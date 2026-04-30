import { describe, expect, it } from "vitest";

import { analyzeNutritionAdjustment, type AdjustmentInputs, type CurrentPlan } from "./nutrition-adjustment";

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

  it("flags likely_undertracking when logged << target and weight is not moving toward goal", () => {
    const inputs: AdjustmentInputs = {
      plan: basePlan(),
      dailyLogs: makeLogs(14, 1700), // 1700 / 2500 = 0.68 -> < 0.85
      weights: makeWeights(200, 0), // flat weight
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.status).toBe("likely_undertracking");
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

  it("enforces protein floor when current protein is below 0.8g/lb", () => {
    const plan = basePlan({ proteinGrams: 100, currentWeightLbs: 200, targetWeightLbs: 180 });
    // floor = 0.8 * 180 = 144
    const inputs: AdjustmentInputs = {
      plan,
      dailyLogs: makeLogs(14, 2500),
      weights: makeWeights(200, -1), // on track
    };
    const rec = analyzeNutritionAdjustment(inputs);
    expect(rec.guardrails.proteinFloorGrams).toBe(144);
    expect(rec.warnings.some((w) => w.includes("Protein"))).toBe(true);
    expect(rec.proposed?.proteinGrams).toBeGreaterThanOrEqual(144);
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
});
