/**
 * Tests for lib/nurture/segments.ts
 *
 * Uses a fully mocked PrismaClient to verify that each segment query applies
 * the correct filters (unsubscribed, verified, paid exclusion, cadence, etc.).
 * No real database connection is used.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  fetchSegment1,
  fetchSegment2,
  fetchSegment3,
  fetchSegment4,
} from "../../lib/nurture/segments";

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

/** Build a minimal mocked PrismaClient with a user.findMany stub. */
function makePrisma(findManyResult: unknown[]): PrismaClient {
  return {
    user: {
      findMany: vi.fn().mockResolvedValue(findManyResult),
    },
  } as unknown as PrismaClient;
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "alice@example.com",
    profile: { displayName: "Alice Test" },
    conversations: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Segment 1
// ---------------------------------------------------------------------------

describe("fetchSegment1", () => {
  it("returns eligible users mapped to EligibleUser shape", async () => {
    const prisma = makePrisma([makeUser()]);
    const result = await fetchSegment1(prisma);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: "user-1",
      email: "alice@example.com",
      displayName: "Alice Test",
      characterId: null,
      characterName: null,
    });
  });

  it("passes correct where clause (unsubscribedAt null, emailVerifiedAt not null, free, no onboarding)", async () => {
    const prisma = makePrisma([]);
    await fetchSegment1(prisma);

    const findMany = (prisma.user.findMany as ReturnType<typeof vi.fn>);
    const where = findMany.mock.calls[0][0].where;

    expect(where.completedOnboardingAt).toBe(null);
    expect(where.subscriptionTier).toBe("free");
    expect(where.unsubscribedAt).toBe(null);
    expect(where.emailVerifiedAt).toEqual({ not: null });
  });

  it("returns empty array when no eligible users", async () => {
    const prisma = makePrisma([]);
    const result = await fetchSegment1(prisma);
    expect(result).toHaveLength(0);
  });

  it("handles user with no profile (displayName null)", async () => {
    const prisma = makePrisma([makeUser({ profile: null })]);
    const result = await fetchSegment1(prisma);
    expect(result[0].displayName).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Segment 2
// ---------------------------------------------------------------------------

describe("fetchSegment2", () => {
  it("returns eligible users", async () => {
    const prisma = makePrisma([makeUser()]);
    const result = await fetchSegment2(prisma);
    expect(result).toHaveLength(1);
  });

  it("where clause excludes users with any real conversation", async () => {
    const prisma = makePrisma([]);
    await fetchSegment2(prisma);

    const findMany = (prisma.user.findMany as ReturnType<typeof vi.fn>);
    const where = findMany.mock.calls[0][0].where;

    expect(where.completedOnboardingAt).toEqual({ not: null });
    expect(where.subscriptionTier).toBe("free");
    expect(where.conversations).toEqual({ none: { messageCount: { gt: 0 } } });
    expect(where.unsubscribedAt).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// Segment 3
// ---------------------------------------------------------------------------

describe("fetchSegment3", () => {
  it("excludes users who chatted within the lapsed threshold", async () => {
    // User's latest conversation has a very recent lastMessageAt (within 2 days).
    const recentUser = makeUser({
      conversations: [
        {
          characterId: "char-1",
          lastMessageAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
          character: { name: "Luna" },
        },
      ],
    });
    const prisma = makePrisma([recentUser]);
    const result = await fetchSegment3(prisma, 2);

    // Should be filtered out (chatted within 2 days).
    expect(result).toHaveLength(0);
  });

  it("includes users who have not chatted in more than lapsedDays", async () => {
    const lapsedUser = makeUser({
      id: "user-lapsed",
      email: "lapsed@example.com",
      conversations: [
        {
          characterId: "char-2",
          lastMessageAt: new Date(Date.now() - 5 * 86_400_000), // 5 days ago
          character: { name: "Zara" },
        },
      ],
    });
    const prisma = makePrisma([lapsedUser]);
    const result = await fetchSegment3(prisma, 2);

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("user-lapsed");
    expect(result[0].characterId).toBe("char-2");
    expect(result[0].characterName).toBe("Zara");
  });

  it("excludes users with no conversations", async () => {
    const noConvoUser = makeUser({ conversations: [] });
    const prisma = makePrisma([noConvoUser]);
    const result = await fetchSegment3(prisma, 2);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Segment 4
// ---------------------------------------------------------------------------

describe("fetchSegment4", () => {
  it("suppresses users who chatted in the last 24h", async () => {
    const activeUser = makeUser({
      id: "user-active",
      conversations: [
        {
          characterId: "char-3",
          lastMessageAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          character: { name: "Nyx" },
        },
      ],
    });
    const prisma = makePrisma([activeUser]);
    const result = await fetchSegment4(prisma, 24);
    expect(result).toHaveLength(0);
  });

  it("includes paid users who haven't chatted in 24h", async () => {
    const paidUser = makeUser({
      id: "user-paid",
      email: "paid@example.com",
      conversations: [
        {
          characterId: "char-4",
          lastMessageAt: new Date(Date.now() - 2 * 86_400_000), // 2 days ago
          character: { name: "Iris" },
        },
      ],
    });
    const prisma = makePrisma([paidUser]);
    const result = await fetchSegment4(prisma, 24);

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("user-paid");
  });

  it("where clause does NOT filter by subscriptionTier=free (segment 4 is paid)", async () => {
    const prisma = makePrisma([]);
    await fetchSegment4(prisma, 24);

    const findMany = (prisma.user.findMany as ReturnType<typeof vi.fn>);
    const where = findMany.mock.calls[0][0].where;

    // Segment 4 targets non-free users.
    expect(where.subscriptionTier).toEqual({ not: "free" });
  });

  it("includes users with no conversations (paid, never chatted)", async () => {
    const noConvoUser = makeUser({ id: "u-nochat", email: "paid-nochat@example.com", conversations: [] });
    const prisma = makePrisma([noConvoUser]);
    const result = await fetchSegment4(prisma, 24);
    // No conversations means no lastMessageAt: should be included.
    expect(result).toHaveLength(1);
  });
});
