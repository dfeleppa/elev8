"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Dumbbell, Flame, Snowflake, Zap } from "lucide-react";
import { AccentCard, Micro } from "@/components/ui";

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
  if (type === "warmup") return <Flame className="h-3.5 w-3.5 text-orange-400" />;
  if (type === "lift") return <Dumbbell className="h-3.5 w-3.5 text-blue-400" />;
  if (type === "cooldown") return <Snowflake className="h-3.5 w-3.5 text-cyan-400" />;
  return <Zap className="h-3.5 w-3.5 text-yellow-400" />;
}

function blockAccent() {
  return "border-black/10 bg-black/10";
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
    <AccentCard tone="violet" className="flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <Micro onAccent as="p">Today&apos;s Workout</Micro>
        <Link
          href="/member/workout"
          className="flex items-center gap-1 text-xs font-medium opacity-70 transition hover:opacity-100"
        >
          View full
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-1 flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-black/10" />
          ))}
        </div>
      ) : noWorkout ? (
        <div className="flex flex-1 items-center justify-center py-6">
          <p className="text-sm opacity-50">No workout scheduled for today.</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2">
          {blocks!.map((block) => {
            const plainDesc = block.description ? stripHtml(block.description) : null;
            return (
              <div
                key={block.id}
                className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${blockAccent()}`}
              >
                <span className="mt-0.5 shrink-0">{blockIcon(block.block_type)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{block.title}</p>
                  {plainDesc ? (
                    <p className="mt-0.5 line-clamp-1 text-xs opacity-60">{plainDesc}</p>
                  ) : block.score_type && SCORE_LABEL[block.score_type] ? (
                    <p className="mt-0.5 text-xs opacity-50">{SCORE_LABEL[block.score_type]}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AccentCard>
  );
}
