import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminEmail } from "@/lib/auth";

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const email = await getAdminEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const allowed = [
    "name", "bio", "age", "gender", "location", "style",
    "contentRating", "visibility", "tags", "popularityScore", "seedKey",
  ] as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  try {
    const updated = await prisma.character.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[character-patch]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
