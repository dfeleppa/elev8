"use client";

import { useEffect, useState } from "react";
import { CopyPlus } from "lucide-react";

import type { LiftProgression, LiftProgressionType } from "@/lib/programs";
import { LIFT_PROGRESSION_TYPES } from "@/lib/programs";

type Props = {
  programId: string;
  blockId: string;
  durationWeeks: number;
};

type Row = {
  weekNumber: number;
  progressionType: LiftProgressionType;
  sets: number;
  reps: string;
  percentOfMax: string;
  rpeTarget: string;
  startingWeight: string;
  weightIncrement: string;
  notes: string;
};

function blankRow(weekNumber: number): Row {
  return {
    weekNumber,
    progressionType: "percentage",
    sets: 3,
    reps: "5",
    percentOfMax: "",
    rpeTarget: "",
    startingWeight: "",
    weightIncrement: "",
    notes: "",
  };
}

function fromApi(p: LiftProgression): Row {
  return {
    weekNumber: p.week_number,
    progressionType: p.progression_type,
    sets: p.sets,
    reps: p.reps,
    percentOfMax: p.percent_of_max != null ? String(Math.round(p.percent_of_max * 100)) : "",
    rpeTarget: p.rpe_target != null ? String(p.rpe_target) : "",
    startingWeight: p.starting_weight != null ? String(p.starting_weight) : "",
    weightIncrement: p.weight_increment != null ? String(p.weight_increment) : "",
    notes: p.notes ?? "",
  };
}

const inputSm =
  "w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none";

const selectSm =
  "w-full rounded-lg border border-white/10 bg-[#0d0f14] px-2 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none";

export default function LiftProgressionGrid({ programId, blockId, durationWeeks }: Props) {
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
        const res = await fetch(`/api/programming/programs/${programId}/blocks/${blockId}/lift-progression`);
        const data = await res.json();
        if (!isMounted) return;
        const apiRows: LiftProgression[] = data.progressions ?? [];
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
    setRows((prev) =>
      prev.map((r) => (r.weekNumber === weekNumber ? { ...r, ...patch } : r))
    );
  }

  function copyDown(weekNumber: number) {
    const source = rows.find((r) => r.weekNumber === weekNumber);
    if (!source) return;
    setRows((prev) =>
      prev.map((r) =>
        r.weekNumber > weekNumber
          ? { ...r, progressionType: source.progressionType, sets: source.sets, reps: source.reps }
          : r
      )
    );
  }

  function linearFill(field: "percentOfMax" | "rpeTarget" | "startingWeight") {
    const filled = rows.filter((r) => r[field] !== "" && !isNaN(Number(r[field])));
    if (filled.length < 2) return;
    const first = filled[0];
    const last = filled[filled.length - 1];
    const startVal = Number(first[field]);
    const endVal = Number(last[field]);
    const startWeek = first.weekNumber;
    const endWeek = last.weekNumber;
    if (endWeek === startWeek) return;
    const step = (endVal - startVal) / (endWeek - startWeek);
    setRows((prev) =>
      prev.map((r) =>
        r.weekNumber >= startWeek && r.weekNumber <= endWeek
          ? { ...r, [field]: String(Math.round((startVal + step * (r.weekNumber - startWeek)) * 10) / 10) }
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
        .filter((r) => r.reps.trim())
        .map((r) => ({
          weekNumber: r.weekNumber,
          progressionType: r.progressionType,
          sets: r.sets,
          reps: r.reps,
          percentOfMax: r.percentOfMax !== "" ? Number(r.percentOfMax) / 100 : null,
          rpeTarget: r.rpeTarget !== "" ? Number(r.rpeTarget) : null,
          startingWeight: r.startingWeight !== "" ? Number(r.startingWeight) : null,
          weightIncrement: r.weightIncrement !== "" ? Number(r.weightIncrement) : null,
          notes: r.notes || null,
        }));

      const res = await fetch(`/api/programming/programs/${programId}/blocks/${blockId}/lift-progression`, {
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
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Lift Progression</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => linearFill("percentOfMax")}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200"
            title="Linear fill % of max between filled cells"
          >
            Auto-fill %
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-lg bg-indigo-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5">
        {rows.map((row) => (
          <div key={row.weekNumber} className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-12 shrink-0 text-[10px] font-semibold text-slate-500 uppercase">Wk {row.weekNumber}</span>
              <select
                value={row.progressionType}
                onChange={(e) => updateRow(row.weekNumber, { progressionType: e.target.value as LiftProgressionType })}
                className={selectSm + " flex-1"}
              >
                {LIFT_PROGRESSION_TYPES.map((t) => (
                  <option key={t} value={t}>{t === "percentage" ? "% of Max" : t === "rpe" ? "RPE" : "Linear Weight"}</option>
                ))}
              </select>
              <button
                type="button"
                title="Copy scheme to remaining weeks"
                onClick={() => copyDown(row.weekNumber)}
                className="shrink-0 text-slate-600 hover:text-indigo-400"
              >
                <CopyPlus className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="mb-0.5 block text-[10px] text-slate-600">Sets</label>
                <input
                  type="number"
                  min={1}
                  value={row.sets}
                  onChange={(e) => updateRow(row.weekNumber, { sets: Math.max(1, parseInt(e.target.value) || 1) })}
                  className={inputSm}
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] text-slate-600">Reps</label>
                <input
                  type="text"
                  placeholder="e.g. 5 or 3-5"
                  value={row.reps}
                  onChange={(e) => updateRow(row.weekNumber, { reps: e.target.value })}
                  className={inputSm}
                />
              </div>

              {row.progressionType === "percentage" && (
                <div className="col-span-2">
                  <label className="mb-0.5 block text-[10px] text-slate-600">% of Max</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    step={0.5}
                    placeholder="e.g. 75"
                    value={row.percentOfMax}
                    onChange={(e) => updateRow(row.weekNumber, { percentOfMax: e.target.value })}
                    className={inputSm}
                  />
                </div>
              )}

              {row.progressionType === "rpe" && (
                <div className="col-span-2">
                  <label className="mb-0.5 block text-[10px] text-slate-600">RPE Target</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={0.5}
                    placeholder="e.g. 7.5"
                    value={row.rpeTarget}
                    onChange={(e) => updateRow(row.weekNumber, { rpeTarget: e.target.value })}
                    className={inputSm}
                  />
                </div>
              )}

              {row.progressionType === "linear_weight" && (
                <>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-slate-600">Start Weight (lbs)</label>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      placeholder="e.g. 135"
                      value={row.startingWeight}
                      onChange={(e) => updateRow(row.weekNumber, { startingWeight: e.target.value })}
                      className={inputSm}
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-slate-600">+lbs/week</label>
                    <input
                      type="number"
                      min={0}
                      step={2.5}
                      placeholder="e.g. 5"
                      value={row.weightIncrement}
                      onChange={(e) => updateRow(row.weekNumber, { weightIncrement: e.target.value })}
                      className={inputSm}
                    />
                  </div>
                </>
              )}

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
