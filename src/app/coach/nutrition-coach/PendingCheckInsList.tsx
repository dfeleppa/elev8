"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type RecommendationStatus =
  | "insufficient_weight_data"
  | "low_adherence"
  | "likely_undertracking"
  | "on_track"
  | "adjust"
  | "guardrail_blocked";

type Recommendation = {
  status: RecommendationStatus;
  reason: string;
  warnings: string[];
  calorieDelta: number;
  proposed: {
    targetCalories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    fiberGrams: number;
  } | null;
  adherence: { adherencePercent: number; daysLogged: number; daysExpected: number };
  weightTrend: {
    observedWeeklyChangeLbs: number | null;
    expectedWeeklyChangeLbs: number;
  };
};

type PendingItem = {
  id: string;
  memberId: string;
  memberName: string | null;
  memberEmail: string | null;
  planId: string;
  recommendation: Recommendation;
  createdAt: string;
};

const STATUS_LABEL: Record<RecommendationStatus, string> = {
  adjust: "Adjustment Recommended",
  on_track: "On Track",
  low_adherence: "Tracking Inconsistent",
  likely_undertracking: "Possible Undertracking",
  insufficient_weight_data: "Need More Data",
  guardrail_blocked: "Coach Review Needed",
};

const STATUS_TONE: Record<RecommendationStatus, string> = {
  adjust: "border-[var(--accent-cyan)] text-[var(--accent-cyan)]",
  on_track: "border-emerald-400/60 text-emerald-300",
  low_adherence: "border-amber-400/60 text-amber-300",
  likely_undertracking: "border-amber-400/60 text-amber-300",
  insufficient_weight_data: "border-[var(--line-strong)] text-[var(--text-muted)]",
  guardrail_blocked: "border-rose-400/60 text-rose-300",
};

export default function PendingCheckInsList() {
  const [items, setItems] = useState<PendingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/coach/nutrition-plan/check-in/pending/list", { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) {
          setError(payload?.error ?? "Failed to load.");
          setItems([]);
          return;
        }
        setItems((payload?.items ?? []) as PendingItem[]);
      })
      .catch(() => {
        if (active) {
          setError("Failed to load.");
          setItems([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function apply(item: PendingItem) {
    setBusyId(item.id);
    setError(null);
    try {
      const res = await fetch("/api/coach/nutrition-plan/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: item.memberId, checkInId: item.id }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to apply.");
      }
      setItems((prev) => prev?.filter((it) => it.id !== item.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply.");
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(item: PendingItem) {
    setBusyId(item.id);
    setError(null);
    try {
      const res = await fetch("/api/coach/nutrition-plan/check-in/pending", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: item.memberId, checkInId: item.id }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to dismiss.");
      }
      setItems((prev) => prev?.filter((it) => it.id !== item.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dismiss.");
    } finally {
      setBusyId(null);
    }
  }

  if (items === null) {
    return <p className="text-sm text-[var(--text-muted)]">Loading pending check-ins…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="panel rounded-3xl p-6 text-sm text-[var(--text-muted)]">
        No pending nutrition check-ins. The daily cron will queue new ones as plans come due.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      {items.map((item) => {
        const rec = item.recommendation;
        const adherencePct = Math.round(rec.adherence.adherencePercent * 100);
        const observed = rec.weightTrend.observedWeeklyChangeLbs;
        const expected = rec.weightTrend.expectedWeeklyChangeLbs;
        const hasMacroChange = Boolean(rec.proposed);

        return (
          <div
            key={item.id}
            className={`rounded-2xl border bg-[var(--panel-2)] p-4 ${STATUS_TONE[rec.status]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {item.memberName ?? item.memberEmail ?? item.memberId}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] opacity-80">
                  {STATUS_LABEL[rec.status]}
                </p>
              </div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </div>

            <p className="mt-2 text-sm text-[var(--text-muted)]">{rec.reason}</p>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-3">
              <div>
                <p className="opacity-70">Logging</p>
                <p className="text-[var(--text)]">
                  {rec.adherence.daysLogged}/{rec.adherence.daysExpected} ({adherencePct}%)
                </p>
              </div>
              <div>
                <p className="opacity-70">Weight Trend</p>
                <p className="text-[var(--text)]">
                  {observed === null ? "—" : `${observed >= 0 ? "+" : ""}${observed} lb/wk`}
                  <span className="opacity-60"> vs {expected >= 0 ? "+" : ""}{expected}</span>
                </p>
              </div>
              {hasMacroChange && rec.proposed ? (
                <div>
                  <p className="opacity-70">Proposed</p>
                  <p className="text-[var(--text)]">
                    {rec.calorieDelta > 0 ? "+" : ""}
                    {rec.calorieDelta} kcal → {rec.proposed.targetCalories}
                  </p>
                </div>
              ) : null}
            </div>

            {hasMacroChange && rec.proposed ? (
              <div className="mt-3 rounded-xl bg-[var(--panel)] p-3 text-xs text-[var(--text-muted)]">
                <p>
                  Macros:{" "}
                  <span className="text-[var(--text)]">
                    P {rec.proposed.proteinGrams}g / C {rec.proposed.carbsGrams}g / F{" "}
                    {rec.proposed.fatGrams}g / Fiber {rec.proposed.fiberGrams}g
                  </span>
                </p>
              </div>
            ) : null}

            {rec.warnings.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] text-amber-300/80">
                {rec.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {hasMacroChange ? (
                <button
                  type="button"
                  onClick={() => apply(item)}
                  disabled={busyId === item.id}
                  className="rounded-full border border-[var(--accent-cyan)] px-3 py-1 text-xs font-semibold text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10 disabled:opacity-50"
                >
                  {busyId === item.id ? "Applying…" : "Apply"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => dismiss(item)}
                disabled={busyId === item.id}
                className="rounded-full border border-[var(--line-strong)] px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
              >
                {busyId === item.id ? "Dismissing…" : "Dismiss"}
              </button>
              <Link
                href={`/coach/nutrition?memberId=${encodeURIComponent(item.memberId)}`}
                className="rounded-full border border-[var(--line-strong)] px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                View Member
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
