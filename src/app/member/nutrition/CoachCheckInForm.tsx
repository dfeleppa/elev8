"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

type Props = {
  /** Called after a check-in is logged successfully (e.g. to refresh card stats). */
  onLogged?: () => void;
};

export default function CoachCheckInForm({ onLogged }: Props) {
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const weightValue = Number(weight);
    if (!Number.isFinite(weightValue) || weightValue <= 0) {
      setError("Enter a valid body weight.");
      return;
    }

    const trimmedBodyFat = bodyFat.trim();
    const bodyFatValue = trimmedBodyFat === "" ? null : Number(trimmedBodyFat);
    if (bodyFatValue != null && (!Number.isFinite(bodyFatValue) || bodyFatValue < 0 || bodyFatValue > 100)) {
      setError("Body fat % must be between 0 and 100.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/health-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log_body_comp",
          bodyWeight: weightValue,
          ...(bodyFatValue != null ? { bodyFatPercent: bodyFatValue } : {}),
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Could not save measurements.");
      }
      setSuccess(true);
      setWeight("");
      setBodyFat("");
      onLogged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save measurements.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-[16px] border border-[#DDE2EA]/80 bg-white/60 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] sm:mt-4 sm:rounded-[20px] sm:p-3.5"
    >
      <p className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[#667085] sm:text-[11px]">
        Log measurements
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:gap-2.5">
        <label className="block">
          <span className="text-[10px] font-bold text-[#667085] sm:text-[11px]">
            Body weight <span className="text-[#98A2B3]">(lbs)</span>
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            required
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            placeholder="0.0"
            className="mt-1 w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-[14px] font-semibold text-[#17141F] outline-none transition focus:border-[#FF5CA8] focus:ring-2 focus:ring-[#FF5CA8]/20"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-[#667085] sm:text-[11px]">
            Body fat % <span className="font-medium text-[#98A2B3]">(optional)</span>
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            max="100"
            value={bodyFat}
            onChange={(event) => setBodyFat(event.target.value)}
            placeholder="—"
            className="mt-1 w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-[14px] font-semibold text-[#17141F] outline-none transition focus:border-[#FF5CA8] focus:ring-2 focus:ring-[#FF5CA8]/20"
          />
        </label>
      </div>
      {error ? <p className="mt-2 text-[11px] font-semibold text-[#F04438]">{error}</p> : null}
      {success ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#12B76A]">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Measurements saved!
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#101828] px-4 py-2 text-[12px] font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[13px]"
      >
        {submitting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Saving…
          </>
        ) : (
          "Save measurements"
        )}
      </button>
    </form>
  );
}
