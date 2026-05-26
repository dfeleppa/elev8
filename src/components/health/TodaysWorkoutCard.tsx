"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Dumbbell, Flame, Snowflake, Zap } from "lucide-react";
import { ActionLink, EmptyState, GlassCard } from "@/components/member-dashboard/PremiumDashboard";

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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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
  if (type === "warmup") return <Flame className="h-4 w-4 text-[#B42368]" />;
  if (type === "lift") return <Dumbbell className="h-4 w-4 text-[#17141F]" />;
  if (type === "cooldown") return <Snowflake className="h-4 w-4 text-[#0D98A1]" />;
  return <Zap className="h-4 w-4 text-[#0D98A1]" />;
}

function blockAccent(type: string) {
  if (type === "warmup") return "border-[rgba(255,92,168,0.18)] bg-[rgba(255,92,168,0.07)]";
  if (type === "lift") return "border-[rgba(16,24,40,0.09)] bg-white/62";
  if (type === "cooldown") return "border-[rgba(20,210,220,0.18)] bg-[rgba(20,210,220,0.07)]";
  return "border-[rgba(20,210,220,0.18)] bg-white/62";
}

export default function TodaysWorkoutCard() {
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [noWorkout, setNoWorkout] = useState(false);

  const loadWorkout = useCallback(async (trackId: string) => {
    setLoading(true);
    setNoWorkout(false);
    setBlocks(null);
    try {
      const today = todayKey();
      const weekStart = startOfWeek(today);
      const res = await fetch(
        `/api/programming/week?trackId=${trackId}&startDate=${weekStart}`,
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
  }, []);

  // Bootstrap: fetch me + resolve track, then load workout
  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me", { cache: "no-store" });
        const me = await meRes.json();

        const storedId = localStorage.getItem("elev8-track-id");
        const tr = await fetch(`/api/programming/tracks`, { cache: "no-store" });
        const tp = await tr.json();
        const fetchedTracks: { id: string }[] = tp?.tracks ?? [];

        let trackId: string | null = null;
        if (storedId && fetchedTracks.some((t) => t.id === storedId)) {
          trackId = storedId;
        } else if (me?.trackId) {
          trackId = me.trackId;
        } else {
          trackId = fetchedTracks[0]?.id ?? null;
        }

        if (!trackId) { setNoWorkout(true); setLoading(false); return; }
        await loadWorkout(trackId);
      } catch {
        setNoWorkout(true);
        setLoading(false);
      }
    })();
  }, [loadWorkout]);

  // React to track changes from header / workout page dropdowns
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "elev8-track-id" && e.newValue) {
        loadWorkout(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [loadWorkout]);

  return (
    <GlassCard className="relative flex min-h-[430px] flex-col overflow-hidden">
      <div className="pointer-events-none absolute -right-12 top-8 h-44 w-44 rounded-full bg-[rgba(109,61,212,0.12)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-4 left-8 h-40 w-40 rounded-full bg-[rgba(20,210,220,0.12)] blur-3xl" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#667085]">Today&apos;s Workout</p>
          <h2 className="mt-1 text-2xl font-bold leading-tight text-[#17141F]">Training plan</h2>
        </div>
        <ActionLink
          href="/member/workout"
          variant="secondary"
          className="px-3 py-2 text-xs"
        >
          View full
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </ActionLink>
      </div>

      {loading ? (
        <div className="flex flex-1 flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-[18px] bg-white/58" />
          ))}
        </div>
      ) : noWorkout ? (
        <EmptyState title="No workout scheduled" description="You do not have programming assigned for today." />
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          {blocks!.map((block) => {
            const plainDesc = block.description ? stripHtml(block.description) : null;
            return (
              <div
                key={block.id}
                className={`flex items-start gap-3 rounded-[20px] border px-4 py-3 ${blockAccent(block.block_type)}`}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                  {blockIcon(block.block_type)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#17141F]">{block.title}</p>
                  {plainDesc ? (
                    <p className="mt-1 line-clamp-1 text-xs font-medium text-[#667085]">{plainDesc}</p>
                  ) : block.score_type && SCORE_LABEL[block.score_type] ? (
                    <p className="mt-1 text-xs font-medium text-[#667085]">{SCORE_LABEL[block.score_type]}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
