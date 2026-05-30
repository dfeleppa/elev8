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
import type { AdjustmentRecommendation } from "@/lib/nutrition-adjustment";
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

/** Reuse today's weigh-in when the member skipped the metrics step. */
async function loadTodaysBodyComp(
  memberId: string
): Promise<{ weightLbs: number | null; bodyFatPercent: number | null }> {
  const today = todayIsoDate();
  const { data } = await supabaseAdmin
    .from("health_stat_entries")
    .select("stat_key, value, unit")
    .eq("member_id", memberId)
    .in("stat_key", ["body_weight", "body_fat"])
    .eq("entry_date", today);

  let weightLbs: number | null = null;
  let bodyFatPercent: number | null = null;
  for (const row of data ?? []) {
    const value = Number(row.value) || 0;
    if (row.stat_key === "body_weight" && value > 0) {
      const unit = String(row.unit ?? "lb").toLowerCase();
      weightLbs = unit.startsWith("kg") ? value * 2.20462 : value;
    } else if (row.stat_key === "body_fat" && value > 0) {
      bodyFatPercent = value;
    }
  }
  return { weightLbs, bodyFatPercent };
}

type MemberCheckInOutcome =
  | "adjusted"
  | "held_on_pace"
  | "no_change_not_accountable"
  | "counter_reset"
  | "guardrail_blocked";

/**
 * Persist one complete record per member check-in. If the daily cron already
 * queued a pending row, complete it in place; otherwise insert a fresh one.
 */
async function recordMemberCheckIn(params: {
  memberId: string;
  userId: string;
  planId: string;
  appliedPlanId: string | null;
  status: "applied" | "dismissed";
  outcome: MemberCheckInOutcome;
  bodyWeightLbs: number;
  bodyFatPercent: number | null;
  accountable: boolean;
  calorieDelta: number;
  recommendation: AdjustmentRecommendation;
}) {
  const now = new Date().toISOString();
  const payload = {
    status: params.status,
    outcome: params.outcome,
    recommendation: params.recommendation as unknown as Record<string, unknown>,
    body_weight_lbs: params.bodyWeightLbs,
    body_fat_percent: params.bodyFatPercent,
    self_reported_accountable: params.accountable,
    calorie_delta: Math.round(params.calorieDelta),
    source: "member",
    reviewed_by: params.userId,
    reviewed_at: now,
    applied_plan_id: params.appliedPlanId,
  };

  const { data: pending } = await supabaseAdmin
    .from("nutrition_check_ins")
    .select("id")
    .eq("member_id", params.memberId)
    .eq("status", "pending")
    .maybeSingle();

  if (pending?.id) {
    await supabaseAdmin.from("nutrition_check_ins").update(payload).eq("id", pending.id);
  } else {
    await supabaseAdmin.from("nutrition_check_ins").insert({
      member_id: params.memberId,
      plan_id: params.planId,
      ...payload,
    });
  }
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

    const accountable = typeof body?.accountable === "boolean" ? body.accountable : null;
    if (accountable === null) {
      return NextResponse.json({ error: "Accountability response is required." }, { status: 400 });
    }

    // Body fat is optional; bodyweight may be omitted when today's weigh-in is reused.
    const providedWeight = toPositiveNumber(body?.bodyWeightLbs);
    const providedBodyFat = toOptionalBodyFat(body?.bodyFatPercent);
    let bodyWeightLbs = providedWeight;
    let bodyFatPercent = providedBodyFat;
    if (bodyWeightLbs === null || bodyFatPercent === null) {
      const todays = await loadTodaysBodyComp(memberId);
      if (bodyWeightLbs === null) bodyWeightLbs = todays.weightLbs;
      if (bodyFatPercent === null) bodyFatPercent = todays.bodyFatPercent;
    }
    if (!bodyWeightLbs) {
      return NextResponse.json(
        { error: "Bodyweight is required (none on file for today)." },
        { status: 400 }
      );
    }
    const isFreshWeighIn = providedWeight !== null;

    try {
      const initial = await buildCheckInRecommendation(memberId);
      if ("error" in initial) {
        return NextResponse.json({ error: initial.error }, { status: initial.status });
      }

      // Members can't check in before their scheduled window. Coaches/admins
      // acting on behalf of a member are exempt.
      const isSelfCheckIn = memberId === userId;
      const nextCheckInDate = initial.latestPlan.next_check_in_date;
      if (isSelfCheckIn && nextCheckInDate && todayIsoDate() < nextCheckInDate) {
        return NextResponse.json(
          { error: `Your next check-in opens ${nextCheckInDate}.`, nextCheckInDate },
          { status: 409 }
        );
      }

      const goalType =
        typeof body?.goalType === "string" && goalTypeSet.has(body.goalType as GoalType)
          ? (body.goalType as GoalType)
          : initial.latestPlan.goal_type;

      // Only write a new weigh-in when the member actually entered one this session.
      if (isFreshWeighIn) {
        await saveConfirmedBodyComp(memberId, bodyWeightLbs, bodyFatPercent);
      }

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

      // Self-reported not accountable → never adjust; just log and reset the window.
      if (!accountable) {
        const reset = await resetCheckInWindow(latestPlan, recommendation);
        await recordMemberCheckIn({
          memberId,
          userId,
          planId: latestPlan.id,
          appliedPlanId: null,
          status: "dismissed",
          outcome: "no_change_not_accountable",
          bodyWeightLbs,
          bodyFatPercent,
          accountable: false,
          calorieDelta: 0,
          recommendation,
        });
        return NextResponse.json({
          memberId,
          action: "held_not_accountable",
          effectiveDate: reset.effectiveDate,
          nextCheckInDate: reset.nextCheckInDate,
          confirmed: { bodyWeightLbs, bodyFatPercent, goalType, accountable: false },
          currentPlan,
          recommendation,
        });
      }

      // Accountable → run the data-driven recommendation. The adherence /
      // undertracking gates still backstop a dishonest "yes".
      const shouldApplyAdjustment =
        recommendation.proposed !== null &&
        recommendation.calorieDelta !== 0 &&
        recommendation.status !== "low_adherence" &&
        recommendation.status !== "likely_undertracking";

      if (shouldApplyAdjustment) {
        const applied = await applyAdjustmentAsNewPlan(memberId, latestPlan, recommendation);
        await recordMemberCheckIn({
          memberId,
          userId,
          planId: latestPlan.id,
          appliedPlanId: applied.newPlanId,
          status: "applied",
          outcome: "adjusted",
          bodyWeightLbs,
          bodyFatPercent,
          accountable: true,
          calorieDelta: recommendation.calorieDelta,
          recommendation,
        });
        return NextResponse.json({
          memberId,
          action: "adjusted",
          newPlanId: applied.newPlanId,
          previousPlanId: latestPlan.id,
          effectiveDate: applied.effectiveDate,
          nextCheckInDate: applied.nextCheckInDate,
          confirmed: { bodyWeightLbs, bodyFatPercent, goalType, accountable: true },
          currentPlan,
          recommendation,
        });
      }

      const reset = await resetCheckInWindow(latestPlan, recommendation);
      const isCounterReset =
        recommendation.status === "low_adherence" || recommendation.status === "likely_undertracking";
      const outcome: MemberCheckInOutcome = isCounterReset
        ? "counter_reset"
        : recommendation.status === "guardrail_blocked"
          ? "guardrail_blocked"
          : "held_on_pace";
      await recordMemberCheckIn({
        memberId,
        userId,
        planId: latestPlan.id,
        appliedPlanId: null,
        status: "dismissed",
        outcome,
        bodyWeightLbs,
        bodyFatPercent,
        accountable: true,
        calorieDelta: 0,
        recommendation,
      });
      return NextResponse.json({
        memberId,
        action: isCounterReset ? "counter_reset" : "held",
        effectiveDate: reset.effectiveDate,
        nextCheckInDate: reset.nextCheckInDate,
        confirmed: { bodyWeightLbs, bodyFatPercent, goalType, accountable: true },
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
