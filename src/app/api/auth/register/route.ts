import { NextResponse } from "next/server";
import {
  createInvitationTicket,
  getInvitationTicketMaxAgeSeconds,
  INVITATION_TICKET_COOKIE,
  verifyInvitationCode,
} from "@/lib/invitation-code";
import { rateLimit } from "@/lib/rate-limit";

// 5 attempts per IP per 15 minutes. Caps invitation-code guessing before a
// user is allowed into the Google OAuth account creation flow.
const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const limit = rateLimit(request, "register", REGISTER_LIMIT, REGISTER_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const body = await request.json();
    const invitationCode = body.invitationCode ?? "";

    if (!(await verifyInvitationCode(invitationCode))) {
      return NextResponse.json(
        { error: "A valid invitation code is required to create an account." },
        { status: 403 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(INVITATION_TICKET_COOKIE, createInvitationTicket(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: getInvitationTicketMaxAgeSeconds(),
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
