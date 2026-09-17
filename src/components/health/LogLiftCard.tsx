"use client";

import { useEffect, useId, useRef, useState } from "react";
import { validateLiftSets } from "@/lib/lift-log";

type Movement = { id: string; name: string };
type LiftSet = { id: number; reps: string; weight: string };
type Props = { initialDate?: string; lockDate?: boolean; onSaved?: () => void };
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function LogLiftCard({
  initialDate,
  lockDate = false,
  onSaved,
}: Props) {
  const fieldId = useId();
  const nextSetId = useRef(1);
  const submitting = useRef(false);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [movementId, setMovementId] = useState("");
  const [date, setDate] = useState(() => initialDate ?? todayKey());
  const [sets, setSets] = useState<LiftSet[]>([
    { id: 0, reps: "", weight: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    fetch("/api/athlete/movements", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error ?? "Unable to load movements.");
        setMovements(payload.movements ?? []);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setLoadError(
            failure instanceof Error
              ? failure.message
              : "Unable to load movements.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);

  const filtered = movements.filter(
    (movement) =>
      movement.name.toLowerCase().includes(query.trim().toLowerCase()) ||
      movement.id === movementId,
  );
  const selected = movements.find((movement) => movement.id === movementId);
  function updateSet(id: number, field: "reps" | "weight", value: string) {
    setSets((current) =>
      current.map((set) => (set.id === id ? { ...set, [field]: value } : set)),
    );
    setSuccess("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!selected) {
      setError("Choose a movement to log.");
      return;
    }
    const parsed = sets.map((set) => ({
      reps: Number(set.reps),
      weight: Number(set.weight),
    }));
    if (!validateLiftSets(parsed)) {
      setError(
        "Complete every set with whole-number reps and a positive weight.",
      );
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/athlete/lift-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movementId: selected.id,
          dayDate: date,
          sets: parsed,
          notes: notes.trim() || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error ?? "Unable to save lift.");
      setSuccess(`${selected.name} saved for ${date}.`);
      setSets([{ id: nextSetId.current++, reps: "", weight: "" }]);
      setNotes("");
      onSaved?.();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Unable to save lift.",
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const inputClass =
    "w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900">
      <h3 className="text-lg font-bold">Log Lift</h3>
      <p className="mt-1 text-sm text-slate-600">
        Choose a movement and record your sets. A scheduled workout is not
        required.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <fieldset disabled={saving} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className="block space-y-1 text-sm font-medium"
              htmlFor={`${fieldId}-search`}
            >
              Find a movement
              <input
                id={`${fieldId}-search`}
                className={inputClass}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  const exact = movements.find(
                    (m) =>
                      m.name.toLowerCase() ===
                      e.target.value.trim().toLowerCase(),
                  );
                  setMovementId(exact?.id ?? "");
                  setSuccess("");
                }}
                placeholder="Search, e.g. Deadlift"
              />
            </label>
            <label
              className="block space-y-1 text-sm font-medium"
              htmlFor={`${fieldId}-movement`}
            >
              Movement
              <select
                id={`${fieldId}-movement`}
                required
                disabled={loading || !!loadError}
                className={inputClass}
                value={movementId}
                onChange={(e) => {
                  setMovementId(e.target.value);
                  setSuccess("");
                }}
              >
                <option value="">
                  {loading ? "Loading movements…" : "Choose a movement"}
                </option>
                {filtered.map((movement) => (
                  <option key={movement.id} value={movement.id}>
                    {movement.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {loadError && (
            <p role="alert" className="text-sm text-red-700">
              {loadError}{" "}
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
                className="underline"
              >
                Retry
              </button>
            </p>
          )}
          {!loading && !loadError && !filtered.length && (
            <p className="text-sm text-slate-600">
              No matching movements. Try a different search.
            </p>
          )}
          <label
            className="block max-w-xs space-y-1 text-sm font-medium"
            htmlFor={`${fieldId}-date`}
          >
            Date
            <input
              id={`${fieldId}-date`}
              type="date"
              required
              readOnly={lockDate}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSuccess("");
              }}
              className={inputClass}
            />
          </label>
          <div className="space-y-3">
            <p className="text-sm font-semibold">
              Sets · weight in pounds (lb)
            </p>
            {sets.map((set, index) => (
              <div
                key={set.id}
                className="grid grid-cols-[24px_1fr_1fr_auto] items-end gap-2"
              >
                <span className="pb-3 text-sm text-slate-500">{index + 1}</span>
                <label className="space-y-1 text-xs">
                  Reps
                  <input
                    aria-label={`Set ${index + 1} reps`}
                    type="number"
                    required
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={set.reps}
                    onChange={(e) => updateSet(set.id, "reps", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1 text-xs">
                  Weight (lb)
                  <input
                    aria-label={`Set ${index + 1} weight (lb)`}
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={set.weight}
                    onChange={(e) =>
                      updateSet(set.id, "weight", e.target.value)
                    }
                    className={inputClass}
                  />
                </label>
                <button
                  aria-label={`Remove set ${index + 1}`}
                  type="button"
                  disabled={sets.length === 1}
                  className="rounded-lg px-2 py-3 text-sm disabled:opacity-30"
                  onClick={() =>
                    setSets((current) =>
                      current.filter((item) => item.id !== set.id),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={sets.length >= 100}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium"
              onClick={() => {
                const id = nextSetId.current++;
                setSets((current) => [
                  ...current,
                  { id, reps: "", weight: "" },
                ]);
              }}
            >
              + Add Set
            </button>
          </div>
          <label
            className="block space-y-1 text-sm font-medium"
            htmlFor={`${fieldId}-notes`}
          >
            Notes
            <input
              id={`${fieldId}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
              placeholder="Optional notes"
            />
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm font-semibold text-emerald-700">
            {success}
          </p>
        )}
        <button
          type="submit"
          disabled={saving || loading || !!loadError || !selected}
          className="rounded-xl bg-[#14D2DC] px-5 py-3 text-sm font-bold text-[#071317] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Lift"}
        </button>
      </form>
    </div>
  );
}
