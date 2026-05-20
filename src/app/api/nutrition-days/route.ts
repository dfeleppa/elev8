import { NextResponse } from "next/server";

import { hasRole, requireRequestUserContext, requireUserContext } from "@/lib/member";
import {
  omitNutritionKeys,
  readNutritionNumberField,
  readNutritionStringField,
  runNutritionQueryWithFallbacks,
} from "@/lib/nutrition-schema";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toOptionalDecimal(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, parsed);
}

function areTargetsUnset(day: {
  calorie_target: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
}) {
  return (
    day.calorie_target === null &&
    day.protein_target === null &&
    day.carbs_target === null &&
    day.fat_target === null
  );
}

function shouldRefreshTargetsFromPlan(
  day: { updated_at?: string | null },
  planTargets: { updated_at?: string | null }
) {
  if (!planTargets.updated_at) {
    return false;
  }
  if (!day.updated_at) {
    return true;
  }

  const dayUpdatedAt = new Date(day.updated_at).getTime();
  const planUpdatedAt = new Date(planTargets.updated_at).getTime();
  return Number.isFinite(dayUpdatedAt) && Number.isFinite(planUpdatedAt) && planUpdatedAt > dayUpdatedAt;
}

function clampHistoryLimit(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.min(parsed, 30);
}

async function getCoachPlanTargets(memberId: string, date: string) {
  const { data: activePlan, error: activeError } = await runNutritionQueryWithFallbacks([
    () =>
      supabaseAdmin
        .from("coach_nutrition_plans")
        .select("target_calories, protein_grams, carbs_grams, fat_grams, fiber_grams, updated_at")
        .eq("member_id", memberId)
        .lte("effective_date", date)
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    () =>
      supabaseAdmin
        .from("coach_nutrition_plans")
        .select("target_calories, protein_grams, carbs_grams, fat_grams, updated_at")
        .eq("member_id", memberId)
        .lte("effective_date", date)
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
  ]);

  if (activeError) {
    return null;
  }

  let plan = activePlan;

  if (!plan) {
    const { data: fallbackPlan, error: fallbackError } = await runNutritionQueryWithFallbacks([
      () =>
        supabaseAdmin
          .from("coach_nutrition_plans")
          .select("target_calories, protein_grams, carbs_grams, fat_grams, fiber_grams, updated_at")
          .eq("member_id", memberId)
          .order("effective_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      () =>
        supabaseAdmin
          .from("coach_nutrition_plans")
          .select("target_calories, protein_grams, carbs_grams, fat_grams, updated_at")
          .eq("member_id", memberId)
          .order("effective_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
    ]);

    if (fallbackError || !fallbackPlan) {
      return null;
    }

    plan = fallbackPlan;
  }

  if (!plan) {
    return null;
  }

  const planRecord = plan as Record<string, unknown>;

  return {
    calorie_target: toOptionalDecimal(readNutritionNumberField(planRecord, "target_calories")),
    protein_target: toOptionalDecimal(readNutritionNumberField(planRecord, "protein_grams")),
    carbs_target: toOptionalDecimal(readNutritionNumberField(planRecord, "carbs_grams")),
    fat_target: toOptionalDecimal(readNutritionNumberField(planRecord, "fat_grams")),
    fiber_target: toOptionalDecimal(readNutritionNumberField(planRecord, "fiber_grams")),
    updated_at: typeof planRecord.updated_at === "string" ? planRecord.updated_at : null,
  };
}

async function getRecentNutritionHistory(memberId: string, limit: number) {
  const fetchWindow = Math.max(limit * 8, 120);
  const { data: days, error: dayError } = await runNutritionQueryWithFallbacks([
    () =>
      supabaseAdmin
        .from("nutrition_days")
        .select("id, day_date, calorie_target")
        .eq("member_id", memberId)
        .order("day_date", { ascending: false })
        .limit(fetchWindow),
  ]);

  if (dayError) {
    return { history: null, error: dayError };
  }

  const recentDays = (days ?? []) as Array<{
    id: string;
    day_date: string;
    calorie_target: number | null;
  }>;

  if (recentDays.length === 0) {
    return { history: [], error: null };
  }

  const dayIds = recentDays.map((day) => day.id);
  const { data: entries, error: entriesError } = await runNutritionQueryWithFallbacks([
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select("day_id, calories, protein, carbs, fat, fiber, created_at")
        .in("day_id", dayIds)
        .order("created_at", { ascending: true }),
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select("day_id, calories, protein, carbs, fat, created_at")
        .in("day_id", dayIds)
        .order("created_at", { ascending: true }),
  ]);

  if (entriesError) {
    return { history: null, error: entriesError };
  }

  const totalsByDayId = new Map<
    string,
    { calories: number; protein: number; carbs: number; fat: number; fiber: number }
  >();

  for (const entry of (entries ?? []) as Array<Record<string, unknown>>) {
    const dayId = readNutritionStringField(entry, "day_id");
    if (!dayId) continue;

    const current = totalsByDayId.get(dayId) ?? { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    current.calories += readNutritionNumberField(entry, "calories") ?? 0;
    current.protein += readNutritionNumberField(entry, "protein") ?? 0;
    current.carbs += readNutritionNumberField(entry, "carbs") ?? 0;
    current.fat += readNutritionNumberField(entry, "fat") ?? 0;
    current.fiber += readNutritionNumberField(entry, "fiber") ?? 0;
    totalsByDayId.set(dayId, current);
  }

  const history = await Promise.all(
    recentDays
      .filter((day) => totalsByDayId.has(day.id))
      .slice(0, limit)
      .map(async (day) => {
        const totals = totalsByDayId.get(day.id) ?? { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
        const fallbackTargets =
          day.calorie_target === null ? await getCoachPlanTargets(memberId, day.day_date) : null;
        const calorieTarget = day.calorie_target ?? fallbackTargets?.calorie_target ?? null;

        return {
          date: day.day_date,
          calories: totals.calories,
          carbs: totals.carbs,
          protein: totals.protein,
          fat: totals.fat,
          fiber: totals.fiber,
          calorieTarget,
          calorieDelta: calorieTarget === null ? null : totals.calories - calorieTarget,
        };
      })
  );

  return { history, error: null };
}

export async function GET(request: Request) {
  const { error: userError, userId, role } = await requireRequestUserContext(request);
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedMemberId = searchParams.get("memberId");
  if (requestedMemberId && !hasRole("coach", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const targetUserId = requestedMemberId && hasRole("coach", role) ? requestedMemberId : userId;
  const historyLimit = clampHistoryLimit(searchParams.get("recent"));

  if (historyLimit !== null) {
    const { history, error } = await getRecentNutritionHistory(targetUserId, historyLimit);
    if (error) {
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
    return NextResponse.json({ history: history ?? [] });
  }

  const date = searchParams.get("date");

  if (!date || !isValidDate(date)) {
    return NextResponse.json({ error: "Missing or invalid date." }, { status: 400 });
  }

  const { data: day, error: dayError } = await runNutritionQueryWithFallbacks([
    () =>
      supabaseAdmin
        .from("nutrition_days")
        .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target, fiber_target, updated_at")
        .eq("member_id", targetUserId)
        .eq("day_date", date)
        .maybeSingle(),
    () =>
      supabaseAdmin
        .from("nutrition_days")
        .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target, updated_at")
        .eq("member_id", targetUserId)
        .eq("day_date", date)
        .maybeSingle(),
  ]);

  if (dayError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  let resolvedDay = day;

  if (!resolvedDay) {
    const planTargets = await getCoachPlanTargets(targetUserId, date);
    if (planTargets) {
      const payload = {
        member_id: targetUserId,
        day_date: date,
        ...planTargets,
        updated_at: new Date().toISOString(),
      };
      const createdResult = await runNutritionQueryWithFallbacks([
        () =>
          supabaseAdmin
            .from("nutrition_days")
            .upsert(payload, { onConflict: "member_id,day_date" })
            .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target, fiber_target")
            .single(),
        () =>
          supabaseAdmin
            .from("nutrition_days")
            .upsert(omitNutritionKeys(payload, ["fiber_target"]), { onConflict: "member_id,day_date" })
            .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
            .single(),
      ]);

      if (createdResult.error) {
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
      }

      resolvedDay = createdResult.data;
    }
  } else if (resolvedDay) {
    const planTargets = await getCoachPlanTargets(targetUserId, date);
    if (planTargets && (areTargetsUnset(resolvedDay) || shouldRefreshTargetsFromPlan(resolvedDay, planTargets))) {
      const resolvedExistingDay = resolvedDay as { id: string };
      const resolvedDayId = resolvedExistingDay.id;
      const payload = {
        calorie_target: planTargets.calorie_target,
        protein_target: planTargets.protein_target,
        carbs_target: planTargets.carbs_target,
        fat_target: planTargets.fat_target,
        fiber_target: planTargets.fiber_target,
        updated_at: new Date().toISOString(),
      };
      const updatedResult = await runNutritionQueryWithFallbacks([
        () =>
          supabaseAdmin
            .from("nutrition_days")
            .update(payload)
            .eq("id", resolvedDayId)
            .eq("member_id", targetUserId)
            .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target, fiber_target")
            .single(),
        () =>
          supabaseAdmin
            .from("nutrition_days")
            .update(omitNutritionKeys(payload, ["fiber_target"]))
            .eq("id", resolvedDayId)
            .eq("member_id", targetUserId)
            .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
            .single(),
      ]);

      if (updatedResult.error) {
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
      }

      resolvedDay = updatedResult.data;
    }
  }

  if (!resolvedDay) {
    return NextResponse.json({ day: null, entries: [] });
  }

  const resolvedDayId = (resolvedDay as { id: string }).id;

  const { data: entries, error: entriesError } = await runNutritionQueryWithFallbacks([
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select(
          "id, meal_type, entry_name, quantity, calories, protein, carbs, fat, fiber, sugar, saturated_fat, created_at"
        )
        .eq("day_id", resolvedDayId)
        .order("created_at", { ascending: true }),
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select("id, meal_type, entry_name, quantity, calories, protein, carbs, fat, fiber, created_at")
        .eq("day_id", resolvedDayId)
        .order("created_at", { ascending: true }),
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select("id, meal_type, entry_name, quantity, calories, protein, carbs, fat, created_at")
        .eq("day_id", resolvedDayId)
        .order("created_at", { ascending: true }),
  ]);

  if (entriesError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ day: resolvedDay, entries: entries ?? [] });
}

export async function POST(request: Request) {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const dayDate = typeof body?.dayDate === "string" ? body.dayDate : "";

  if (!isValidDate(dayDate)) {
    return NextResponse.json({ error: "Invalid day date." }, { status: 400 });
  }

  const payload = {
    member_id: userId,
    day_date: dayDate,
    calorie_target: toOptionalDecimal(body?.calorieTarget),
    protein_target: toOptionalDecimal(body?.proteinTarget),
    carbs_target: toOptionalDecimal(body?.carbsTarget),
    fat_target: toOptionalDecimal(body?.fatTarget),
    fiber_target: toOptionalDecimal(body?.fiberTarget),
    updated_at: new Date().toISOString(),
  };
  const { data: day, error } = await runNutritionQueryWithFallbacks([
    () =>
      supabaseAdmin
        .from("nutrition_days")
        .upsert(payload, { onConflict: "member_id,day_date" })
        .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target, fiber_target")
        .single(),
    () =>
      supabaseAdmin
        .from("nutrition_days")
        .upsert(omitNutritionKeys(payload, ["fiber_target"]), { onConflict: "member_id,day_date" })
        .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
        .single(),
  ]);

  if (error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ day });
}
