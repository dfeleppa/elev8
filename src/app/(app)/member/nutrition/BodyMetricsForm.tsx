"use client";

import { useState } from "react";

type BodyMetricsFormProps = {
  onError: (message: string | null) => void;
};

export default function BodyMetricsForm({ onError }: BodyMetricsFormProps) {
  const [draft, setDraft] = useState({ weight: "", bodyFat: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitBodyComp() {
    const bodyWeight = Number(draft.weight);
    const bodyFatPercent = draft.bodyFat.trim() ? Number(draft.bodyFat) : null;

    if (!Number.isFinite(bodyWeight) || bodyWeight <= 0) {
      setMessage(null);
      onError("Enter a valid body weight.");
      return;
    }

    if (
      bodyFatPercent !== null &&
      (!Number.isFinite(bodyFatPercent) || bodyFatPercent <= 0 || bodyFatPercent >= 100)
    ) {
      setMessage(null);
      onError("Enter a valid body fat percentage.");
      return;
    }

    setSaving(true);
    setMessage(null);
    onError(null);
    try {
      const response = await fetch("/api/health-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log_body_comp",
          bodyWeight,
          bodyFatPercent: bodyFatPercent ?? undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onError(payload?.error ?? "Failed to save body metrics.");
        return;
      }

      setMessage("Saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nutrition-body-metrics mt-3 rounded-[18px] border border-[#D4DAE4]/85 bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.94)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#667085]">Today&apos;s metrics</p>
        {message ? (
          <span className="rounded-full bg-[#14D2DC]/12 px-2 py-1 text-[11px] font-extrabold text-[#0C7D85]">
            {message}
          </span>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
        <label className="min-w-0 space-y-1">
          <span className="text-[11px] font-bold text-[#5F6B7A]">Weight</span>
          <input
            value={draft.weight}
            onChange={(event) => setDraft((prev) => ({ ...prev, weight: event.target.value }))}
            placeholder="lb"
            inputMode="decimal"
            className="w-full rounded-[14px] border border-[#D4DAE4]/85 bg-white/86 px-3 py-2 text-sm font-bold text-[#17141F] placeholder:text-[#98A2B3] focus:border-[#14D2DC]/45 focus:outline-none"
          />
        </label>
        <label className="min-w-0 space-y-1">
          <span className="text-[11px] font-bold text-[#5F6B7A]">Body Fat %</span>
          <input
            value={draft.bodyFat}
            onChange={(event) => setDraft((prev) => ({ ...prev, bodyFat: event.target.value }))}
            placeholder="%"
            inputMode="decimal"
            className="w-full rounded-[14px] border border-[#D4DAE4]/85 bg-white/86 px-3 py-2 text-sm font-bold text-[#17141F] placeholder:text-[#98A2B3] focus:border-[#14D2DC]/45 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => void submitBodyComp()}
          disabled={saving}
          className="h-10 rounded-[14px] bg-[#101828] px-3 text-[12px] font-extrabold text-white shadow-[0_8px_18px_rgba(16,24,40,0.16)] transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Saving" : "Submit"}
        </button>
      </div>
    </div>
  );
}
