import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../lib/member";
import { listInboxItems } from "../../../../lib/social";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() ?? organizationIds[0] ?? null;
  if (!organizationId || !organizationIds.includes(organizationId)) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  const inbox = await listInboxItems(organizationId);
  return NextResponse.json(inbox);
}

export async function PATCH(request: NextRequest) {
  const { error, role, userId, organizationIds } = await requireUserContext();
  if (error || !userId || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        organizationId?: string;
        itemType?: "comment" | "conversation";
        itemId?: string;
        status?: string;
        priority?: string;
        assignedToUserId?: string | null;
      }
    | null;

  const organizationId = body?.organizationId?.trim() ?? organizationIds[0] ?? null;
  if (!body || !organizationId || !organizationIds.includes(organizationId) || !body.itemType || !body.itemId) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const table = body.itemType === "conversation" ? "social_conversations" : "social_comments";
  const { error: updateError } = await supabaseAdmin
    .from(table)
    .update({
      status: body.status?.trim() || undefined,
      priority: body.priority?.trim() || undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.itemId)
    .eq("organization_id", organizationId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update inbox item." }, { status: 500 });
  }

  if (body.assignedToUserId !== undefined) {
    await supabaseAdmin.from("social_inbox_assignments").insert({
      organization_id: organizationId,
      item_type: body.itemType,
      item_id: body.itemId,
      assigned_to_user_id: body.assignedToUserId || null,
      assigned_by_user_id: userId,
      status: "active",
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}
