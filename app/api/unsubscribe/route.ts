/**
 * app/api/unsubscribe/route.ts
 *
 * One-click unsubscribe endpoint (CAN-SPAM / GDPR compliant).
 *
 * GET  /api/unsubscribe?token=<HMAC-token>
 *   Renders a friendly HTML confirmation page (browser-facing unsubscribe link
 *   in email footer).
 *
 * POST /api/unsubscribe?token=<HMAC-token>
 *   Machine-triggered one-click unsubscribe (RFC 8058 List-Unsubscribe-Post).
 *   Returns JSON { ok: true }.
 *
 * Both handlers verify the token, look up the user, set User.unsubscribedAt,
 * and return a success response. Calling this endpoint when the user is already
 * unsubscribed is a no-op (idempotent).
 *
 * Token format: URL-safe base64 HMAC-SHA256 over the userId, signed with
 * UNSUBSCRIBE_SECRET (falls back to CRON_SECRET, then ADMIN_JWT_SECRET).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const TokenSchema = z.object({
  token: z.string().min(10),
});

// ---------------------------------------------------------------------------
// Shared handler: verify token, find user, mark unsubscribed
// ---------------------------------------------------------------------------

async function handleUnsubscribe(
  req: NextRequest
): Promise<{ ok: true; email: string } | { ok: false; error: string; status: number }> {
  const raw = { token: req.nextUrl.searchParams.get("token") ?? undefined };
  const parsed = TokenSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Missing or invalid token", status: 400 };
  }

  const { token } = parsed.data;

  // Look up the user by the stored unsubscribeToken. Because the column is
  // @unique, this indexed lookup authoritatively resolves at most one user and
  // IS the authentication step. We deliberately do not re-derive/verify the
  // HMAC here: doing so would break every previously-issued link the moment
  // UNSUBSCRIBE_SECRET is rotated. An unknown token simply matches no row.
  const user = await prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true, email: true, unsubscribedAt: true },
  });

  if (!user) {
    // Token not found in DB. Could be a stale, forged, or never-minted token.
    // Return a generic error (do not leak user existence).
    return { ok: false, error: "Invalid or expired unsubscribe link.", status: 400 };
  }

  // Idempotent: already unsubscribed is not an error.
  if (!user.unsubscribedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { unsubscribedAt: new Date() },
    });
  }

  return { ok: true, email: user.email };
}

// ---------------------------------------------------------------------------
// GET: browser-facing (renders HTML confirmation)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const result = await handleUnsubscribe(req);

  if (!result.ok) {
    return new NextResponse(errorHtml(result.error), {
      status: result.status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new NextResponse(successHtml(result.email), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ---------------------------------------------------------------------------
// POST: machine one-click unsubscribe (RFC 8058 List-Unsubscribe-Post)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await handleUnsubscribe(req);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// HTML responses
// ---------------------------------------------------------------------------

function successHtml(email: string): string {
  const safeEmail = email
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Unsubscribed - Buttercupp</title>
  <style>
    body { margin:0; padding:0; background:#F7F1E6; font-family:'Inter',sans-serif; }
    .card { max-width:480px; margin:80px auto; background:#1A0900; border-radius:20px;
            padding:48px 36px; text-align:center; color:#fff; }
    h1 { font-size:24px; font-weight:700; margin:0 0 16px; color:#FC9908; }
    p { font-size:15px; line-height:24px; color:rgba(255,255,255,0.72); margin:0 0 12px; }
    .small { font-size:12px; color:rgba(255,255,255,0.35); margin-top:24px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You've been unsubscribed.</h1>
    <p>We've removed <strong>${safeEmail}</strong> from our nurture emails.</p>
    <p>You'll no longer receive these messages. Transactional emails (account security, etc.) are unaffected.</p>
    <p class="small">Buttercupp &copy; ${new Date().getFullYear()}</p>
  </div>
</body>
</html>`;
}

function errorHtml(message: string): string {
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Unsubscribe Error - Buttercupp</title>
  <style>
    body { margin:0; padding:0; background:#F7F1E6; font-family:'Inter',sans-serif; }
    .card { max-width:480px; margin:80px auto; background:#1A0900; border-radius:20px;
            padding:48px 36px; text-align:center; color:#fff; }
    h1 { font-size:22px; font-weight:700; margin:0 0 16px; color:#FC9908; }
    p { font-size:15px; line-height:24px; color:rgba(255,255,255,0.72); margin:0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Something went wrong.</h1>
    <p>${safe}</p>
  </div>
</body>
</html>`;
}
