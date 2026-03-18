import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

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
