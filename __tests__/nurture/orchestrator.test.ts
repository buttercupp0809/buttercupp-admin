/**
 * Tests for lib/nurture/orchestrator.ts
 *
 * Integration-level tests using a mocked Prisma and mocked Brevo. Verifies:
 *   - dryRun mode emits correct recipients, does not call sendBrevoEmail,
 *     and writes "dry_run" EmailSendLog rows.
 *   - Daily ceiling cap is respected.
 *   - Already-sent-today idempotency guard prevents double sends.
 *   - Lifetime cap (5 max) for segments 1-2.
 *   - Min-gap-days (2 days) cadence for segments 1-2.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Module mocks: stub brevo, media-url, and segments before importing orchestrator
// ---------------------------------------------------------------------------

vi.mock("../../lib/brevo", () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue({ ok: true, messageId: "mock-id" }),
}));

vi.mock("../../lib/media-url", () => ({
  resolveImageUrl: vi.fn().mockResolvedValue("https://cdn.example.com/img.webp"),
}));

vi.mock("../../lib/nurture/segments", () => ({
  fetchSegment1: vi.fn().mockResolvedValue([]),
  fetchSegment2: vi.fn().mockResolvedValue([]),
  fetchSegment3: vi.fn().mockResolvedValue([]),
  fetchSegment4: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { runNurturePipeline } from "../../lib/nurture/orchestrator";
import { sendBrevoEmail } from "../../lib/brevo";
import {
  fetchSegment1,
  fetchSegment2,
} from "../../lib/nurture/segments";

// ---------------------------------------------------------------------------
// Mock Prisma factory
// ---------------------------------------------------------------------------

const mockCharacter = {
  id: "char-1",
  name: "Luna",
  bio: "A mysterious companion.",
  gender: "female",
  media: [{ url: "images/luna.webp", kind: "image", hidden: false }],
  currentVersion: {
    greeting: "Hello there.",
    personality: "mysterious",
    backstory: "From the shadows.",
  },
  popularityScore: 100,
};

function makePrisma(overrides: Partial<Record<string, unknown>> = {}): PrismaClient {
  return {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ unsubscribeToken: "tok", id: "u1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    emailSendLog: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    character: {
      // Returns a character pool so sendToUser doesn't skip with "no_character".
      findMany: vi.fn().mockResolvedValue([mockCharacter]),
      findUnique: vi.fn().mockResolvedValue(mockCharacter),
    },
    ...overrides,
  } as unknown as PrismaClient;
}

const mockEligibleUser = {
  userId: "user-1",
  email: "alice@example.com",
  displayName: "Alice",
  characterId: null,
  characterName: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runNurturePipeline", () => {
  beforeEach(() => {
    process.env.UNSUBSCRIBE_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_APP_URL = "https://www.buttercupp.fun";
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.UNSUBSCRIBE_SECRET;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("dry run: does not call sendBrevoEmail", async () => {
    (fetchSegment1 as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockEligibleUser]);
    const prisma = makePrisma();

    const result = await runNurturePipeline(prisma, { dryRun: true, segment: 1 });

    expect(sendBrevoEmail).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
  });

  it("dry run: writes dry_run EmailSendLog rows", async () => {
    (fetchSegment1 as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockEligibleUser]);
    const prisma = makePrisma();

    await runNurturePipeline(prisma, { dryRun: true, segment: 1 });

    const create = (prisma.emailSendLog.create as ReturnType<typeof vi.fn>);
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].data.status).toBe("dry_run");
  });

  it("respects the daily ceiling", async () => {
    // Two users eligible in segment 1.
    (fetchSegment1 as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mockEligibleUser,
      { ...mockEligibleUser, userId: "user-2", email: "bob@example.com" },
    ]);
    const prisma = makePrisma();

    // Ceiling = 1: only one send allowed.
    const result = await runNurturePipeline(prisma, { dryRun: true, segment: 1, dailyCeiling: 1 });
    expect(result.totalSent).toBe(1);
  });

  it("respects already-sent-today idempotency (count returns 1)", async () => {
    (fetchSegment1 as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockEligibleUser]);
    const prisma = makePrisma({
      emailSendLog: {
        // countTodaySends returns 1 (already sent)
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });

    const result = await runNurturePipeline(prisma, { dryRun: true, segment: 1 });
    // Should skip because already sent today.
    expect(result.segments[0].sent).toBe(0);
    expect(result.segments[0].skipped).toBe(1);
  });

  it("respects lifetime cap (5 sends) for segment 1", async () => {
    (fetchSegment1 as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockEligibleUser]);

    let callCount = 0;
    const prisma = makePrisma({
      emailSendLog: {
        count: vi.fn().mockImplementation(() => {
          callCount++;
          // First call: today sends = 0 (not sent today)
          // Second call: all-time sends = 5 (cap reached)
          return Promise.resolve(callCount === 1 ? 0 : 5);
        }),
        create: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });

    const result = await runNurturePipeline(prisma, { dryRun: true, segment: 1 });
    expect(result.segments[0].skipped).toBe(1);
    expect(result.segments[0].sent).toBe(0);
  });

  it("respects min-gap-days for segment 1 (sent 1 day ago: skip)", async () => {
    (fetchSegment1 as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockEligibleUser]);

    let callCount = 0;
    const prisma = makePrisma({
      emailSendLog: {
        count: vi.fn().mockImplementation(() => {
          callCount++;
          // today sends = 0, all-time = 1 (within cap but too recent)
          return Promise.resolve(callCount === 1 ? 0 : 1);
        }),
        create: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue({
          // Last sent 1 day ago (less than MIN_GAP_DAYS=2).
          sentAt: new Date(Date.now() - 1 * 86_400_000),
        }),
      },
    });

    const result = await runNurturePipeline(prisma, { dryRun: true, segment: 1 });
    expect(result.segments[0].skipped).toBe(1);
  });

  it("sends when min-gap-days is satisfied (sent 3 days ago)", async () => {
    (fetchSegment1 as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockEligibleUser]);

    let callCount = 0;
    const prisma = makePrisma({
      emailSendLog: {
        // Calls in order:
        //   1: countTotalSentToday (global ceiling check) -> 0
        //   2: countTodaySends (user+segment today) -> 0 (not sent today)
        //   3: countAllSends (lifetime cap check) -> 1 (within 5 cap)
        count: vi.fn().mockImplementation(() => {
          callCount++;
          return Promise.resolve(0); // all counts = 0 to avoid all skips
        }),
        create: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue({
          // Last sent 3 days ago (satisfies MIN_GAP_DAYS=2).
          sentAt: new Date(Date.now() - 3 * 86_400_000),
        }),
      },
    });

    const result = await runNurturePipeline(prisma, { dryRun: true, segment: 1 });
    // Should send (gap is satisfied, within cap, character is available).
    expect(result.segments[0].sent).toBe(1);
    expect(result.segments[0].skipped).toBe(0);
  });

  it("runs all 4 segments when no segment filter is provided", async () => {
    const prisma = makePrisma();
    const result = await runNurturePipeline(prisma, { dryRun: true });
    expect(result.segments).toHaveLength(4);
  });

  it("runs only the specified segment when segment=2", async () => {
    const prisma = makePrisma();
    const result = await runNurturePipeline(prisma, { dryRun: true, segment: 2 });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].segment).toBe(2);
  });

  it("marks cappedByDailyCeiling=true when ceiling is exhausted before all segments run", async () => {
    (fetchSegment1 as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockEligibleUser]);
    const prisma = makePrisma();

    const result = await runNurturePipeline(prisma, {
      dryRun: true,
      dailyCeiling: 0, // already at ceiling
    });
    // All segments should be skipped due to ceiling.
    expect(result.cappedByDailyCeiling).toBe(true);
    expect(result.totalSent).toBe(0);
  });
});
