import { NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { error, userId, role } = await requireRequestUserContext(request);
  if (error || !userId || !hasRole("coach", role)) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { data, error: queryError } = await supabaseAdmin
    .from("nutrition_check_ins")
    .select("id, member_id, plan_id, recommendation, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(200);

  if (queryError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const memberIds = Array.from(new Set((data ?? []).map((row) => row.member_id as string)));
  type MemberRow = { id: string; full_name: string | null; email: string | null };
  let memberMap = new Map<string, MemberRow>();
  if (memberIds.length > 0) {
    const { data: members } = await supabaseAdmin
      .from("app_users")
      .select("id, full_name, email")
      .in("id", memberIds);
    memberMap = new Map(((members ?? []) as MemberRow[]).map((m) => [m.id, m]));
  }

  const items = (data ?? []).map((row) => ({
    id: row.id as string,
    memberId: row.member_id as string,
    memberName: memberMap.get(row.member_id as string)?.full_name ?? null,
    memberEmail: memberMap.get(row.member_id as string)?.email ?? null,
    planId: row.plan_id as string,
    recommendation: row.recommendation,
    createdAt: row.created_at as string,
  }));

  return NextResponse.json({ items });
}
