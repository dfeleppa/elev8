import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../lib/member";
import { ensurePlannerSlot, listSocialPosts, startOfWeek, toDateKey } from "../../../../lib/social";
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
  const weekOfParam = request.nextUrl.searchParams.get("weekOf")?.trim() ?? null;
  const weekOf = weekOfParam || toDateKey(startOfWeek(new Date()));
  const posts = await listSocialPosts(organizationId, { weekOf, limit: 120 });
  return NextResponse.json({ weekOf, posts });
}

export async function PATCH(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { organizationId?: string; socialPostId?: string; slotDate?: string; lane?: string; sortOrder?: number }
    | null;

  const organizationId = body?.organizationId?.trim() ?? organizationIds[0] ?? null;
  if (!body || !organizationId || !organizationIds.includes(organizationId) || !body.socialPostId || !body.slotDate || !body.lane) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const ok = await ensurePlannerSlot(organizationId, body.socialPostId, body.slotDate, body.lane, Number(body.sortOrder ?? 0));
  if (!ok) {
    return NextResponse.json({ error: "Failed to update planner slot." }, { status: 500 });
  }

  await supabaseAdmin
    .from("social_posts")
    .update({ workflow_state: body.lane === "scheduled" ? "scheduled" : undefined, updated_at: new Date().toISOString() })
    .eq("id", body.socialPostId)
    .eq("organization_id", organizationId);

  return NextResponse.json({ ok: true });
}
