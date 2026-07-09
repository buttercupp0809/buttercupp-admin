import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";

// Mints a signed preview link for the variant editor's "Preview" button.
// sig = HMAC-SHA256(`${key}.${exp}`, PAYWALL_PREVIEW_SECRET), matching
// Pellow's verifyPreviewSignature exactly (app/api/paywall/resolve/route.ts).
// Minted just-in-time on click so the 5 min TTL starts when the admin
// actually opens the link, not when the editor page loaded.
const PREVIEW_TTL_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { key?: string } | null;
  const key = (body?.key || "").trim();
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const secret = process.env.PAYWALL_PREVIEW_SECRET;
  const origin = process.env.NEXT_PUBLIC_VESSPR_ORIGIN;
  if (!secret) {
    return NextResponse.json({ error: "PAYWALL_PREVIEW_SECRET not configured" }, { status: 503 });
  }
  if (!origin) {
    return NextResponse.json({ error: "NEXT_PUBLIC_VESSPR_ORIGIN not configured" }, { status: 503 });
  }

  const exp = Date.now() + PREVIEW_TTL_MS;
  const sig = createHmac("sha256", secret).update(`${key}.${exp}`).digest("hex");

  const url = `${origin.replace(/\/$/, "")}/onboard/payment?paywall_preview=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;

  return NextResponse.json({ url, exp });
}
