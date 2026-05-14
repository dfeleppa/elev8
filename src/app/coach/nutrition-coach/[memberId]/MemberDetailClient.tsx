"use client";

import { useCallback, useEffect, useState } from "react";

import NutritionCheckInBanner from "@/components/health/NutritionCheckInBanner";
import { Micro, Panel } from "@/components/ui";

type Member = { id: string; full_name: string | null; email: string | null };

type MetabolismEstimateSnapshot = {
  status:
    | "estimated"
    | "low_adherence"
    | "insufficient_weight_data"
    | "likely_undertracking"
    | "out_of_bounds";
  windowDays: number;
  daysLogged: number;
  daysExpected: number;
  avgDailyCalories: number;
  loggedVsTargetRatio: number;
  weightEntries: number;
  weightSpanDays: number | null;
  startWeightLbs: number | null;
  endWeightLbs: number | null;
  weightChangeLbs: number | null;
  estimatedTdee: number | null;
  formulaTdee: number;
  deltaKcal: number | null;
  confidence: "high" | "medium" | "low";
  reason: string;
};

type PlanRow = {
  id: string;
  goal_type: string;
  target_calories: number;
  maintenance_calories: number | null;
  maintenance_calories_source: "formula" | "empirical" | null;
  maintenance_calories_estimated_at: string | null;
  last_metabolism_estimate: MetabolismEstimateSnapshot | null;
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

type RecentNutritionHistoryEntry = {
  date: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
  calorieDelta: number | null;
};

const STATUS_TONE: Record<string, string> = {
  pending: "text-amber-300",
  applied: "text-emerald-300",
  dismissed: "text-[var(--text-muted)]",
  superseded: "text-[var(--text-muted)] line-through",
};

function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return "-";
  return Math.round(n).toString();
}

function formatMetric(n: number | null | undefined) {
  if (n === null || n === undefined) return "-";
  return Math.round(n).toLocaleString();
}

function formatDelta(n: number | null) {
  if (n === null) return "-";
  const rounded = Math.round(n);
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString()}`;
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function MemberDetailClient({ memberId }: { memberId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [liveRec, setLiveRec] = useState<LiveRecommendation>(null);
  const [history, setHistory] = useState<RecentNutritionHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [detailRes, historyRes] = await Promise.all([
        fetch(`/api/coach/nutrition-plan/member/${memberId}`, {
          cache: "no-store",
        }),
        fetch(`/api/nutrition-days?recent=14&memberId=${memberId}`, {
          cache: "no-store",
        }),
      ]);

      const detailPayload = await detailRes.json().catch(() => null);
      if (!detailRes.ok) {
        setError(detailPayload?.error ?? "Failed to load.");
        return;
      }
      setDetail(detailPayload as Detail);

      const historyPayload = await historyRes.json().catch(() => null);
      if (!historyRes.ok) {
        setHistory([]);
        setHistoryError(historyPayload?.error ?? "Failed to load nutrition history.");
      } else {
        setHistory(
          Array.isArray(historyPayload?.history)
            ? (historyPayload.history as RecentNutritionHistoryEntry[])
            : []
        );
        setHistoryError(null);
      }
    } catch {
      setError("Failed to load.");
    } finally {
      setHistoryLoading(false);
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
    return <p className="text-sm text-[var(--text-muted)]">{error ?? "Loading..."}</p>;
  }

  const currentPlan = detail.plans[0] ?? null;
  const planChanges = detail.plans.slice(1);
  const weightSorted = [...detail.weights].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
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
            {running ? "Running..." : "Run Analysis Now"}
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
      </section>

      {liveRec ? (
        <section className="panel rounded-3xl p-5">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Live Analysis</h2>
          <p className="text-sm font-semibold text-[var(--text)]">{liveRec.status}</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{liveRec.reason}</p>
          {liveRec.proposed ? (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Would propose: <span className="text-[var(--text)]">{liveRec.calorieDelta > 0 ? "+" : ""}{liveRec.calorieDelta} kcal to {liveRec.proposed.targetCalories} kcal</span>
            </p>
          ) : null}
          {liveRec.warnings.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-[11px] text-amber-300/80">
              {liveRec.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <NutritionCheckInBanner memberId={memberId} canManage />

      <Panel padding="lg">
        <div>
          <Micro as="p">Recent Daily Entries</Micro>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Latest 14 logged days with calories, carbs, protein, fat, fiber, and calorie variance vs target.
          </p>
        </div>

        <div className="app-table-shell mt-5">
          <table className="app-table min-w-[760px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Calories</th>
                <th>Carbs</th>
                <th>Protein</th>
                <th>Fat</th>
                <th>Fiber</th>
                <th>+/- Calories</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="app-table-empty">
                    <td colSpan={7}>
                      <div className="h-4 w-40 animate-pulse rounded bg-[var(--panel-2)]" />
                    </td>
                  </tr>
                ))
              ) : historyError ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-rose-400">
                    {historyError}
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-[var(--text-soft)]">
                    No recent daily entries yet.
                  </td>
                </tr>
              ) : (
                history.map((entry) => (
                  <tr key={entry.date}>
                    <td className="text-sm text-[var(--text-muted)]">{formatDate(entry.date)}</td>
                    <td className="text-sm text-[var(--text)]">{formatMetric(entry.calories)}</td>
                    <td className="text-sm text-[var(--text-muted)]">{formatMetric(entry.carbs)} g</td>
                    <td className="text-sm text-[var(--text-muted)]">{formatMetric(entry.protein)} g</td>
                    <td className="text-sm text-[var(--text-muted)]">{formatMetric(entry.fat)} g</td>
                    <td className="text-sm text-[var(--text-muted)]">{formatMetric(entry.fiber)} g</td>
                    <td
                      className={
                        entry.calorieDelta === null
                          ? "text-sm text-[var(--text-soft)]"
                          : entry.calorieDelta > 0
                            ? "text-sm text-amber-300"
                            : entry.calorieDelta < 0
                              ? "text-sm text-cyan-300"
                              : "text-sm text-emerald-300"
                      }
                    >
                      {formatDelta(entry.calorieDelta)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {currentPlan ? (
        <section className="panel rounded-3xl p-5">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Current Plan - effective {currentPlan.effective_date}
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
            Last check-in: {currentPlan.last_check_in_date ?? "-"} - Next: {currentPlan.next_check_in_date ?? "-"}
          </p>
        </section>
      ) : (
        <section className="panel rounded-3xl p-5 text-sm text-[var(--text-muted)]">
          No plan on file for this member yet.
        </section>
      )}

      {currentPlan ? <MetabolismCard plan={currentPlan} /> : null}

      {planChanges.length > 0 ? (
        <section className="panel rounded-3xl p-5">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Plan History</h2>
          <ul className="divide-y divide-[var(--line)] text-sm">
            {planChanges.map((plan) => (
              <li key={plan.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <p className="text-[var(--text)]">{plan.effective_date}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatNumber(plan.target_calories)} kcal - P{formatNumber(plan.protein_grams)} / C
                    {formatNumber(plan.carbs_grams)} / F{formatNumber(plan.fat_grams)}
                  </p>
                  {plan.adjustment_reason ? (
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">{plan.adjustment_reason}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {detail.checkIns.length > 0 ? (
        <section className="panel rounded-3xl p-5">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Check-In History</h2>
          <ul className="divide-y divide-[var(--line)] text-sm">
            {detail.checkIns.map((checkIn) => (
              <li key={checkIn.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <p className={`text-xs uppercase tracking-[0.18em] ${STATUS_TONE[checkIn.status] ?? ""}`}>
                    {checkIn.status}
                  </p>
                  <p className="mt-1 text-[var(--text)]">
                    {checkIn.recommendation.status} - delta {checkIn.recommendation.calorieDelta} kcal
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{checkIn.recommendation.reason}</p>
                </div>
                <p className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {new Date(checkIn.created_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {weights.length > 0 ? (
        <section className="panel rounded-3xl p-5">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Recent Weight Entries</h2>
          <ul className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-5">
            {weights.map((weight) => (
              <li key={`${weight.entry_date}-${weight.value}`} className="flex justify-between gap-2">
                <span className="text-[var(--text-muted)]">{weight.entry_date}</span>
                <span className="text-[var(--text)]">
                  {Number(weight.value).toFixed(1)} {weight.unit}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const STATUS_LABEL: Record<MetabolismEstimateSnapshot["status"], string> = {
  estimated: "Estimated",
  low_adherence: "Low adherence",
  insufficient_weight_data: "Need more weigh-ins",
  likely_undertracking: "Possible undertracking",
  out_of_bounds: "Out of bounds",
};

const CONFIDENCE_TONE: Record<MetabolismEstimateSnapshot["confidence"], string> = {
  high: "text-emerald-300 border-emerald-300/40 bg-emerald-300/10",
  medium: "text-amber-300 border-amber-300/40 bg-amber-300/10",
  low: "text-[var(--text-muted)] border-[var(--line)] bg-white/5",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "never";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return `${days} d ago`;
}

function MetabolismCard({ plan }: { plan: PlanRow }) {
  const estimate = plan.last_metabolism_estimate;
  const formulaTdee = plan.maintenance_calories ?? estimate?.formulaTdee ?? null;
  const source = plan.maintenance_calories_source ?? "formula";

  return (
    <section className="panel rounded-3xl p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Estimated Metabolism</h2>
        {source === "empirical" ? (
          <span className="rounded-full border border-[var(--accent-cyan)]/40 bg-[var(--accent-cyan)]/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--accent-cyan)]">
            Auto-updated
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-[var(--text-muted)]">Formula TDEE</p>
          <p className="text-2xl font-semibold text-[var(--text)]">
            {formatNumber(formulaTdee)}
            <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">kcal/day</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Empirical TDEE (last 7 days)</p>
          <p className="text-2xl font-semibold text-[var(--text)]">
            {estimate?.estimatedTdee !== null && estimate?.estimatedTdee !== undefined
              ? formatNumber(estimate.estimatedTdee)
              : "-"}
            <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">kcal/day</span>
          </p>
        </div>
        <div className="flex flex-col gap-1">
          {estimate?.deltaKcal !== null && estimate?.deltaKcal !== undefined ? (
            <span className="self-start rounded-full border border-[var(--line)] bg-white/5 px-2 py-0.5 text-[11px] text-[var(--text)]">
              {estimate.deltaKcal > 0 ? "+" : ""}
              {estimate.deltaKcal} kcal vs formula
            </span>
          ) : null}
          {estimate ? (
            <span
              className={`self-start rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${CONFIDENCE_TONE[estimate.confidence]}`}
            >
              {STATUS_LABEL[estimate.status]} - {estimate.confidence}
            </span>
          ) : null}
        </div>
      </div>

      {estimate ? (
        <p className="mt-3 text-xs text-[var(--text-muted)]">{estimate.reason}</p>
      ) : (
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          No estimate yet - needs {">= "}5/7 days logged and {">= "}2 weigh-ins in the last 7 days.
        </p>
      )}

      {estimate ? (
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
          Window: last {estimate.windowDays} days - {estimate.daysLogged}/{estimate.daysExpected} days logged - {estimate.weightEntries} weigh-ins - updated {relativeTime(plan.maintenance_calories_estimated_at)}
        </p>
      ) : null}
    </section>
  );
}
