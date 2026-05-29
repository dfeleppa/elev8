import { describe, expect, it } from "vitest";

import {
  buildMacroTargetsFromWeightLbs,
  calculateNutritionPlan,
  clampWeeklyRatePercent,
} from "./nutrition-calculations";

describe("clampWeeklyRatePercent", () => {
  it("hard-caps lose_weight to 0.25–1.0 %/wk", () => {
    expect(clampWeeklyRatePercent("lose_weight", 2)).toBe(1.0);
    expect(clampWeeklyRatePercent("lose_weight", 0.1)).toBe(0.25);
    expect(clampWeeklyRatePercent("lose_weight", 0.6)).toBe(0.6);
  });

  it("hard-caps gain_weight to 0.1–0.5 %/wk", () => {
    expect(clampWeeklyRatePercent("gain_weight", 1)).toBe(0.5);
    expect(clampWeeklyRatePercent("gain_weight", 0.05)).toBe(0.1);
  });

  it("treats maintain/performance as allowed weekly gain 0–0.25 %/wk", () => {
    expect(clampWeeklyRatePercent("maintain_weight", 0.5)).toBe(0.25);
    expect(clampWeeklyRatePercent("maintain_weight", -1)).toBe(0);
    expect(clampWeeklyRatePercent("performance_reverse_diet", 0.4)).toBe(0.25);
  });

  it("falls back to the goal minimum for non-finite input", () => {
    expect(clampWeeklyRatePercent("lose_weight", Number.NaN)).toBe(0.25);
  });
});

describe("buildMacroTargetsFromWeightLbs", () => {
  it("uses 1g/lb protein for the supplied lean body mass", () => {
    const macros = buildMacroTargetsFromWeightLbs(2200, 180);

    expect(macros.proteinGrams).toBe(180);
    expect(macros.fatGrams).toBeCloseTo(73.3, 1);
    expect(macros.carbsGrams).toBeCloseTo(205, 1);
  });

  it("keeps the lean-mass protein target even when calories are lower", () => {
    const macros = buildMacroTargetsFromWeightLbs(1800, 300);

    expect(macros.proteinGrams).toBe(300);
    expect(macros.fatGrams).toBeCloseTo(60, 1);
    expect(macros.carbsGrams).toBeCloseTo(15, 1);
  });

  it("does not raise protein above the lean-mass target when calories are higher", () => {
    const macros = buildMacroTargetsFromWeightLbs(3000, 120);

    expect(macros.proteinGrams).toBe(120);
    expect(macros.fatGrams).toBe(100);
    expect(macros.carbsGrams).toBe(405);
  });
});

describe("calculateNutritionPlan protein target", () => {
  it("sets protein to 1g/lb of measured lean body mass", () => {
    const plan = calculateNutritionPlan({
      goalType: "maintain_weight",
      weightKg: 200 / 2.20462,
      heightCm: 178,
      ageYears: 35,
      sex: "male",
      bodyFatPercentage: 20,
      sessionsPerWeek: 4,
      intensityPreset: "moderate",
    });

    expect(plan.proteinGrams).toBe(160);
    expect(plan.leanBodyMassLbs).toBe(160);
    expect(plan.proteinBasis).toBe("measured_body_fat");
    expect(plan.bodyFatRecommendation).toBeNull();
  });

  it("uses a BMI body fat estimate when measured body fat is missing", () => {
    const plan = calculateNutritionPlan({
      goalType: "maintain_weight",
      weightKg: 200 / 2.20462,
      heightCm: 178,
      ageYears: 35,
      sex: "male",
      bodyFatPercentage: null,
      sessionsPerWeek: 4,
      intensityPreset: "moderate",
    });

    expect(plan.proteinBasis).toBe("bmi_estimated_body_fat");
    expect(plan.proteinBodyFatPercentage).toBeGreaterThan(0);
    expect(plan.proteinGrams).toBe(plan.leanBodyMassLbs);
    expect(plan.bodyFatRecommendation).toContain("Recommend testing body fat");
  });

  it("treats zero body fat as unknown and uses the BMI estimate", () => {
    const plan = calculateNutritionPlan({
      goalType: "maintain_weight",
      weightKg: 200 / 2.20462,
      heightCm: 178,
      ageYears: 35,
      sex: "male",
      bodyFatPercentage: 0,
      sessionsPerWeek: 4,
      intensityPreset: "moderate",
    });

    expect(plan.proteinBasis).toBe("bmi_estimated_body_fat");
    expect(plan.leanBodyMassLbs).toBeLessThan(200);
    expect(plan.proteinGrams).toBe(plan.leanBodyMassLbs);
  });
});
