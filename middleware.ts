import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "poppy-admin-token";

async function authenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return false;
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Auth API and public cron routes bypass auth check
  if (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/api/unsubscribe"
  ) {
    return NextResponse.next();
  }

  const authed = await authenticated(req);

  // Redirect authenticated users away from login
  if (pathname === "/login") {
    return authed
      ? NextResponse.redirect(new URL("/dashboard", req.url))
      : NextResponse.next();
  }

  // Redirect unauthenticated users to login
  if (!authed) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
