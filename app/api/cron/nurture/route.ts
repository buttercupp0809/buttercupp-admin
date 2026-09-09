/**
 * app/api/cron/nurture/route.ts
 *
 * CRON_SECRET-guarded endpoint that triggers the email nurture pipeline.
 *
 * Authentication: Bearer token in Authorization header must match CRON_SECRET
 * env var. Requests without a matching secret receive 401.
 *
 * Query parameters:
 *   dryRun          Dry-run is the DEFAULT and cannot be triggered by accident.
 *                   With no dryRun param (or ?dryRun=1) the pipeline simulates:
 *                   it logs intended recipients and writes "dry_run" rows but
 *                   sends nothing. To actually send live email the caller must
 *                   pass an explicit ?dryRun=0 (or ?dryRun=false). A plain call
 *                   to /api/cron/nurture is always a safe dry-run.
 *   ?segment=N      Run only segment N (1-4). Omit to run all four segments.
 *
 * Response: JSON summary of what was (or would be) sent.
 *
 * Scheduling: this endpoint is scheduler-agnostic. Wire it to an AWS
 * EventBridge Scheduler rule or a GitHub Actions cron that curls the URL with
 * the Authorization header. The live schedule MUST pass ?dryRun=0 to actually
 * send; without it every run is a no-op dry-run. The live schedule is a
 * separate, explicitly-approved deploy step (see spec).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runNurturePipeline } from "@/lib/nurture/orchestrator";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes (Next.js Fluid compute / Pro plan)

// ---------------------------------------------------------------------------
// Input schema (query params)
// ---------------------------------------------------------------------------

const QuerySchema = z.object({
  // Dry-run defaults to TRUE. Only an explicit ?dryRun=0 (or ?dryRun=false)
  // switches to a live send. Absent param => dry-run (send nothing).
  dryRun: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v !== "0" && v !== "false"),
  segment: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const n = parseInt(v, 10);
      return isNaN(n) ? undefined : n;
    })
    .refine((v) => v === undefined || (v >= 1 && v <= 4), {
      message: "segment must be 1, 2, 3, or 4",
    }),
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Authentication: CRON_SECRET must be present and must match.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const providedSecret = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate query params.
  const raw = {
    dryRun: req.nextUrl.searchParams.get("dryRun") ?? undefined,
    segment: req.nextUrl.searchParams.get("segment") ?? undefined,
  };

  const parsed = QuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // dryRun defaults to true when the param is absent (safe: send nothing).
  const { dryRun = true, segment } = parsed.data;

  try {
    const result = await runNurturePipeline(prisma, { dryRun, segment });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[nurture-cron] fatal error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
