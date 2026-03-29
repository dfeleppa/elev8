import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { supabaseAdmin } from "../../../../lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fullName = (body.fullName ?? "").trim();
    const email = (body.email ?? "").toLowerCase().trim();
    const password = body.password ?? "";

    // Validation
    if (!fullName) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existing } = await supabaseAdmin
      .from("app_users")
      .select("id, password_hash")
      .eq("email", email)
      .maybeSingle();

    const passwordHash = await bcrypt.hash(password, 12);

    if (existing) {
      if (existing.password_hash) {
        // Already registered with email/password
        return NextResponse.json(
          { error: "An account with this email already exists." },
          { status: 409 }
        );
      }

      // OAuth-only user — link by adding password
      await supabaseAdmin
        .from("app_users")
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      // New user
      const { error: insertError } = await supabaseAdmin.from("app_users").insert({
        email,
        full_name: fullName,
        password_hash: passwordHash,
      });

      if (insertError) {
        // Handle race condition on unique constraint
        if (insertError.code === "23505") {
          return NextResponse.json(
            { error: "An account with this email already exists." },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: "Failed to create account." }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
