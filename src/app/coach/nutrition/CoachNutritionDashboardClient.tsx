"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import NutritionCheckInBanner from "@/components/health/NutritionCheckInBanner";

type MemberOption = {
  id: string;
  fullName: string | null;
  email: string | null;
  label: string;
};

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

type PlanPayload = Record<string, unknown>;

type PlanRow = {
  id: string;
  goal_type: string;
  intensity_preset: string | null;
  weekly_rate_percent: number | null;
  reverse_diet_weekly_kcal: number | null;
  target_weight_lbs: number | null;
  target_calories: number;
  maintenance_calories: number | null;
  maintenance_calories_source: "formula" | "empirical" | null;
  maintenance_calories_estimated_at: string | null;
  last_metabolism_estimate: MetabolismEstimateSnapshot | null;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  fiber_grams: number | null;
  formula_used: "katch_mcardle" | "mifflin_st_jeor" | string | null;
  activity_multiplier: number | null;
  sessions_per_week: number | null;
  effective_date: string;
  last_check_in_date: string | null;
  next_check_in_date: string | null;
  adjustment_reason: string | null;
  previous_plan_id: string | null;
  adherence_snapshot: Record<string, unknown> | null;
  plan_payload: PlanPayload | null;
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

type RecentNutritionDay = {
  date?: string | null;
  entryCount: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  calorieTarget?: number | null;
  proteinTarget?: number | null;
  carbsTarget?: number | null;
  fatTarget?: number | null;
  fiberTarget?: number | null;
};

type Detail = {
  member: { id: string; full_name: string | null; email: string | null };
  plans: PlanRow[];
  checkIns: CheckInRow[];
  weights: WeightRow[];
  recentNutritionDays: RecentNutritionDay[];
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
  adherence?: {
    daysLogged: number;
    daysExpected: number;
    adherencePercent: number;
    avgLoggedCalories: number;
    avgLoggedProtein: number;
    avgLoggedFiber: number | null;
  };
  weightTrend?: {
    entries: number;
    observedWeeklyChangeLbs: number | null;
    expectedWeeklyChangeLbs: number;
  };
} | null;

const STATUS_TONE: Record<string, string> = {
  pending: "text-amber-300",
  applied: "text-emerald-300",
  dismissed: "text-[var(--text-muted)]",
  superseded: "text-[var(--text-muted)] line-through",
};

const ESTIMATE_LABEL: Record<MetabolismEstimateSnapshot["status"], string> = {
  estimated: "Estimated",
  low_adherence: "Low adherence",
  insufficient_weight_data: "Need more weigh-ins",
  likely_undertracking: "Possible undertracking",
  out_of_bounds: "Out of bounds",
};

const CONFIDENCE_TONE: Record<MetabolismEstimateSnapshot["confidence"], string> = {
  high: "border-emerald-300/40 bg-emerald-300/10 text-emerald-300",
  medium: "border-amber-300/40 bg-amber-300/10 text-amber-300",
  low: "border-[var(--line)] bg-white/5 text-[var(--text-muted)]",
};

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatSigned(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${formatNumber(number, Math.abs(number) < 10 ? 1 : 0)}${suffix}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatMacroCell(value: number | null | undefined, target?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
  const rounded = Math.round(Number(value));
  const targetNum = typeof target === "number" && Number.isFinite(target) && target > 0 ? Math.round(target) : null;
  return targetNum ? `${formatNumber(rounded)} / ${formatNumber(targetNum)} g` : `${formatNumber(rounded)} g`;
}

function titleize(value: string | null | undefined) {
  if (!value) return "-";
  return value.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function payloadNumber(payload: PlanPayload | null | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{value}</p>
      {sub ? <p className="mt-1 text-xs text-[var(--text-muted)]">{sub}</p> : null}
    </div>
  );
}

export default function CoachNutritionDashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMemberId = searchParams.get("memberId");
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [memberSearch, setMemberSearch] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [liveRec, setLiveRec] = useState<LiveRecommendation>(null);

  useEffect(() => {
    let active = true;
    setMembersLoading(true);
    fetch("/api/coach/nutrition/members", { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) {
          setError(payload?.error ?? "Failed to load members.");
          setMembers([]);
          return;
        }
        const nextMembers = (payload?.members ?? []) as MemberOption[];
        setMembers(nextMembers);
        const requested = requestedMemberId && nextMembers.some((member) => member.id === requestedMemberId)
          ? requestedMemberId
          : null;
        const nextSelected = requested ?? nextMembers[0]?.id ?? "";
        setSelectedMemberId(nextSelected);
        if (nextSelected && requestedMemberId !== nextSelected) {
          router.replace(`/coach/nutrition?memberId=${encodeURIComponent(nextSelected)}`, { scroll: false });
        }
      })
      .catch(() => {
        if (active) setError("Failed to load members.");
      })
      .finally(() => {
        if (active) setMembersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestedMemberId, router]);

  const loadDetail = useCallback(async (memberId: string) => {
    if (!memberId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setError(null);
    setLiveRec(null);
    try {
      const res = await fetch(`/api/coach/nutrition-plan/member/${encodeURIComponent(memberId)}`, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to load member nutrition.");
      }
      setDetail(payload as Detail);
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : "Failed to load member nutrition.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDetail(selectedMemberId);
  }, [loadDetail, selectedMemberId]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) =>
      `${member.fullName ?? ""} ${member.email ?? ""} ${member.id}`.toLowerCase().includes(query)
    );
  }, [memberSearch, members]);
  const shownMembers = useMemo(() => {
    if (!selectedMemberId || filteredMembers.some((member) => member.id === selectedMemberId)) {
      return filteredMembers;
    }
    const selected = members.find((member) => member.id === selectedMemberId);
    return selected ? [selected, ...filteredMembers] : filteredMembers;
  }, [filteredMembers, members, selectedMemberId]);

  function handleMemberChange(memberId: string) {
    setSelectedMemberId(memberId);
    router.replace(`/coach/nutrition?memberId=${encodeURIComponent(memberId)}`, { scroll: false });
  }

  async function runAnalysisNow() {
    if (!selectedMemberId) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/nutrition-plan/check-in?memberId=${encodeURIComponent(selectedMemberId)}`, {
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

  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;
  const currentPlan = detail?.plans[0] ?? null;
  const historicalPlans = detail?.plans.slice(1) ?? [];
  const recentWeights = [...(detail?.weights ?? [])]
    .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
    .slice(0, 12);

  return (
    <div className="flex flex-col gap-6">
      <section className="panel rounded-3xl p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]" htmlFor="member-search">
              Member
            </label>
            <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_1.2fr]">
              <input
                id="member-search"
                type="search"
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                placeholder="Search name or email"
                className="min-h-11 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent-cyan)]"
              />
              <select
                value={selectedMemberId}
                onChange={(event) => handleMemberChange(event.target.value)}
                disabled={membersLoading || shownMembers.length === 0}
                className="min-h-11 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent-cyan)] disabled:opacity-60"
              >
                {shownMembers.length === 0 ? (
                  <option value="">{membersLoading ? "Loading members..." : "No members found"}</option>
                ) : null}
                {shownMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.label}
                  </option>
                ))}
              </select>
            </div>
            {selectedMember ? (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Viewing {selectedMember.fullName ?? selectedMember.email ?? selectedMember.id}
                {selectedMember.email && selectedMember.fullName ? ` - ${selectedMember.email}` : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={runAnalysisNow}
            disabled={!selectedMemberId || running || detailLoading}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--accent-cyan)] px-4 text-sm font-semibold text-[var(--accent-cyan)] transition hover:bg-[var(--accent-cyan)]/10 disabled:opacity-50"
          >
            {running ? "Running analysis..." : "Run Analysis Now"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      </section>

      {detailLoading ? <p className="text-sm text-[var(--text-muted)]">Loading member nutrition...</p> : null}

      {!detailLoading && selectedMemberId && detail ? (
        <div className="flex flex-col gap-6">
          {liveRec ? <LiveAnalysisCard recommendation={liveRec} /> : null}
          <NutritionCheckInBanner memberId={selectedMemberId} canManage />
          {currentPlan ? (
            <>
              <CurrentPlanCards plan={currentPlan} />
              <MacroCalculationCard plan={currentPlan} />
              <RecentNutritionDaysTable days={detail.recentNutritionDays ?? []} />
              <MetabolismCard plan={currentPlan} />
            </>
          ) : (
            <section className="panel rounded-3xl p-6 text-sm text-[var(--text-muted)]">
              No coach nutrition plan is on file for this member yet.
            </section>
          )}
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <PlanHistory plans={historicalPlans} />
            <RecentWeights weights={recentWeights} />
          </div>
          <CheckInHistory checkIns={detail.checkIns} />
        </div>
      ) : null}

      {!membersLoading && members.length === 0 ? (
        <section className="panel rounded-3xl p-6 text-sm text-[var(--text-muted)]">
          No members found.
        </section>
      ) : null}
    </div>
  );
}

function RecentNutritionDaysTable({ days }: { days: RecentNutritionDay[] }) {
  return (
    <section className="panel rounded-3xl p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Recent Nutrition Entries</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Last 14 tracked days for the selected member. Totals include logged quantity.
          </p>
        </div>
      </div>

      {days.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No nutrition entries have been logged yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--line)]">
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--panel-2)] text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Calories</th>
                <th className="px-4 py-3 text-right font-medium">Protein</th>
                <th className="px-4 py-3 text-right font-medium">Carbs</th>
                <th className="px-4 py-3 text-right font-medium">Fat</th>
                <th className="px-4 py-3 text-right font-medium">Fiber</th>
                <th className="px-4 py-3 text-right font-medium">Entries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {days.map((day) => (
                <tr key={day.date ?? "unknown"} className="text-[var(--text)]">
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(day.date)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {day.calorieTarget
                      ? `${formatNumber(day.calories)} / ${formatNumber(day.calorieTarget)} kcal`
                      : `${formatNumber(day.calories)} kcal`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{formatMacroCell(day.protein, day.proteinTarget)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{formatMacroCell(day.carbs, day.carbsTarget)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{formatMacroCell(day.fat, day.fatTarget)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{formatMacroCell(day.fiber, day.fiberTarget)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{formatNumber(day.entryCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CurrentPlanCards({ plan }: { plan: PlanRow }) {
  const macroCalories = plan.protein_grams * 4 + plan.carbs_grams * 4 + plan.fat_grams * 9;
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Goal" value={titleize(plan.goal_type)} sub={`Effective ${formatDate(plan.effective_date)}`} />
      <StatCard label="Calories" value={`${formatNumber(plan.target_calories)} kcal`} sub={`Macro math: ${formatNumber(macroCalories)} kcal`} />
      <StatCard label="Protein" value={`${formatNumber(plan.protein_grams)} g`} sub={`${formatNumber(plan.protein_grams * 4)} kcal`} />
      <StatCard label="Carbs" value={`${formatNumber(plan.carbs_grams)} g`} sub={`${formatNumber(plan.carbs_grams * 4)} kcal`} />
      <StatCard
        label="Fat / Fiber"
        value={`${formatNumber(plan.fat_grams)} / ${formatNumber(plan.fiber_grams)} g`}
        sub={`Next check-in ${formatDate(plan.next_check_in_date)}`}
      />
    </section>
  );
}

function MacroCalculationCard({ plan }: { plan: PlanRow }) {
  const payload = plan.plan_payload ?? {};
  const formulaTdee = plan.last_metabolism_estimate?.formulaTdee ?? plan.maintenance_calories;
  const derivedBmr =
    formulaTdee && plan.activity_multiplier && plan.activity_multiplier > 0
      ? Math.round(formulaTdee / plan.activity_multiplier)
      : null;
  const proteinCalories = plan.protein_grams * 4;
  const carbCalories = plan.carbs_grams * 4;
  const fatCalories = plan.fat_grams * 9;
  const macroCalories = proteinCalories + carbCalories + fatCalories;
  const percent = (value: number) => (macroCalories > 0 ? Math.round((value / macroCalories) * 100) : 0);

  return (
    <section className="panel rounded-3xl p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Macro Calculation</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Stored coach-plan inputs and outputs used to compose this member&apos;s targets.
          </p>
        </div>
        <span className="rounded-full border border-[var(--line)] bg-white/5 px-3 py-1 text-xs text-[var(--text-muted)]">
          {titleize(plan.formula_used)} formula
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="grid grid-cols-2 gap-3">
          <MiniMetric label="Estimated BMR" value={`${formatNumber(derivedBmr)} kcal`} />
          <MiniMetric label="Formula TDEE" value={`${formatNumber(formulaTdee)} kcal`} />
          <MiniMetric label="Activity multiplier" value={formatNumber(plan.activity_multiplier, 1)} />
          <MiniMetric label="Sessions / week" value={formatNumber(plan.sessions_per_week, 1)} />
          <MiniMetric label="Weekly rate" value={`${formatNumber(plan.weekly_rate_percent, 1)}%`} />
          <MiniMetric label="Reverse diet" value={`${formatNumber(plan.reverse_diet_weekly_kcal)} kcal/wk`} />
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MacroBar label="Protein" grams={plan.protein_grams} calories={proteinCalories} percent={percent(proteinCalories)} tone="bg-[var(--accent-cyan)]" />
            <MacroBar label="Carbs" grams={plan.carbs_grams} calories={carbCalories} percent={percent(carbCalories)} tone="bg-[var(--pink)]" />
            <MacroBar label="Fat" grams={plan.fat_grams} calories={fatCalories} percent={percent(fatCalories)} tone="bg-amber-300" />
          </div>
          <div className="mt-4 grid gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-2">
            <p>Weight input: <span className="text-[var(--text)]">{formatNumber(payloadNumber(payload, "weightLbs"), 1)} lb</span></p>
            <p>Target weight: <span className="text-[var(--text)]">{formatNumber(plan.target_weight_lbs, 1)} lb</span></p>
            <p>Height: <span className="text-[var(--text)]">{formatNumber(payloadNumber(payload, "heightCm"), 1)} cm</span></p>
            <p>Age: <span className="text-[var(--text)]">{formatNumber(payloadNumber(payload, "ageYears"))}</span></p>
            <p>Body fat: <span className="text-[var(--text)]">{formatNumber(payloadNumber(payload, "bodyFatPercentage"), 1)}%</span></p>
            <p>Intensity: <span className="text-[var(--text)]">{titleize(plan.intensity_preset)}</span></p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}

function MacroBar({
  label,
  grams,
  calories,
  percent,
  tone,
}: {
  label: string;
  grams: number;
  calories: number;
  percent: number;
  tone: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-[var(--text)]">{label}</span>
        <span className="text-[var(--text-muted)]">{percent}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-white/10">
        <div className={`h-2 rounded-full ${tone}`} style={{ width: `${Math.max(3, Math.min(100, percent))}%` }} />
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        {formatNumber(grams)}g / {formatNumber(calories)} kcal
      </p>
    </div>
  );
}

function MetabolismCard({ plan }: { plan: PlanRow }) {
  const estimate = plan.last_metabolism_estimate;
  const formulaTdee = estimate?.formulaTdee ?? plan.maintenance_calories;
  const source = plan.maintenance_calories_source ?? "formula";

  return (
    <section className="panel rounded-3xl p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Estimated Metabolism</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Empirical TDEE from recent logging and weigh-ins, compared with the formula estimate.
          </p>
        </div>
        {source === "empirical" ? (
          <span className="rounded-full border border-[var(--accent-cyan)]/40 bg-[var(--accent-cyan)]/10 px-3 py-1 text-xs text-[var(--accent-cyan)]">
            Maintenance auto-updated
          </span>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Formula TDEE" value={`${formatNumber(formulaTdee)} kcal`} sub="calculated maintenance" />
        <StatCard
          label="Empirical TDEE"
          value={`${formatNumber(estimate?.estimatedTdee)} kcal`}
          sub={estimate ? `last ${estimate.windowDays} days` : "not enough data yet"}
        />
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Confidence</p>
          {estimate ? (
            <>
              <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{formatSigned(estimate.deltaKcal, " kcal")}</p>
              <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${CONFIDENCE_TONE[estimate.confidence]}`}>
                {ESTIMATE_LABEL[estimate.status]} - {estimate.confidence}
              </span>
            </>
          ) : (
            <p className="mt-2 text-sm text-[var(--text-muted)]">No estimate yet</p>
          )}
        </div>
      </div>
      {estimate ? (
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white/[0.03] p-4 text-xs text-[var(--text-muted)]">
          <p>{estimate.reason}</p>
          <p className="mt-2">
            {estimate.daysLogged}/{estimate.daysExpected} logged days - {estimate.weightEntries} weigh-ins - avg{" "}
            {formatNumber(estimate.avgDailyCalories)} kcal/day - updated{" "}
            {formatDateTime(plan.maintenance_calories_estimated_at)}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Needs at least 5 of 7 logged days and 2 weigh-ins spanning the estimate window.
        </p>
      )}
    </section>
  );
}

function LiveAnalysisCard({ recommendation }: { recommendation: NonNullable<LiveRecommendation> }) {
  const adherence = recommendation.adherence;
  const trend = recommendation.weightTrend;
  return (
    <section className="panel rounded-3xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Live Analysis</h2>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--accent-cyan)]">
            {titleize(recommendation.status)}
          </p>
        </div>
        {recommendation.proposed ? (
          <span className="rounded-full border border-[var(--accent-cyan)]/40 bg-[var(--accent-cyan)]/10 px-3 py-1 text-xs text-[var(--accent-cyan)]">
            {formatSigned(recommendation.calorieDelta, " kcal")} to {formatNumber(recommendation.proposed.targetCalories)} kcal
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-[var(--text-muted)]">{recommendation.reason}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniMetric
          label="Adherence"
          value={adherence ? `${adherence.daysLogged}/${adherence.daysExpected}` : "-"}
        />
        <MiniMetric
          label="Avg logged"
          value={adherence ? `${formatNumber(adherence.avgLoggedCalories)} kcal` : "-"}
        />
        <MiniMetric
          label="Weight trend"
          value={trend ? `${formatSigned(trend.observedWeeklyChangeLbs, " lb/wk")}` : "-"}
        />
      </div>
      {recommendation.warnings.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-300/85">
          {recommendation.warnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function PlanHistory({ plans }: { plans: PlanRow[] }) {
  return (
    <section className="panel rounded-3xl p-5">
      <h2 className="text-sm font-semibold text-[var(--text)]">Plan History</h2>
      {plans.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">No prior plans.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--line)] text-sm">
          {plans.map((plan) => (
            <li key={plan.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--text)]">{formatDate(plan.effective_date)}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {formatNumber(plan.target_calories)} kcal - P{formatNumber(plan.protein_grams)} / C
                    {formatNumber(plan.carbs_grams)} / F{formatNumber(plan.fat_grams)}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--line)] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  {titleize(plan.goal_type)}
                </span>
              </div>
              {plan.adjustment_reason ? (
                <p className="mt-2 text-xs text-[var(--text-muted)]">{plan.adjustment_reason}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentWeights({ weights }: { weights: WeightRow[] }) {
  return (
    <section className="panel rounded-3xl p-5">
      <h2 className="text-sm font-semibold text-[var(--text)]">Recent Weight Entries</h2>
      {weights.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">No bodyweight entries yet.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {weights.map((weight) => (
            <li key={`${weight.entry_date}-${weight.value}`} className="flex justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2">
              <span className="text-[var(--text-muted)]">{formatDate(weight.entry_date)}</span>
              <span className="font-medium text-[var(--text)]">
                {formatNumber(Number(weight.value), 1)} {weight.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CheckInHistory({ checkIns }: { checkIns: CheckInRow[] }) {
  return (
    <section className="panel rounded-3xl p-5">
      <h2 className="text-sm font-semibold text-[var(--text)]">Check-In History</h2>
      {checkIns.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">No check-ins have been generated yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--line)] text-sm">
          {checkIns.map((checkIn) => (
            <li key={checkIn.id} className="grid gap-3 py-3 lg:grid-cols-[0.7fr_1fr_auto] lg:items-start">
              <div>
                <p className={`text-xs uppercase tracking-[0.18em] ${STATUS_TONE[checkIn.status] ?? "text-[var(--text-muted)]"}`}>
                  {checkIn.status}
                </p>
                <p className="mt-1 text-[var(--text)]">{formatDateTime(checkIn.created_at)}</p>
              </div>
              <div>
                <p className="font-medium text-[var(--text)]">
                  {titleize(checkIn.recommendation.status)} - {formatSigned(checkIn.recommendation.calorieDelta, " kcal")}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{checkIn.recommendation.reason}</p>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Reviewed {formatDateTime(checkIn.reviewed_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
