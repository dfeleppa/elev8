"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Minus, Plus, Search, X } from "lucide-react";

type Movement = { id: string; name: string };
type LiftSet = { reps: string; weight: string };

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  onSaved?: () => void;
};

export default function LogLiftCard({ onSaved }: Props) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState<Movement | null>(null);

  const [date, setDate] = useState(todayKey);
  const [sets, setSets] = useState<LiftSet[]>([{ reps: "", weight: "" }]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/athlete/movements`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMovements(d.movements ?? []))
      .catch(() => {})
      .finally(() => setMovementsLoading(false));
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = movements.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase())
  );

  function selectMovement(m: Movement) {
    setSelected(m);
    setQuery(m.name);
    setDropdownOpen(false);
  }

  function clearMovement() {
    setSelected(null);
    setQuery("");
    setDropdownOpen(false);
  }

  function addSet() {
    setSets((prev) => [...prev, { reps: "", weight: "" }]);
  }

  function removeSet(i: number) {
    setSets((prev) => prev.filter((_, j) => j !== i));
  }

  function updateSet(i: number, field: "reps" | "weight", value: string) {
    setSets((prev) => prev.map((s, j) => (j === i ? { ...s, [field]: value } : s)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    const parsedSets = sets
      .map((s) => ({ reps: parseInt(s.reps, 10), weight: parseFloat(s.weight) }))
      .filter((s) => Number.isFinite(s.reps) && s.reps > 0 && Number.isFinite(s.weight) && s.weight > 0);

    if (parsedSets.length === 0) {
      setError("Add at least one valid set with reps and weight.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/athlete/lift-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movementId: selected.id,
          dayDate: date,
          sets: parsedSets,
          notes: notes.trim() || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? "Failed to save.");
      setSuccess(true);
      setSets([{ reps: "", weight: "" }]);
      setNotes("");
      onSaved?.();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-panel rounded-3xl border border-white/10 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Log Lift</p>
      <p className="mt-1 text-sm text-slate-500">Record a standalone lift outside of programming</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        {/* Movement search */}
        <div ref={containerRef} className="relative">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
            Movement
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 focus-within:border-white/30">
            <Search className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setDropdownOpen(true);
                if (selected && e.target.value !== selected.name) setSelected(null);
              }}
              onFocus={() => setDropdownOpen(true)}
              placeholder={movementsLoading ? "Loading movements..." : "Search movements..."}
              disabled={movementsLoading}
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
            />
            {query && (
              <button type="button" onClick={clearMovement} className="shrink-0 text-slate-500 transition hover:text-slate-300">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {dropdownOpen && query && filtered.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-[#0f172a] shadow-xl">
              {filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectMovement(m)}
                  className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-white/5 ${
                    selected?.id === m.id ? "text-sky-300" : "text-slate-200"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
          {dropdownOpen && query && filtered.length === 0 && !movementsLoading && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-white/10 bg-[#0f172a] px-4 py-3 shadow-xl">
              <p className="text-sm text-slate-500">No movements found.</p>
            </div>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-white/30"
          />
        </div>

        {/* Sets */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Sets</label>
            <button
              type="button"
              onClick={addSet}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              <Plus className="h-3 w-3" />
              Add Set
            </button>
          </div>
          <div className="space-y-2">
            {sets.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center text-xs text-slate-500">{i + 1}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  placeholder="Reps"
                  value={s.reps}
                  onChange={(e) => updateSet(i, "reps", e.target.value)}
                  className="w-20 rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-white/30"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  step="2.5"
                  min="0"
                  placeholder="Weight (lb)"
                  value={s.weight}
                  onChange={(e) => updateSet(i, "weight", e.target.value)}
                  className="flex-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-white/30"
                />
                {sets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSet(i)}
                    className="text-slate-600 transition hover:text-rose-400"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
            Notes
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-white/30"
          />
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !selected}
            className="rounded-xl bg-gradient-to-br from-pink-400 to-pink-600 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-[0_4px_20px_rgba(255,177,196,0.2)] transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Lift"}
          </button>
          {success && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Saved!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
