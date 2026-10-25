"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { meanReadings, type TrendDay, type TrendResponse } from "@/lib/recovery-trends";

const metrics = [
  { key: "sleepHours", label: "Sleep", unit: "hours", source: "Garmin", color: "#a78bfa" },
  { key: "hrv", label: "Overnight HRV", unit: "ms", source: "Garmin", color: "#06b6d4" },
  { key: "restingHeartRate", label: "Resting heart rate", unit: "bpm", source: "Garmin", color: "#f472b6" },
  { key: "bodyBattery", label: "Body Battery · latest reading", unit: "/ 100", source: "Garmin", color: "#10b981" },
  { key: "activityMinutes", label: "Recorded activity", unit: "min", source: "Garmin", color: "#06b6d4" },
  { key: "calories", label: "Logged food energy", unit: "kcal", source: "Lyfe", color: "#f59e0b" },
  { key: "protein", label: "Logged protein", unit: "g", source: "Lyfe", color: "#a78bfa" },
] as const;
const control = "rounded-xl border border-[var(--line)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] disabled:opacity-50";
const display = (value: number | null) => value === null ? "—" : value.toLocaleString();

function TrendChart({ days, metric }: { days: TrendDay[]; metric: typeof metrics[number] }) {
  const summary = meanReadings(days.map(day => day[metric.key]));
  return <section className="glass-panel min-w-0 rounded-2xl p-5" aria-label={`${metric.label} trend`}>
    <div className="flex items-start justify-between gap-3">
      <h3 className="text-sm font-medium">{metric.label}</h3>
      <span className="text-xs text-[var(--text-muted)]">{metric.source}</span>
    </div>
    <p className="mt-3 text-2xl font-semibold">{display(summary.value)} <span className="text-sm font-normal text-[var(--text-muted)]">{metric.unit} average</span></p>
    <p className="mt-1 text-xs text-[var(--text-muted)]">{summary.count} of {days.length} days with data</p>
    {summary.count ? <div className="mt-4 h-40" role="img" aria-label={`${metric.label}: average ${summary.value} ${metric.unit}. Daily values in the table below.`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={days} syncId="recovery-days" margin={{ top: 8, right: 10, bottom: 0, left: -20 }} accessibilityLayer>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={value => String(value).slice(5)} tick={{ fill: "var(--text-muted)", fontSize: 11 }} minTickGap={28} />
          <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={55} />
          <Tooltip contentStyle={{ background: "var(--panel)", color: "var(--text)", borderColor: "var(--line)", borderRadius: 12 }} formatter={value => [`${value} ${metric.unit}`, metric.label]} />
          <Line dataKey={metric.key} name={metric.label} stroke={metric.color} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div> : <p className="flex h-44 items-center text-sm text-[var(--text-muted)]">No readings for this period.</p>}
  </section>;
}

export default function RecoveryTrends({ initialDate }: { initialDate: string }) {
  const [end, setEnd] = useState(initialDate);
  const [range, setRange] = useState(7);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; data?: TrendResponse; error?: string } | null>(null);
  const start = new Date(Date.parse(end) - (range - 1) * 86400000).toISOString().slice(0, 10);
  const key = `${start}/${end}/${revision}`;
  const current = state?.key === key ? state : null;
  const loading = current === null;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ resource: "trends", start_date: start, end_date: end });
    fetch(`/api/garmin?${params}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load trends.");
      if (!controller.signal.aborted) setState({ key, data });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ key, error: error instanceof Error ? error.message : "Unable to load trends." });
    });
    return () => controller.abort();
  }, [start, end, key]);

  const data = current?.data;
  return <section className="space-y-5 text-[var(--text)]" aria-labelledby="recovery-heading">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Garmin + Lyfe</p>
        <h2 id="recovery-heading" className="mt-2 text-2xl font-semibold">Recovery & performance trends</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">See your recovery, food logs, and training on the same timeline.</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-[var(--text-muted)]">Period<select aria-label="Trend period" value={range} onChange={event => setRange(Number(event.target.value))} className={`${control} mt-1 block`}><option value={7}>7 days</option><option value={30}>30 days</option></select></label>
        <label className="text-xs text-[var(--text-muted)]">Ending<input aria-label="Trend ending date" type="date" value={end} max={initialDate} onChange={event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value) && event.target.value <= initialDate) setEnd(event.target.value); }} className={`${control} mt-1 block`} /></label>
        <button className={control} disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh trends</button>
      </div>
    </header>
    <p className="text-xs text-[var(--text-muted)]">{start} through {end} · America/New_York. {end === initialDate ? "Today is still in progress. " : ""}Gaps mean missing readings. Food totals reflect only what you logged; zero activity means no Garmin activities returned.</p>
    <p role="status" className="text-xs text-[var(--text-muted)]">{loading ? "Loading recovery and performance…" : data ? `Last checked ${new Date(data.fetchedAt).toLocaleTimeString()}` : ""}</p>
    {current?.error ? <p role="alert" className="rounded-xl border border-amber-500/40 p-4">{current.error}</p> : null}
    {data?.warnings.length ? <div role="alert" className="rounded-xl border border-amber-500/40 p-4 text-sm">{data.warnings.map(warning => <p key={warning}>{warning}</p>)}</div> : null}
    {data ? <>
      <div className="grid gap-4 md:grid-cols-2">{metrics.map(metric => <TrendChart key={metric.key} days={data.days} metric={metric} />)}
        <section className="glass-panel rounded-2xl p-5">
          <h3 className="font-medium">Lyfe training logs</h3>
          <p className="mt-4 text-sm">{display(data.days.some(day => day.workoutCount === null) ? null : data.days.reduce((sum, day) => sum + (day.workoutCount ?? 0), 0))} workout results</p>
          <p className="mt-2 text-sm">{display(data.days.some(day => day.liftCount === null) ? null : data.days.reduce((sum, day) => sum + (day.liftCount ?? 0), 0))} separate lift logs</p>
          <p className="mt-4 text-sm text-[var(--text-muted)]">Results are logged blocks, not attendance or distinct sessions. Garmin and Lyfe may describe the same workout. Scores stay with their original workouts instead of being averaged together.</p>
        </section>
      </div>
      <details className="glass-panel rounded-2xl p-5" open>
        <summary className="cursor-pointer font-semibold">Daily recovery, nutrition & training</summary>
        <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Daily trend readings">
          <table className="w-full min-w-[850px] text-left text-sm">
            <caption className="sr-only">Daily values for all charts, followed by the original training logs. A dash means unavailable or unlogged.</caption>
            <thead className="text-xs text-[var(--text-muted)]"><tr>{["Date", "Sleep (h)", "HRV (ms)", "Rest HR", "Battery", "Garmin min", "Food kcal", "Protein (g)", "Training"].map(label => <th scope="col" key={label} className="px-2 py-3">{label}</th>)}</tr></thead>
            <tbody>{data.days.map(day => <tr key={day.date} className="border-t border-[var(--line)] align-top">
              <th scope="row" className="whitespace-nowrap px-2 py-3 font-normal">{day.date}</th>
              {[day.sleepHours, day.hrv, day.restingHeartRate, day.bodyBattery, day.activityMinutes, day.calories, day.protein].map((value, index) => <td key={index} className="px-2 py-3">{display(value)}</td>)}
              <td className="min-w-64 px-2 py-3">{day.training.length ? <ul className="space-y-2">{day.training.map((item, index) => <li key={index}><span className="text-xs text-[var(--text-muted)]">{item.source}</span><p>{item.name} · {item.detail}</p></li>)}</ul> : <span className="text-[var(--text-muted)]">{day.activityCount === null || day.workoutCount === null || day.liftCount === null ? "Some training sources unavailable" : "No training records returned"}</span>}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>
      <p className="text-xs text-[var(--text-muted)]">Compare patterns over time. These charts do not establish why a metric changed or generate a readiness score. Sync your watch in Garmin Connect before refreshing.</p>
    </> : null}
  </section>;
}
