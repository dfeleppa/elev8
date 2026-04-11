import { NextResponse } from "next/server";
import { registerWithEmailPassword } from "../../../../lib/supabase-auth-admin";

export async function POST(request: Request) {
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
      if (result.code === "reserved_email") {
        return NextResponse.json(
          {
            error:
              "This email already exists in an organization's member roster and cannot be used to create an app account.",
          },
          { status: 409 }
        );
      }
      if (result.code === "already_exists") {
        return NextResponse.json(
          { error: "An account with this email already exists." },
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
