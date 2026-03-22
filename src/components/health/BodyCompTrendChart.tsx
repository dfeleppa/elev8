"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Metric = "body_weight" | "body_fat" | "lean_body_mass";
type Range = "1W" | "1M" | "1Y" | "custom";

type HistoryEntry = {
  date: string;
  body_weight: number | null;
  body_fat: number | null;
  lean_body_mass: number | null;
};

type ChartPoint = {
  date: string;
  label: string;
  actual: number | null;
  trend: number | null;
};

const METRICS: { key: Metric; label: string; unit: string; color: string; gradientId: string }[] = [
  { key: "body_weight", label: "Body Weight", unit: "lb", color: "#38bdf8", gradientId: "bodyWeightGrad" },
  { key: "body_fat", label: "Body Fat %", unit: "%", color: "#f472b6", gradientId: "bodyFatGrad" },
  { key: "lean_body_mass", label: "Lean Body Mass", unit: "lb", color: "#34d399", gradientId: "lbmGrad" },
];

const RANGES: { key: Range; label: string }[] = [
  { key: "1W", label: "1W" },
  { key: "1M", label: "1M" },
  { key: "1Y", label: "1Y" },
  { key: "custom", label: "Custom" },
];

function toDateString(d: Date) {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function getDateRange(range: Range, customFrom: string, customTo: string) {
  if (range === "custom" && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }
  const today = new Date();
  const from = new Date(today);
  if (range === "1W") from.setDate(from.getDate() - 7);
  else if (range === "1M") from.setDate(from.getDate() - 30);
  else if (range === "1Y") from.setDate(from.getDate() - 365);
  return { from: toDateString(from), to: toDateString(today) };
}

function formatXLabel(dateStr: string, range: Range) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (range === "1W" || range === "1M") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function computeTrendline(values: (number | null)[]): (number | null)[] {
  const valid = values
    .map((v, i) => (v !== null ? { x: i, y: v } : null))
    .filter((p): p is { x: number; y: number } => p !== null);

  if (valid.length < 2) return values.map(() => null);

  const n = valid.length;
  const sumX = valid.reduce((s, p) => s + p.x, 0);
  const sumY = valid.reduce((s, p) => s + p.y, 0);
  const sumXY = valid.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = valid.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return values.map(() => null);
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return values.map((_, i) => Math.round((slope * i + intercept) * 10) / 10);
}

export default function BodyCompTrendChart() {
  const [metric, setMetric] = useState<Metric>("body_weight");
  const [range, setRange] = useState<Range>("1M");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return toDateString(d);
  });
  const [customTo, setCustomTo] = useState(() => toDateString(new Date()));
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = useMemo(
    () => getDateRange(range, customFrom, customTo),
    [range, customFrom, customTo]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/athlete/body-comp-history?from=${from}&to=${to}`, { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) throw new Error(payload?.error ?? "Failed to load body comp history.");
        setEntries(payload.entries ?? []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [from, to]);

  const activeMetric = METRICS.find((m) => m.key === metric)!;

  const chartData: ChartPoint[] = useMemo(() => {
    const actuals = entries.map((e) => e[metric]);
    const trends = computeTrendline(actuals);
    return entries.map((e, i) => ({
      date: e.date,
      label: formatXLabel(e.date, range),
      actual: actuals[i],
      trend: trends[i],
    }));
  }, [entries, metric, range]);

  const hasData = chartData.some((p) => p.actual !== null);

  const yDomain = useMemo((): [number, number] | ["auto", "auto"] => {
    const vals = chartData.flatMap((p) =>
      [p.actual, p.trend].filter((v): v is number => v !== null)
    );
    if (vals.length === 0) return ["auto", "auto"];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max((max - min) * 0.1, 1);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [chartData]);

  return (
    <div className="glass-panel rounded-3xl border border-white/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Body Comp Trends
          </p>
          <p className="mt-1 text-sm text-slate-500">Track your composition over time</p>
        </div>

        {/* Range buttons */}
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                range === r.key
                  ? "bg-white/15 text-slate-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date inputs */}
      {range === "custom" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-400/60"
          />
          <span className="text-xs text-slate-500">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-400/60"
          />
        </div>
      )}

      {/* Metric toggle */}
      <div className="mt-4 flex flex-wrap gap-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              metric === m.key
                ? "border-transparent text-slate-100"
                : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
            }`}
            style={metric === m.key ? { backgroundColor: `${m.color}22`, borderColor: `${m.color}55` } : {}}
          >
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: m.color }}
            />
            {m.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="mt-6 h-64">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-500">Loading...</p>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-rose-400">{error}</p>
          </div>
        ) : !hasData ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-500">No data for this period. Log body comp to start tracking.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id={activeMetric.gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={activeMetric.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={activeMetric.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}${activeMetric.unit === "%" ? "%" : ""}`}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  color: "#e2e8f0",
                  fontSize: 12,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                }}
                labelStyle={{ color: "#94a3b8", marginBottom: 4 }}
                formatter={(value, name) => [
                  `${value ?? ""}${activeMetric.unit}`,
                  name === "actual" ? activeMetric.label : "Trend",
                ]}
              />
              {/* Actual data line */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke={activeMetric.color}
                strokeWidth={2}
                dot={{ r: 3, fill: activeMetric.color, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: activeMetric.color }}
                connectNulls={false}
                name="actual"
              />
              {/* Trendline */}
              <Line
                type="linear"
                dataKey="trend"
                stroke={activeMetric.color}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                activeDot={false}
                strokeOpacity={0.5}
                name="trend"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {hasData && !loading && (
        <p className="mt-2 text-[11px] text-slate-600">
          Dashed line = trendline (linear regression)
        </p>
      )}
    </div>
  );
}
