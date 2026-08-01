import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      onboardingStep: true,
      onboardingComplete: true,
    },
  });

  const total = users.length;
  const completedCount = users.filter((u) => u.onboardingComplete).length;
  const incomplete = users.filter((u) => !u.onboardingComplete);
  const inProgress = incomplete.filter((u) => u.onboardingStep > 0).length;
  const notStarted = incomplete.filter((u) => u.onboardingStep === 0).length;

  const stepMap = new Map<number, number>();
  for (const u of incomplete) {
    stepMap.set(u.onboardingStep, (stepMap.get(u.onboardingStep) || 0) + 1);
  }

  const dropoffByStep = [...stepMap.entries()]
    .map(([step, count]) => ({ step, count }))
    .sort((a, b) => a.step - b.step);

  return NextResponse.json({
    total,
    completed: completedCount,
    inProgress,
    notStarted,
    completionRate: total > 0 ? Math.round((completedCount / total) * 100) : 0,
    dropoffByStep,
  });
}
