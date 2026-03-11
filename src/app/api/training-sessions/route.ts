import { NextResponse } from "next/server";

import { requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET() {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("training_sessions")
    .select("id, title, scheduled_date, notes, is_complete, created_at, updated_at")
    .eq("member_id", userId)
    .order("scheduled_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(request: Request) {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const scheduledDate = typeof body?.scheduledDate === "string" ? body.scheduledDate : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const isComplete = Boolean(body?.isComplete);

  if (!title || !isValidDate(scheduledDate)) {
    return NextResponse.json({ error: "Invalid training payload." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("training_sessions")
    .insert({
      member_id: userId,
      title,
      scheduled_date: scheduledDate,
      notes,
      is_complete: isComplete,
      updated_at: new Date().toISOString(),
    })
    .select("id, title, scheduled_date, notes, is_complete, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: data }, { status: 201 });
}
