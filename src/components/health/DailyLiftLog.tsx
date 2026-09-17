"use client";

import { useEffect, useState } from "react";
import LogLiftCard from "./LogLiftCard";

type Log = {
  id: string;
  movementName: string;
  notes: string | null;
  sets: { set_order: number; reps: number; weight: number }[];
};

export default function DailyLiftLog({ dayDate }: { dayDate: string }) {
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/athlete/lift-log?dayDate=${encodeURIComponent(dayDate)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error ?? "Unable to load your lifts.");
        setLogs(payload.logs ?? []);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to load your lifts.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [dayDate, revision]);

  return (
    <section
      className="premium-glass-card space-y-4 p-5"
      aria-label="Your lifts for the selected day"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#17141F]">Your lifts</h2>
          <p className="mt-1 text-sm text-[#475467]">
            Log your own lifts for {dayDate}, with or without scheduled
            programming. These follow the date, not the selected track.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value);
            setSaved(false);
          }}
          aria-expanded={open}
          className="rounded-xl bg-[#14D2DC] px-5 py-3 text-sm font-bold text-[#071317]"
        >
          {open ? "Close lift form" : "+ Log Lift"}
        </button>
      </div>
      {open && (
        <LogLiftCard
          initialDate={dayDate}
          lockDate
          onSaved={() => {
            setOpen(false);
            setSaved(true);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {saved && (
        <p role="status" className="text-sm font-semibold text-emerald-700">
          Lift saved for {dayDate}.
        </p>
      )}
      {loading ? (
        <p role="status" className="text-sm text-[#475467]">
          Loading your lifts…
        </p>
      ) : error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setRevision((value) => value + 1)}
          >
            Retry
          </button>
        </p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-[#475467]">
          No personal lifts logged for this date yet.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {logs.map((log) => (
            <article
              key={log.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900"
            >
              <h3 className="font-bold">{log.movementName}</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {log.sets.map((set) => (
                  <li key={set.set_order}>
                    Set {set.set_order}: {set.weight} lb × {set.reps} reps
                  </li>
                ))}
              </ul>
              {log.notes && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                  {log.notes}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
