import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shiftUserToWhatsapp, sendShiftEmail } from "@/lib/shift-to-whatsapp";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | { confirmEmail?: string; sendEmail?: boolean }
    | null;

  if (!body?.confirmEmail) {
    return NextResponse.json(
      { error: "confirmEmail is required" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { email: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (body.confirmEmail !== existing.email) {
    return NextResponse.json(
      { error: "Confirmation email does not match" },
      { status: 400 }
    );
  }

  try {
    const result = await shiftUserToWhatsapp(id);

    let emailSent = false;
    let emailError: string | undefined;
    if (body.sendEmail !== false && !result.alreadyOnWhatsapp) {
      try {
        await sendShiftEmail(result.user.email, result.user.name, result.waLink);
        emailSent = true;
      } catch (err) {
        emailError = err instanceof Error ? err.message : "unknown";
      }
    }

    return NextResponse.json({
      success: true,
      alreadyOnWhatsapp: result.alreadyOnWhatsapp,
      user: result.user,
      waLink: result.waLink,
      emailSent,
      emailError,
    });
  } catch (err) {
    console.error(`POST /api/users/${id}/shift-to-whatsapp failed`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
