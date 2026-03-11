import { NextResponse } from "next/server";

import { requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const scheduledDate = typeof body?.scheduledDate === "string" ? body.scheduledDate : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const isComplete = Boolean(body?.isComplete);

  if (!id || !title || !isValidDate(scheduledDate)) {
    return NextResponse.json({ error: "Invalid training payload." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("training_sessions")
    .update({
      title,
      scheduled_date: scheduledDate,
      notes,
      is_complete: isComplete,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("member_id", userId)
    .select("id, title, scheduled_date, notes, is_complete, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: "Missing session id." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("training_sessions")
    .delete()
    .eq("id", id)
    .eq("member_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
