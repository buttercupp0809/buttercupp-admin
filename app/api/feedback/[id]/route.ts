import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = new Set(["new", "acknowledged", "in_progress", "resolved"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as {
    status?: string;
    resolutionNote?: string | null;
  };

  if (body.status !== undefined && !VALID_STATUSES.has(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const existing = await prisma.feedback.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  }

  const now = new Date();
  const data: {
    status?: string;
    resolutionNote?: string | null;
    resolvedAt?: Date | null;
    userAcknowledged?: boolean;
    userAcknowledgedAt?: Date | null;
  } = {};

  if (body.status !== undefined) {
    data.status = body.status;
    if (body.status === "resolved") {
      data.resolvedAt = existing.resolvedAt ?? now;
    } else {
      data.resolvedAt = null;
    }
    if (body.status === "acknowledged" && !existing.userAcknowledged) {
      data.userAcknowledged = true;
      data.userAcknowledgedAt = now;
    }
  }

  if (body.resolutionNote !== undefined) {
    data.resolutionNote = body.resolutionNote || null;
  }

  const updated = await prisma.feedback.update({
    where: { id },
    data,
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return NextResponse.json(updated);
}
