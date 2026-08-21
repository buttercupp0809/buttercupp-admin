import { jwtVerify, SignJWT } from "jose";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";

const COOKIE_NAME = "poppy-admin-token";
const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || ""
);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase());

export async function validateAdmin(
  email: string,
  password: string
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!ADMIN_EMAILS.includes(normalized)) return false;

  const name = normalized.split("@")[0].toUpperCase();
  const hash = process.env[`ADMIN_PASSWORD_HASH_${name}`];
  if (!hash) return false;

  return compare(password, hash);
}

export async function signAdminToken(email: string): Promise<string> {
  return new SignJWT({ sub: email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyAdminToken(
  token: string
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const email = payload.sub as string;
    if (!ADMIN_EMAILS.includes(email.toLowerCase())) return null;
    return email;
  } catch {
    return null;
  }
}

export async function getAdminEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
