import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  METABOLISM_AUTO_UPDATE_DELTA_KCAL,
  NEXT_CHECK_IN_DAYS,
  buildCheckInRecommendation,
  datePlusDays,
  todayIsoDate,
} from "@/lib/nutrition-check-in";
import type { MetabolismEstimate } from "@/lib/nutrition-adjustment";

export const runtime = "nodejs";

const BATCH_LIMIT = 100;

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

type DuePlanRow = { id: string; member_id: string; next_check_in_date: string | null };

async function loadDuePlans(today: string): Promise<DuePlanRow[]> {
  // Dedupe before testing due dates: an overdue historical plan must never
  // schedule a check-in for a newer plan. Page through history so members
  // outside the first window are still considered.
  const pageSize = BATCH_LIMIT * 4;
  const seen = new Set<string>();
  const due: DuePlanRow[] = [];
  for (let offset = 0; due.length < BATCH_LIMIT; offset += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("coach_nutrition_plans")
      .select("id, member_id, next_check_in_date, effective_date")
      .order("effective_date", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as DuePlanRow[];
    for (const row of rows) {
      if (seen.has(row.member_id)) continue;
      seen.add(row.member_id);
      if (!row.next_check_in_date || row.next_check_in_date > today) continue;
      due.push(row);
      if (due.length >= BATCH_LIMIT) break;
    }
    if (rows.length < pageSize) break;
  }
  return due;
}

async function processMember(memberId: string, planId: string) {
  const result = await buildCheckInRecommendation(memberId);
  if ("error" in result) {
    return { memberId, status: "skipped", reason: result.error };
  }

  // A plan may have changed after the batch was loaded. Do not supersede a
  // pending check-in or move another plan's schedule in that case.
  const today = todayIsoDate();
  if (result.latestPlan.id !== planId || !result.latestPlan.next_check_in_date ||
    result.latestPlan.next_check_in_date > today) {
    return { memberId, status: "skipped", reason: "Plan changed or is not due." };
  }

  // Don't replace a still-pending check-in for a different plan; mark the old as superseded.
  await supabaseAdmin
    .from("nutrition_check_ins")
    .update({ status: "superseded", reviewed_at: new Date().toISOString() })
    .eq("member_id", memberId)
    .eq("status", "pending");

  const { error: insertError } = await supabaseAdmin.from("nutrition_check_ins").insert({
    member_id: memberId,
    plan_id: result.latestPlan.id,
    status: "pending",
    recommendation: result.recommendation as unknown as Record<string, unknown>,
  });

  if (insertError) {
    return { memberId, status: "error", reason: insertError.message };
  }

  // Bump the plan's next_check_in_date so we don't repeatedly re-fire.
  // Also persist the metabolism estimate (and auto-update maintenance_calories
  // when high confidence + meaningful delta).
  const planUpdate = buildPlanUpdate(today, result.metabolismEstimate);
  const { error: updateError } = await supabaseAdmin
    .from("coach_nutrition_plans")
    .update(planUpdate)
    .eq("id", planId);

  if (updateError) return { memberId, status: "error", reason: updateError.message };

  return {
    memberId,
    status: "queued",
    recommendation: result.recommendation.status,
    metabolism: result.metabolismEstimate.status,
    metabolismUpdated: planUpdate.maintenance_calories_source === "empirical",
  };
}

function buildPlanUpdate(
  today: string,
  estimate: MetabolismEstimate
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    last_check_in_date: today,
    next_check_in_date: datePlusDays(today, NEXT_CHECK_IN_DAYS),
    updated_at: new Date().toISOString(),
    last_metabolism_estimate: estimate as unknown as Record<string, unknown>,
    maintenance_calories_estimated_at: new Date().toISOString(),
  };

  const shouldAutoUpdate =
    estimate.status === "estimated" &&
    estimate.confidence === "high" &&
    estimate.estimatedTdee !== null &&
    estimate.deltaKcal !== null &&
    Math.abs(estimate.deltaKcal) > METABOLISM_AUTO_UPDATE_DELTA_KCAL;

  if (shouldAutoUpdate) {
    base.maintenance_calories = estimate.estimatedTdee;
    base.maintenance_calories_source = "empirical";
  }

  return base;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${cronSecret}`;
  if (!authHeader || !constantTimeEqual(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = todayIsoDate();
    const duePlans = await loadDuePlans(today);
    if (duePlans.length === 0) {
      return NextResponse.json({ today, processed: 0, results: [] });
    }

    const results: Array<{
      memberId: string;
      status: string;
      reason?: string;
      recommendation?: string;
      metabolism?: string;
      metabolismUpdated?: boolean;
    }> = [];
    for (const plan of duePlans) {
      try {
        results.push(await processMember(plan.member_id, plan.id));
      } catch (err) {
        results.push({
          memberId: plan.member_id,
          status: "error",
          reason: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    return NextResponse.json({ today, processed: results.length, results });
  } catch (err) {
    console.error("[cron nutrition-check-in] failed", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
