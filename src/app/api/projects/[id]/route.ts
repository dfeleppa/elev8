import { NextResponse } from "next/server";
import { hasRole, requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error: userError, role, userId } = await requireUserContext();
  if (userError || !userId || !hasRole("owner", role)) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const { id } = await context.params;

  const { error } = await supabaseAdmin
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("member_id", userId);

  if (error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error: userError, role, userId } = await requireUserContext();
  if (userError || !userId || !hasRole("owner", role)) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("member_id", userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ project: data });
}
