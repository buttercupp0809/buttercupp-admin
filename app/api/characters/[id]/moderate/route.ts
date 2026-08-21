import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminEmail } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminEmail = await getAdminEmail();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action } = await req.json();
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  const newVisibility = action === "approve" ? "public" : "private";

  const character = await prisma.character.update({
    where: { id },
    data: {
      moderationStatus: newStatus,
      visibility: action === "approve" ? newVisibility : undefined,
    },
  });

  return NextResponse.json({ success: true, moderationStatus: character.moderationStatus });
}
