import { NextResponse } from "next/server";
import { hasRole, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error: userError, role, userId } = await requireRequestUserContext(request);
  if (userError || !userId || !hasRole("owner", role)) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status !== undefined) {
    patch.status = body.status || null;
  }

  if (body.project_id !== undefined) {
    patch.project_id = body.project_id || null;
  }

  if (body.due_date !== undefined) {
    patch.due_date = body.due_date || null;
  }

  if (body.priority !== undefined) {
    patch.priority = body.priority || null;
  }

  if (body.notes !== undefined) {
    patch.notes = body.notes || null;
  }

  if (body.is_complete !== undefined) {
    patch.is_complete = Boolean(body.is_complete);
  }

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .eq("member_id", userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error: userError, userId } = await requireRequestUserContext(request);
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const { id } = await context.params;

  const { error } = await supabaseAdmin
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("member_id", userId);

  if (error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
