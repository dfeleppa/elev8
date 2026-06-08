import "server-only";

import {
  buildMacroTargetsFromLeanMassLbs,
  type CalculationResult,
} from "@/lib/nutrition-calculations";
import { supabaseAdmin } from "@/lib/supabase-admin";

type MetabolismSource = "formula" | "empirical";

export type MetabolismLearningSnapshot = {
  maintenanceCalories: number | null;
  maintenanceCaloriesSource: MetabolismSource;
  maintenanceCaloriesEstimatedAt: string | null;
  lastMetabolismEstimate: Record<string, unknown> | null;
};

type MetabolismLearningRow = {
  maintenance_calories: number | null;
  maintenance_calories_source: MetabolismSource | null;
  maintenance_calories_estimated_at: string | null;
  last_metabolism_estimate: Record<string, unknown> | null;
};

function toFinitePositive(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeSnapshot(row: MetabolismLearningRow | null): MetabolismLearningSnapshot | null {
  if (!row) return null;
  return {
    maintenanceCalories: toFinitePositive(row.maintenance_calories),
    maintenanceCaloriesSource: row.maintenance_calories_source === "empirical" ? "empirical" : "formula",
    maintenanceCaloriesEstimatedAt: row.maintenance_calories_estimated_at ?? null,
    lastMetabolismEstimate: row.last_metabolism_estimate ?? null,
  };
}

export async function loadMetabolismLearning(memberId: string): Promise<MetabolismLearningSnapshot | null> {
  const learned = await supabaseAdmin
    .from("member_metabolism_learning")
    .select(
      "maintenance_calories, maintenance_calories_source, maintenance_calories_estimated_at, last_metabolism_estimate"
    )
    .eq("member_id", memberId)
    .maybeSingle<MetabolismLearningRow>();

  if (learned.error) throw new Error(learned.error.message);
  const learnedSnapshot = normalizeSnapshot(learned.data);
  if (learnedSnapshot) return learnedSnapshot;

  const latestPlan = await supabaseAdmin
    .from("coach_nutrition_plans")
    .select(
      "maintenance_calories, maintenance_calories_source, maintenance_calories_estimated_at, last_metabolism_estimate"
    )
    .eq("member_id", memberId)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle<MetabolismLearningRow>();

  if (latestPlan.error) throw new Error(latestPlan.error.message);
  return normalizeSnapshot(latestPlan.data);
}

export async function preserveMetabolismLearning(memberId: string) {
  const snapshot = await loadMetabolismLearning(memberId);
  if (!snapshot) return null;

  const { error } = await supabaseAdmin
    .from("member_metabolism_learning")
    .upsert(
      {
        member_id: memberId,
        maintenance_calories: snapshot.maintenanceCalories,
        maintenance_calories_source: snapshot.maintenanceCaloriesSource,
        maintenance_calories_estimated_at: snapshot.maintenanceCaloriesEstimatedAt,
        last_metabolism_estimate: snapshot.lastMetabolismEstimate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id" }
    );

  if (error) throw new Error(error.message);
  return snapshot;
}

export function applyMetabolismLearningToPlan(
  plan: CalculationResult,
  snapshot: MetabolismLearningSnapshot | null
): CalculationResult {
  if (
    snapshot?.maintenanceCaloriesSource !== "empirical" ||
    snapshot.maintenanceCalories === null ||
    snapshot.maintenanceCalories <= 0
  ) {
    return plan;
  }

  const goalAdjustment = plan.targetCalories - plan.maintenanceCalories;
  const maintenanceCalories = Math.round(snapshot.maintenanceCalories);
  const targetCalories = Math.max(1200, Math.round(maintenanceCalories + goalAdjustment));
  const macros = buildMacroTargetsFromLeanMassLbs(targetCalories, plan.leanBodyMassLbs);

  return {
    ...plan,
    maintenanceCalories,
    targetCalories,
    proteinGrams: macros.proteinGrams,
    carbsGrams: macros.carbsGrams,
    fatGrams: macros.fatGrams,
  };
}
