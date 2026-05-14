"use client";

import { useEffect, useState } from "react";

type RecommendationStatus =
  | "insufficient_weight_data"
  | "low_adherence"
  | "likely_undertracking"
  | "on_track"
  | "adjust"
  | "guardrail_blocked";

type ProposedMacros = {
  targetCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
};

type Recommendation = {
  status: RecommendationStatus;
  reason: string;
  warnings: string[];
  calorieDelta: number;
  proposed: ProposedMacros | null;
  adherence: { adherencePercent: number; daysLogged: number; daysExpected: number };
  weightTrend: {
    observedWeeklyChangeLbs: number | null;
    expectedWeeklyChangeLbs: number;
  };
};

type PendingCheckIn = {
  id: string;
  plan_id: string;
  status: string;
  recommendation: Recommendation;
  created_at: string;
};

type Props = {
  /** Optional memberId override for coach/admin viewing another member. */
  memberId?: string;
  /** If false, hide the apply/dismiss controls (member view). */
  canManage?: boolean;
};

const STATUS_LABEL: Record<RecommendationStatus, string> = {
  adjust: "Adjustment Recommended",
  on_track: "On Track",
  low_adherence: "Tracking Inconsistent",
  likely_undertracking: "Possible Undertracking",
  insufficient_weight_data: "Need More Weight Data",
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

export default function NutritionCheckInBanner({ memberId, canManage = false }: Props) {
  const [pending, setPending] = useState<PendingCheckIn | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"apply" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = memberId ? `?memberId=${encodeURIComponent(memberId)}` : "";

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/coach/nutrition-plan/check-in/pending${query}`, { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!active) return;
        if (res.ok) setPending(payload?.pending ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query]);

  if (loading || !pending) return null;
  const rec = pending.recommendation;

  async function apply() {
    if (!pending) return;
    setBusy("apply");
    setError(null);
    try {
      const res = await fetch(`/api/coach/nutrition-plan/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: memberId ?? undefined, checkInId: pending.id }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Failed to apply.");
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply.");
    } finally {
      setBusy(null);
    }
  }

  async function dismiss() {
    if (!pending) return;
    setBusy("dismiss");
    setError(null);
    try {
      const res = await fetch(`/api/coach/nutrition-plan/check-in/pending`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: memberId ?? undefined, checkInId: pending.id }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Failed to dismiss.");
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dismiss.");
    } finally {
      setBusy(null);
    }
  }

  const hasMacroChange = Boolean(rec.proposed);
  const adherencePct = Math.round(rec.adherence.adherencePercent * 100);
  const observed = rec.weightTrend.observedWeeklyChangeLbs;
  const expected = rec.weightTrend.expectedWeeklyChangeLbs;

  return (
    <div className={`mt-4 rounded-2xl border bg-[var(--panel-2)] p-4 ${STATUS_TONE[rec.status]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-80">Check-In</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text)]">{STATUS_LABEL[rec.status]}</p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
          {new Date(pending.created_at).toLocaleDateString()}
        </p>
      </div>

      <p className="mt-2 text-sm text-[var(--text-muted)]">{rec.reason}</p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)]">
        <div>
          <p className="opacity-70">Logging</p>
          <p className="text-[var(--text)]">
            {rec.adherence.daysLogged}/{rec.adherence.daysExpected} days ({adherencePct}%)
          </p>
        </div>
        <div>
          <p className="opacity-70">Weight Trend</p>
          <p className="text-[var(--text)]">
            {observed === null ? "—" : `${observed >= 0 ? "+" : ""}${observed} lb/wk`}
            <span className="opacity-60"> vs {expected >= 0 ? "+" : ""}{expected}</span>
          </p>
        </div>
      </div>

      {hasMacroChange && rec.proposed ? (
        <div className="mt-3 rounded-xl bg-[var(--panel)] p-3 text-xs">
          <p className="text-[var(--text-muted)]">
            Proposed:{" "}
            <span className="font-semibold text-[var(--text)]">
              {rec.calorieDelta > 0 ? "+" : ""}
              {rec.calorieDelta} kcal/day → {rec.proposed.targetCalories} kcal
            </span>
          </p>
          <p className="mt-1 text-[var(--text-muted)]">
            P {rec.proposed.proteinGrams}g · C {rec.proposed.carbsGrams}g · F{" "}
            {rec.proposed.fatGrams}g · Fiber {rec.proposed.fiberGrams}g
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

      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}

      {canManage ? (
        <div className="mt-3 flex gap-2">
          {hasMacroChange ? (
            <button
              type="button"
              onClick={apply}
              disabled={busy !== null}
              className="rounded-full border border-[var(--accent-cyan)] px-3 py-1 text-xs font-semibold text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10 disabled:opacity-50"
            >
              {busy === "apply" ? "Applying…" : "Apply"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            disabled={busy !== null}
            className="rounded-full border border-[var(--line-strong)] px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
          >
            {busy === "dismiss" ? "Dismissing…" : "Dismiss"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
