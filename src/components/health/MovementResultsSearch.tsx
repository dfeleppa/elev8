"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

type Movement = { id: string; name: string };

type LiftSet = { set_order: number | null; reps: number | null; weight: number | null };

type MovementResult = {
  id: string;
  day_date: string | null;
  score_type: string | null;
  score_text: string | null;
  score_value: number | null;
  total_reps: number | null;
  notes: string | null;
  blockTitle: string | null;
  blockType: string | null;
  sets: LiftSet[];
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatScore(result: MovementResult) {
  if (result.blockType === "lift" || result.score_type === "none") {
    if (result.sets.length > 0) {
      const best = result.sets.reduce((b, s) =>
        (s.weight ?? 0) > (b.weight ?? 0) ? s : b
      );
      return best.weight ? `${best.weight} lb × ${best.reps ?? "?"}` : result.score_text ?? "—";
    }
    return result.score_text ?? "—";
  }
  if (result.score_type === "time") return result.score_text ?? "—";
  if (result.score_type === "reps") return result.total_reps ? `${result.total_reps} reps` : result.score_text ?? "—";
  if (result.score_type === "rounds_reps") return result.score_text ?? "—";
  if (result.score_type === "distance") return result.score_text ?? "—";
  return result.score_text ?? "—";
}

export default function MovementResultsSearch() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState<Movement | null>(null);
  const [results, setResults] = useState<MovementResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/athlete/movement-results", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMovements(d.movements ?? []))
      .catch(() => {})
      .finally(() => setMovementsLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setResultsLoading(true);
    setResults([]);
    fetch(`/api/athlete/movement-results?movementId=${selected.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setResults(d.results ?? []))
      .catch(() => {})
      .finally(() => setResultsLoading(false));
  }, [selected]);

  // Close dropdown on outside click
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

  function clear() {
    setSelected(null);
    setQuery("");
    setResults([]);
    setDropdownOpen(false);
  }

  return (
    <div className="glass-panel rounded-3xl border border-white/10 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        Movement History
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Search your results by movement
      </p>

      {/* Search input */}
      <div ref={containerRef} className="relative mt-4">
        <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 focus-within:border-white/30">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDropdownOpen(true);
              if (selected && e.target.value !== selected.name) {
                setSelected(null);
                setResults([]);
              }
            }}
            onFocus={() => setDropdownOpen(true)}
            placeholder={movementsLoading ? "Loading movements..." : "Search movements..."}
            disabled={movementsLoading}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
          />
          {query && (
            <button type="button" onClick={clear} className="shrink-0 text-slate-500 hover:text-slate-300 transition">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {dropdownOpen && query && filtered.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#0f172a] shadow-xl">
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

      {/* Results */}
      {selected && (
        <div className="mt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {selected.name} — {resultsLoading ? "Loading..." : `${results.length} result${results.length !== 1 ? "s" : ""}`}
          </p>

          {resultsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-slate-500">No results recorded for this movement.</p>
          ) : (
            <div className="app-table-shell">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Workout</th>
                    <th>Best Score</th>
                    <th>Sets</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap text-sm text-slate-300">
                        {formatDate(r.day_date)}
                      </td>
                      <td className="text-sm font-medium text-slate-100">
                        {r.blockTitle ?? "—"}
                      </td>
                      <td className="text-sm text-slate-300">
                        {formatScore(r)}
                      </td>
                      <td className="text-sm text-slate-400">
                        {r.sets.length > 0
                          ? r.sets.map((s) => `${s.weight ?? "?"}×${s.reps ?? "?"}`).join(", ")
                          : "—"}
                      </td>
                      <td className="max-w-[160px] truncate text-sm text-slate-500">
                        {r.notes ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
