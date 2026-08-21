import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HIDDEN_USER_IDS } from "@/lib/hidden-users";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminEmail();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (HIDDEN_USER_IDS.includes(id)) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const body = await req.json();
  const { conversationId, content } = body as { conversationId: string; content: string };

  if (!content || !content.trim()) {
    return NextResponse.json({ error: "content cannot be empty" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: id },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, role: "assistant", content },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
    }),
  ]);

  return NextResponse.json({
    success: true,
    message: {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    },
  });
}
