"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Dumbbell, Flame, Snowflake, Zap } from "lucide-react";

type Block = {
  id: string;
  block_type: "warmup" | "lift" | "workout" | "cooldown";
  title: string;
  description: string | null;
  score_type: string;
};

type DayData = {
  id: string;
  day_date: string;
  blocks: Block[];
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfWeek(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - d.getDay());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const SCORE_LABEL: Record<string, string> = {
  time: "For Time",
  reps: "For Reps",
  rounds_reps: "Rounds & Reps",
  distance: "Distance",
  calories: "Calories",
  load: "Load",
  weight: "Load",
};

function blockIcon(type: string) {
  if (type === "warmup") return <Flame className="h-3.5 w-3.5 text-orange-400" />;
  if (type === "lift") return <Dumbbell className="h-3.5 w-3.5 text-blue-400" />;
  if (type === "cooldown") return <Snowflake className="h-3.5 w-3.5 text-cyan-400" />;
  return <Zap className="h-3.5 w-3.5 text-yellow-400" />;
}

function blockAccent(type: string) {
  if (type === "warmup") return "border-orange-400/20 bg-orange-400/5";
  if (type === "lift") return "border-blue-400/20 bg-blue-400/5";
  if (type === "cooldown") return "border-cyan-400/20 bg-cyan-400/5";
  return "border-yellow-400/20 bg-yellow-400/5";
}

export default function TodaysWorkoutCard() {
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [noWorkout, setNoWorkout] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me", { cache: "no-store" });
        const me = await meRes.json();
        const orgId = me?.organizationIds?.[0] ?? null;
        let trackId: string | null = null;

        if (orgId) {
          const storedId = localStorage.getItem("elev8-track-id");
          const tr = await fetch(`/api/programming/tracks?organizationId=${orgId}`, { cache: "no-store" });
          const tp = await tr.json();
          const fetchedTracks: { id: string }[] = tp?.tracks ?? [];
          if (storedId && fetchedTracks.some((t) => t.id === storedId)) {
            trackId = storedId;
          } else if (me?.trackId) {
            trackId = me.trackId;
          } else {
            trackId = fetchedTracks[0]?.id ?? null;
          }
        }

        if (!orgId || !trackId) {
          setNoWorkout(true);
          return;
        }

        const today = todayKey();
        const weekStart = startOfWeek(today);
        const res = await fetch(
          `/api/programming/week?organizationId=${orgId}&trackId=${trackId}&startDate=${weekStart}`,
          { cache: "no-store" }
        );
        const payload = await res.json();
        const days: DayData[] = payload?.days ?? [];
        const todayData = days.find((d) => d.day_date === today);

        if (!todayData || todayData.blocks.length === 0) {
          setNoWorkout(true);
        } else {
          setBlocks(todayData.blocks);
        }
      } catch {
        setNoWorkout(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="glass-panel flex flex-col rounded-3xl border border-white/10 p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Today&apos;s Workout
        </p>
        <Link
          href="/organization/member/workout"
          className="flex items-center gap-1 text-xs font-medium text-[#ffb1c4] transition hover:text-pink-300"
        >
          View full
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-1 flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : noWorkout ? (
        <div className="flex flex-1 items-center justify-center py-6">
          <p className="text-sm text-slate-500">No workout scheduled for today.</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2">
          {blocks!.map((block) => (
            <div
              key={block.id}
              className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${blockAccent(block.block_type)}`}
            >
              <span className="mt-0.5 shrink-0">{blockIcon(block.block_type)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{block.title}</p>
                {block.description ? (
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{block.description}</p>
                ) : block.score_type && SCORE_LABEL[block.score_type] ? (
                  <p className="mt-0.5 text-xs text-slate-500">{SCORE_LABEL[block.score_type]}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
