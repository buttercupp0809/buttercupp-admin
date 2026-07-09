import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

// master-prd-21 §18.2: sig = HMAC-SHA256(`${key}.${exp}`, PAYWALL_PREVIEW_SECRET),
// exp is an absolute expiry timestamp in ms, minted with a 5 min TTL. Must match
// Pellow's frontend/app/api/paywall/resolve/route.ts verifyPreviewSignature exactly.
const PREVIEW_TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const key = (req.nextUrl.searchParams.get("key") || "").trim();
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const secret = process.env.PAYWALL_PREVIEW_SECRET;
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!secret) {
    return NextResponse.json(
      { error: "PAYWALL_PREVIEW_SECRET is not configured" },
      { status: 503 },
    );
  }
  if (!origin) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL is not configured" },
      { status: 503 },
    );
  }

  const variant = await prisma.paywallVariant.findUnique({
    where: { key },
    select: { key: true },
  });
  if (!variant) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  const exp = Date.now() + PREVIEW_TTL_MS;
  const sig = createHmac("sha256", secret).update(`${key}.${exp}`).digest("hex");

  const url = `${origin.replace(/\/+$/, "")}/onboard/payment?paywall_preview=${encodeURIComponent(key)}&sig=${sig}&exp=${exp}`;

  return NextResponse.json({ url, expiresAt: exp });
}
