"use client";

import { useCallback, useEffect, useState } from "react";

import NutritionCheckInBanner from "@/components/health/NutritionCheckInBanner";

type Member = { id: string; full_name: string | null; email: string | null };

type PlanRow = {
  id: string;
  goal_type: string;
  target_calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  fiber_grams: number | null;
  effective_date: string;
  last_check_in_date: string | null;
  next_check_in_date: string | null;
  adjustment_reason: string | null;
  previous_plan_id: string | null;
  adherence_snapshot: Record<string, unknown> | null;
};

type CheckInRow = {
  id: string;
  plan_id: string;
  status: "pending" | "applied" | "dismissed" | "superseded";
  recommendation: {
    status: string;
    reason: string;
    calorieDelta: number;
  };
  created_at: string;
  reviewed_at: string | null;
  applied_plan_id: string | null;
};

type WeightRow = { entry_date: string; value: number; unit: string };

type Detail = {
  member: Member;
  plans: PlanRow[];
  checkIns: CheckInRow[];
  weights: WeightRow[];
};

type LiveRecommendation = {
  status: string;
  reason: string;
  calorieDelta: number;
  proposed: {
    targetCalories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    fiberGrams: number;
  } | null;
  warnings: string[];
} | null;

const STATUS_TONE: Record<string, string> = {
  pending: "text-amber-300",
  applied: "text-emerald-300",
  dismissed: "text-[var(--text-muted)]",
  superseded: "text-[var(--text-muted)] line-through",
};

function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return Math.round(n).toString();
}

export default function MemberDetailClient({ memberId }: { memberId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [liveRec, setLiveRec] = useState<LiveRecommendation>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/coach/nutrition-plan/member/${memberId}`, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(payload?.error ?? "Failed to load.");
        return;
      }
      setDetail(payload as Detail);
    } catch {
      setError("Failed to load.");
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAnalysisNow() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/nutrition-plan/check-in?memberId=${memberId}`, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to run analysis.");
      }
      setLiveRec(payload?.recommendation ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run analysis.");
    } finally {
      setRunning(false);
    }
  }

  if (!detail) {
    return <p className="text-sm text-[var(--text-muted)]">{error ?? "Loading…"}</p>;
  }

  const currentPlan = detail.plans[0] ?? null;
  const planChanges = detail.plans.slice(1);
  const weightSorted = [...detail.weights].sort((a, b) =>
    a.entry_date < b.entry_date ? 1 : -1
  );
  const weights = weightSorted.slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <section className="panel rounded-3xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">
              {detail.member.full_name ?? detail.member.email ?? detail.member.id}
            </p>
            <p className="text-xs text-[var(--text-muted)]">{detail.member.email}</p>
          </div>
          <button
            type="button"
            onClick={runAnalysisNow}
            disabled={running}
            className="rounded-full border border-[var(--accent-cyan)] px-3 py-1 text-xs font-semibold text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10 disabled:opacity-50"
          >
            {running ? "Running…" : "Run Analysis Now"}
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
      </section>

      {/* Live "what would the analyzer say right now" preview */}
      {liveRec ? (
        <section className="panel rounded-3xl p-5">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Live Analysis
          </h2>
          <p className="text-sm font-semibold text-[var(--text)]">{liveRec.status}</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{liveRec.reason}</p>
          {liveRec.proposed ? (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Would propose:{" "}
              <span className="text-[var(--text)]">
                {liveRec.calorieDelta > 0 ? "+" : ""}
                {liveRec.calorieDelta} kcal → {liveRec.proposed.targetCalories} kcal
              </span>
            </p>
          ) : null}
          {liveRec.warnings.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-[11px] text-amber-300/80">
              {liveRec.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {/* Pending check-in banner (reuses the existing component) */}
      <NutritionCheckInBanner memberId={memberId} canManage />

      {/* Current plan */}
      {currentPlan ? (
        <section className="panel rounded-3xl p-5">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Current Plan · effective {currentPlan.effective_date}
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Goal</p>
              <p className="text-[var(--text)]">{currentPlan.goal_type.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Calories</p>
              <p className="text-[var(--text)]">{formatNumber(currentPlan.target_calories)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Protein</p>
              <p className="text-[var(--text)]">{formatNumber(currentPlan.protein_grams)} g</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Carbs</p>
              <p className="text-[var(--text)]">{formatNumber(currentPlan.carbs_grams)} g</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Fat / Fiber</p>
              <p className="text-[var(--text)]">
                {formatNumber(currentPlan.fat_grams)} / {formatNumber(currentPlan.fiber_grams)} g
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Last check-in: {currentPlan.last_check_in_date ?? "—"} · Next:{" "}
            {currentPlan.next_check_in_date ?? "—"}
          </p>
        </section>
      ) : (
        <section className="panel rounded-3xl p-5 text-sm text-[var(--text-muted)]">
          No plan on file for this member yet.
        </section>
      )}

      {/* Plan history */}
      {planChanges.length > 0 ? (
        <section className="panel rounded-3xl p-5">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Plan History
          </h2>
          <ul className="divide-y divide-[var(--line)] text-sm">
            {planChanges.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <p className="text-[var(--text)]">{p.effective_date}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatNumber(p.target_calories)} kcal · P{formatNumber(p.protein_grams)} / C
                    {formatNumber(p.carbs_grams)} / F{formatNumber(p.fat_grams)}
                  </p>
                  {p.adjustment_reason ? (
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      {p.adjustment_reason}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Check-in history */}
      {detail.checkIns.length > 0 ? (
        <section className="panel rounded-3xl p-5">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Check-In History
          </h2>
          <ul className="divide-y divide-[var(--line)] text-sm">
            {detail.checkIns.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <p className={`text-xs uppercase tracking-[0.18em] ${STATUS_TONE[c.status] ?? ""}`}>
                    {c.status}
                  </p>
                  <p className="mt-1 text-[var(--text)]">
                    {c.recommendation.status} · Δ {c.recommendation.calorieDelta} kcal
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {c.recommendation.reason}
                  </p>
                </div>
                <p className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {new Date(c.created_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Recent weights */}
      {weights.length > 0 ? (
        <section className="panel rounded-3xl p-5">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Recent Weight Entries
          </h2>
          <ul className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-5">
            {weights.map((w) => (
              <li key={`${w.entry_date}-${w.value}`} className="flex justify-between gap-2">
                <span className="text-[var(--text-muted)]">{w.entry_date}</span>
                <span className="text-[var(--text)]">
                  {Number(w.value).toFixed(1)} {w.unit}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
