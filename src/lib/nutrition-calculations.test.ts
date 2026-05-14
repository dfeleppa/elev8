import { describe, expect, it } from "vitest";

import { buildMacroTargetsFromWeightLbs } from "./nutrition-calculations";

describe("buildMacroTargetsFromWeightLbs", () => {
  it("uses 0.8g/lb protein for normal bodyweight-to-calorie plans", () => {
    const macros = buildMacroTargetsFromWeightLbs(2200, 180);

    expect(macros.proteinGrams).toBe(144);
    expect(macros.fatGrams).toBeCloseTo(73.3, 1);
    expect(macros.carbsGrams).toBeCloseTo(241, 1);
  });

  it("raises protein to the 0.7g/lb floor for high bodyweight relative to calories", () => {
    const macros = buildMacroTargetsFromWeightLbs(1800, 300);

    expect(macros.proteinGrams).toBe(210);
    expect(macros.fatGrams).toBeCloseTo(60, 1);
    expect(macros.carbsGrams).toBeCloseTo(105, 1);
  });

  it("caps protein at 1.0g/lb for low bodyweight relative to calories", () => {
    const macros = buildMacroTargetsFromWeightLbs(3000, 120);

    expect(macros.proteinGrams).toBe(120);
    expect(macros.fatGrams).toBe(100);
    expect(macros.carbsGrams).toBe(405);
  });
});
