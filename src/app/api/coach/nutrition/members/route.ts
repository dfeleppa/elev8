import { NextResponse } from "next/server";

import { hasRole, listAccessibleNutritionMemberIds, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { error, userId, role } = await requireRequestUserContext(request);
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  if (!hasRole("coach", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accessibleMemberIds = await listAccessibleNutritionMemberIds(userId, role);
  if (accessibleMemberIds?.length === 0) {
    return NextResponse.json({ members: [] });
  }

  let query = supabaseAdmin
    .from("app_users")
    .select("id, full_name, email")
    .eq("role", "member")
    .order("full_name", { ascending: true, nullsFirst: false });
  if (accessibleMemberIds) {
    query = query.in("id", accessibleMemberIds);
  }
  const { data, error: membersError } = await query;

  if (membersError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const members = (data ?? []).map((member) => ({
    id: member.id,
    fullName: member.full_name,
    email: member.email,
    label: member.full_name ?? member.email ?? member.id,
  }));

  members.sort((a, b) => a.label.localeCompare(b.label));

  return NextResponse.json({ members });
}
