import { NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  applyAdjustmentAsNewPlan,
  buildCheckInRecommendation,
} from "@/lib/nutrition-check-in";

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

  try {
    const result = await buildCheckInRecommendation(memberId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      memberId,
      latestPlanId: result.latestPlan.id,
      currentPlan: result.currentPlan,
      recommendation: result.recommendation,
      metabolismEstimate: result.metabolismEstimate,
    });
  } catch (err) {
    console.error("[check-in GET] failed", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error, userId, role } = await requireRequestUserContext(request);
  if (error || !userId || !hasRole("coach", role)) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const memberId =
    typeof body?.memberId === "string" && body.memberId.trim() ? body.memberId.trim() : null;
  const checkInId =
    typeof body?.checkInId === "string" && body.checkInId.trim() ? body.checkInId.trim() : null;
  if (!memberId) {
    return NextResponse.json({ error: "memberId required." }, { status: 400 });
  }
  if (!canManageMember(role, userId, memberId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await buildCheckInRecommendation(memberId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { latestPlan, recommendation } = result;
    if (!recommendation.proposed) {
      return NextResponse.json(
        { error: "No macro changes to apply.", recommendation },
        { status: 409 }
      );
    }

    const applied = await applyAdjustmentAsNewPlan(memberId, latestPlan, recommendation);

    if (checkInId) {
      await supabaseAdmin
        .from("nutrition_check_ins")
        .update({
          status: "applied",
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          applied_plan_id: applied.newPlanId,
        })
        .eq("id", checkInId)
        .eq("member_id", memberId);
    }

    return NextResponse.json({
      memberId,
      newPlanId: applied.newPlanId,
      previousPlanId: latestPlan.id,
      effectiveDate: applied.effectiveDate,
      nextCheckInDate: applied.nextCheckInDate,
      recommendation,
    });
  } catch (err) {
    console.error("[check-in POST] failed", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
