/**
 * Tests for app/api/cron/nurture/route.ts
 *
 * Verifies:
 *   - Missing/incorrect CRON_SECRET => 401.
 *   - No dryRun param => orchestrator invoked with dryRun=true (send nothing).
 *   - ?dryRun=1 => dryRun=true.
 *   - ?dryRun=0 => dryRun=false (live send opt-in).
 *   - ?dryRun=false => dryRun=false.
 *   - ?segment=N passes through; invalid segment => 400.
 *
 * The orchestrator is mocked so no DB / Brevo calls happen.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.mock factories are hoisted above imports, so the mock fn must be created
// via vi.hoisted() to be available inside the factory.
const { runNurturePipelineMock } = vi.hoisted(() => ({
  runNurturePipelineMock: vi.fn().mockResolvedValue({
    dryRun: true,
    totalSent: 0,
    totalFailed: 0,
    segments: [],
    cappedByDailyCeiling: false,
  }),
}));

vi.mock("../../lib/nurture/orchestrator", () => ({
  runNurturePipeline: runNurturePipelineMock,
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {},
}));

import { GET } from "../../app/api/cron/nurture/route";

// ---------------------------------------------------------------------------
// Helper: build a minimal NextRequest-like object.
// The route only uses req.headers.get() and req.nextUrl.searchParams.get().
// ---------------------------------------------------------------------------

function makeReq(url: string, authHeader?: string) {
  const nextUrl = new URL(url);
  return {
    headers: {
      get: (k: string) =>
        k.toLowerCase() === "authorization" ? authHeader ?? null : null,
    },
    nextUrl,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const CRON_SECRET = "test-cron-secret";
const AUTH = `Bearer ${CRON_SECRET}`;
const BASE = "https://admin.buttercupp.fun/api/cron/nurture";

describe("GET /api/cron/nurture", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
    runNurturePipelineMock.mockClear();
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const res = await GET(makeReq(BASE));
    expect(res.status).toBe(401);
    expect(runNurturePipelineMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the secret does not match", async () => {
    const res = await GET(makeReq(BASE, "Bearer wrong-secret"));
    expect(res.status).toBe(401);
    expect(runNurturePipelineMock).not.toHaveBeenCalled();
  });

  it("defaults to dry-run when no dryRun param is present (sends nothing)", async () => {
    const res = await GET(makeReq(BASE, AUTH));
    expect(res.status).toBe(200);
    expect(runNurturePipelineMock).toHaveBeenCalledOnce();
    const opts = runNurturePipelineMock.mock.calls[0][1];
    expect(opts.dryRun).toBe(true);
  });

  it("treats ?dryRun=1 as dry-run", async () => {
    await GET(makeReq(`${BASE}?dryRun=1`, AUTH));
    const opts = runNurturePipelineMock.mock.calls[0][1];
    expect(opts.dryRun).toBe(true);
  });

  it("treats ?dryRun=0 as a LIVE send (explicit opt-in)", async () => {
    await GET(makeReq(`${BASE}?dryRun=0`, AUTH));
    const opts = runNurturePipelineMock.mock.calls[0][1];
    expect(opts.dryRun).toBe(false);
  });

  it("treats ?dryRun=false as a LIVE send", async () => {
    await GET(makeReq(`${BASE}?dryRun=false`, AUTH));
    const opts = runNurturePipelineMock.mock.calls[0][1];
    expect(opts.dryRun).toBe(false);
  });

  it("passes segment through when valid", async () => {
    await GET(makeReq(`${BASE}?segment=3`, AUTH));
    const opts = runNurturePipelineMock.mock.calls[0][1];
    expect(opts.segment).toBe(3);
    expect(opts.dryRun).toBe(true); // still defaults to dry-run
  });

  it("returns 400 for an out-of-range segment", async () => {
    const res = await GET(makeReq(`${BASE}?segment=9`, AUTH));
    expect(res.status).toBe(400);
    expect(runNurturePipelineMock).not.toHaveBeenCalled();
  });
});
