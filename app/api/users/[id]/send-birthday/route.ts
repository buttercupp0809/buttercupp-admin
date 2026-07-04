import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend";
import { prisma } from "@/lib/prisma";
import { getAdminEmail } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | { force?: boolean }
    | null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      dateOfBirth: true,
      telegramChatId: true,
      whatsappPhoneId: true,
      imessagePhoneId: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!user.dateOfBirth) {
    return NextResponse.json(
      { error: "User has no date of birth on record" },
      { status: 400 }
    );
  }
  const hasChannel =
    !!user.telegramChatId || !!user.whatsappPhoneId || !!user.imessagePhoneId;
  if (!hasChannel) {
    return NextResponse.json(
      { error: "User has no bound messaging channel" },
      { status: 400 }
    );
  }

  try {
    const adminEmail = await getAdminEmail();
    const backendResult = await callBackend<{
      sent: boolean;
      reason?: string;
      result?: { text: string; platform: string };
    }>({
      path: "/api/admin/send-birthday",
      method: "POST",
      adminEmail,
      body: { userId: user.id, force: body?.force ?? false },
    });

    return NextResponse.json(backendResult);
  } catch (err) {
    console.error(`POST /api/users/${id}/send-birthday failed`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
