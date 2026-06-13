import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Mirrors backend/scripts/create-reviewer-account.ts: bcrypt cost 12 so the
// resulting hash is interchangeable with the user-facing login route.
const BCRYPT_COST = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTIVE_TIER = "active";

function deriveNameFromEmail(email: string): string {
  const local = email.split("@")[0] || "User";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || local;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string; name?: string }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = (body.password || "").trim();
  const name = (body.name || "").trim() || deriveNameFromEmail(email);

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A user with that email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await hash(password, BCRYPT_COST);

  // Mirrors create-reviewer-account.ts: User + Personality + Subscription so
  // the account passes the dashboard's paywall guards on first sign-in.
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      platform: "whatsapp",
      timezone: "UTC",
      country: "US",
      onboardingComplete: true,
      subscriptionTier: ACTIVE_TIER,
      ageVerified: true,
      age: 30,
      gender: "prefer-not-to-say",
      personality: { create: {} },
      subscription: {
        create: {
          tier: ACTIVE_TIER,
          status: "active",
          billingInterval: "monthly",
          startedAt: new Date(),
          nextBillingAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      },
    },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  return NextResponse.json({
    user,
    credentials: { email, password },
  });
}
