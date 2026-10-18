import { expect, it } from "vitest";
import { getReservationCutoffAt, isReservationClosed, type ScheduleClassRow } from "@/lib/class-schedule";
const sample: ScheduleClassRow = { id: "test", name: "Class", class_time: "09:00:00", duration_minutes: 60, class_days: ["Su"], start_date: "2026-01-01", end_date: null, size_limit: 10, reservation_cutoff_hours: 1, calendar_color: "#fff" };
it.each([
  ["2026-03-07", "2026-03-07T13:00:00.000Z"],
  ["2026-03-08", "2026-03-08T12:00:00.000Z"],
  ["2026-10-31", "2026-10-31T12:00:00.000Z"],
  ["2026-11-01", "2026-11-01T13:00:00.000Z"],
])("evaluates New York cutoff across DST on %s", (date, cutoff) => {
  expect(getReservationCutoffAt(sample, date, "America/New_York")).toBe(cutoff);
  expect(isReservationClosed(sample, date, new Date(cutoff), "America/New_York")).toBe(true);
  expect(isReservationClosed(sample, date, new Date(new Date(cutoff).getTime() - 1), "America/New_York")).toBe(false);
});
