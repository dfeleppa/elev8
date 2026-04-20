"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { Micro } from "@/components/ui";

type DayStatus = "empty" | "logged" | "pr";

type ConsistencyData = {
  streak: number;
  days: { date: string; status: DayStatus }[];
};

const STATUS_CLASS: Record<DayStatus, string> = {
  empty: "bg-[var(--panel-2)] opacity-50",
  logged: "bg-[#5c2d4a]",
  pr: "bg-gradient-to-br from-[var(--pink)] to-[var(--violet)]",
};

export default function ConsistencyCard() {
  const [data, setData] = useState<ConsistencyData | null>(null);

  useEffect(() => {
    fetch("/api/athlete/consistency", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (payload?.days) setData(payload as ConsistencyData);
      })
      .catch(() => {});
  }, []);

  // Pad to 35 cells so the grid is always full
  const cells: { date: string; status: DayStatus }[] = data?.days.length
    ? data.days
    : Array.from({ length: 35 }, (_, i) => ({ date: String(i), status: "empty" }));

  const streak = data?.streak ?? 0;

  return (
    <div className="panel p-6 fade-in">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <Micro as="p">Consistency</Micro>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-heading text-5xl font-bold leading-none text-[var(--text)]">
              {streak}
            </span>
            <span className="text-sm text-[var(--text-muted)]">day streak</span>
          </div>
        </div>

        {/* Fire badge */}
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--pink)] to-[var(--violet)] shadow-[0_4px_14px_rgba(255,74,141,0.35)]">
          <Flame className="h-5 w-5 text-white" />
        </div>
      </div>

      {/* 5×7 day grid */}
      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) => (
          <div
            key={cell.date + i}
            className={`aspect-square rounded-md transition-opacity ${STATUS_CLASS[cell.status]}`}
            title={cell.date}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-gradient-to-br from-[var(--pink)] to-[var(--violet)]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-soft)]">
            PR Day
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-[#5c2d4a]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-soft)]">
            Logged
          </span>
        </div>
      </div>
    </div>
  );
}
