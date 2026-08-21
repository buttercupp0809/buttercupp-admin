import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const character = await prisma.character.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, email: true } },
      versions: {
        include: {
          appearanceSheet: true,
          voiceProfile: true,
        },
        orderBy: { versionNo: "desc" },
      },
      currentVersion: {
        include: {
          appearanceSheet: true,
          voiceProfile: true,
        },
      },
      media: { orderBy: { sort: "asc" } },
      conversations: {
        select: { id: true, userId: true, messageCount: true, lastMessageAt: true },
        take: 5,
        orderBy: { messageCount: "desc" },
      },
    },
  });

  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(character);
}
