import { describe, expect, it } from "vitest";
import { dailyMetrics, garminDate, garminEndpoint } from "./garmin-data";

describe("Garmin data contract", () => {
  it("rejects invalid dates, reversed ranges, and overlong requests", () => {
    expect(() => garminDate("2026-02-30")).toThrow();
    expect(() => garminDate("2026-1-1")).toThrow();
    for (const [start, end] of [["2026-01-02", "2026-01-01"], ["2026-01-01", "2026-02-01"]]) {
      expect(() => garminEndpoint("daily", new URLSearchParams({ start_date: start, end_date: end }))).toThrow();
    }
    expect(garminEndpoint("steps", new URLSearchParams({ start_date: "2026-01-01", end_date: "2026-01-31" }))).toContain("/2026-01-01/2026-01-31");
  });
  it("rejects arbitrary resources, traversal, and invalid pagination", () => {
    expect(() => garminEndpoint("https://evil.example", new URLSearchParams())).toThrow();
    expect(() => garminEndpoint("activity", new URLSearchParams({ activity_id: "../secret" }))).toThrow();
    for (const start of ["-1", "1.5", "10001", "", "Infinity"]) {
      expect(() => garminEndpoint("activities", new URLSearchParams({ start_date: "2026-01-01", end_date: "2026-01-01", start }))).toThrow();
    }
    expect(garminEndpoint("activity", new URLSearchParams({ activity_id: "12345678901234567890" }))).toBe("/activity-service/activity/12345678901234567890");
  });
  it("preserves missing readings, real zeroes, and the selected calendar date", () => {
    const data = { data: [{ calendarDate: "2026-10-23", movement: { steps: { value: 999 } } }, { calendarDate: "2026-10-24", movement: { steps: { value: 0 } }, heartRate: { restingValue: 62 }, stress: { avgLevel: -1 } }] };
    const metrics = dailyMetrics(data, [{ calendarDate: "2026-10-24", sleepTimeSeconds: 26160, sleepScores: { overall: { value: 76 } } }], { hrvSummaries: [{ calendarDate: "2026-10-24", lastNightAvg: 38 }] }, "2026-10-24");
    expect(metrics).toMatchObject({ steps: 0, restingHeartRate: 62, stress: null, bodyBattery: null, sleepSeconds: 26160, sleepScore: 76, hrv: 38 });
    expect(Object.values(dailyMetrics(null, null, null, "2026-10-24"))).toEqual(Array(8).fill(null));
  });
});
