import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const email = await getAdminEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const character = await prisma.character.findUnique({
    where: { id },
    select: { currentVersionId: true },
  });
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!character.currentVersionId) {
    return NextResponse.json({ error: "No current version" }, { status: 400 });
  }

  const body = await req.json();
  const allowed = [
    "personality", "backstory", "behavioralInstructions", "greeting", "systemPromptSnapshot",
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
    const updated = await prisma.characterVersion.update({
      where: { id: character.currentVersionId },
      data,
      include: { appearanceSheet: true, voiceProfile: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[version-patch]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
