import { describe, expect, it } from "vitest";

import { buildMacroTargetsFromWeightLbs, calculateNutritionPlan } from "./nutrition-calculations";

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
