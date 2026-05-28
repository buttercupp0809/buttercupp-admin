import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const results = await prisma.usageCounter.aggregate({
    where: { periodStart: { gte: since } },
    _sum: {
      llmMessages: true,
      voiceNotes: true,
      voiceTranscriptions: true,
      imageGens: true,
      imageAnalysis: true,
      aiInitiated: true,
    },
  });

  return NextResponse.json({
    llmMessages: results._sum.llmMessages || 0,
    voiceNotes: results._sum.voiceNotes || 0,
    voiceTranscriptions: results._sum.voiceTranscriptions || 0,
    imageGens: results._sum.imageGens || 0,
    imageAnalysis: results._sum.imageAnalysis || 0,
    aiInitiated: results._sum.aiInitiated || 0,
  });
}
