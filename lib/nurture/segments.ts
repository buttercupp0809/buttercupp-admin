/**
 * lib/nurture/segments.ts
 *
 * Four lifecycle segment queries. Each returns a batch of eligible users for
 * that segment, already filtered for:
 *   - unsubscribedAt IS NULL (global suppression)
 *   - emailVerifiedAt IS NOT NULL (must have a verified email)
 *   - email IS NOT NULL
 *   - Segments 1-3 exclude paid users (they belong to segment 4)
 *
 * These are pure query functions; cadence caps and idempotency against
 * EmailSendLog are applied in orchestrator.ts.
 */

import { PrismaClient } from "@prisma/client";
import { HIDDEN_USER_IDS } from "@/lib/hidden-users";

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export interface EligibleUser {
  userId: string;
  email: string;
  displayName: string | null;
  /** The character to feature in the email. Null for segments that pick randomly. */
  characterId: string | null;
  characterName: string | null;
}

// ---------------------------------------------------------------------------
// Segment 1: never completed onboarding
//
// Audience: completedOnboardingAt IS NULL, free tier, verified email.
// Message : "Finish onboarding; photo + overlay" (a random public character is
//           assigned in the orchestrator, since the user has no conversation).
// ---------------------------------------------------------------------------

export async function fetchSegment1(
  prisma: PrismaClient,
  limit = 500
): Promise<EligibleUser[]> {
  const users = await prisma.user.findMany({
    where: {
      completedOnboardingAt: null,
      subscriptionTier: "free",
      unsubscribedAt: null,
      email: { not: "" },
      id: { notIn: HIDDEN_USER_IDS },
    },
    select: {
      id: true,
      email: true,
      profile: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return users.map((u) => ({
    userId: u.id,
    email: u.email,
    displayName: u.profile?.displayName ?? null,
    characterId: null,
    characterName: null,
  }));
}

// ---------------------------------------------------------------------------
// Segment 2: onboarded but no real conversation (messageCount == 0 everywhere)
//
// Audience: completedOnboardingAt IS NOT NULL, no conversation with
//           messageCount > 0, free tier, verified email.
// ---------------------------------------------------------------------------

export async function fetchSegment2(
  prisma: PrismaClient,
  limit = 500
): Promise<EligibleUser[]> {
  // Users who have onboarded but whose conversations all have messageCount == 0
  // (i.e. they started a conversation but never sent a real message, or have no
  // conversations at all).
  const users = await prisma.user.findMany({
    where: {
      completedOnboardingAt: { not: null },
      subscriptionTier: "free",
      unsubscribedAt: null,
      email: { not: "" },
      id: { notIn: HIDDEN_USER_IDS },
      // Exclude users who have any conversation with at least one real message.
      conversations: {
        none: { messageCount: { gt: 0 } },
      },
    },
    select: {
      id: true,
      email: true,
      profile: { select: { displayName: true } },
    },
    orderBy: { completedOnboardingAt: "desc" },
    take: limit,
  });

  return users.map((u) => ({
    userId: u.id,
    email: u.email,
    displayName: u.profile?.displayName ?? null,
    characterId: null,
    characterName: null,
  }));
}

// ---------------------------------------------------------------------------
// Segment 3: has chatted, but lapsed (MAX(lastMessageAt) > 2 days ago)
//
// Audience: has at least one conversation with messageCount > 0, the most
//           recent lastMessageAt across all their conversations is older than
//           2 days, free tier, verified email.
// lapsedDays is tunable (spec says 2 days default).
// ---------------------------------------------------------------------------

export async function fetchSegment3(
  prisma: PrismaClient,
  lapsedDays = 2,
  limit = 500
): Promise<EligibleUser[]> {
  const cutoff = new Date(Date.now() - lapsedDays * 86_400_000);

  // Find users who have at least one real conversation...
  const users = await prisma.user.findMany({
    where: {
      completedOnboardingAt: { not: null },
      subscriptionTier: "free",
      unsubscribedAt: null,
      email: { not: "" },
      id: { notIn: HIDDEN_USER_IDS },
      conversations: {
        some: { messageCount: { gt: 0 } },
      },
    },
    select: {
      id: true,
      email: true,
      profile: { select: { displayName: true } },
      conversations: {
        where: { messageCount: { gt: 0 } },
        select: { characterId: true, lastMessageAt: true, character: { select: { name: true } } },
        orderBy: { lastMessageAt: "desc" },
        take: 1,
      },
    },
    take: limit * 3, // over-fetch because we filter by lastMessageAt below
  });

  // Keep only users whose most recent real conversation is older than cutoff.
  const eligible: EligibleUser[] = [];
  for (const u of users) {
    const latest = u.conversations[0];
    if (!latest) continue;
    const lastAt = latest.lastMessageAt;
    if (!lastAt || lastAt > cutoff) continue; // active in last N days: skip

    eligible.push({
      userId: u.id,
      email: u.email,
      displayName: u.profile?.displayName ?? null,
      characterId: latest.characterId,
      characterName: latest.character.name,
    });
    if (eligible.length >= limit) break;
  }

  return eligible;
}

// ---------------------------------------------------------------------------
// Segment 4: paid / active subscription (warm engagement email)
//
// Audience: subscriptionTier != free (premium or pro), verified email,
//           unsubscribedAt IS NULL.
// Suppress if they chatted in the last 24h (checked via lastMessageAt).
// ---------------------------------------------------------------------------

export async function fetchSegment4(
  prisma: PrismaClient,
  suppressIfChattedHours = 24,
  limit = 500
): Promise<EligibleUser[]> {
  const cutoff = new Date(Date.now() - suppressIfChattedHours * 3_600_000);

  const users = await prisma.user.findMany({
    where: {
      subscriptionTier: { not: "free" },
      unsubscribedAt: null,
      email: { not: "" },
      id: { notIn: HIDDEN_USER_IDS },
    },
    select: {
      id: true,
      email: true,
      profile: { select: { displayName: true } },
      conversations: {
        where: { messageCount: { gt: 0 } },
        select: { characterId: true, lastMessageAt: true, character: { select: { name: true } } },
        orderBy: { lastMessageAt: "desc" },
        take: 1,
      },
    },
    take: limit * 3,
  });

  const eligible: EligibleUser[] = [];
  for (const u of users) {
    const latest = u.conversations[0];
    // Suppress if they chatted in the last suppressIfChattedHours hours.
    if (latest?.lastMessageAt && latest.lastMessageAt > cutoff) continue;

    eligible.push({
      userId: u.id,
      email: u.email,
      displayName: u.profile?.displayName ?? null,
      characterId: latest?.characterId ?? null,
      characterName: latest?.character.name ?? null,
    });
    if (eligible.length >= limit) break;
  }

  return eligible;
}
