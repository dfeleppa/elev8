"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { dailyMetrics, reading, record, rows } from "@/lib/garmin-data";

const RecoveryTrends = dynamic(() => import("./RecoveryTrends"), { loading: () => <p>Loading trends…</p> });

type Snapshot = { date: string; daily: unknown; sleep: unknown; hrv: unknown; activities: Record<string, unknown>[]; errors: string[]; fetchedAt: string };
const button = "rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100 hover:bg-white/10 disabled:opacity-50";

async function fetchResource(resource: string, date: string, signal: AbortSignal, offset = 0) {
  const start = new Date(`${date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  const params = new URLSearchParams({ resource, start_date: start.toISOString().slice(0, 10), end_date: date, start: String(offset), limit: "20" });
  const response = await fetch(`/api/garmin?${params}`, { cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Unable to load Garmin data.");
  return result.data as unknown;
}

export default function GarminDashboard({ initialDate }: { initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [activityRows, setActivityRows] = useState<Record<string, unknown>[]>([]);
  const [activityError, setActivityError] = useState("");
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const resources = ["daily", "sleep", "hrv", "activities"] as const;
    Promise.allSettled(resources.map(resource => fetchResource(resource, date, controller.signal))).then(results => {
      if (controller.signal.aborted) return;
      const value = (index: number) => results[index].status === "fulfilled" ? results[index].value : null;
      setSnapshot({ date, daily: value(0), sleep: value(1), hrv: value(2), activities: rows(value(3)),
        errors: results.flatMap((result, index) => result.status === "rejected" ? [`${resources[index]}: ${result.reason instanceof Error ? result.reason.message : "Data unavailable."}`] : []),
        fetchedAt: new Date().toLocaleTimeString(),
      });
      setLoading(false);
    });
    return () => controller.abort();
  }, [date, revision]);

  useEffect(() => {
    if (page === 0) return;
    const controller = new AbortController();
    fetchResource("activities", date, controller.signal, page * 20).then(data => {
      if (!controller.signal.aborted) setActivityRows(rows(data));
    }).catch(error => {
      if (!controller.signal.aborted) setActivityError(error instanceof Error ? error.message : "Activities unavailable.");
    }).finally(() => { if (!controller.signal.aborted) setActivityLoading(false); });
    return () => controller.abort();
  }, [page, date, revision]);

  const current = !loading && snapshot?.date === date ? snapshot : null;
  const metrics = dailyMetrics(current?.daily, current?.sleep, current?.hrv, date);
  const activities = page === 0 ? current?.activities ?? [] : activityRows;
  const cards: [string, number | null, string][] = [
    ["Steps", metrics.steps, "steps"], ["Resting heart rate", metrics.restingHeartRate, "bpm"],
    ["Body Battery", metrics.bodyBattery, "/ 100"], ["Average stress", metrics.stress, "/ 100"],
    ["Active calories", metrics.activeCalories, "kcal"],
    ["Sleep", metrics.sleepSeconds === null ? null : Math.round(metrics.sleepSeconds / 360) / 10, "hours"],
    ["Sleep score", metrics.sleepScore, "/ 100"], ["Overnight HRV", metrics.hrv, "ms"],
  ];
  function refresh(nextDate = date) {
    setLoading(true); setPage(0); setActivityRows([]); setActivityError(""); setActivityLoading(false);
    setDate(nextDate); setRevision(value => value + 1);
  }
  function changePage(next: number) {
    setActivityRows([]); setActivityError(""); setActivityLoading(next > 0); setPage(next);
  }

  return <div className="space-y-6">
    <RecoveryTrends initialDate={initialDate} />
    <h2 className="pt-4 text-xl font-semibold text-[var(--text)]">Daily Garmin detail</h2>
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm text-slate-300">Day
        <input aria-label="Garmin calendar date" type="date" value={date} max={initialDate} onChange={event => { if (event.target.value) refresh(event.target.value); }} className="mt-1 block rounded-xl border border-white/15 bg-[var(--input-bg)] p-2 text-[var(--text)]" />
      </label>
      <button className={button} disabled={loading} onClick={() => refresh()}>Refresh Garmin</button>
      <p className="text-xs text-slate-400" aria-live="polite">{loading ? "Loading Garmin…" : current ? `Last checked ${current.fetchedAt}` : ""}</p>
    </div>
    <p className="text-sm text-slate-400">Readings use your Garmin account’s calendar dates. Sync your watch in Garmin Connect before refreshing. A dash means no reading was returned.</p>
    {current?.errors.length ? <div role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-200">{current.errors.map(error => <p key={error}>{error}</p>)}</div> : null}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy={loading}>
      {cards.map(([label, value, unit]) => <section key={label} className="glass-panel rounded-2xl p-5">
        <h2 className="text-sm text-slate-400">{label}</h2>
        <p className="mt-3 text-3xl font-semibold text-slate-100">{value === null ? "—" : value.toLocaleString()}</p>
        <p className="mt-1 text-xs text-slate-400">{unit}</p>
      </section>)}
    </div>
    <section className="glass-panel rounded-2xl p-5">
      <h2 className="text-xl font-semibold text-slate-100">Activities</h2>
      <p className="mt-1 text-sm text-slate-400">Seven days ending {date}. Garmin activities are separate from your Lyfe workout log.</p>
      {activityError ? <p role="alert" className="mt-4 text-amber-200">{activityError}</p> : null}
      <div aria-busy={loading || activityLoading} className="mt-4 space-y-3">
        {loading || activityLoading ? <p className="text-slate-400">Loading activities…</p> : activities.length ? activities.map((activity, index) => {
          const duration = reading(activity.duration);
          const distance = reading(activity.distance);
          const calories = reading(activity.calories);
          return <article key={String(activity.activityId ?? index)} className="rounded-xl border border-white/10 p-4">
            <h3 className="font-medium text-slate-100">{typeof activity.activityName === "string" ? activity.activityName : "Garmin activity"}</h3>
            <p className="text-sm text-slate-400">{typeof activity.startTimeLocal === "string" ? activity.startTimeLocal : "Date unavailable"} · {String(record(activity.activityType).typeKey ?? "Activity").replaceAll("_", " ")}</p>
            <p className="mt-2 text-sm text-slate-300">{duration === null ? "—" : Math.round(duration / 60)} min · {distance === null ? "—" : (distance / 1000).toFixed(2)} km · {calories === null ? "—" : Math.round(calories)} kcal</p>
          </article>;
        }) : <p className="text-sm text-slate-400">{activityError || current?.errors.some(error => error.startsWith("activities:")) ? "Activity data unavailable." : "No activities returned for this page and date range."}</p>}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className={button} disabled={page === 0 || loading || activityLoading} onClick={() => changePage(page - 1)}>Previous</button>
        <span className="text-sm text-slate-400">Page {page + 1}</span>
        <button className={button} disabled={loading || activityLoading || activities.length < 20 || page >= 500} onClick={() => changePage(page + 1)}>Next</button>
      </div>
    </section>
  </div>;
}
