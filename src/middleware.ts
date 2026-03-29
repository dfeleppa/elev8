import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_FILE = /\.[^/]+$/;

/** Routes that bypass auth entirely (no token check) */
function isFullyPublic(pathname: string) {
  if (PUBLIC_FILE.test(pathname)) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/agent")) return true;
  if (pathname.startsWith("/api/cron")) return true;
  return false;
}

/** Routes that are accessible without auth but redirect to / if already authenticated */
function isAuthPage(pathname: string) {
  return pathname === "/login" || pathname === "/register";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Fully public — no auth check at all
  if (isFullyPublic(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Auth pages (login/register): allow if not authenticated, redirect if authenticated
  if (isAuthPage(pathname)) {
    if (token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Not authenticated → redirect to login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Check org membership — skip for /join and its API
  const orgIds = (token.organizationIds as string[] | undefined) ?? [];
  const isJoinRoute = pathname === "/join" || pathname.startsWith("/api/auth/join-organization");

  if (orgIds.length === 0 && !isJoinRoute) {
    return NextResponse.redirect(new URL("/join", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
