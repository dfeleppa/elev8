import { NextResponse } from "next/server";

import { authorizeRole, requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  // Listing programs is a gym-side management view; restrict to admins to match
  // the POST handler below and the [programId] PATCH/DELETE routes.
  const auth = authorizeRole(await requireUserContext(), "admin");
  if (!auth.ok) return auth.response;

  const { data, error: fetchError } = await supabaseAdmin
    .from("programs")
    .select("id, name, description, duration_weeks, days_per_week, status, created_by, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (fetchError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ programs: data ?? [] });
}

export async function POST(request: Request) {
  const auth = authorizeRole(await requireUserContext(), "admin");
  if (!auth.ok) return auth.response;
  const { userId } = auth;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  const durationWeeks = Number.isInteger(body?.durationWeeks) ? body.durationWeeks : 0;
  const daysPerWeek = Number.isInteger(body?.daysPerWeek) ? body.daysPerWeek : 5;

  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  if (durationWeeks < 1 || durationWeeks > 52) {
    return NextResponse.json({ error: "durationWeeks must be between 1 and 52." }, { status: 400 });
  }

  if (daysPerWeek < 1 || daysPerWeek > 7) {
    return NextResponse.json({ error: "daysPerWeek must be between 1 and 7." }, { status: 400 });
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("programs")
    .insert({
      name,
      description,
      duration_weeks: durationWeeks,
      days_per_week: daysPerWeek,
      created_by: userId,
      updated_at: new Date().toISOString(),
    })
    .select("id, name, description, duration_weeks, days_per_week, status, created_by, created_at, updated_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ program: data }, { status: 201 });
}
