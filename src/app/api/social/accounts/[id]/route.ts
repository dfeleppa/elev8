import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

async function resolveAccount(accountId: string) {
  const { data } = await supabaseAdmin
    .from("social_accounts")
    .select("id")
    .eq("id", accountId)
    .maybeSingle();
  return data;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, role } = await requireRequestUserContext(request);
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { status?: string; actionRequired?: string | null } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const account = await resolveAccount(id);
  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const { data, error: updateError } = await supabaseAdmin
    .from("social_accounts")
    .update({
      status: body.status?.trim() || "connected",
      action_required: body.actionRequired?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, status, action_required, updated_at")
    .single();

  if (updateError || !data) {
    return NextResponse.json({ error: "Failed to update account." }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, role } = await requireRequestUserContext(request);
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const account = await resolveAccount(id);
  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabaseAdmin.from("social_accounts").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: "Failed to disconnect account." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
