export class GarminError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export function garminDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value) {
    throw new GarminError("Use a valid YYYY-MM-DD date.", 400);
  }
  return value;
}

export function garminEndpoint(resource: string, params: URLSearchParams): string {
  if (resource === "activity") {
    const id = params.get("activity_id") ?? "";
    if (!/^[1-9][0-9]{0,19}$/.test(id)) throw new GarminError("Invalid activity ID.", 400);
    return `/activity-service/activity/${id}`;
  }
  if (resource === "heart-rate") {
    return `/wellness-service/wellness/dailyHeartRate?date=${garminDate(params.get("date"))}`;
  }
  if (!["activities", "sleep", "hrv", "daily", "body-battery", "steps"].includes(resource)) {
    throw new GarminError("Unknown Garmin resource.", 400);
  }
  const start = garminDate(params.get("start_date"));
  const end = garminDate(params.get("end_date"));
  const days = (Date.parse(end) - Date.parse(start)) / 86400000;
  if (days < 0 || days > 30) throw new GarminError("Select an inclusive range of at most 31 days.", 400);
  const query = new URLSearchParams({ startDate: start, endDate: end });
  switch (resource) {
    case "activities": {
      const offset = params.get("start") ?? "0";
      const limit = params.get("limit") ?? "20";
      if (!/^\d+$/.test(offset) || Number(offset) > 10000 || !/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 50) {
        throw new GarminError("Invalid activity pagination.", 400);
      }
      query.set("start", offset); query.set("limit", limit);
      return `/activitylist-service/activities/search/activities?${query}`;
    }
    case "sleep": return `/sleep-service/sleep/dailySleepSummariesByDate?${query}`;
    case "hrv": return `/hrv-service/hrv/daily/${start}/${end}`;
    case "daily": return `/usersummary-service/v2/dailysummaries?${query}`;
    case "body-battery": return `/wellness-service/wellness/bodyBattery/reports/daily?${query}`;
    default: return `/usersummary-service/stats/steps/daily/${start}/${end}`;
  }
}

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function rows(value: unknown, key = "data"): Record<string, unknown>[] {
  const list = Array.isArray(value) ? value : record(value)[key];
  return Array.isArray(list) ? list.map(record) : [];
}
export function reading(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
export function dailyMetrics(daily: unknown, sleep: unknown, hrv: unknown, date: string) {
  const day = rows(daily).find(row => row.calendarDate === date) ?? {};
  const night = rows(sleep).find(row => row.calendarDate === date) ?? {};
  const variability = rows(hrv, "hrvSummaries").find(row => row.calendarDate === date) ?? {};
  return {
    steps: reading(record(record(day.movement).steps).value),
    restingHeartRate: reading(record(day.heartRate).restingValue),
    bodyBattery: reading(record(day.bodyBattery).latestValue),
    stress: reading(record(day.stress).avgLevel),
    activeCalories: reading(record(day.calories).burnedActive),
    sleepSeconds: reading(night.sleepTimeSeconds),
    sleepScore: reading(record(record(night.sleepScores).overall).value),
    hrv: reading(variability.lastNightAvg),
  };
}
