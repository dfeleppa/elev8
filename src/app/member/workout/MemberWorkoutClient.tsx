"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Calendar,
  Clock,
  Dumbbell,
  Flame,
  Snowflake,
  Trophy,
  Zap,
  X,
  Plus,
  Minus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Level = { id: string; level: number; title: string; instructions: string };

type Block = {
  id: string;
  block_type: "warmup" | "lift" | "workout" | "cooldown";
  title: string;
  description: string | null;
  score_type: string;
  leaderboard_enabled: boolean;
  benchmark_enabled: boolean;
  movement_id: string | null;
  levels: Level[];
};

type DayData = {
  id: string;
  day_date: string;
  blocks: Block[];
};

type LeaderboardEntry = {
  rank: number;
  id: string;
  member_id: string;
  memberName: string;
  score_text: string | null;
  duration_seconds: number | null;
  is_rx: boolean;
};

type MyResult = {
  id: string;
  block_id: string;
  score_text: string | null;
  is_rx: boolean;
  notes: string | null;
};

type LiftSet = { reps: string; weight: string };

type HistoryEntry = {
  id: string;
  day_date: string;
  score_text: string | null;
  sets: { set_order: number; reps: number; weight: number }[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayKey() {
  return formatKey(new Date());
}

function formatKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, n: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return formatKey(d);
}

function startOfWeek(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return formatKey(d);
}

function labelDay(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return {
    dow: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][d.getDay()],
    num: d.getDate(),
  };
}

function fullDayLabel(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function epleyOneRepMax(sets: { reps: number; weight: number }[]) {
  let best = 0;
  for (const s of sets) {
    if (s.reps > 0 && s.weight > 0) {
      const est = s.weight * (1 + s.reps / 30);
      if (est > best) best = est;
    }
  }
  return best > 0 ? Math.round(best) : null;
}

function roundToNearest5(n: number) {
  return Math.round(n / 5) * 5;
}

function blockIcon(type: string) {
  if (type === "warmup") return <Flame className="h-4 w-4" />;
  if (type === "lift") return <Dumbbell className="h-4 w-4" />;
  if (type === "cooldown") return <Snowflake className="h-4 w-4" />;
  return <Zap className="h-4 w-4" />;
}

const SCORE_LABEL: Record<string, string> = {
  time: "For Time",
  reps: "Reps",
  rounds_reps: "Rounds & Reps",
  distance: "Distance",
  calories: "Calories",
};

function cleanWorkoutText(value: string | null) {
  return (value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\r/g, "")
    .split(/\n|(?:\s{2,})|(?:\s*-\s+)/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function blockAccent(type: Block["block_type"]) {
  if (type === "warmup") return "#FF5CA8";
  if (type === "lift") return "#17141F";
  if (type === "cooldown") return "#14D2DC";
  return "#14D2DC";
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function MemberWorkoutClient() {
  const datePickerRef = useRef<HTMLInputElement>(null);

  const [trackId, setTrackId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<{ id: string; name: string }[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [dayCache, setDayCache] = useState<Record<string, DayData>>({});
  const [weekLoading, setWeekLoading] = useState(false);

  // keyed by blockId
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [leaderboardOpen, setLeaderboardOpen] = useState<Record<string, boolean>>({});
  const [myResults, setMyResults] = useState<Record<string, MyResult>>({});

  // Modals
  const [recordBlock, setRecordBlock] = useState<Block | null>(null);
  const [historyBlock, setHistoryBlock] = useState<Block | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Build the 15-day strip (today is in the center at index 7)
  const stripDays = Array.from({ length: 15 }, (_, i) => addDays(todayKey(), i - 7));

  // ---- Bootstrap ----
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me", { cache: "no-store" });
      const me = await res.json();
      setUserId(me?.userId ?? null);

      let tid: string | null = null;

      const tr = await fetch(`/api/programming/tracks`, { cache: "no-store" });
      const tp = await tr.json();
      const fetchedTracks: { id: string; name: string }[] = (tp?.tracks ?? []).map(
        (t: { id: string; name: string }) => ({ id: t.id, name: t.name })
      );
      setTracks(fetchedTracks);

      const storedId = localStorage.getItem("elev8-track-id");
      if (storedId && fetchedTracks.some((t) => t.id === storedId)) {
        tid = storedId;
      } else if (me?.trackId) {
        tid = me.trackId;
      } else if (fetchedTracks.length > 0) {
        tid = fetchedTracks[0].id;
      }
      if (tid) localStorage.setItem("elev8-track-id", tid);

      setTrackId(tid);
    })();
  }, []);

  // ---- React to track changes from the header dropdown ----
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "elev8-track-id" && e.newValue && e.newValue !== trackId) {
        setTrackId(e.newValue);
        setDayCache({});
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [trackId]);

  // ---- Load week when day or track changes ----
  const loadWeek = useCallback(
    async (dateStr: string) => {
      if (!trackId) return;
      const weekStart = startOfWeek(dateStr);
      setWeekLoading(true);
      try {
        const res = await fetch(
          `/api/programming/week?trackId=${trackId}&startDate=${weekStart}`,
          { cache: "no-store" }
        );
        const payload = await res.json();
        const days: DayData[] = payload?.days ?? [];
        setDayCache((prev) => {
          const next = { ...prev };
          for (const d of days) next[d.day_date] = d;
          return next;
        });
      } finally {
        setWeekLoading(false);
      }
    },
    [trackId]
  );

  useEffect(() => {
    loadWeek(selectedDay);
  }, [loadWeek, selectedDay]);

  // ---- Load my results for selected day ----
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const res = await fetch(
        `/api/programming/results?startDate=${selectedDay}&endDate=${selectedDay}&memberId=${userId}`,
        { cache: "no-store" }
      );
      const payload = await res.json();
      const results: MyResult[] = payload?.results ?? [];
      setMyResults(Object.fromEntries(results.map((r) => [r.block_id, r])));
    })();
  }, [userId, selectedDay]);

  // ---- Load leaderboards for blocks on selected day that are enabled ----
  useEffect(() => {
    const day = dayCache[selectedDay];
    if (!day) return;
    const enabledBlocks = day.blocks.filter((b) => b.leaderboard_enabled);
    if (enabledBlocks.length === 0) return;

    for (const block of enabledBlocks) {
      (async () => {
        const res = await fetch(
          `/api/programming/leaderboards?blockId=${block.id}&dayDate=${selectedDay}`,
          { cache: "no-store" }
        );
        const payload = await res.json();
        setLeaderboards((prev) => ({ ...prev, [block.id]: payload?.leaderboard ?? [] }));
        setLeaderboardOpen((prev) => ({ ...prev, [block.id]: true }));
      })();
    }
  }, [selectedDay, dayCache]);

  // ---- History ----
  async function openHistory(block: Block) {
    setHistoryBlock(block);
    setHistoryEntries([]);
    if (!block.movement_id) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/athlete/movement-results?movementId=${block.movement_id}`, {
        cache: "no-store",
      });
      const payload = await res.json();
      setHistoryEntries(payload?.results ?? []);
    } finally {
      setHistoryLoading(false);
    }
  }

  function afterRecord(blockId: string) {
    // Refresh my results and leaderboard for this block
    if (!userId) return;
    fetch(
      `/api/programming/results?startDate=${selectedDay}&endDate=${selectedDay}&memberId=${userId}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((p) => {
        const results: MyResult[] = p?.results ?? [];
        setMyResults(Object.fromEntries(results.map((r) => [r.block_id, r])));
      });

    if (leaderboards[blockId] !== undefined) {
      fetch(
        `/api/programming/leaderboards?blockId=${blockId}&dayDate=${selectedDay}`,
        { cache: "no-store" }
      )
        .then((r) => r.json())
        .then((p) => setLeaderboards((prev) => ({ ...prev, [blockId]: p?.leaderboard ?? [] })));
    }
  }

  function handleTrackSelect(id: string) {
    if (id === trackId) return;
    setTrackId(id);
    setDayCache({});
    localStorage.setItem("elev8-track-id", id);
    window.dispatchEvent(new StorageEvent("storage", { key: "elev8-track-id", newValue: id }));
  }

  const day = dayCache[selectedDay];
  const blocks = day?.blocks ?? [];
  const selectedTrackName = tracks.find((track) => track.id === trackId)?.name ?? "Fitness";
  const primaryBlock =
    blocks.find((block) => block.block_type === "workout") ??
    blocks.find((block) => block.block_type === "lift") ??
    blocks[0] ??
    null;
  const scoreTypeLabel = primaryBlock ? SCORE_LABEL[primaryBlock.score_type] ?? "Not scored" : "Not scored";
  const recordStatus = primaryBlock && myResults[primaryBlock.id] ? "Recorded" : "Not recorded";
  const equipmentSummary = primaryBlock?.description?.toLowerCase().includes("hyrox")
    ? "Run, Ski, Row, Wall Balls"
    : "See workout details";

  return (
    <div className="premium-main-glow min-h-[calc(100vh-3.5rem)] w-full px-5 py-4 text-[#17141F] sm:px-8 lg:px-10 lg:py-6 2xl:px-12">
      <div className="flex w-full flex-col gap-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-head text-[28px] font-bold leading-tight tracking-normal text-[#17141F] sm:text-[32px]">
              Workout
            </h1>
            <p className="mt-1 text-[15px] font-medium text-[#475467]">
              {fullDayLabel(selectedDay)} · {selectedTrackName} Track
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-[18px] border border-[rgba(16,24,40,0.08)] bg-white/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#667085]">Track</span>
            <select
              value={trackId ?? ""}
              onChange={(e) => handleTrackSelect(e.target.value)}
              className="min-w-[120px] bg-transparent text-sm font-bold text-[#17141F] outline-none"
              aria-label="Select workout track"
            >
              {tracks.length === 0 ? (
                <option value="">Loading</option>
              ) : (
                tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </header>

        <section className="premium-glass-card p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 overflow-x-auto gap-2 pb-0.5 scrollbar-none">
              {stripDays.map((d) => {
                const { dow, num } = labelDay(d);
                const isToday = d === todayKey();
                const isSelected = d === selectedDay;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDay(d)}
                    className={`flex min-w-[72px] flex-col items-center rounded-[20px] border px-2 py-3 text-center transition md:flex-1 ${
                      isSelected
                        ? "border-white/80 bg-[linear-gradient(135deg,rgba(255,92,168,0.92),rgba(20,210,220,0.88))] text-white shadow-[0_14px_30px_rgba(20,210,220,0.18),0_10px_24px_rgba(255,92,168,0.16)]"
                        : "border-[rgba(16,24,40,0.08)] bg-white/64 text-[#475467] hover:border-[rgba(20,210,220,0.24)] hover:bg-[rgba(20,210,220,0.08)]"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase leading-none tracking-[0.16em] ${
                        isSelected ? "text-white/86" : isToday ? "text-[#0D98A1]" : "text-[#667085]"
                      }`}
                    >
                      {isToday ? `${dow} Today` : dow}
                    </span>
                    <span className={`mt-1.5 text-[24px] font-bold leading-none ${isSelected ? "text-white" : "text-[#17141F]"}`}>
                      {num}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => datePickerRef.current?.showPicker?.() ?? datePickerRef.current?.click()}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-[rgba(16,24,40,0.08)] bg-[#17141F] text-white shadow-[0_12px_28px_rgba(16,24,40,0.18)] transition hover:bg-[#101828]"
              aria-label="Pick date"
            >
              <Calendar className="h-4 w-4" />
            </button>
            <input
              ref={datePickerRef}
              type="date"
              value={selectedDay}
              onChange={(e) => {
                if (e.target.value) setSelectedDay(e.target.value);
              }}
              className="sr-only"
            />
          </div>
        </section>

        {weekLoading && <span className="text-xs font-semibold text-[#667085]">Loading workout...</span>}

        <section className="grid w-full gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.65fr)]">
          <div className="premium-glass-card min-h-[420px] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#667085]">Today&apos;s Workout</p>
                <h2 className="mt-1 text-[24px] font-bold leading-tight text-[#17141F]">{fullDayLabel(selectedDay)}</h2>
              </div>
              <span className="rounded-full border border-[rgba(20,210,220,0.22)] bg-[rgba(20,210,220,0.09)] px-3 py-1 text-xs font-bold text-[#0D98A1]">
                {selectedTrackName}
              </span>
            </div>

            {blocks.length === 0 && !weekLoading ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[24px] border border-[rgba(16,24,40,0.08)] bg-white/62 p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(20,210,220,0.18)] bg-[rgba(20,210,220,0.08)] text-[#0D98A1]">
                  <Calendar className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-[#17141F]">Rest day</h3>
                <p className="mt-2 max-w-md text-sm font-medium leading-6 text-[#667085]">
                  No programming is scheduled for this selected day.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {blocks.map((block) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    myResult={myResults[block.id] ?? null}
                    leaderboard={leaderboards[block.id] ?? null}
                    leaderboardOpen={leaderboardOpen[block.id] ?? false}
                    userId={userId}
                    onToggleLeaderboard={() =>
                      setLeaderboardOpen((prev) => ({ ...prev, [block.id]: !prev[block.id] }))
                    }
                    onRecord={() => setRecordBlock(block)}
                    onHistory={() => openHistory(block)}
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-5">
            <div className="premium-glass-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#667085]">Workout Summary</p>
                  <h2 className="mt-1 text-[22px] font-bold leading-tight text-[#17141F]">Training focus</h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(20,210,220,0.11)] text-[#0D98A1]">
                  <Zap className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {[
                  ["Track", selectedTrackName],
                  ["Focus", primaryBlock?.description?.toLowerCase().includes("hyrox") ? "HYROX / Engine" : "Training"],
                  ["Score Type", scoreTypeLabel],
                  ["Time Domain", primaryBlock?.score_type === "time" ? "Long" : "Variable"],
                  ["Equipment", equipmentSummary],
                  ["Record Status", recordStatus],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 rounded-[18px] border border-[rgba(16,24,40,0.08)] bg-white/66 px-4 py-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#667085]">{label}</span>
                    <span className="text-right text-sm font-bold text-[#17141F]">{value}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={!primaryBlock || !(primaryBlock.block_type === "lift" || primaryBlock.block_type === "workout")}
                onClick={() => primaryBlock && setRecordBlock(primaryBlock)}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14D2DC] px-4 py-3 text-sm font-bold text-[#071317] shadow-[0_14px_30px_rgba(20,210,220,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Record Score
              </button>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <button type="button" className="rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/70 px-4 py-2.5 text-sm font-bold text-[#17141F] transition hover:border-[rgba(20,210,220,0.24)] hover:bg-[rgba(20,210,220,0.08)]">
                  View Scaling
                </button>
                <button type="button" className="rounded-2xl border border-[rgba(255,92,168,0.18)] bg-[rgba(255,92,168,0.08)] px-4 py-2.5 text-sm font-bold text-[#B42368] transition hover:bg-[rgba(255,92,168,0.12)]">
                  Ask AI Coach
                </button>
              </div>
            </div>

            <div className="premium-glass-card p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#667085]">Coach Note</p>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#475467]">
                Pace the first run. Keep transitions tight. Save your push for the final wall balls.
              </p>
            </div>
          </aside>
        </section>

        {recordBlock && (
          <RecordModal
            block={recordBlock}
            trackId={trackId!}
            dayDate={selectedDay}
            userId={userId!}
            onClose={() => setRecordBlock(null)}
            onSaved={() => {
              afterRecord(recordBlock.id);
              setRecordBlock(null);
            }}
          />
        )}

        {historyBlock && (
          <HistoryPanel
            block={historyBlock}
            entries={historyEntries}
            loading={historyLoading}
            onClose={() => setHistoryBlock(null)}
          />
        )}

        <div className="hidden">
      {/* ── Track selector ── */}
      {tracks.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Track</span>
          <select
            value={trackId ?? ""}
            onChange={(e) => handleTrackSelect(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1.5 text-sm text-[var(--text-muted)] outline-none transition hover:border-[var(--line-strong)] hover:text-[var(--text)]"
          >
            {tracks.map((t) => (
              <option key={t.id} value={t.id} className="bg-[var(--panel)] text-[var(--text)]">
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Date strip ── */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 overflow-x-auto gap-1 pb-0.5 scrollbar-none">
            {stripDays.map((d) => {
              const { dow, num } = labelDay(d);
              const isToday = d === todayKey();
              const isSelected = d === selectedDay;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDay(d)}
                  className={`flex min-w-[40px] flex-col items-center rounded-xl px-2 py-1.5 text-center transition ${
                    isSelected
                      ? "bg-blue-800 text-white ring-1 ring-blue-700"
                      : "text-[var(--text-muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest">{dow}</span>
                  <span
                    className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      isToday && !isSelected ? "bg-[var(--panel-2)] text-[var(--text)]" : ""
                    }`}
                  >
                    {num}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Calendar picker */}
          <button
            type="button"
            onClick={() => datePickerRef.current?.showPicker?.() ?? datePickerRef.current?.click()}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--panel-2)] text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text)]"
            aria-label="Pick date"
          >
            <Calendar className="h-4 w-4" />
          </button>
          <input
            ref={datePickerRef}
            type="date"
            value={selectedDay}
            onChange={(e) => { if (e.target.value) setSelectedDay(e.target.value); }}
            className="sr-only"
          />
        </div>
      </div>

      {/* ── Day heading ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--text)]">{fullDayLabel(selectedDay)}</h1>
        {weekLoading && <span className="text-xs text-[var(--text-soft)]">Loading…</span>}
      </div>

      {/* ── Blocks ── */}
      {blocks.length === 0 && !weekLoading ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] px-6 py-12 text-center text-sm text-[var(--text-soft)]">
          Rest day — no programming scheduled.
        </div>
      ) : (
        <div className="space-y-5">
          {blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              myResult={myResults[block.id] ?? null}
              leaderboard={leaderboards[block.id] ?? null}
              leaderboardOpen={leaderboardOpen[block.id] ?? false}
              userId={userId}
              onToggleLeaderboard={() =>
                setLeaderboardOpen((prev) => ({ ...prev, [block.id]: !prev[block.id] }))
              }
              onRecord={() => setRecordBlock(block)}
              onHistory={() => openHistory(block)}
            />
          ))}
        </div>
      )}

      {/* ── Record Modal ── */}
      {recordBlock && (
        <RecordModal
          block={recordBlock}
          trackId={trackId!}
          dayDate={selectedDay}
          userId={userId!}
          onClose={() => setRecordBlock(null)}
          onSaved={() => {
            afterRecord(recordBlock.id);
            setRecordBlock(null);
          }}
        />
      )}

      {/* ── History Panel ── */}
      {historyBlock && (
        <HistoryPanel
          block={historyBlock}
          entries={historyEntries}
          loading={historyLoading}
          onClose={() => setHistoryBlock(null)}
        />
      )}
    </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlockCard
// ---------------------------------------------------------------------------

type BlockCardProps = {
  block: Block;
  myResult: MyResult | null;
  leaderboard: LeaderboardEntry[] | null;
  leaderboardOpen: boolean;
  userId: string | null;
  onToggleLeaderboard: () => void;
  onRecord: () => void;
  onHistory: () => void;
};

function BlockCard({
  block,
  myResult,
  leaderboard,
  leaderboardOpen,
  userId,
  onToggleLeaderboard,
  onRecord,
  onHistory,
}: BlockCardProps) {
  const scoreLabel = SCORE_LABEL[block.score_type] ?? null;
  const showRecord = block.block_type === "lift" || block.block_type === "workout";
  const showHistory = !!block.movement_id;
  const showLeaderboard = block.leaderboard_enabled;
  const descriptionLines = cleanWorkoutText(block.description);
  const accent = blockAccent(block.block_type);

  return (
    <div className="overflow-hidden rounded-[26px] border border-[rgba(16,24,40,0.08)] bg-white/72 shadow-[0_18px_38px_rgba(16,24,40,0.08)]">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-4">
        <div
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_12px_26px_rgba(16,24,40,0.12)]"
          style={{ backgroundColor: accent }}
        >
          {blockIcon(block.block_type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[22px] font-bold leading-tight text-[#17141F]">{block.title}</h2>
            {scoreLabel && (
              <span className="rounded-full border border-[rgba(20,210,220,0.22)] bg-[rgba(20,210,220,0.09)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0D98A1]">
                {scoreLabel}
              </span>
            )}
            {myResult && (
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                ✓ {myResult.score_text ?? "Logged"}
              </span>
            )}
          </div>
        </div>
        {showHistory && (
          <button
            type="button"
            onClick={onHistory}
            title="View history"
            className="flex-shrink-0 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-1.5 text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text)]"
          >
            <Clock className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Description */}
      {descriptionLines.length > 0 && (
        <div className="mx-5 mb-4 rounded-[22px] border border-[rgba(16,24,40,0.08)] bg-white/66 p-4">
          {block.block_type === "workout" ? (
            <ol className="grid gap-2 md:grid-cols-2">
              {descriptionLines.map((line, index) => (
                <li key={`${line}-${index}`} className="flex gap-3 rounded-2xl bg-white/62 px-3 py-2.5 text-sm font-semibold leading-5 text-[#344054]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#17141F] text-[11px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {descriptionLines.map((line, index) => (
                <p key={`${line}-${index}`} className="rounded-2xl bg-white/62 px-3 py-2.5 text-sm font-semibold leading-5 text-[#344054]">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Levels */}
      {block.levels.length > 0 && (
        <div className="mx-5 mb-4 grid gap-2">
          {block.levels.map((lv) => (
            <div key={lv.id} className="rounded-[18px] border border-[rgba(16,24,40,0.08)] bg-white/66 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#667085]">{lv.title}</p>
              {lv.instructions && (
                <p className="mt-1 text-sm font-medium leading-6 text-[#475467]">{lv.instructions}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {(showRecord || showLeaderboard) && (
        <div className="flex items-center gap-2 border-t border-[var(--line)] px-4 py-2.5">
          {showLeaderboard && (
            <button
              type="button"
              onClick={onToggleLeaderboard}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                leaderboardOpen
                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                  : "border-[var(--line)] bg-[var(--panel-2)] text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]"
              }`}
            >
              <Trophy className="h-3.5 w-3.5" />
              Results
            </button>
          )}
          {showRecord && (
            <button
              type="button"
              onClick={onRecord}
              className="ml-auto accent-pink flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            >
              <Plus className="h-3.5 w-3.5" />
              {myResult ? "Re-Record" : "Record"}
            </button>
          )}
        </div>
      )}

      {/* Leaderboard */}
      {showLeaderboard && leaderboardOpen && leaderboard !== null && (
        <div className="border-t border-[var(--line)] px-4 py-3">
          {leaderboard.length === 0 ? (
            <p className="text-xs text-[var(--text-soft)]">No results yet — be the first!</p>
          ) : (
            <div className="space-y-1">
              {leaderboard.map((entry) => {
                const isMe = entry.member_id === userId;
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${
                      isMe ? "border border-cyan-500/20 bg-cyan-500/5" : ""
                    }`}
                  >
                    <span className="w-5 text-center text-xs font-bold text-[var(--text-soft)]">
                      {entry.rank}
                    </span>
                    <span className="flex-1 truncate text-xs text-[var(--text-muted)]">
                      {isMe ? "You" : entry.memberName}
                    </span>
                    <span className="text-xs font-semibold text-[var(--text)]">
                      {entry.score_text ?? "—"}
                    </span>
                    {entry.is_rx && (
                      <span className="text-[10px] font-bold text-cyan-400">RX</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecordModal
// ---------------------------------------------------------------------------

type RecordModalProps = {
  block: Block;
  trackId: string;
  dayDate: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
};

function RecordModal({ block, trackId, dayDate, userId, onClose, onSaved }: RecordModalProps) {
  const isLift = block.block_type === "lift";
  const scoreType = block.score_type;

  const [level, setLevel] = useState<number | null>(block.levels[0]?.level ?? null);
  const [isRx, setIsRx] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lift-specific
  const [liftSets, setLiftSets] = useState<LiftSet[]>([{ reps: "", weight: "" }]);

  // Score fields
  const [mins, setMins] = useState("");
  const [secs, setSecs] = useState("");
  const [reps, setReps] = useState("");
  const [rounds, setRounds] = useState("");
  const [extraReps, setExtraReps] = useState("");
  const [distance, setDistance] = useState("");
  const [calories, setCalories] = useState("");

  function addSet() {
    setLiftSets((prev) => [...prev, { reps: "", weight: "" }]);
  }

  function removeSet(i: number) {
    setLiftSets((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateSet(i: number, field: "reps" | "weight", value: string) {
    setLiftSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      let scoreText: string | null = null;
      let scoreValue: number | null = null;
      let durationSeconds: number | null = null;
      let totalReps: number | null = null;
      let roundsVal: number | null = null;
      let distanceVal: number | null = null;
      let caloriesVal: number | null = null;

      if (scoreType === "time") {
        const m = parseInt(mins || "0", 10);
        const s = parseInt(secs || "0", 10);
        durationSeconds = m * 60 + s;
        scoreValue = durationSeconds;
        scoreText = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      } else if (scoreType === "reps") {
        totalReps = parseInt(reps, 10) || 0;
        scoreValue = totalReps;
        scoreText = `${totalReps} reps`;
      } else if (scoreType === "rounds_reps") {
        roundsVal = parseInt(rounds, 10) || 0;
        const extra = parseInt(extraReps, 10) || 0;
        totalReps = extra;
        scoreValue = roundsVal * 100 + extra;
        scoreText = `${roundsVal}+${extra}`;
      } else if (scoreType === "distance") {
        distanceVal = parseFloat(distance) || 0;
        scoreValue = distanceVal;
        scoreText = distanceVal >= 1000 ? `${(distanceVal / 1000).toFixed(1)}km` : `${distanceVal}m`;
      } else if (scoreType === "calories") {
        caloriesVal = parseInt(calories, 10) || 0;
        scoreValue = caloriesVal;
        scoreText = `${caloriesVal} cal`;
      }

      const parsedSets = isLift
        ? liftSets
            .map((s) => ({ reps: parseInt(s.reps, 10), weight: parseFloat(s.weight) }))
            .filter((s) => s.reps > 0 && s.weight > 0)
        : [];

      const res = await fetch("/api/programming/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId,
          blockId: block.id,
          dayDate,
          memberId: userId,
          scoreType: scoreType || "none",
          scoreText,
          scoreValue,
          totalReps,
          rounds: roundsVal,
          distance: distanceVal,
          calories: caloriesVal,
          durationSeconds,
          level,
          isRx,
          notes: notes || null,
          liftSets: parsedSets,
        }),
      });

      if (!res.ok) {
        const p = await res.json();
        setError(p?.error ?? "Failed to save.");
        return;
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--pink)] focus:outline-none";
  const labelCls = "text-xs uppercase tracking-widest text-[var(--text-soft)]";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[var(--text)]">Record — {block.title}</h2>
          <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Level selector */}
          {block.levels.length > 0 && (
            <div>
              <p className={labelCls}>Level</p>
              <div className="mt-1.5 flex gap-2 flex-wrap">
                {block.levels.map((lv) => (
                  <button
                    key={lv.id}
                    type="button"
                    onClick={() => setLevel(lv.level)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      level === lv.level
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                        : "border-[var(--line)] bg-[var(--panel-2)] text-[var(--text-muted)] hover:border-[var(--line-strong)]"
                    }`}
                  >
                    {lv.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lift sets */}
          {isLift && (
            <div>
              <p className={labelCls}>Sets</p>
              <div className="mt-1.5 space-y-2">
                {liftSets.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 text-center text-xs text-[var(--text-soft)]">{i + 1}</span>
                    <input
                      type="number"
                      placeholder="Reps"
                      value={s.reps}
                      onChange={(e) => updateSet(i, "reps", e.target.value)}
                      className={`${inputCls} flex-1`}
                    />
                    <input
                      type="number"
                      placeholder="Weight (lbs)"
                      value={s.weight}
                      onChange={(e) => updateSet(i, "weight", e.target.value)}
                      className={`${inputCls} flex-1`}
                    />
                    {liftSets.length > 1 && (
                      <button type="button" onClick={() => removeSet(i)} className="text-[var(--text-soft)] hover:text-red-400">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSet}
                  className="flex items-center gap-1 text-xs text-[var(--text-soft)] hover:text-[var(--text-muted)]"
                >
                  <Plus className="h-3 w-3" /> Add set
                </button>
              </div>
            </div>
          )}

          {/* Score entry */}
          {scoreType === "time" && (
            <div>
              <p className={labelCls}>Time</p>
              <div className="mt-1.5 flex gap-2 items-center">
                <input type="number" min={0} placeholder="Min" value={mins} onChange={(e) => setMins(e.target.value)} className={`${inputCls} flex-1`} />
                <span className="text-[var(--text-soft)]">:</span>
                <input type="number" min={0} max={59} placeholder="Sec" value={secs} onChange={(e) => setSecs(e.target.value)} className={`${inputCls} flex-1`} />
              </div>
            </div>
          )}
          {scoreType === "reps" && (
            <div>
              <p className={labelCls}>Reps</p>
              <input type="number" min={0} placeholder="Total reps" value={reps} onChange={(e) => setReps(e.target.value)} className={`${inputCls} mt-1.5`} />
            </div>
          )}
          {scoreType === "rounds_reps" && (
            <div>
              <p className={labelCls}>Rounds + Reps</p>
              <div className="mt-1.5 flex gap-2 items-center">
                <input type="number" min={0} placeholder="Rounds" value={rounds} onChange={(e) => setRounds(e.target.value)} className={`${inputCls} flex-1`} />
                <span className="text-[var(--text-soft)]">+</span>
                <input type="number" min={0} placeholder="Extra reps" value={extraReps} onChange={(e) => setExtraReps(e.target.value)} className={`${inputCls} flex-1`} />
              </div>
            </div>
          )}
          {scoreType === "distance" && (
            <div>
              <p className={labelCls}>Distance (meters)</p>
              <input type="number" min={0} placeholder="e.g. 400" value={distance} onChange={(e) => setDistance(e.target.value)} className={`${inputCls} mt-1.5`} />
            </div>
          )}
          {scoreType === "calories" && (
            <div>
              <p className={labelCls}>Calories</p>
              <input type="number" min={0} placeholder="Cal" value={calories} onChange={(e) => setCalories(e.target.value)} className={`${inputCls} mt-1.5`} />
            </div>
          )}

          {/* RX toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRx}
              onChange={(e) => setIsRx(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 accent-cyan-500"
            />
            <span className="text-sm text-[var(--text-muted)]">RX</span>
          </label>

          {/* Notes */}
          <div>
            <p className={labelCls}>Notes</p>
            <textarea
              rows={2}
              placeholder="How'd it go?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputCls} mt-1.5 resize-none`}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="mt-4 w-full accent-pink rounded-2xl py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Result"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HistoryPanel
// ---------------------------------------------------------------------------

type HistoryPanelProps = {
  block: Block;
  entries: HistoryEntry[];
  loading: boolean;
  onClose: () => void;
};

function HistoryPanel({ block, entries, loading, onClose }: HistoryPanelProps) {
  const [calcWeight, setCalcWeight] = useState("");

  const allSets = entries.flatMap((e) => e.sets);
  const estimatedMax = epleyOneRepMax(allSets);

  const pctRows =
    estimatedMax != null
      ? [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100].map((pct) => ({
          pct,
          weight: roundToNearest5((estimatedMax * pct) / 100),
        }))
      : [];

  const inputPctResult =
    estimatedMax != null && calcWeight !== ""
      ? Math.round((parseFloat(calcWeight) / estimatedMax) * 100)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-sm flex-col border-l border-[var(--line)] bg-[var(--bg)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--text-soft)]">History</p>
            <h2 className="mt-0.5 text-base font-bold text-[var(--text)]">{block.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--panel-2)]" />
              ))}
            </div>
          )}

          {!loading && entries.length === 0 && (
            <p className="text-sm text-[var(--text-soft)]">No history found for this movement.</p>
          )}

          {/* Estimated 1RM */}
          {estimatedMax != null && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-[var(--text-soft)]">Estimated 1RM</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text)]">{estimatedMax} lbs</p>
            </div>
          )}

          {/* % Calculator */}
          {estimatedMax != null && (
            <div>
              <p className="text-xs uppercase tracking-widest text-[var(--text-soft)] mb-2">% Calculator</p>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="number"
                  placeholder="Enter weight (lbs)"
                  value={calcWeight}
                  onChange={(e) => setCalcWeight(e.target.value)}
                  className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--pink)] focus:outline-none"
                />
                {inputPctResult != null && (
                  <span className="text-sm font-bold text-cyan-300 whitespace-nowrap">= {inputPctResult}%</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {pctRows.map(({ pct, weight }) => (
                  <div key={pct} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-1.5">
                    <span className="text-xs text-[var(--text-soft)]">{pct}%</span>
                    <span className="text-xs font-semibold text-[var(--text)]">{weight} lbs</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Past sessions */}
          {entries.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-[var(--text-soft)] mb-2">Past Sessions</p>
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2.5">
                    <p className="text-xs font-semibold text-[var(--text-muted)]">
                      {new Date(`${entry.day_date}T00:00:00`).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    {entry.sets.length > 0 ? (
                      <div className="mt-1.5 space-y-0.5">
                        {entry.sets.map((s) => (
                          <p key={s.set_order} className="text-xs text-[var(--text-muted)]">
                            {s.reps} × {s.weight} lbs
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{entry.score_text ?? "—"}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
