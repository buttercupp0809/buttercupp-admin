/**
 * lib/nurture/orchestrator.ts
 *
 * Main entry point for the email nurture pipeline.
 *
 * For each segment it:
 *   1. Queries eligible users (segments.ts).
 *   2. Applies cadence caps and suppression via EmailSendLog.
 *   3. Renders the overlay email (copy.ts).
 *   4. Sends via Brevo (brevo.ts), with 1.1s inter-send spacing.
 *   5. Writes an EmailSendLog row (status "sent" or "dry_run").
 *   6. Stops when the global daily ceiling is reached.
 *
 * Key constants (all tunable):
 *   DAILY_CEILING   = 250 emails/day (protects the Brevo 300/day free quota)
 *   SEND_GAP_MS     = 1 100 ms between sends (reuses proven nudge-email throttle)
 *   MAX_PER_SEGMENT = 5 emails per user for segments 1 and 2
 *   MIN_GAP_DAYS    = 2 days between consecutive sends (segments 1 and 2)
 */

import { PrismaClient } from "@prisma/client";
import { sendBrevoEmail } from "@/lib/brevo";
import { resolveImageUrl } from "@/lib/media-url";
import {
  fetchSegment1,
  fetchSegment2,
  fetchSegment3,
  fetchSegment4,
  type EligibleUser,
} from "./segments";
import {
  buildSeg1Copy,
  buildSeg2Copy,
  buildSeg3Copy,
  buildSeg4Copy,
  renderOverlayEmail,
  buildLogoInlineImage,
  type CharCtx,
} from "./copy";
import { generateUnsubscribeToken } from "./token";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAILY_CEILING = 250;
const SEND_GAP_MS = 1_100;
const MAX_PER_SEGMENT_1_2 = 5;
const MIN_GAP_DAYS_1_2 = 2;
const LAPSED_DAYS_SEG3 = 2;
const SEG4_SUPPRESS_HOURS = 24;

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://www.buttercupp.fun"
).replace(/\/$/, "");
const ADMIN_URL = (
  process.env.NEXT_PUBLIC_ADMIN_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.buttercupp.fun"
).replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrchestratorOptions {
  dryRun?: boolean;
  /** Run only this segment (1-4). If omitted all four are run. */
  segment?: number;
  /** Override the global daily ceiling (useful for tests). */
  dailyCeiling?: number;
  /**
   * Test override: send the selected segment's rendered email to THIS address
   * only, bypassing eligibility, cadence caps, suppression, and EmailSendLog.
   * No real user is required and no analytics row is written. Still honors
   * dryRun (dryRun => render but do not send). Pair with `segment` to preview
   * one template; omit `segment` to send all four to the address.
   */
  testTo?: string;
}

export interface SegmentSummary {
  segment: number;
  eligible: number;
  skipped: number;
  sent: number;
  failed: number;
}

export interface OrchestratorResult {
  dryRun: boolean;
  totalSent: number;
  totalFailed: number;
  segments: SegmentSummary[];
  cappedByDailyCeiling: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function todayStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function todayEnd(): Date {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** Count sends already logged for this user+segment today. */
async function countTodaySends(
  prisma: PrismaClient,
  userId: string,
  segment: number
): Promise<number> {
  return prisma.emailSendLog.count({
    where: {
      userId,
      segment,
      sentAt: { gte: todayStart(), lte: todayEnd() },
      status: "sent",
    },
  });
}

/** Count total sends ever for this user+segment (cadence cap for segs 1-2). */
async function countAllSends(
  prisma: PrismaClient,
  userId: string,
  segment: number
): Promise<number> {
  return prisma.emailSendLog.count({
    where: { userId, segment, status: "sent" },
  });
}

/** Date of the most recent send for this user+segment. */
async function lastSentAt(
  prisma: PrismaClient,
  userId: string,
  segment: number
): Promise<Date | null> {
  const row = await prisma.emailSendLog.findFirst({
    where: { userId, segment, status: "sent" },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  return row?.sentAt ?? null;
}

/** Count total sent today across ALL segments (global daily ceiling). */
async function countTotalSentToday(prisma: PrismaClient): Promise<number> {
  return prisma.emailSendLog.count({
    where: { sentAt: { gte: todayStart() }, status: "sent" },
  });
}

/** Fetch a random public character with an image, for segment 1/2 assignments. */
async function fetchRandomCharacter(prisma: PrismaClient): Promise<{
  id: string;
  name: string;
  bio: string;
  gender: string;
  greeting: string;
  personality: string;
  backstory: string;
  imageKey: string | null;
} | null> {
  const chars = await prisma.character.findMany({
    where: {
      visibility: "public",
      moderationStatus: "approved",
      currentVersionId: { not: null },
      media: { some: { kind: "image", hidden: false } },
    },
    include: {
      media: {
        where: { kind: "image", hidden: false },
        orderBy: [{ isDisplay: "desc" }, { isPrimary: "desc" }, { sort: "asc" }],
        take: 1,
      },
      currentVersion: {
        select: { personality: true, backstory: true, greeting: true },
      },
    },
    orderBy: { popularityScore: "desc" },
    take: 100,
  });

  const withImage = chars.filter((c) => c.media.length > 0 && c.currentVersion);
  if (withImage.length === 0) return null;

  const picked = withImage[Math.floor(Math.random() * withImage.length)];
  return {
    id: picked.id,
    name: picked.name,
    bio: picked.bio,
    gender: picked.gender,
    greeting: picked.currentVersion?.greeting ?? "",
    personality: picked.currentVersion?.personality ?? "",
    backstory: picked.currentVersion?.backstory ?? "",
    imageKey: picked.media[0]?.url ?? null,
  };
}

/** Fetch character details by ID for segments 3 and 4. */
async function fetchCharacter(
  prisma: PrismaClient,
  characterId: string
): Promise<{
  id: string;
  name: string;
  bio: string;
  gender: string;
  greeting: string;
  personality: string;
  backstory: string;
  imageKey: string | null;
} | null> {
  const char = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      media: {
        where: { kind: "image", hidden: false },
        orderBy: [{ isDisplay: "desc" }, { isPrimary: "desc" }, { sort: "asc" }],
        take: 1,
      },
      currentVersion: {
        select: { personality: true, backstory: true, greeting: true },
      },
    },
  });

  if (!char || !char.currentVersion) return null;
  return {
    id: char.id,
    name: char.name,
    bio: char.bio,
    gender: char.gender,
    greeting: char.currentVersion.greeting,
    personality: char.currentVersion.personality,
    backstory: char.currentVersion.backstory,
    imageKey: char.media[0]?.url ?? null,
  };
}

/** Get or mint the user's unsubscribe token. */
async function ensureUnsubscribeToken(
  prisma: PrismaClient,
  userId: string
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { unsubscribeToken: true },
  });
  if (user?.unsubscribeToken) return user.unsubscribeToken;

  const token = generateUnsubscribeToken(userId);
  await prisma.user.update({
    where: { id: userId },
    data: { unsubscribeToken: token },
  });
  return token;
}

// ---------------------------------------------------------------------------
// Per-user send logic
// ---------------------------------------------------------------------------

async function sendToUser(
  prisma: PrismaClient,
  user: EligibleUser,
  segment: number,
  campaign: string,
  buildCopyFn: (char: CharCtx, firstName: string) => ReturnType<typeof buildSeg1Copy>,
  ctaPath: string,
  dryRun: boolean,
  appendCharId?: boolean
): Promise<{ skipped: boolean; ok: boolean; reason?: string }> {
  // Idempotency: already sent today for this segment.
  const sentToday = await countTodaySends(prisma, user.userId, segment);
  if (sentToday > 0) {
    return { skipped: true, ok: false, reason: "already_sent_today" };
  }

  // Segments 1-2: lifetime cap and minimum gap.
  if (segment <= 2) {
    const totalSent = await countAllSends(prisma, user.userId, segment);
    if (totalSent >= MAX_PER_SEGMENT_1_2) {
      return { skipped: true, ok: false, reason: "lifetime_cap_reached" };
    }
    const last = await lastSentAt(prisma, user.userId, segment);
    if (last) {
      const daysSince = (Date.now() - last.getTime()) / 86_400_000;
      if (daysSince < MIN_GAP_DAYS_1_2) {
        return { skipped: true, ok: false, reason: "too_soon" };
      }
    }
  }

  // Resolve character.
  let charData = user.characterId
    ? await fetchCharacter(prisma, user.characterId)
    : await fetchRandomCharacter(prisma);

  if (!charData) {
    return { skipped: true, ok: false, reason: "no_character" };
  }

  const imageUrl = await resolveImageUrl(charData.imageKey);

  const char: CharCtx = {
    name: charData.name,
    bio: charData.bio,
    gender: charData.gender,
    greeting: charData.greeting,
    personality: charData.personality,
    backstory: charData.backstory,
    imageUrl,
  };

  const firstName =
    user.displayName?.split(" ")[0] ?? user.email.split("@")[0];
  const copy = buildCopyFn(char, firstName);
  const ctaUrl = `${APP_URL}${ctaPath}${appendCharId !== false ? charData.id : ""}`;

  // Unsubscribe token and URL.
  const token = await ensureUnsubscribeToken(prisma, user.userId);
  const unsubscribeUrl = `${ADMIN_URL}/api/unsubscribe?token=${encodeURIComponent(token)}`;

  // Header brand logo: attach the PNG inline (CID) when available so the header
  // shows the real mark. If the PNG can't be read, buildLogoInlineImage returns
  // null and renderOverlayEmail falls back to the text wordmark (no broken img).
  const logoInline = buildLogoInlineImage();

  const html = renderOverlayEmail({
    char,
    copy,
    ctaUrl,
    recipientEmail: user.email,
    unsubscribeUrl,
    inlineLogo: logoInline !== null,
  });

  if (dryRun) {
    // Persist a "dry_run" audit row so a dry-run reports exactly which
    // recipients it would have targeted. NOTE: this row does NOT consume the
    // persistent daily ceiling: countTotalSentToday() counts only status="sent"
    // rows. Ceiling accounting within a single dry-run pass is in-memory only
    // (remainingCeiling is decremented by the in-run sent count), so a dry-run
    // simulates the ceiling for this pass without affecting a later live run.
    await prisma.emailSendLog.create({
      data: {
        userId: user.userId,
        segment,
        campaign,
        provider: "brevo",
        providerMessageId: null,
        status: "dry_run",
      },
    });
    return { skipped: false, ok: true };
  }

  const result = await sendBrevoEmail({
    to: user.email,
    fromName: char.name,
    subject: copy.subject,
    html,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: [`segment-${segment}`, campaign],
    ...(logoInline ? { inlineImages: [logoInline] } : {}),
  });

  await prisma.emailSendLog.create({
    data: {
      userId: user.userId,
      segment,
      campaign,
      provider: "brevo",
      providerMessageId: result.messageId ?? null,
      status: result.ok ? "sent" : "failed",
    },
  });

  return { skipped: false, ok: result.ok, reason: result.error };
}

// ---------------------------------------------------------------------------
// Segment runner
// ---------------------------------------------------------------------------

interface SegmentConfig {
  segment: number;
  campaign: string;
  ctaPath: string;
  /** When false, charData.id is NOT appended to ctaPath (e.g. Seg1 /onboarding has no char). */
  appendCharId?: boolean;
  buildCopyFn: (char: CharCtx, firstName: string) => ReturnType<typeof buildSeg1Copy>;
  fetchFn: (prisma: PrismaClient) => Promise<EligibleUser[]>;
}

async function runSegment(
  prisma: PrismaClient,
  config: SegmentConfig,
  dryRun: boolean,
  remainingCeiling: number
): Promise<SegmentSummary & { remaining: number }> {
  const users = await config.fetchFn(prisma);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const user of users) {
    if (remaining(remainingCeiling, sent) <= 0) break;

    const result = await sendToUser(
      prisma,
      user,
      config.segment,
      config.campaign,
      config.buildCopyFn,
      config.ctaPath,
      dryRun,
      config.appendCharId
    );

    if (result.skipped) {
      skipped++;
    } else if (result.ok) {
      sent++;
      if (!dryRun) await sleep(SEND_GAP_MS);
    } else {
      failed++;
    }
  }

  return {
    segment: config.segment,
    eligible: users.length,
    skipped,
    sent,
    failed,
    remaining: remainingCeiling - sent,
  };
}

function remaining(ceiling: number, sent: number): number {
  return ceiling - sent;
}

// ---------------------------------------------------------------------------
// Test send (?to= override)
// ---------------------------------------------------------------------------

/**
 * Render one segment's email and send it to a single arbitrary address for
 * testing. Deliberately does NOT: query eligibility, apply caps/suppression,
 * require a real User row, or write an EmailSendLog row. Uses a random public
 * character for the artwork/voice. Honors dryRun (render only, no send).
 */
async function sendTestToAddress(
  prisma: PrismaClient,
  address: string,
  config: SegmentConfig,
  dryRun: boolean
): Promise<{ skipped: boolean; ok: boolean; reason?: string }> {
  const charData = await fetchRandomCharacter(prisma);
  if (!charData) {
    return { skipped: true, ok: false, reason: "no_character" };
  }

  const imageUrl = await resolveImageUrl(charData.imageKey);
  const char: CharCtx = {
    name: charData.name,
    bio: charData.bio,
    gender: charData.gender,
    greeting: charData.greeting,
    personality: charData.personality,
    backstory: charData.backstory,
    imageUrl,
  };

  const firstName = address.split("@")[0];
  const copy = config.buildCopyFn(char, firstName);
  const ctaUrl = `${APP_URL}${config.ctaPath}${config.appendCharId !== false ? charData.id : ""}`;

  // No real user, so mint a preview-scoped token purely for the link format.
  // (It will not resolve to a user; unsubscribing from a test email is a no-op.)
  const token = generateUnsubscribeToken(`test:${address}`);
  const unsubscribeUrl = `${ADMIN_URL}/api/unsubscribe?token=${encodeURIComponent(token)}`;

  const logoInline = buildLogoInlineImage();
  const html = renderOverlayEmail({
    char,
    copy,
    ctaUrl,
    recipientEmail: address,
    unsubscribeUrl,
    inlineLogo: logoInline !== null,
  });

  if (dryRun) {
    return { skipped: false, ok: true };
  }

  const result = await sendBrevoEmail({
    to: address,
    fromName: char.name,
    subject: `[TEST] ${copy.subject}`,
    html,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: [`segment-${config.segment}`, config.campaign, "test"],
    ...(logoInline ? { inlineImages: [logoInline] } : {}),
  });

  return { skipped: false, ok: result.ok, reason: result.error };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function runNurturePipeline(
  prisma: PrismaClient,
  options: OrchestratorOptions = {}
): Promise<OrchestratorResult> {
  const {
    dryRun = true,
    segment: onlySegment,
    dailyCeiling = DAILY_CEILING,
    testTo,
  } = options;

  // Consume any already-sent quota for today.
  const alreadySentToday = await countTotalSentToday(prisma);
  let remainingCeiling = Math.max(0, dailyCeiling - alreadySentToday);

  const segmentConfigs: SegmentConfig[] = [
    {
      segment: 1,
      campaign: "onboarding-drip",
      ctaPath: "/onboarding",
      appendCharId: false,
      buildCopyFn: (char, firstName) => buildSeg1Copy(char, firstName),
      fetchFn: (p) => fetchSegment1(p),
    },
    {
      segment: 2,
      campaign: "first-chat-nudge",
      ctaPath: "/chat/",
      buildCopyFn: (char, firstName) => buildSeg2Copy(char, firstName),
      fetchFn: (p) => fetchSegment2(p),
    },
    {
      segment: 3,
      campaign: "lapsed-winback",
      ctaPath: "/chat/",
      buildCopyFn: (char, firstName) => buildSeg3Copy(char, firstName),
      fetchFn: (p) => fetchSegment3(p, LAPSED_DAYS_SEG3),
    },
    {
      segment: 4,
      campaign: "paid-engagement",
      ctaPath: "/chat/",
      buildCopyFn: (char, firstName) => buildSeg4Copy(char, firstName),
      fetchFn: (p) => fetchSegment4(p, SEG4_SUPPRESS_HOURS),
    },
  ];

  const activeConfigs = onlySegment
    ? segmentConfigs.filter((c) => c.segment === onlySegment)
    : segmentConfigs;

  // Test override: render + send to a single address only. Bypasses eligibility,
  // caps, suppression, the daily ceiling, and EmailSendLog. Guarded upstream by
  // CRON_SECRET in the route handler.
  if (testTo) {
    const testResults: SegmentSummary[] = [];
    for (const config of activeConfigs) {
      const r = await sendTestToAddress(prisma, testTo, config, dryRun);
      testResults.push({
        segment: config.segment,
        eligible: 1,
        skipped: r.skipped ? 1 : 0,
        sent: !r.skipped && r.ok ? 1 : 0,
        failed: !r.skipped && !r.ok ? 1 : 0,
      });
      if (!r.skipped && r.ok && !dryRun) await sleep(SEND_GAP_MS);
    }
    return {
      dryRun,
      totalSent: testResults.reduce((a, r) => a + r.sent, 0),
      totalFailed: testResults.reduce((a, r) => a + r.failed, 0),
      segments: testResults,
      cappedByDailyCeiling: false,
    };
  }

  const results: SegmentSummary[] = [];
  let capped = false;

  for (const config of activeConfigs) {
    if (remainingCeiling <= 0) {
      capped = true;
      results.push({ segment: config.segment, eligible: 0, skipped: 0, sent: 0, failed: 0 });
      continue;
    }

    const summary = await runSegment(prisma, config, dryRun, remainingCeiling);
    remainingCeiling = summary.remaining;
    results.push({
      segment: summary.segment,
      eligible: summary.eligible,
      skipped: summary.skipped,
      sent: summary.sent,
      failed: summary.failed,
    });
  }

  const totalSent = results.reduce((acc, r) => acc + r.sent, 0);
  const totalFailed = results.reduce((acc, r) => acc + r.failed, 0);

  return {
    dryRun,
    totalSent,
    totalFailed,
    segments: results,
    cappedByDailyCeiling: capped,
  };
}
