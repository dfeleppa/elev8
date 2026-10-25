import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { readGarmin } from "./garmin-personal";
import { rows } from "./garmin-data";
import { buildTrendDays, trendDates, type TrendSources } from "./recovery-trends";

// Read every page before returning totals. A cap/failure marks the source unavailable,
// never a deceptively complete partial total.
export async function collectTrendPages(load: (offset: number) => Promise<Record<string, unknown>[]>, pageSize: number, maxRows = 10000) {
  const all: Record<string, unknown>[] = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const page = await load(offset);
    all.push(...page);
    if (page.length < pageSize) return all;
  }
  throw new Error("Too many records for a complete trend.");
}

async function loadHistory(memberId: string, start: string, end: string, source: "workouts" | "lifts" | "nutrition") {
  return collectTrendPages(async offset => {
    const query = source === "workouts"
      ? supabaseAdmin.from("workout_results").select("id, day_date, score_text, workout_blocks(title)")
      : source === "lifts"
        ? supabaseAdmin.from("athlete_lift_logs").select("id, day_date, movement_library(name), athlete_lift_log_sets(set_order, reps, weight)")
        : supabaseAdmin.from("nutrition_entries").select("id, quantity, calories, protein, nutrition_days!inner(day_date, member_id)");
    const column = source === "nutrition" ? "nutrition_days.day_date" : "day_date";
    let scoped = query.eq("member_id", memberId).gte(column, start).lte(column, end);
    if (source === "nutrition") scoped = scoped.eq("nutrition_days.member_id", memberId);
    const { data, error } = await scoped.order("id", { ascending: true }).range(offset, offset + 499);
    if (error) throw new Error("History unavailable.");
    return rows(data);
  }, 500);
}

export async function loadRecoveryTrends(memberId: string, start: string, end: string) {
  const dates = trendDates(start, end);
  const params = new URLSearchParams({ start_date: start, end_date: end });
  const keys = ["daily", "sleep", "hrv", "activities", "workouts", "lifts", "nutrition"] as const;
  const results = await Promise.allSettled([
    ...["daily", "sleep", "hrv"].map(resource => readGarmin(resource, params)),
    collectTrendPages(async offset => {
      const value = await readGarmin("activities", new URLSearchParams({ start_date: start, end_date: end, start: String(offset), limit: "50" }));
      if (!Array.isArray(value)) throw new Error("Activities unavailable.");
      return rows(value);
    }, 50),
    ...(["workouts", "lifts", "nutrition"] as const).map(source => loadHistory(memberId, start, end, source)),
  ]);
  const sources = Object.fromEntries(keys.map((key, index) => [key, results[index].status === "fulfilled" ? results[index].value : null])) as TrendSources;
  return { start, end, days: buildTrendDays(dates, sources), fetchedAt: new Date().toISOString(),
    warnings: results.flatMap((result, index) => result.status === "rejected" ? [`${keys[index]} unavailable. Refresh to retry; missing data is not zero.`] : []),
  };
}
