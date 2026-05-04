import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { registerWithEmailPassword } from "@/lib/supabase-auth-admin";

// 5 attempts per IP per 15 minutes. Caps brute-force account creation and
// the email-enumeration attack vector (probing whether a given email already
// has an account by reading the 409 vs 200 response).
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
    const fullName = (body.fullName ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    // Validation
    if (!fullName) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const result = await registerWithEmailPassword(fullName, email, password);

    if (!result.ok) {
      if (result.code === "already_exists") {
        return NextResponse.json(
          { error: "This email is already in our system. Try signing in or resetting your password." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: result.code === "supabase_error" ? result.message : "Failed to create account." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
