import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Prompt 5.4 STEP 3: instant global revert to control, no deploy. Flips every
// rule to status="off" in one shot (leaves matchCampaigns/arms intact so
// rules can be safely turned back on later without re-entering config).
export async function POST() {
  const result = await prisma.paywallRule.updateMany({
    where: { status: { not: "off" } },
    data: { status: "off", version: { increment: 1 } },
  });

  return NextResponse.json({ updated: result.count });
}
