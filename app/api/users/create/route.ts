import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { getAdminEmail } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const BCRYPT_COST = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const admin = await getAdminEmail();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string; subscriptionTier?: string }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = (body.password || "").trim();
  const tier = (body.subscriptionTier || "free") as "free" | "premium" | "pro";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!["free", "premium", "pro"].includes(tier)) {
    return NextResponse.json({ error: "Invalid subscription tier" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
  }

  const passwordHash = await hash(password, BCRYPT_COST);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      subscriptionTier: tier,
    },
    select: { id: true, email: true, subscriptionTier: true, createdAt: true },
  });

  return NextResponse.json({ user, credentials: { email, password } });
}
