import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

export const runtime = "nodejs";

async function resolveAccount(accountId: string, organizationId: string) {
  const { data } = await supabaseAdmin
    .from("social_accounts")
    .select("id, organization_id")
    .eq("id", accountId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { organizationId?: string; status?: string; actionRequired?: string | null } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const organizationId = body.organizationId?.trim() ?? organizationIds[0] ?? null;
  if (!organizationId || !organizationIds.includes(organizationId)) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  const account = await resolveAccount(id, organizationId);
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
    .eq("organization_id", organizationId)
    .select("id, status, action_required, updated_at")
    .single();

  if (updateError || !data) {
    return NextResponse.json({ error: "Failed to update account." }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() ?? organizationIds[0] ?? null;
  if (!organizationId || !organizationIds.includes(organizationId)) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  const account = await resolveAccount(id, organizationId);
  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabaseAdmin.from("social_accounts").delete().eq("id", id).eq("organization_id", organizationId);
  if (deleteError) {
    return NextResponse.json({ error: "Failed to disconnect account." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
