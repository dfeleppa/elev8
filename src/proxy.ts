import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_FILE = /\.[^/]+$/;

function isFullyPublic(pathname: string) {
  if (PUBLIC_FILE.test(pathname)) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/agent")) return true;
  if (pathname.startsWith("/api/cron")) return true;
  if (pathname.startsWith("/api/webhooks/stripe")) return true;
  return false;
}

function isAuthPage(pathname: string) {
  return pathname === "/login" || pathname === "/register";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isFullyPublic(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (isAuthPage(pathname)) {
    if (token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
