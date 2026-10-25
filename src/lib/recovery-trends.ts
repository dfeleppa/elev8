import { dailyMetrics, garminDate, reading, record, rows } from "./garmin-data";

export function trendDates(start: string, end: string) {
  garminDate(start); garminDate(end);
  const length = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (length < 1 || length > 30) throw new Error("Select between 1 and 30 days.");
  return Array.from({ length }, (_, index) => new Date(Date.parse(start) + index * 86400000).toISOString().slice(0, 10));
}

type Row = Record<string, unknown>;
export type TrendSources = {
  daily: unknown; sleep: unknown; hrv: unknown;
  activities: Row[] | null; workouts: Row[] | null; lifts: Row[] | null;
  nutrition: Row[] | null;
};

// Unknown nutrient values make that day's total unknown; an unlogged day is not zero intake.
function nutrientTotal(entries: Row[], key: string) {
  if (!entries.length) return null;
  let total = 0;
  for (const entry of entries) {
    const value = reading(entry[key]);
    const quantity = entry.quantity == null ? 1 : reading(entry.quantity);
    if (value === null || quantity === null) return null;
    total += value * quantity;
  }
  return Math.round(total * 10) / 10;
}

export function buildTrendDays(dates: string[], sources: TrendSources) {
  return dates.map(date => {
    const metrics = dailyMetrics(sources.daily, sources.sleep, sources.hrv, date);
    const activities = sources.activities?.filter(row => String(row.startTimeLocal ?? "").slice(0, 10) === date);
    const workouts = sources.workouts?.filter(row => row.day_date === date);
    const lifts = sources.lifts?.filter(row => row.day_date === date);
    const food = sources.nutrition?.filter(row => record(row.nutrition_days).day_date === date) ?? [];
    return {
      date, ...metrics, sleepHours: metrics.sleepSeconds === null ? null : Math.round(metrics.sleepSeconds / 360) / 10,
      activityMinutes: !activities || activities.some(row => reading(row.duration) === null) ? null
        : Math.round(activities.reduce((sum, row) => sum + (reading(row.duration) ?? 0), 0) / 60),
      activityCount: activities?.length ?? null,
      workoutCount: workouts?.length ?? null, liftCount: lifts?.length ?? null,
      calories: nutrientTotal(food, "calories"), protein: nutrientTotal(food, "protein"), nutritionEntries: food.length,
      training: [
        ...(activities ?? []).map(row => ({ source: "Garmin", name: String(row.activityName ?? "Activity"), detail: reading(row.duration) === null ? "Duration unavailable" : `${Math.round(Number(row.duration) / 60)} min` })),
        ...(workouts ?? []).map(row => ({ source: "Lyfe workout", name: String(record(row.workout_blocks).title ?? "Workout"), detail: String(row.score_text ?? "Score not recorded") })),
        ...(lifts ?? []).map(row => ({ source: "Lyfe lift", name: String(record(row.movement_library).name ?? "Lift"), detail: rows(row.athlete_lift_log_sets).map(set => `${set.reps ?? "?"} × ${set.weight ?? "?"} lb`).join(", ") || "Sets not recorded" })),
      ],
    };
  });
}

export type TrendDay = ReturnType<typeof buildTrendDays>[number];
export type TrendResponse = { days: TrendDay[]; warnings: string[]; fetchedAt: string; start: string; end: string };

export function meanReadings(values: (number | null)[]) {
  const known = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return { value: known.length ? Math.round(known.reduce((sum, value) => sum + value, 0) / known.length * 10) / 10 : null, count: known.length };
}
