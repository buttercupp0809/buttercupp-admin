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
    select: {
      currentVersion: {
        select: { appearanceSheetId: true },
      },
    },
  });
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const appearanceSheetId = character.currentVersion?.appearanceSheetId;
  if (!appearanceSheetId) {
    return NextResponse.json({ error: "No appearance sheet on current version" }, { status: 400 });
  }

  const body = await req.json();
  const allowed = ["stylePrompt", "negativePrompt", "loraRef", "referenceImageKeys", "traits"] as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) {
      if (key === "traits" && typeof body[key] === "string") {
        try {
          data[key] = JSON.parse(body[key]);
        } catch {
          return NextResponse.json({ error: "Invalid JSON for traits" }, { status: 400 });
        }
      } else {
        data[key] = body[key];
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  try {
    const updated = await prisma.appearanceSheet.update({
      where: { id: appearanceSheetId },
      data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[appearance-patch]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
