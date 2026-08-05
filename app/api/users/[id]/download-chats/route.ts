import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { name: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const messages = await prisma.message.findMany({
    where: { userId: id },
    orderBy: { sentAt: "asc" },
    select: { sender: true, content: true, platform: true, sentAt: true },
  });

  const rows = [
    ["Sender", "Message", "Platform", "Sent At"],
    ...messages.map((m) => [
      m.sender === "user" ? (user.name ?? "User") : "Vesspr",
      m.content,
      m.platform,
      m.sentAt.toISOString(),
    ]),
  ];

  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const safeName = (user.email ?? id).replace(/[^a-z0-9@._-]/gi, "_");
  const filename = `chats_${safeName}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
