import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        conversations: {
          include: {
            character: {
              select: {
                id: true,
                name: true,
                style: true,
                contentRating: true,
                moderationStatus: true,
              },
            },
            messages: { take: 3, orderBy: { createdAt: "desc" } },
          },
          orderBy: { lastMessageAt: "desc" },
        },
        memories: { orderBy: { createdAt: "desc" }, take: 50 },
        subscription: true,
        tokenLedger: { orderBy: { createdAt: "desc" }, take: 100 },
        usageCounters: { orderBy: { period: "desc" }, take: 24 },
        crisisEvents: { orderBy: { createdAt: "desc" }, take: 20 },
        relationshipStates: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (err) {
    console.error(`GET /api/users/${id} failed`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { confirmEmail } = await req.json();

  const user = await prisma.user.findUnique({
    where: { id },
    select: { email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (confirmEmail !== user.email) {
    return NextResponse.json(
      { error: "Confirmation email does not match" },
      { status: 400 }
    );
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true, deleted: user.email });
}
