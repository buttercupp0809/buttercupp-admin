import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// Paginated messages for a single conversation. Deliberately bounded (never
// loads a whole conversation into memory at once) and ordered chronologically
// so the UI can render them as a chat transcript.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1"));

  try {
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: id },
        select: {
          id: true,
          role: true,
          content: true,
          mediaAssetId: true,
          tokenCost: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.message.count({ where: { conversationId: id } }),
    ]);

    return NextResponse.json({
      messages,
      total,
      page,
      pageSize: PAGE_SIZE,
      hasMore: page * PAGE_SIZE < total,
    });
  } catch (err) {
    console.error(`[messages] conversation ${id} failed:`, (err as Error)?.message ?? err);
    return NextResponse.json(
      { messages: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false },
      { status: 200 }
    );
  }
}
