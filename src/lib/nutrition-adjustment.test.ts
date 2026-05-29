import { describe, expect, it } from "vitest";

import {
  analyzeNutritionAdjustment,
  estimateMetabolism,
  type AdjustmentInputs,
  type CurrentPlan,
  type MetabolismEstimateInputs,
} from "./nutrition-adjustment";

function basePlan(overrides: Partial<CurrentPlan> = {}): CurrentPlan {
  return {
    goalType: "lose_weight",
    targetCalories: 2500,
    maintenanceCalories: 2900,
    proteinGrams: 180,
    carbsGrams: 250,
    fatGrams: 80,
    fiberGrams: null,
    weeklyRatePercent: 0.5,
    reverseDietWeeklyKcal: 0,
    currentWeightLbs: 200,
    targetWeightLbs: 180,
    ...overrides,
  };
}

function isoMinusDays(days: number) {
  const d = new Date("2026-04-30T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function makeLogs(count: number, calories: number, opts: { protein?: number; fiber?: number | null } = {}) {
  return Array.from({ length: count }, (_, i) => ({
    date: isoMinusDays(13 - i),
    calories,
    proteinGrams: opts.protein ?? 180,
    fiberGrams: opts.fiber ?? null,
  }));
}

function makeWeights(start: number, weeklyChangeLbs: number, days = 21) {
  // entries every 3 days
  const entries = [];
  for (let d = 0; d <= days; d += 3) {
    const w = start + (weeklyChangeLbs * d) / 7;
    entries.push({ date: isoMinusDays(days - d), weightLbs: w });
  }
  return entries;
}

describe("analyzeNutritionAdjustment", () => {
  it("returns low_adherence when fewer than 70% of days are logged", () => {
    const inputs: AdjustmentInputs = {
      plan: basePlan(),
      dailyLogs: makeLogs(5, 2500), // only 5/14 days
      weights: makeWeights(200, 0),
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.status).toBe("low_adherence");
    expect(rec.calorieDelta).toBe(0);
  });

  it("returns low_adherence when calories are hit but protein falls short", () => {
    // Calories on target every day, but protein 100g vs a 180g target → non-compliant.
    const inputs: AdjustmentInputs = {
      plan: basePlan(),
      dailyLogs: makeLogs(14, 2500, { protein: 100 }),
      weights: makeWeights(200, -1),
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.status).toBe("low_adherence");
    expect(rec.adherence.compliantDays).toBe(0);
    expect(rec.adherence.proteinTargetGrams).toBe(180);
    expect(rec.calorieDelta).toBe(0);
  });

  it("counts a day compliant when calories and protein are met regardless of carb/fat", () => {
    const inputs: AdjustmentInputs = {
      plan: basePlan(),
      dailyLogs: makeLogs(14, 2500, { protein: 185 }),
      weights: makeWeights(200, -1),
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.adherence.compliantDays).toBe(14);
    expect(rec.adherence.compliancePercent).toBe(1);
    expect(rec.status).toBe("on_track");
  });

  it("returns insufficient_weight_data when fewer than 4 weight entries", () => {
    const inputs: AdjustmentInputs = {
      plan: basePlan(),
      dailyLogs: makeLogs(14, 2500),
      weights: [
        { date: isoMinusDays(20), weightLbs: 200 },
        { date: isoMinusDays(15), weightLbs: 199 },
      ],
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.status).toBe("insufficient_weight_data");
  });

  it("returns low_adherence when average calories are far below target", () => {
    const inputs: AdjustmentInputs = {
      plan: basePlan(),
      dailyLogs: makeLogs(14, 1700), // 1700 / 2500 = 0.68 -> < 0.85
      weights: makeWeights(200, 0), // flat weight
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.status).toBe("low_adherence");
    expect(rec.calorieDelta).toBe(0);
  });

  it("returns low_adherence when average calories are far above target", () => {
    const inputs: AdjustmentInputs = {
      plan: basePlan(),
      dailyLogs: makeLogs(14, 3100), // 124% of target
      weights: makeWeights(200, -1),
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.status).toBe("low_adherence");
    expect(rec.calorieDelta).toBe(0);
  });

  it("returns on_track when observed loss matches expected within tolerance", () => {
    // Expected weekly loss: 0.5% of 200 = 1 lb/week
    const inputs: AdjustmentInputs = {
      plan: basePlan(),
      dailyLogs: makeLogs(14, 2500),
      weights: makeWeights(200, -1),
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.status).toBe("on_track");
    expect(rec.calorieDelta).toBe(0);
  });

  it("proposes a calorie cut when weight loss is stalled (lose_weight)", () => {
    const inputs: AdjustmentInputs = {
      plan: basePlan(),
      dailyLogs: makeLogs(14, 2500),
      weights: makeWeights(200, 0), // 0 lb/week observed vs -1 expected
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.status).toBe("adjust");
    expect(rec.calorieDelta).toBeLessThan(0);
    expect(Math.abs(rec.calorieDelta)).toBeLessThanOrEqual(200);
    expect(rec.proposed?.targetCalories).toBe(2500 + rec.calorieDelta);
  });

  it("proposes a calorie raise when weight loss is too fast (lose_weight)", () => {
    const inputs: AdjustmentInputs = {
      plan: basePlan(),
      dailyLogs: makeLogs(14, 2500),
      weights: makeWeights(200, -3), // way faster than -1 expected
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.status).toBe("adjust");
    expect(rec.calorieDelta).toBeGreaterThan(0);
    expect(rec.calorieDelta).toBeLessThanOrEqual(200);
  });

  it("never cuts calories below the calorie floor", () => {
    const plan = basePlan({ targetCalories: 1400, maintenanceCalories: 2000 });
    // Floor = max(1300, 2000 * 0.75) = 1500
    const inputs: AdjustmentInputs = {
      plan,
      dailyLogs: makeLogs(14, 1400),
      weights: makeWeights(200, 0),
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.guardrails.calorieFloor).toBe(1500);
    if (rec.proposed) {
      expect(rec.proposed.targetCalories).toBeGreaterThanOrEqual(1500);
    }
    expect(rec.status === "guardrail_blocked" || rec.calorieDelta >= 0 || rec.proposed?.targetCalories === 1500).toBe(true);
  });

  it("never raises calories above the calorie ceiling for gain_weight", () => {
    const plan = basePlan({
      goalType: "gain_weight",
      targetCalories: 3700,
      maintenanceCalories: 3000,
      currentWeightLbs: 160,
      targetWeightLbs: 175,
    });
    // Ceiling = min(4000, 3000 * 1.3) = 3900
    const inputs: AdjustmentInputs = {
      plan,
      dailyLogs: makeLogs(14, 3700),
      weights: makeWeights(160, 0), // not gaining
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.guardrails.calorieCeiling).toBe(3900);
    if (rec.proposed) {
      expect(rec.proposed.targetCalories).toBeLessThanOrEqual(3900);
    }
  });

  it("caps single-check-in adjustments at ±200 kcal", () => {
    const inputs: AdjustmentInputs = {
      plan: basePlan(),
      dailyLogs: makeLogs(14, 2500),
      weights: makeWeights(200, 0),
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(Math.abs(rec.calorieDelta)).toBeLessThanOrEqual(200);
  });

  it("bumps legacy low-protein plans to a conservative fallback target", () => {
    const plan = basePlan({ proteinGrams: 100, currentWeightLbs: 200, targetWeightLbs: 180 });
    // Legacy plans may not have lean body mass in the payload, so use a 0.7g/lb fallback.
    const inputs: AdjustmentInputs = {
      plan,
      dailyLogs: makeLogs(14, 2500),
      weights: makeWeights(200, -1), // on track
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.guardrails.proteinFloorGrams).toBe(126);
    expect(rec.guardrails.proteinCeilingGrams).toBe(126);
    expect(rec.warnings.some((w) => w.includes("Protein"))).toBe(true);
    expect(rec.proposed?.proteinGrams).toBe(126);
  });

  it("uses stored lean body mass as the protein target during adjustments", () => {
    const plan = basePlan({ proteinGrams: 150, leanBodyMassLbs: 160 });
    const inputs: AdjustmentInputs = {
      plan,
      dailyLogs: makeLogs(14, 2500),
      weights: makeWeights(200, -1),
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.guardrails.proteinFloorGrams).toBe(160);
    expect(rec.guardrails.proteinCeilingGrams).toBe(160);
    expect(rec.proposed?.proteinGrams).toBe(160);
  });

  it("sets a fiber floor of at least 25g and 14g/1000kcal", () => {
    const plan = basePlan({ targetCalories: 2500, fiberGrams: null });
    // floor = max(25, 14 * 2500 / 1000) = max(25, 35) = 35
    const inputs: AdjustmentInputs = {
      plan,
      dailyLogs: makeLogs(14, 2500),
      weights: makeWeights(200, -1),
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.guardrails.fiberFloorGrams).toBe(35);
    expect(rec.proposed?.fiberGrams).toBe(35);
  });

  it("returns guardrail_blocked when floor prevents the needed cut", () => {
    const plan = basePlan({ targetCalories: 1500, maintenanceCalories: 2000 });
    // floor = max(1300, 1500) = 1500. We're already at the floor.
    const inputs: AdjustmentInputs = {
      plan,
      dailyLogs: makeLogs(14, 1500),
      weights: makeWeights(200, 0), // stalled, wants to cut, but blocked
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.status).toBe("guardrail_blocked");
    expect(rec.warnings.some((w) => w.toLowerCase().includes("floor"))).toBe(true);
  });

  it("holds plan for maintain_weight when weight is stable", () => {
    const inputs: AdjustmentInputs = {
      plan: basePlan({ goalType: "maintain_weight", weeklyRatePercent: 0 }),
      dailyLogs: makeLogs(14, 2500),
      weights: makeWeights(200, 0.1), // tiny drift
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.status).toBe("on_track");
  });

  it("applies a large cut (>200) when gaining while trying to lose", () => {
    // expected -1 lb/wk, observed +1 lb/wk → wrong direction → STEP_LARGE (350).
    const inputs: AdjustmentInputs = {
      plan: basePlan({ maintenanceCalories: 2600 }), // floor = max(1300, 1950) = 1950
      dailyLogs: makeLogs(14, 2500),
      weights: makeWeights(200, 1),
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.status).toBe("adjust");
    expect(rec.calorieDelta).toBe(-350);
    expect(Math.abs(rec.calorieDelta)).toBeGreaterThan(200);
    expect(rec.proposed?.targetCalories).toBe(2150);
  });

  it("holds maintain_weight within an opted-in allowed weekly gain band", () => {
    // weeklyRatePercent 0.25 on 200 lb → ~0.5 lb/wk allowed gain.
    const inputs: AdjustmentInputs = {
      plan: basePlan({ goalType: "maintain_weight", weeklyRatePercent: 0.25, currentWeightLbs: 200 }),
      dailyLogs: makeLogs(14, 2500),
      weights: makeWeights(200, 0.4), // gaining within the allowed band
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.status).toBe("on_track");
    expect(rec.calorieDelta).toBe(0);
  });
});

// ----------------------------------------------------------------------------
// estimateMetabolism
// ----------------------------------------------------------------------------

const ASOF = "2026-04-30";

function logsLastNDays(n: number, calories: number) {
  // produces n consecutive days ending on ASOF
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(`${ASOF}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    arr.push({
      date: d.toISOString().slice(0, 10),
      calories,
      proteinGrams: 180,
      fiberGrams: null,
    });
  }
  return arr;
}

function weightsAcross7Days(start: number, end: number, count = 4) {
  // count entries spread across the 7-day window ending on ASOF.
  const arr = [];
  for (let i = 0; i < count; i++) {
    const dayOffset = Math.round((6 * i) / (count - 1)); // 0..6
    const d = new Date(`${ASOF}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (6 - dayOffset));
    const w = start + ((end - start) * i) / (count - 1);
    arr.push({ date: d.toISOString().slice(0, 10), weightLbs: w });
  }
  return arr;
}

describe("estimateMetabolism", () => {
  it("estimates higher TDEE when losing weight on a deficit", () => {
    // Avg 2200 kcal/day, lost 1 lb over 6 days -> TDEE ≈ 2200 + (1*3500/6) = 2783
    const inputs: MetabolismEstimateInputs = {
      plan: basePlan({ targetCalories: 2200, maintenanceCalories: 2700 }),
      dailyLogs: logsLastNDays(7, 2200),
      weights: weightsAcross7Days(180, 179, 4),
      asOf: ASOF,
    };
    const est = estimateMetabolism(inputs);
    expect(est.status).toBe("estimated");
    expect(est.confidence).toBe("high");
    expect(est.estimatedTdee).toBeGreaterThan(2700);
    expect(est.estimatedTdee).toBeLessThan(2900);
    expect(est.weightChangeLbs).toBeCloseTo(-1, 1);
  });

  it("estimates ≈ avg intake when weight is stable", () => {
    const inputs: MetabolismEstimateInputs = {
      plan: basePlan({ goalType: "maintain_weight", targetCalories: 2400, maintenanceCalories: 2400 }),
      dailyLogs: logsLastNDays(7, 2400),
      weights: weightsAcross7Days(180, 180, 4),
      asOf: ASOF,
    };
    const est = estimateMetabolism(inputs);
    expect(est.status).toBe("estimated");
    expect(est.estimatedTdee).toBe(2400);
    expect(Math.abs(est.deltaKcal!)).toBeLessThanOrEqual(5);
  });

  it("returns low_adherence when fewer than 5/7 days logged", () => {
    const inputs: MetabolismEstimateInputs = {
      plan: basePlan(),
      dailyLogs: logsLastNDays(4, 2200),
      weights: weightsAcross7Days(180, 179, 4),
      asOf: ASOF,
    };
    const est = estimateMetabolism(inputs);
    expect(est.status).toBe("low_adherence");
    expect(est.estimatedTdee).toBeNull();
    expect(est.confidence).toBe("low");
  });

  it("returns insufficient_weight_data when only 1 weigh-in", () => {
    const inputs: MetabolismEstimateInputs = {
      plan: basePlan(),
      dailyLogs: logsLastNDays(7, 2200),
      weights: [{ date: ASOF, weightLbs: 180 }],
      asOf: ASOF,
    };
    const est = estimateMetabolism(inputs);
    expect(est.status).toBe("insufficient_weight_data");
    expect(est.estimatedTdee).toBeNull();
  });

  it("flags likely_undertracking when logged ≪ target and weight not moving toward goal", () => {
    // lose_weight goal, logged 1500 vs target 2500, weight stable
    const inputs: MetabolismEstimateInputs = {
      plan: basePlan({ targetCalories: 2500, maintenanceCalories: 2900 }),
      dailyLogs: logsLastNDays(7, 1500),
      weights: weightsAcross7Days(200, 200, 4),
      asOf: ASOF,
    };
    const est = estimateMetabolism(inputs);
    expect(est.status).toBe("likely_undertracking");
    expect(est.confidence).toBe("low");
  });

  it("flags out_of_bounds when computed TDEE is implausible", () => {
    // Avg 5000 kcal but lost 5 lb in 6 days -> TDEE ≈ 5000 + 5*3500/6 ≈ 7917
    const inputs: MetabolismEstimateInputs = {
      plan: basePlan({ targetCalories: 5000, maintenanceCalories: 3000 }),
      dailyLogs: logsLastNDays(7, 5000),
      weights: weightsAcross7Days(200, 195, 4),
      asOf: ASOF,
    };
    const est = estimateMetabolism(inputs);
    expect(est.status).toBe("out_of_bounds");
    expect(est.confidence).toBe("low");
  });

  it("downgrades to medium confidence with only 5/7 logged days and 2 weigh-ins", () => {
    const inputs: MetabolismEstimateInputs = {
      plan: basePlan({ goalType: "maintain_weight", targetCalories: 2400, maintenanceCalories: 2400 }),
      dailyLogs: logsLastNDays(5, 2400),
      weights: weightsAcross7Days(180, 180, 2),
      asOf: ASOF,
    };
    const est = estimateMetabolism(inputs);
    expect(est.status).toBe("estimated");
    expect(est.confidence).toBe("medium");
  });
});
