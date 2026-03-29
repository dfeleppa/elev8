"use client";

import { useEffect, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WeekType = "normal" | "deload" | "off";
type LiftMode = "percentage" | "rpe" | "linear_weight";
type CondMode = "distance" | "time" | "intervals";
type Category = "lift" | "conditioning";

type WeekRow = {
  weekNumber: number;
  weekType: WeekType;
  // lift
  sets: string;
  reps: string;
  progressionType: LiftMode;
  percentOfMax: string;
  rpeTarget: string;
  weightIncrement: string;
  startingWeight: string;
  // conditioning
  modality: string;
  conditioningType: CondMode;
  distanceMeters: string;
  durationSeconds: string;
  intervalCount: string;
  intervalDistanceMeters: string;
  intervalRestSeconds: string;
  targetPacePer500m: string;
  // shared
  notes: string;
};

type Props = {
  blockId: string;
  blockType: string;
  trackId: string;
  organizationId: string;
  selectedDay: string;
  onApplied: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DURATION_PRESETS = [4, 6, 8, 12];

function defaultRow(weekNumber: number): WeekRow {
  return {
    weekNumber,
    weekType: "normal",
    sets: "",
    reps: "",
    progressionType: "percentage",
    percentOfMax: "",
    rpeTarget: "",
    weightIncrement: "",
    startingWeight: "",
    modality: "run",
    conditioningType: "distance",
    distanceMeters: "",
    durationSeconds: "",
    intervalCount: "",
    intervalDistanceMeters: "",
    intervalRestSeconds: "",
    targetPacePer500m: "",
    notes: "",
  };
}

function buildWeeks(count: number, existing: WeekRow[]): WeekRow[] {
  return Array.from({ length: count }, (_, i) => {
    const wn = i + 1;
    return existing.find((r) => r.weekNumber === wn) ?? defaultRow(wn);
  });
}

function dbRowToWeekRow(r: Record<string, unknown>): WeekRow {
  return {
    weekNumber: Number(r.week_number),
    weekType: (r.week_type as WeekType) ?? "normal",
    sets: r.sets != null ? String(r.sets) : "",
    reps: r.reps != null ? String(r.reps) : "",
    progressionType: (r.progression_type as LiftMode) ?? "percentage",
    percentOfMax: r.percent_of_max != null ? String(r.percent_of_max) : "",
    rpeTarget: r.rpe_target != null ? String(r.rpe_target) : "",
    weightIncrement: r.weight_increment != null ? String(r.weight_increment) : "",
    startingWeight: r.starting_weight != null ? String(r.starting_weight) : "",
    modality: r.modality != null ? String(r.modality) : "run",
    conditioningType: (r.conditioning_type as CondMode) ?? "distance",
    distanceMeters: r.distance_meters != null ? String(r.distance_meters) : "",
    durationSeconds: r.duration_seconds != null ? String(r.duration_seconds) : "",
    intervalCount: r.interval_count != null ? String(r.interval_count) : "",
    intervalDistanceMeters: r.interval_distance_meters != null ? String(r.interval_distance_meters) : "",
    intervalRestSeconds: r.interval_rest_seconds != null ? String(r.interval_rest_seconds) : "",
    targetPacePer500m: r.target_pace_per_500m != null ? String(r.target_pace_per_500m) : "",
    notes: r.notes != null ? String(r.notes) : "",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TrackProgressionPanel({
  blockId,
  blockType,
  trackId,
  organizationId,
  selectedDay,
  onApplied,
}: Props) {
  const defaultCategory: Category = blockType === "lift" ? "lift" : "conditioning";

  const [loaded, setLoaded] = useState(false);
  const [progressionId, setProgressionId] = useState<string | null>(null);
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [startDate, setStartDate] = useState(selectedDay);
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [weeks, setWeeks] = useState<WeekRow[]>(() => buildWeeks(4, []));
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  // ---- Load existing progression on mount / blockId change ----
  const load = useCallback(async () => {
    setLoaded(false);
    setApplyResult(null);
    try {
      const res = await fetch(`/api/programming/track-progressions?blockId=${blockId}`, {
        cache: "no-store",
      });
      const payload = await res.json();
      if (payload?.progression) {
        const p = payload.progression;
        setProgressionId(p.id);
        setDurationWeeks(p.duration_weeks);
        setStartDate(p.start_date);
        setCategory(p.category ?? defaultCategory);
        const dbWeeks: WeekRow[] = (p.weeks ?? []).map(dbRowToWeekRow);
        setWeeks(buildWeeks(p.duration_weeks, dbWeeks));
      } else {
        setProgressionId(null);
        setDurationWeeks(4);
        setStartDate(selectedDay);
        setCategory(defaultCategory);
        setWeeks(buildWeeks(4, []));
      }
    } finally {
      setLoaded(true);
    }
  }, [blockId, selectedDay, defaultCategory]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Sync weeks array when durationWeeks changes ----
  useEffect(() => {
    setWeeks((prev) => buildWeeks(durationWeeks, prev));
  }, [durationWeeks]);

  // ---- Update a single field on a week row ----
  function updateWeek(weekNumber: number, field: keyof WeekRow, value: string) {
    setWeeks((prev) =>
      prev.map((row) =>
        row.weekNumber === weekNumber ? { ...row, [field]: value } : row
      )
    );
  }

  // ---- Copy row N down to all subsequent rows ----
  function copyDown(fromWeekNumber: number) {
    setWeeks((prev) => {
      const source = prev.find((r) => r.weekNumber === fromWeekNumber);
      if (!source) return prev;
      return prev.map((row) =>
        row.weekNumber > fromWeekNumber
          ? { ...row, ...source, weekNumber: row.weekNumber, weekType: row.weekType }
          : row
      );
    });
  }

  // ---- Auto-fill % (lift only): linear interpolation ----
  function autoFillPercent() {
    setWeeks((prev) => {
      const active = prev.filter((r) => r.weekType !== "off");
      const filled = active.filter((r) => r.percentOfMax !== "");
      if (filled.length < 2) return prev;

      const first = filled[0];
      const last = filled[filled.length - 1];
      const startPct = parseFloat(first.percentOfMax);
      const endPct = parseFloat(last.percentOfMax);
      const span = last.weekNumber - first.weekNumber;
      if (span === 0 || isNaN(startPct) || isNaN(endPct)) return prev;

      const step = (endPct - startPct) / span;

      return prev.map((row) => {
        if (row.weekType === "off") return row;
        if (row.weekNumber < first.weekNumber || row.weekNumber > last.weekNumber) return row;
        const interpolated = startPct + step * (row.weekNumber - first.weekNumber);
        return { ...row, percentOfMax: interpolated.toFixed(1) };
      });
    });
  }

  // ---- Save ----
  async function handleSave(): Promise<string | null> {
    setSaving(true);
    try {
      const res = await fetch("/api/programming/track-progressions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockId,
          organizationId,
          trackId,
          category,
          startDate,
          durationWeeks,
          weeks,
        }),
      });
      const payload = await res.json();
      if (!res.ok) return null;
      const id: string = payload.progressionId;
      setProgressionId(id);
      return id;
    } finally {
      setSaving(false);
    }
  }

  // ---- Apply to calendar ----
  async function handleApply() {
    setApplyResult(null);
    const id = await handleSave();
    if (!id) return;

    setApplying(true);
    try {
      const res = await fetch(`/api/programming/track-progressions/${id}/apply`, {
        method: "POST",
      });
      const payload = await res.json();
      if (res.ok) {
        setApplyResult(`${payload.created} block${payload.created === 1 ? "" : "s"} created on the calendar.`);
        onApplied();
      }
    } finally {
      setApplying(false);
    }
  }

  // ---- Shared input classes ----
  const inputCls = "w-full rounded border border-white/10 bg-white/5 px-1.5 py-1 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none disabled:opacity-40";
  const selectCls = "w-full rounded border border-white/10 bg-[#1a1d26] px-1.5 py-1 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none disabled:opacity-40";

  if (!loaded) {
    return <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5" />;
  }

  return (
    <div className="space-y-4">
      {/* ── Config row ── */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Duration */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-widest text-slate-500">Weeks</label>
          <div className="flex items-center gap-1">
            {DURATION_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDurationWeeks(n)}
                className={`rounded px-2 py-1 text-xs font-semibold transition ${
                  durationWeeks === n
                    ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                    : "border border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
                }`}
              >
                {n}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={52}
              value={!DURATION_PRESETS.includes(durationWeeks) ? durationWeeks : ""}
              placeholder="…"
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1 && v <= 52) setDurationWeeks(v);
              }}
              className="w-12 rounded border border-white/10 bg-white/5 px-1.5 py-1 text-center text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Start date */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-widest text-slate-500">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-white/10 bg-[#1a1d26] px-2 py-1 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-widest text-slate-500">Type</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="rounded border border-white/10 bg-[#1a1d26] px-2 py-1 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
          >
            <option value="lift">Lift</option>
            <option value="conditioning">Conditioning</option>
          </select>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        {category === "lift" ? (
          <LiftGrid weeks={weeks} inputCls={inputCls} selectCls={selectCls} onUpdate={updateWeek} onCopyDown={copyDown} />
        ) : (
          <CondGrid weeks={weeks} inputCls={inputCls} selectCls={selectCls} onUpdate={updateWeek} onCopyDown={copyDown} />
        )}
      </div>

      {/* ── Footer actions ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {category === "lift" && (
            <button
              type="button"
              onClick={autoFillPercent}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-slate-100"
            >
              Auto-fill %
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving || applying}
            onClick={handleSave}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={saving || applying}
            onClick={handleApply}
            className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(2,132,199,0.3)] transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {applying ? "Applying…" : "Apply to Calendar →"}
          </button>
        </div>
      </div>

      {applyResult && (
        <p className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-300">
          {applyResult}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lift grid
// ---------------------------------------------------------------------------

type GridProps = {
  weeks: WeekRow[];
  inputCls: string;
  selectCls: string;
  onUpdate: (weekNumber: number, field: keyof WeekRow, value: string) => void;
  onCopyDown: (weekNumber: number) => void;
};

function LiftGrid({ weeks, inputCls, selectCls, onUpdate, onCopyDown }: GridProps) {
  return (
    <table className="w-full min-w-[640px] border-collapse text-xs">
      <thead>
        <tr className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-widest text-slate-500">
          <th className="px-2 py-2 text-left">Wk</th>
          <th className="px-2 py-2 text-left">Type</th>
          <th className="px-2 py-2 text-left">Sets</th>
          <th className="px-2 py-2 text-left">Reps</th>
          <th className="px-2 py-2 text-left">Mode</th>
          <th className="px-2 py-2 text-left">Value</th>
          <th className="px-2 py-2 text-left">Notes</th>
          <th className="px-2 py-2" />
        </tr>
      </thead>
      <tbody>
        {weeks.map((row) => {
          const off = row.weekType === "off";
          return (
            <tr
              key={row.weekNumber}
              className={`border-b border-white/5 transition ${
                off ? "opacity-40" : row.weekType === "deload" ? "bg-amber-500/5" : ""
              }`}
            >
              {/* Wk */}
              <td className="px-2 py-1.5 font-semibold text-slate-400">{row.weekNumber}</td>

              {/* Type */}
              <td className="px-2 py-1.5">
                <select
                  value={row.weekType}
                  onChange={(e) => onUpdate(row.weekNumber, "weekType", e.target.value)}
                  className={selectCls}
                >
                  <option value="normal">Normal</option>
                  <option value="deload">Deload</option>
                  <option value="off">Off</option>
                </select>
              </td>

              {/* Sets */}
              <td className="px-2 py-1.5">
                <input
                  disabled={off}
                  type="number"
                  min={1}
                  value={row.sets}
                  onChange={(e) => onUpdate(row.weekNumber, "sets", e.target.value)}
                  placeholder="—"
                  className={inputCls}
                />
              </td>

              {/* Reps */}
              <td className="px-2 py-1.5">
                <input
                  disabled={off}
                  type="text"
                  value={row.reps}
                  onChange={(e) => onUpdate(row.weekNumber, "reps", e.target.value)}
                  placeholder="5"
                  className={inputCls}
                />
              </td>

              {/* Mode */}
              <td className="px-2 py-1.5">
                <select
                  disabled={off}
                  value={row.progressionType}
                  onChange={(e) => onUpdate(row.weekNumber, "progressionType", e.target.value)}
                  className={selectCls}
                >
                  <option value="percentage">% 1RM</option>
                  <option value="rpe">RPE</option>
                  <option value="linear_weight">Linear</option>
                </select>
              </td>

              {/* Value (conditional) */}
              <td className="px-2 py-1.5">
                {row.progressionType === "percentage" && (
                  <input
                    disabled={off}
                    type="number"
                    min={0}
                    max={120}
                    step={0.5}
                    value={row.percentOfMax}
                    onChange={(e) => onUpdate(row.weekNumber, "percentOfMax", e.target.value)}
                    placeholder="75"
                    className={inputCls}
                  />
                )}
                {row.progressionType === "rpe" && (
                  <input
                    disabled={off}
                    type="number"
                    min={1}
                    max={10}
                    step={0.5}
                    value={row.rpeTarget}
                    onChange={(e) => onUpdate(row.weekNumber, "rpeTarget", e.target.value)}
                    placeholder="8"
                    className={inputCls}
                  />
                )}
                {row.progressionType === "linear_weight" && (
                  <div className="flex gap-1">
                    <input
                      disabled={off}
                      type="number"
                      value={row.startingWeight}
                      onChange={(e) => onUpdate(row.weekNumber, "startingWeight", e.target.value)}
                      placeholder="Start"
                      className={inputCls}
                    />
                    <input
                      disabled={off}
                      type="number"
                      value={row.weightIncrement}
                      onChange={(e) => onUpdate(row.weekNumber, "weightIncrement", e.target.value)}
                      placeholder="+lbs"
                      className={inputCls}
                    />
                  </div>
                )}
              </td>

              {/* Notes */}
              <td className="px-2 py-1.5">
                <input
                  disabled={off}
                  type="text"
                  value={row.notes}
                  onChange={(e) => onUpdate(row.weekNumber, "notes", e.target.value)}
                  placeholder="Notes…"
                  className={inputCls}
                />
              </td>

              {/* Copy down */}
              <td className="px-2 py-1.5">
                <button
                  type="button"
                  title="Copy this week down"
                  onClick={() => onCopyDown(row.weekNumber)}
                  className="text-slate-600 transition hover:text-slate-300"
                >
                  ↓
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Conditioning grid
// ---------------------------------------------------------------------------

function CondGrid({ weeks, inputCls, selectCls, onUpdate, onCopyDown }: GridProps) {
  return (
    <table className="w-full min-w-[700px] border-collapse text-xs">
      <thead>
        <tr className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-widest text-slate-500">
          <th className="px-2 py-2 text-left">Wk</th>
          <th className="px-2 py-2 text-left">Type</th>
          <th className="px-2 py-2 text-left">Modality</th>
          <th className="px-2 py-2 text-left">Mode</th>
          <th className="px-2 py-2 text-left">Prescription</th>
          <th className="px-2 py-2 text-left">Notes</th>
          <th className="px-2 py-2" />
        </tr>
      </thead>
      <tbody>
        {weeks.map((row) => {
          const off = row.weekType === "off";
          return (
            <tr
              key={row.weekNumber}
              className={`border-b border-white/5 transition ${
                off ? "opacity-40" : row.weekType === "deload" ? "bg-amber-500/5" : ""
              }`}
            >
              {/* Wk */}
              <td className="px-2 py-1.5 font-semibold text-slate-400">{row.weekNumber}</td>

              {/* Type */}
              <td className="px-2 py-1.5">
                <select
                  value={row.weekType}
                  onChange={(e) => onUpdate(row.weekNumber, "weekType", e.target.value)}
                  className={selectCls}
                >
                  <option value="normal">Normal</option>
                  <option value="deload">Deload</option>
                  <option value="off">Off</option>
                </select>
              </td>

              {/* Modality */}
              <td className="px-2 py-1.5">
                <select
                  disabled={off}
                  value={row.modality}
                  onChange={(e) => onUpdate(row.weekNumber, "modality", e.target.value)}
                  className={selectCls}
                >
                  <option value="run">Run</option>
                  <option value="row">Row</option>
                  <option value="bike">Bike</option>
                  <option value="ski">Ski</option>
                  <option value="swim">Swim</option>
                </select>
              </td>

              {/* Mode */}
              <td className="px-2 py-1.5">
                <select
                  disabled={off}
                  value={row.conditioningType}
                  onChange={(e) => onUpdate(row.weekNumber, "conditioningType", e.target.value)}
                  className={selectCls}
                >
                  <option value="distance">Distance</option>
                  <option value="time">Time</option>
                  <option value="intervals">Intervals</option>
                </select>
              </td>

              {/* Prescription (conditional) */}
              <td className="px-2 py-1.5">
                {row.conditioningType === "distance" && (
                  <input
                    disabled={off}
                    type="number"
                    min={0}
                    value={row.distanceMeters}
                    onChange={(e) => onUpdate(row.weekNumber, "distanceMeters", e.target.value)}
                    placeholder="meters"
                    className={inputCls}
                  />
                )}
                {row.conditioningType === "time" && (
                  <input
                    disabled={off}
                    type="number"
                    min={0}
                    value={row.durationSeconds}
                    onChange={(e) => onUpdate(row.weekNumber, "durationSeconds", e.target.value)}
                    placeholder="seconds"
                    className={inputCls}
                  />
                )}
                {row.conditioningType === "intervals" && (
                  <div className="flex gap-1">
                    <input
                      disabled={off}
                      type="number"
                      min={1}
                      value={row.intervalCount}
                      onChange={(e) => onUpdate(row.weekNumber, "intervalCount", e.target.value)}
                      placeholder="×"
                      className={inputCls}
                    />
                    <input
                      disabled={off}
                      type="number"
                      min={0}
                      value={row.intervalDistanceMeters}
                      onChange={(e) => onUpdate(row.weekNumber, "intervalDistanceMeters", e.target.value)}
                      placeholder="m"
                      className={inputCls}
                    />
                    <input
                      disabled={off}
                      type="number"
                      min={0}
                      value={row.intervalRestSeconds}
                      onChange={(e) => onUpdate(row.weekNumber, "intervalRestSeconds", e.target.value)}
                      placeholder="rest"
                      className={inputCls}
                    />
                  </div>
                )}
              </td>

              {/* Notes */}
              <td className="px-2 py-1.5">
                <input
                  disabled={off}
                  type="text"
                  value={row.notes}
                  onChange={(e) => onUpdate(row.weekNumber, "notes", e.target.value)}
                  placeholder="Notes…"
                  className={inputCls}
                />
              </td>

              {/* Copy down */}
              <td className="px-2 py-1.5">
                <button
                  type="button"
                  title="Copy this week down"
                  onClick={() => onCopyDown(row.weekNumber)}
                  className="text-slate-600 transition hover:text-slate-300"
                >
                  ↓
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
