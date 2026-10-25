import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_FILE = /\.[^/]+$/;

export function isFullyPublic(pathname: string) {
  if (pathname === "/") return true;
  if (PUBLIC_FILE.test(pathname)) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/.well-known")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/agent")) return true;
  if (pathname.startsWith("/api/mcp")) return true;
  if (pathname.startsWith("/api/oauth")) return true;
  if (pathname.startsWith("/api/cron")) return true;
  // Provider authentication is enforced by the default-disabled SMS handler.
  if (pathname === "/api/webhooks/twilio/sms") return true;
  return false;
}

export function isAuthPage(pathname: string) {
  return pathname === "/login" || pathname === "/register" || pathname === "/account-recovery";
}

export function hasDevAuthBypass() {
  return process.env.NODE_ENV === "development" && Boolean(process.env.DEV_AUTH_EMAIL?.trim());
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Versioned client APIs authenticate web cookies or verified mobile bearer
  // tokens themselves and return JSON 401/403 instead of login-page redirects.
  if (pathname.startsWith("/api/v1/") || pathname === "/api/garmin") return NextResponse.next();

  // Authentication pages must always remain reachable. A stale or otherwise
  // unusable session cookie can still be decoded by getToken(), while the app
  // cannot resolve it into a valid user context. Redirecting /login to / in
  // that state creates an endless /login <-> / loop.
  if (isFullyPublic(pathname) || isAuthPage(pathname)) {
    return NextResponse.next();
  }

  const devAuthBypass = hasDevAuthBypass();

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token && !devAuthBypass) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
