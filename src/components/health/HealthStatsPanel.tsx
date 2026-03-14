"use client";

import { useEffect, useMemo, useState } from "react";

import type { StatGroup } from "./health-stats-config";

type StatValue = {
  value: string;
  unit: string;
  entryDate: string | null;
};

type StatsPayloadEntry = {
  value?: string | number | null;
  unit?: string | null;
  entryDate?: string | null;
};

type HealthStatsResponse = {
  stats?: Record<string, StatsPayloadEntry>;
  error?: string;
};

type HealthStatsPanelProps = {
  title: string;
  description: string;
  groups: StatGroup[];
};

export default function HealthStatsPanel({ title, description, groups }: HealthStatsPanelProps) {
  const initialValues = useMemo(() => {
    return Object.fromEntries(
      groups.flatMap((group) =>
        group.stats.map((stat) => [stat.key, { value: "", unit: stat.unit, entryDate: null }])
      )
    ) as Record<string, StatValue>;
  }, [groups]);

  const [values, setValues] = useState<Record<string, StatValue>>(initialValues);
  const [editingStat, setEditingStat] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      try {
        const response = await fetch("/api/health-stats", { cache: "no-store" });
        const payload = (await response.json()) as HealthStatsResponse;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to load stats.");
        }

        if (isMounted) {
          setValues((prev) => {
            const next = { ...prev };
            Object.entries(payload?.stats ?? {}).forEach(([key, entry]) => {
              if (next[key]) {
                next[key] = {
                  value: entry?.value?.toString?.() ?? "",
                  unit: entry?.unit ?? next[key].unit,
                  entryDate: entry?.entryDate ?? null,
                };
              }
            });
            return next;
          });
        }
      } catch (error) {
        if (isMounted) {
          const message = error instanceof Error ? error.message : "Unable to load stats.";
          setErrorMessage(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  const startEdit = (statKey: string) => {
    setEditingStat(statKey);
    setDraftValue(values[statKey]?.value ?? "");
    setErrorMessage(null);
  };

  const cancelEdit = () => {
    setEditingStat(null);
    setDraftValue("");
  };

  const saveEdit = async () => {
    if (!editingStat || draftValue.trim() === "") {
      return;
    }

    try {
      const response = await fetch("/api/health-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statKey: editingStat,
          value: Number(draftValue),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to save stat.");
      }

      setValues((prev) => ({
        ...prev,
        [editingStat]: {
          value: payload?.entry?.value?.toString?.() ?? draftValue.trim(),
          unit: payload?.entry?.unit ?? prev[editingStat].unit,
          entryDate: payload?.entry?.entryDate ?? prev[editingStat].entryDate,
        },
      }));
      setEditingStat(null);
      setDraftValue("");
      setErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save stat.";
      setErrorMessage(message);
    }
  };

  return (
    <section>
      <header>
        <h1 className="text-3xl font-semibold text-slate-100">{title}</h1>
        <p className="mt-3 text-sm text-slate-400">{description}</p>
        {errorMessage ? <p className="mt-3 text-sm text-rose-300">{errorMessage}</p> : null}
      </header>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        {groups.map((group) => (
          <div
            key={group.title}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-slate-900">{group.title}</h2>
            {group.slug === "body-comp" ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Athlete</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Sex</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">--</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Age</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">--</p>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="mt-4 grid gap-3">
              {group.stats.map((stat) => (
                <div
                  key={stat.key}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <span className="text-sm font-semibold text-slate-900">{stat.label}</span>
                  {editingStat === stat.key ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={draftValue}
                        onChange={(event) => setDraftValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            saveEdit();
                          }
                          if (event.key === "Escape") {
                            cancelEdit();
                          }
                        }}
                        className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400/60"
                        aria-label={`Enter ${stat.label} value`}
                      />
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 transition hover:border-emerald-300"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 transition hover:border-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900">
                        {isLoading ? "..." : values[stat.key]?.value ? values[stat.key].value : "-"}
                      </span>
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {stat.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(stat.key)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                        aria-label={`Add ${stat.label} value`}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </section>
  );
}
