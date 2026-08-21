import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const adminEmail = await getAdminEmail();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body.rollout === "number") data.rollout = Math.min(100, Math.max(0, body.rollout));
  if (body.metadata !== undefined) {
    data.metadata =
      typeof body.metadata === "string" ? JSON.parse(body.metadata) : body.metadata;
  }

  const flag = await prisma.featureFlag.update({ where: { key }, data });
  return NextResponse.json(flag);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const adminEmail = await getAdminEmail();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = await params;
  await prisma.featureFlag.delete({ where: { key } });
  return NextResponse.json({ success: true });
}
