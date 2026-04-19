import { NextResponse } from "next/server";

import { isOrgMember } from "@/lib/programming-access";
import { calculatePrescriptionWeight } from "@/lib/programming";
import { requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const movementId = url.searchParams.get("movementId") ?? "";
  const percentParam = url.searchParams.get("percent") ?? "";
  const targetMemberId = url.searchParams.get("memberId") ?? userId;

  const percent = Number(percentParam);

  if (!movementId || !Number.isFinite(percent) || percent <= 0) {
    return NextResponse.json({ error: "movementId and percent are required." }, { status: 400 });
  }

  const member = await isOrgMember(userId);
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: prRow, error: prError } = await supabaseAdmin
    .from("member_movement_prs")
    .select("best_weight, estimated_one_rep_max")
    .eq("member_id", targetMemberId)
    .eq("movement_id", movementId)
    .maybeSingle();

  if (prError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const baseline =
    (typeof prRow?.estimated_one_rep_max === "number" ? prRow.estimated_one_rep_max : null) ??
    (typeof prRow?.best_weight === "number" ? prRow.best_weight : null);

  if (!baseline) {
    return NextResponse.json({ baseline: null, prescription: null });
  }

  const prescription = calculatePrescriptionWeight(baseline, percent);

  return NextResponse.json({
    baseline,
    percent,
    prescription,
  });
}
