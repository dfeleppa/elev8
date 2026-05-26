"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { GlassCard } from "@/components/member-dashboard/PremiumDashboard";

type DayStatus = "empty" | "logged" | "pr";

type ConsistencyData = {
  streak: number;
  days: { date: string; status: DayStatus }[];
};

const STATUS_CLASS: Record<DayStatus, string> = {
  empty: "bg-white/60 opacity-70",
  logged: "bg-[#14D2DC]",
  pr: "bg-[#FF5CA8]",
};

export default function ConsistencyCard() {
  const [data, setData] = useState<ConsistencyData | null>(null);

  useEffect(() => {
    fetch("/api/athlete/consistency", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (payload?.days) setData(payload as ConsistencyData);
      })
      .catch((err) => {
        console.error("Failed to load consistency data:", err);
      });
  }, []);

  // Pad to 35 cells so the grid is always full
  const cells: { date: string; status: DayStatus }[] = data?.days.length
    ? data.days
    : Array.from({ length: 35 }, (_, i) => ({ date: String(i), status: "empty" }));

  const streak = data?.streak ?? 0;

  return (
    <GlassCard className="fade-in">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#667085]">Consistency</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-head text-5xl font-bold leading-none text-[#17141F]">
              {streak}
            </span>
            <span className="text-sm font-semibold text-[#667085]">day streak</span>
          </div>
        </div>

        {/* Fire badge */}
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(255,92,168,0.1)] text-[#B42368]">
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
          <div className="h-2.5 w-2.5 rounded-sm bg-[#FF5CA8]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
            PR Day
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-[#14D2DC]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
            Logged
          </span>
        </div>
      </div>
    </GlassCard>
  );
}
