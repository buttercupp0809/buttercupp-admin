import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | {
        mode?: "raw" | "llm";
        text?: string;
        prompt?: string;
        context?: string;
        reason?: string;
      }
    | null;

  if (!body?.mode) {
    return NextResponse.json({ error: "mode required" }, { status: 400 });
  }
  if (body.mode === "raw" && !body.text?.trim()) {
    return NextResponse.json(
      { error: "text required when mode='raw'" },
      { status: 400 }
    );
  }
  if (body.mode === "llm" && !body.prompt?.trim() && !body.context?.trim()) {
    return NextResponse.json(
      { error: "prompt or context required when mode='llm'" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      platform: true,
      telegramChatId: true,
      whatsappPhoneId: true,
      imessagePhoneId: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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
    const backendResult = await callBackend<{
      success: boolean;
      text: string;
      platform: string;
    }>({
      path: "/api/admin/send-message",
      method: "POST",
      body: {
        userId: user.id,
        mode: body.mode,
        text: body.text,
        prompt: body.prompt,
        context: body.context,
        reason: body.reason ?? "admin_ui",
      },
    });

    return NextResponse.json(backendResult);
  } catch (err) {
    console.error(`POST /api/users/${id}/send-message failed`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
