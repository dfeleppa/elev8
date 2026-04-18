import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function hasCoachNutritionPlan(memberId: string) {
  const { count, error } = await supabaseAdmin
    .from("coach_nutrition_plans")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}

export async function getCoachNutritionPlan<T>(memberId: string, select: string, effectiveOn = todayIsoDate()) {
  const activeQuery = await supabaseAdmin
    .from("coach_nutrition_plans")
    .select(select)
    .eq("member_id", memberId)
    .lte("effective_date", effectiveOn)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle<T>();

  if (activeQuery.error) {
    throw new Error(activeQuery.error.message);
  }

  if (activeQuery.data) {
    return activeQuery.data;
  }

  const fallbackQuery = await supabaseAdmin
    .from("coach_nutrition_plans")
    .select(select)
    .eq("member_id", memberId)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle<T>();

  if (fallbackQuery.error) {
    throw new Error(fallbackQuery.error.message);
  }

  return fallbackQuery.data;
}
