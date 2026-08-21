import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailShell } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { type, subject, body } = await req.json();

  const user = await prisma.user.findUnique({
    where: { id },
    select: { email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    if (type === "forgot-password") {
      const secret = new TextEncoder().encode(
        process.env.ADMIN_JWT_SECRET || ""
      );
      const token = await new SignJWT({
        sub: user.email,
        purpose: "password-reset",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .setIssuedAt()
        .sign(secret);

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.poppy.ai";
      const resetUrl = `${appUrl}/reset-password?token=${token}`;

      const html = emailShell({
        title: "Reset your password",
        bodyHtml: `
          <p>Hey ${user.email}, we received a request to reset your password. Click the button below to set a new one.</p>
          <p style="font-size:13px;color:#475569;margin-top:16px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        `,
        ctaText: "Reset password",
        ctaUrl: resetUrl,
        footerNote: "If you didn't request this, no action is needed.",
      });

      await sendEmail(user.email, "Reset your password", html);
      return NextResponse.json({ success: true });
    }

    if (type === "custom") {
      if (!subject || !body) {
        return NextResponse.json(
          { error: "subject and body required for custom emails" },
          { status: 400 }
        );
      }

      const html = emailShell({
        title: subject,
        bodyHtml: body.replace(/\n/g, "<br/>"),
      });

      await sendEmail(user.email, subject, html);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
