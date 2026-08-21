import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const flags = await prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json(flags);
}

export async function POST(req: NextRequest) {
  const adminEmail = await getAdminEmail();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key, enabled, rollout, metadata } = await req.json();
  if (!key?.trim()) return NextResponse.json({ error: "key required" }, { status: 400 });

  const flag = await prisma.featureFlag.create({
    data: {
      key: key.trim(),
      enabled: enabled ?? false,
      rollout: rollout ?? 0,
      metadata: metadata ? JSON.parse(metadata) : undefined,
    },
  });
  return NextResponse.json(flag, { status: 201 });
}
