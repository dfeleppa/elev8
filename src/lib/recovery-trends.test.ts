import { describe, expect, it } from "vitest";
import { buildTrendDays, meanReadings, trendDates, type TrendSources } from "./recovery-trends";

const empty: TrendSources = { daily: [], sleep: [], hrv: [], activities: [], workouts: [], lifts: [], nutrition: [] };
describe("recovery trends", () => {
  it("includes exactly 30 calendar days across DST and rejects invalid or oversized ranges", () => {
    expect(trendDates("2026-10-10", "2026-11-08")).toHaveLength(30);
    expect(() => trendDates("2026-02-30", "2026-03-01")).toThrow();
    expect(() => trendDates("2026-10-01", "2026-10-31")).toThrow();
    expect(() => trendDates("2026-10-02", "2026-10-01")).toThrow();
  });
  it("keeps missing recovery and food null, but counts successfully returned empty activity logs as zero", () => {
    const [day] = buildTrendDays(["2026-10-25"], empty);
    expect(day).toMatchObject({ sleepHours: null, hrv: null, calories: null, protein: null, activityMinutes: 0, workoutCount: 0 });
    expect(meanReadings([null, 0, 6])).toEqual({ value: 3, count: 2 });
  });
  it("keeps failed training sources unknown", () => {
    expect(buildTrendDays(["2026-10-25"], { ...empty, activities: null, workouts: null })[0]).toMatchObject({ activityMinutes: null, activityCount: null, workoutCount: null });
  });
  it("uses calendar dates, quantity-adjusted food totals, and keeps overlapping logs separate", () => {
    const [day] = buildTrendDays(["2026-10-25"], { ...empty,
      activities: [{ startTimeLocal: "2026-10-25 23:30:00", duration: 1200, activityName: "Run" }],
      workouts: [{ day_date: "2026-10-25", workout_blocks: { title: "Run" }, score_text: "20:00" }],
      nutrition: [{ nutrition_days: { day_date: "2026-10-25" }, calories: 200, protein: 10, quantity: 2 }],
    });
    expect(day).toMatchObject({ activityMinutes: 20, workoutCount: 1, calories: 400, protein: 20 });
    expect(day.training.map(item => item.source)).toEqual(["Garmin", "Lyfe workout"]);
  });
  it("does not present partial nutrient totals as complete or missing duration as zero", () => {
    const [day] = buildTrendDays(["2026-10-25"], { ...empty,
      activities: [{ startTimeLocal: "2026-10-25", duration: null }],
      nutrition: [{ nutrition_days: { day_date: "2026-10-25" }, calories: null, protein: 10, quantity: 1 }],
    });
    expect(day).toMatchObject({ calories: null, protein: 10, activityMinutes: null });
  });
});
