import { NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function canManageMember(role: string, currentUserId: string, memberId: string) {
  if (memberId === currentUserId) return true;
  return role === "admin" || role === "owner" || role === "coach";
}

export async function GET(request: Request) {
  const { error, userId, role } = await requireRequestUserContext(request);
  if (error || !userId || !hasRole("member", role)) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId")?.trim() || userId;
  if (!canManageMember(role, userId, memberId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error: queryError } = await supabaseAdmin
    .from("nutrition_check_ins")
    .select("id, plan_id, status, recommendation, created_at")
    .eq("member_id", memberId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (queryError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ memberId, pending: data ?? null });
}

export async function DELETE(request: Request) {
  const { error, userId, role } = await requireRequestUserContext(request);
  if (error || !userId || !hasRole("coach", role)) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const checkInId =
    typeof body?.checkInId === "string" && body.checkInId.trim() ? body.checkInId.trim() : null;
  const memberId =
    typeof body?.memberId === "string" && body.memberId.trim() ? body.memberId.trim() : null;
  if (!checkInId || !memberId) {
    return NextResponse.json({ error: "checkInId and memberId required." }, { status: 400 });
  }
  if (!canManageMember(role, userId, memberId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("nutrition_check_ins")
    .update({
      status: "dismissed",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", checkInId)
    .eq("member_id", memberId)
    .eq("status", "pending");

  if (updateError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
