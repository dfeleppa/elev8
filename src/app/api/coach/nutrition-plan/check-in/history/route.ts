import { NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AdjustmentRecommendation } from "@/lib/nutrition-adjustment";

export const runtime = "nodejs";

const HISTORY_LIMIT = 50;

function canManageMember(role: string, currentUserId: string, memberId: string) {
  if (memberId === currentUserId) return true;
  return role === "admin" || role === "owner" || role === "coach";
}

type CheckInRow = {
  id: string;
  created_at: string;
  reviewed_at: string | null;
  status: string;
  outcome: string | null;
  source: string | null;
  body_weight_lbs: number | null;
  body_fat_percent: number | null;
  self_reported_accountable: boolean | null;
  calorie_delta: number | null;
  recommendation: AdjustmentRecommendation | null;
};

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

  try {
    // Show completed check-ins (members never see the transient "pending" cron rows).
    const { data, error: queryError } = await supabaseAdmin
      .from("nutrition_check_ins")
      .select(
        "id, created_at, reviewed_at, status, outcome, source, body_weight_lbs, body_fat_percent, self_reported_accountable, calorie_delta, recommendation"
      )
      .eq("member_id", memberId)
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT)
      .returns<CheckInRow[]>();

    if (queryError) throw new Error(queryError.message);

    const history = (data ?? []).map((row) => {
      const rec = row.recommendation;
      return {
        id: row.id,
        date: row.reviewed_at ?? row.created_at,
        status: row.status,
        outcome: row.outcome,
        source: row.source,
        bodyWeightLbs: row.body_weight_lbs,
        bodyFatPercent: row.body_fat_percent,
        accountable: row.self_reported_accountable,
        calorieDelta: row.calorie_delta,
        reason: rec?.reason ?? null,
        proposedCalories: rec?.proposed?.targetCalories ?? null,
      };
    });

    return NextResponse.json({ memberId, history });
  } catch (err) {
    console.error("[check-in history GET] failed", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
