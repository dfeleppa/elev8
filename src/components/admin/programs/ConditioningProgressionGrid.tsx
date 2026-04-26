"use client";

import { useEffect, useState } from "react";

import type { ConditioningProgression, ConditioningModality, ConditioningProgressionType } from "@/lib/programs";
import { CONDITIONING_MODALITIES, CONDITIONING_PROGRESSION_TYPES, formatDuration } from "@/lib/programs";
import { parseDurationToSeconds } from "@/lib/programming";

type Props = {
  programId: string;
  blockId: string;
  durationWeeks: number;
};

type Row = {
  weekNumber: number;
  modality: ConditioningModality;
  progressionType: ConditioningProgressionType;
  distanceMeters: string;
  durationSeconds: string;   // stored as MM:SS string for display
  intervalCount: string;
  intervalDistanceMeters: string;
  intervalRestSeconds: string; // MM:SS
  targetPacePer500m: string;   // MM:SS
  notes: string;
};

function blankRow(weekNumber: number): Row {
  return {
    weekNumber,
    modality: "run",
    progressionType: "distance",
    distanceMeters: "",
    durationSeconds: "",
    intervalCount: "",
    intervalDistanceMeters: "",
    intervalRestSeconds: "",
    targetPacePer500m: "",
    notes: "",
  };
}

function fromApi(p: ConditioningProgression): Row {
  return {
    weekNumber: p.week_number,
    modality: p.modality,
    progressionType: p.progression_type,
    distanceMeters: p.distance_meters != null ? String(p.distance_meters) : "",
    durationSeconds: p.duration_seconds != null ? formatDuration(p.duration_seconds) : "",
    intervalCount: p.interval_count != null ? String(p.interval_count) : "",
    intervalDistanceMeters: p.interval_distance_meters != null ? String(p.interval_distance_meters) : "",
    intervalRestSeconds: p.interval_rest_seconds != null ? formatDuration(p.interval_rest_seconds) : "",
    targetPacePer500m: p.target_pace_per_500m != null ? formatDuration(p.target_pace_per_500m) : "",
    notes: p.notes ?? "",
  };
}

const inputSm =
  "w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none placeholder:text-slate-600";

const selectSm =
  "w-full rounded-lg border border-white/10 bg-[#0d0f14] px-2 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none";

export default function ConditioningProgressionGrid({ programId, blockId, durationWeeks }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: durationWeeks }, (_, i) => blankRow(i + 1))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/programming/programs/${programId}/blocks/${blockId}/conditioning-progression`);
        const data = await res.json();
        if (!isMounted) return;
        const apiRows: ConditioningProgression[] = data.progressions ?? [];
        setRows(
          Array.from({ length: durationWeeks }, (_, i) => {
            const found = apiRows.find((r) => r.week_number === i + 1);
            return found ? fromApi(found) : blankRow(i + 1);
          })
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [programId, blockId, durationWeeks]);

  function updateRow(weekNumber: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.weekNumber === weekNumber ? { ...r, ...patch } : r)));
  }

  // Copy modality + progressionType down to all subsequent weeks
  function copySchemeDown(weekNumber: number) {
    const source = rows.find((r) => r.weekNumber === weekNumber);
    if (!source) return;
    setRows((prev) =>
      prev.map((r) =>
        r.weekNumber > weekNumber
          ? { ...r, modality: source.modality, progressionType: source.progressionType }
          : r
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const progressions = rows
        .filter((r) => {
          if (r.progressionType === "distance") return r.distanceMeters !== "";
          if (r.progressionType === "time") return r.durationSeconds !== "";
          if (r.progressionType === "intervals") return r.intervalCount !== "" && r.intervalDistanceMeters !== "";
          return false;
        })
        .map((r) => {
          const durationSec = r.durationSeconds ? (parseDurationToSeconds(r.durationSeconds) ?? null) : null;
          const restSec = r.intervalRestSeconds ? (parseDurationToSeconds(r.intervalRestSeconds) ?? null) : null;
          const paceSec = r.targetPacePer500m ? (parseDurationToSeconds(r.targetPacePer500m) ?? null) : null;

          return {
            weekNumber: r.weekNumber,
            modality: r.modality,
            progressionType: r.progressionType,
            distanceMeters: r.distanceMeters !== "" ? Number(r.distanceMeters) : null,
            durationSeconds: durationSec,
            intervalCount: r.intervalCount !== "" ? parseInt(r.intervalCount, 10) : null,
            intervalDistanceMeters: r.intervalDistanceMeters !== "" ? Number(r.intervalDistanceMeters) : null,
            intervalRestSeconds: restSec,
            targetPacePer500m: paceSec,
            notes: r.notes || null,
          };
        });

      const res = await fetch(`/api/programming/programs/${programId}/blocks/${blockId}/conditioning-progression`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progressions }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-xs text-slate-500 py-4">Loading progressions...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Conditioning Progression</span>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-lg bg-indigo-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
        </button>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5">
        {rows.map((row) => (
          <div key={row.weekNumber} className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
            {/* Week header + modality/type selectors */}
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-10 shrink-0 text-[10px] font-semibold text-slate-500 uppercase">Wk {row.weekNumber}</span>
              <select
                value={row.modality}
                onChange={(e) => updateRow(row.weekNumber, { modality: e.target.value as ConditioningModality })}
                className={selectSm + " flex-1"}
              >
                {CONDITIONING_MODALITIES.map((m) => (
                  <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                ))}
              </select>
              <select
                value={row.progressionType}
                onChange={(e) => updateRow(row.weekNumber, { progressionType: e.target.value as ConditioningProgressionType })}
                className={selectSm + " flex-1"}
              >
                {CONDITIONING_PROGRESSION_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
              <button
                type="button"
                title="Copy scheme down"
                onClick={() => copySchemeDown(row.weekNumber)}
                className="shrink-0 text-[10px] text-slate-600 hover:text-indigo-400 leading-none"
              >
                ↓
              </button>
            </div>

            {/* Type-specific fields */}
            <div className="grid grid-cols-2 gap-1.5">
              {row.progressionType === "distance" && (
                <div className="col-span-2">
                  <label className="mb-0.5 block text-[10px] text-slate-600">Distance (m)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    placeholder="e.g. 5000"
                    value={row.distanceMeters}
                    onChange={(e) => updateRow(row.weekNumber, { distanceMeters: e.target.value })}
                    className={inputSm}
                  />
                </div>
              )}

              {row.progressionType === "time" && (
                <div className="col-span-2">
                  <label className="mb-0.5 block text-[10px] text-slate-600">Duration (MM:SS)</label>
                  <input
                    type="text"
                    placeholder="e.g. 20:00"
                    value={row.durationSeconds}
                    onChange={(e) => updateRow(row.weekNumber, { durationSeconds: e.target.value })}
                    className={inputSm}
                  />
                </div>
              )}

              {row.progressionType === "intervals" && (
                <>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-slate-600">Intervals</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="e.g. 8"
                      value={row.intervalCount}
                      onChange={(e) => updateRow(row.weekNumber, { intervalCount: e.target.value })}
                      className={inputSm}
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-slate-600">Distance/interval (m)</label>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      placeholder="e.g. 400"
                      value={row.intervalDistanceMeters}
                      onChange={(e) => updateRow(row.weekNumber, { intervalDistanceMeters: e.target.value })}
                      className={inputSm}
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-slate-600">Rest (MM:SS)</label>
                    <input
                      type="text"
                      placeholder="e.g. 2:00"
                      value={row.intervalRestSeconds}
                      onChange={(e) => updateRow(row.weekNumber, { intervalRestSeconds: e.target.value })}
                      className={inputSm}
                    />
                  </div>
                </>
              )}

              <div className={row.progressionType === "intervals" ? "" : "col-span-2"}>
                <label className="mb-0.5 block text-[10px] text-slate-600">Target Pace /500m (MM:SS)</label>
                <input
                  type="text"
                  placeholder="e.g. 2:10"
                  value={row.targetPacePer500m}
                  onChange={(e) => updateRow(row.weekNumber, { targetPacePer500m: e.target.value })}
                  className={inputSm}
                />
              </div>

              <div className="col-span-2">
                <label className="mb-0.5 block text-[10px] text-slate-600">Notes</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={row.notes}
                  onChange={(e) => updateRow(row.weekNumber, { notes: e.target.value })}
                  className={inputSm}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
