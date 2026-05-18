import { NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  applyAdjustmentAsNewPlan,
  buildCheckInRecommendation,
  resetCheckInWindow,
  todayIsoDate,
  type LatestPlanRow,
} from "@/lib/nutrition-check-in";
import type { GoalType } from "@/lib/nutrition-calculations";

export const runtime = "nodejs";

function canManageMember(role: string, currentUserId: string, memberId: string) {
  if (memberId === currentUserId) return true;
  return role === "admin" || role === "owner" || role === "coach";
}

const goalTypeSet = new Set<GoalType>([
  "lose_weight",
  "gain_weight",
  "maintain_weight",
  "performance_reverse_diet",
]);

function toPositiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toOptionalBodyFat(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 1 && parsed < 99 ? parsed : null;
}

function buildConfirmedPlan(
  latestPlan: LatestPlanRow,
  goalType: GoalType,
  bodyWeightLbs: number,
  bodyFatPercent: number | null
): LatestPlanRow {
  const leanBodyMassLbs =
    bodyFatPercent !== null ? Math.round(bodyWeightLbs * (1 - bodyFatPercent / 100) * 10) / 10 : null;
  return {
    ...latestPlan,
    goal_type: goalType,
    plan_payload: {
      ...(latestPlan.plan_payload ?? {}),
      weightLbs: bodyWeightLbs,
      bodyFatPercentage: bodyFatPercent,
      ...(leanBodyMassLbs !== null ? { leanBodyMassLbs } : {}),
    },
  };
}

async function saveConfirmedBodyComp(memberId: string, bodyWeightLbs: number, bodyFatPercent: number | null) {
  const today = todayIsoDate();
  const now = new Date().toISOString();

  const { error: profileError } = await supabaseAdmin
    .from("app_users")
    .update({
      current_weight_kg: bodyWeightLbs / 2.20462,
      body_fat_percent: bodyFatPercent,
      updated_at: now,
    })
    .eq("id", memberId);
  if (profileError) throw new Error(profileError.message);

  const inserts: Array<{
    member_id: string;
    stat_key: string;
    value: number;
    unit: string;
    entry_date: string;
    updated_at: string;
  }> = [
    {
      member_id: memberId,
      stat_key: "body_weight",
      value: bodyWeightLbs,
      unit: "lb",
      entry_date: today,
      updated_at: now,
    },
  ];

  if (bodyFatPercent !== null) {
    inserts.push({
      member_id: memberId,
      stat_key: "body_fat",
      value: bodyFatPercent,
      unit: "%",
      entry_date: today,
      updated_at: now,
    });
    inserts.push({
      member_id: memberId,
      stat_key: "lean_body_mass",
      value: Math.round(bodyWeightLbs * (1 - bodyFatPercent / 100) * 10) / 10,
      unit: "lb",
      entry_date: today,
      updated_at: now,
    });
  }

  const { error } = await supabaseAdmin.from("health_stat_entries").insert(inserts);
  if (error) throw new Error(error.message);
}

async function markPendingCheckIn(
  memberId: string,
  userId: string,
  appliedPlanId: string | null,
  status: "applied" | "dismissed"
) {
  await supabaseAdmin
    .from("nutrition_check_ins")
    .update({
      status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      applied_plan_id: appliedPlanId,
    })
    .eq("member_id", memberId)
    .eq("status", "pending");
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
  if (error || !userId || !hasRole("member", role)) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "apply";
  if (action === "member_check_in") {
    const memberId =
      typeof body?.memberId === "string" && body.memberId.trim() ? body.memberId.trim() : userId;
    if (!canManageMember(role, userId, memberId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bodyWeightLbs = toPositiveNumber(body?.bodyWeightLbs);
    const bodyFatPercent = toOptionalBodyFat(body?.bodyFatPercent);
    const goalType = typeof body?.goalType === "string" && goalTypeSet.has(body.goalType as GoalType)
      ? (body.goalType as GoalType)
      : null;

    if (!bodyWeightLbs) {
      return NextResponse.json({ error: "Bodyweight is required." }, { status: 400 });
    }
    if (!goalType) {
      return NextResponse.json({ error: "Goal is required." }, { status: 400 });
    }
    if (bodyFatPercent === null) {
      return NextResponse.json({ error: "Body fat must be between 1 and 99 percent." }, { status: 400 });
    }

    try {
      const initial = await buildCheckInRecommendation(memberId);
      if ("error" in initial) {
        return NextResponse.json({ error: initial.error }, { status: initial.status });
      }

      await saveConfirmedBodyComp(memberId, bodyWeightLbs, bodyFatPercent);

      const latestPlan = buildConfirmedPlan(initial.latestPlan, goalType, bodyWeightLbs, bodyFatPercent);
      const refreshed = await buildCheckInRecommendation(memberId, {
        goal_type: latestPlan.goal_type,
        plan_payload: latestPlan.plan_payload,
      });
      if ("error" in refreshed) {
        return NextResponse.json({ error: refreshed.error }, { status: refreshed.status });
      }
      const recommendation = refreshed.recommendation;
      const currentPlan = refreshed.currentPlan;

      const shouldApplyAdjustment =
        recommendation.proposed !== null &&
        recommendation.calorieDelta !== 0 &&
        recommendation.status !== "low_adherence" &&
        recommendation.status !== "likely_undertracking";

      if (shouldApplyAdjustment) {
        const applied = await applyAdjustmentAsNewPlan(memberId, latestPlan, recommendation);
        await markPendingCheckIn(memberId, userId, applied.newPlanId, "applied");
        return NextResponse.json({
          memberId,
          action: "adjusted",
          newPlanId: applied.newPlanId,
          previousPlanId: latestPlan.id,
          effectiveDate: applied.effectiveDate,
          nextCheckInDate: applied.nextCheckInDate,
          confirmed: { bodyWeightLbs, bodyFatPercent, goalType },
          currentPlan,
          recommendation,
        });
      }

      const reset = await resetCheckInWindow(latestPlan, recommendation);
      await markPendingCheckIn(memberId, userId, null, "dismissed");
      return NextResponse.json({
        memberId,
        action:
          recommendation.status === "low_adherence" || recommendation.status === "likely_undertracking"
            ? "counter_reset"
            : "held",
        effectiveDate: reset.effectiveDate,
        nextCheckInDate: reset.nextCheckInDate,
        confirmed: { bodyWeightLbs, bodyFatPercent, goalType },
        currentPlan,
        recommendation,
      });
    } catch (err) {
      console.error("[member check-in POST] failed", err);
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
  }

  if (!hasRole("coach", role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
