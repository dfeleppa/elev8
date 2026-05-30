"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Lock, Scale, ThumbsDown, ThumbsUp } from "lucide-react";

type Props = {
  /** Called after a check-in completes successfully (e.g. to refresh plan + history). */
  onComplete?: () => void;
  /** Whether the scheduled check-in window has opened. When false, the wizard is locked. */
  checkInDue?: boolean;
  /** Days remaining until the next check-in opens (for the locked-state message). */
  daysUntilCheckIn?: number | null;
  /** ISO date the next check-in opens. */
  nextCheckInDate?: string | null;
};

type Step = "start" | "metrics" | "accountability" | "result";

type Recommendation = {
  reason?: string | null;
  status?: string | null;
  calorieDelta?: number | null;
  proposed?: { targetCalories?: number | null } | null;
};

type ResultPayload = {
  action?: string;
  recommendation?: Recommendation | null;
  currentPlan?: { targetCalories?: number | null } | null;
  nextCheckInDate?: string | null;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "the next check-in";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const inputClass =
  "w-full rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 px-3 py-2.5 text-sm font-bold text-[#17141F] focus:border-[rgba(20,210,220,0.34)] focus:outline-none sm:py-3";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#14D2DC] px-5 py-2.5 text-sm font-bold text-[#071317] shadow-[0_14px_30px_rgba(20,210,220,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:py-3";

export default function CheckInWizard({
  onComplete,
  checkInDue = true,
  daysUntilCheckIn = null,
  nextCheckInDate = null,
}: Props) {
  const [step, setStep] = useState<Step>("start");
  const [todaysWeight, setTodaysWeight] = useState<number | null>(null);
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultPayload | null>(null);

  // Detect today's weigh-in so we can skip the metrics step (per the Carbon flow).
  useEffect(() => {
    let cancelled = false;
    const today = todayIso();
    fetch(`/api/athlete/body-comp-history?from=${today}&to=${today}`, { cache: "no-store" })
      .then((r) => r.json().catch(() => null))
      .then((payload) => {
        if (cancelled) return;
        const entries = (payload?.entries ?? []) as Array<{ date: string; body_weight: number | null }>;
        const todayEntry = entries.find((e) => e.date === today && typeof e.body_weight === "number");
        if (todayEntry && typeof todayEntry.body_weight === "number") {
          setTodaysWeight(todayEntry.body_weight);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const hasTodayWeight = todaysWeight !== null;

  function beginCheckIn() {
    setError(null);
    setStep(hasTodayWeight ? "accountability" : "metrics");
  }

  function metricsNext() {
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) {
      setError("Enter a valid body weight.");
      return;
    }
    const bf = bodyFat.trim();
    if (bf !== "" && (!Number.isFinite(Number(bf)) || Number(bf) <= 0 || Number(bf) >= 100)) {
      setError("Body fat % must be between 0 and 100.");
      return;
    }
    setError(null);
    setStep("accountability");
  }

  async function submit(isAccountable: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { action: "member_check_in", accountable: isAccountable };
      // Only send metrics when freshly entered; otherwise the API reuses today's weigh-in.
      if (!hasTodayWeight) {
        body.bodyWeightLbs = Number(weight);
        if (bodyFat.trim()) body.bodyFatPercent = Number(bodyFat);
      }
      const res = await fetch("/api/coach/nutrition-plan/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as ResultPayload | { error?: string } | null;
      if (!res.ok) {
        throw new Error((payload as { error?: string })?.error ?? "Check-in failed.");
      }
      setResult(payload as ResultPayload);
      setStep("result");
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setStep("start");
    setWeight("");
    setBodyFat("");
    setResult(null);
    setError(null);
  }

  return (
    <div className="premium-glass-card p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#B42368] sm:text-[11px]">
          Weekly Check-In
        </p>
        <h2 className="text-[20px] font-bold text-[#17141F] sm:text-[22px]">Coach review</h2>
      </div>

      {/* Step: Start */}
      {step === "start" ? (
        !checkInDue ? (
          <div className="mt-3">
            <p className="flex items-center gap-2 rounded-2xl border border-[rgba(16,24,40,0.1)] bg-white/60 px-3 py-2.5 text-sm font-bold text-[#475467]">
              <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
              {daysUntilCheckIn && daysUntilCheckIn > 0
                ? `Your next check-in opens in ${daysUntilCheckIn} day${daysUntilCheckIn === 1 ? "" : "s"} (${formatDate(nextCheckInDate)}).`
                : `Your next check-in opens on ${formatDate(nextCheckInDate)}.`}
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#667085]">
              Check-ins are spaced a week apart so adjustments are driven by a full week of real data.
              Keep logging your meals and weigh-ins until then.
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm font-semibold leading-6 text-[#667085]">
              A quick three-step review: share today&apos;s weigh-in, tell us if you were accountable, and
              we&apos;ll adjust your targets from your real progress — or hold steady.
            </p>
            <ol className="mt-3 space-y-1.5 text-sm font-semibold text-[#475467]">
              <li>1. {hasTodayWeight ? "Confirm today's weigh-in" : "Enter bodyweight & body fat"}</li>
              <li>2. Were you accountable this week?</li>
              <li>3. Your recommendation</li>
            </ol>
            <button type="button" onClick={beginCheckIn} className={`mt-4 ${primaryBtn}`}>
              Start check-in
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )
      ) : null}

      {/* Step: Metrics */}
      {step === "metrics" ? (
        <div className="mt-3">
          <p className="text-sm font-semibold leading-6 text-[#667085]">
            Daily weight fluctuates — we look at the trend across weeks, so just log today&apos;s reading.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#667085] sm:text-xs">
              Bodyweight (lbs)
              <input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                inputMode="decimal"
                placeholder="lb"
                className={`${inputClass} normal-case tracking-normal`}
              />
            </label>
            <label className="block space-y-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#667085] sm:text-xs">
              Body fat % (optional)
              <input
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
                inputMode="decimal"
                placeholder="%"
                className={`${inputClass} normal-case tracking-normal`}
              />
            </label>
          </div>
          {error ? <p className="mt-3 text-sm font-bold text-rose-700">{error}</p> : null}
          <button type="button" onClick={metricsNext} className={`mt-4 ${primaryBtn}`}>
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Step: Accountability */}
      {step === "accountability" ? (
        <div className="mt-3">
          {hasTodayWeight ? (
            <p className="mb-3 flex items-center gap-2 rounded-2xl border border-[rgba(20,210,220,0.18)] bg-[rgba(20,210,220,0.08)] px-3 py-2 text-sm font-bold text-[#0B7C84]">
              <Scale className="h-4 w-4" aria-hidden="true" />
              Using today&apos;s weigh-in: {todaysWeight?.toFixed(1)} lb
            </p>
          ) : null}
          <p className="text-base font-bold text-[#17141F]">Were you accountable this week?</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
            Did you track consistently and hit your targets? If not, we&apos;ll hold your plan — no
            changes until you&apos;ve got a clean week of data.
          </p>
          {error ? <p className="mt-3 text-sm font-bold text-rose-700">{error}</p> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void submit(true)}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#14D2DC] px-5 py-3 text-sm font-bold text-[#071317] shadow-[0_14px_30px_rgba(20,210,220,0.24)] transition hover:brightness-105 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
              Yes, I was accountable
            </button>
            <button
              type="button"
              onClick={() => void submit(false)}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[rgba(16,24,40,0.12)] bg-white/70 px-5 py-3 text-sm font-bold text-[#17141F] transition hover:bg-white disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
              No, not this week
            </button>
          </div>
        </div>
      ) : null}

      {/* Step: Result */}
      {step === "result" && result ? (
        <CheckInResult result={result} onRestart={restart} />
      ) : null}
    </div>
  );
}

function CheckInResult({ result, onRestart }: { result: ResultPayload; onRestart: () => void }) {
  const action = result.action ?? "held";
  const rec = result.recommendation ?? null;
  const delta = Math.round(rec?.calorieDelta ?? 0);
  const fromCals = result.currentPlan?.targetCalories ?? null;
  const toCals = rec?.proposed?.targetCalories ?? null;
  const nextDate = formatDate(result.nextCheckInDate);

  let headline: string;
  let tone: "good" | "neutral" = "neutral";
  if (action === "adjusted") {
    headline = `Calories ${delta > 0 ? "increased" : "decreased"} by ${Math.abs(delta)} kcal/day.`;
    tone = "good";
  } else if (action === "held_not_accountable") {
    headline = "No changes this week — let's build a clean week of tracking.";
  } else if (action === "counter_reset") {
    headline = "Tracking wasn't consistent enough yet, so we held your plan and reset the window.";
  } else {
    headline = "You're on pace — holding your plan.";
    tone = "good";
  }

  return (
    <div className="mt-3">
      <div
        className={`rounded-2xl border p-4 ${
          tone === "good"
            ? "border-[rgba(18,183,106,0.22)] bg-[rgba(18,183,106,0.08)]"
            : "border-[rgba(16,24,40,0.1)] bg-white/66"
        }`}
      >
        <p className="flex items-center gap-2 text-base font-bold text-[#17141F]">
          <CheckCircle2 className="h-5 w-5 text-[#12B76A]" aria-hidden="true" />
          Check-in complete
        </p>
        <p className="mt-2 text-sm font-bold text-[#17141F]">{headline}</p>
        {action === "adjusted" && fromCals && toCals ? (
          <p className="mt-1 text-sm font-semibold text-[#475467]">
            {Math.round(fromCals)} → {Math.round(toCals)} kcal/day
          </p>
        ) : null}
        {rec?.reason ? <p className="mt-2 text-sm font-medium leading-6 text-[#667085]">{rec.reason}</p> : null}
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">
          Next check-in: {nextDate}
        </p>
      </div>
      <button
        type="button"
        onClick={onRestart}
        className="mt-3 rounded-2xl border border-[rgba(16,24,40,0.12)] bg-white/70 px-4 py-2 text-sm font-bold text-[#17141F] transition hover:bg-white"
      >
        Done
      </button>
    </div>
  );
}
