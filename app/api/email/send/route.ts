import { NextRequest, NextResponse } from "next/server";
import { sendEmail, emailShell } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { to, subject, body, wrap = true } = await req.json();

  if (!to || !subject || !body) {
    return NextResponse.json(
      { error: "to, subject, and body are required" },
      { status: 400 }
    );
  }

  try {
    // body is HTML from the rich-text editor. When wrap is false the admin wants a
    // plain email with no Poppy branding, so send the HTML as-is.
    const html =
      wrap === false ? body : emailShell({ title: subject, bodyHtml: body });
    await sendEmail(to, subject, html);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
