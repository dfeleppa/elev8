"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Dumbbell,
  Layers3,
  Plus,
  Sparkles,
} from "lucide-react";
import ProgrammingSubheader from "@/components/admin/ProgrammingSubheader";
import TipTapEditor from "@/components/owner/TipTapEditor";
import TrackProgressionPanel from "@/components/admin/TrackProgressionPanel";

type SessionEntry = {
  id: string;
  title: string;
  block?: string;
  blockType: string;
  lines: string[];
  htmlContent: string;
};

type TrackOption = {
  id: string;
  name: string;
};

type ViewMode = "month" | "week" | "day";

type WeekDayResponse = {
  id: string;
  day_date: string;
  blocks: Array<{
    id: string;
    title: string;
    description: string | null;
    score_type: string;
    block_type: string;
  }>;
};

const weekDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fallbackSessions: Record<string, SessionEntry[]> = {};

function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(value: string) {
  return new Date(`${value}T00:00:00`);
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function toWeekRangeLabel(date: Date) {
  const start = startOfWeek(date);
  const end = endOfWeek(date);
  const left = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const right = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${left} - ${right}`;
}

function toMonthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function toDayLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toHeaderDayLabel(date: Date) {
  return `${weekDayNames[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()}`;
}

const SCORE_LABELS: Record<string, string> = {
  calories: "Calories",
  distance: "Distance",
  time: "For Time",
  reps: "Reps",
  rounds_reps: "Rounds & Reps",
};

function getScoreLabel(value?: string) {
  const text = (value ?? "none").trim();
  if (!text || text === "none") {
    return null;
  }
  return SCORE_LABELS[text] ?? (text.charAt(0).toUpperCase() + text.slice(1));
}

function getSessionById(
  sessions: Record<string, SessionEntry[]>,
  sessionId: string | null
): { day: string; session: SessionEntry } | null {
  if (!sessionId) {
    return null;
  }

  for (const [dayKey, daySessions] of Object.entries(sessions)) {
    const match = daySessions.find((session) => session.id === sessionId);
    if (match) {
      return { day: dayKey, session: match };
    }
  }

  return null;
}

function htmlToPlainLines(html: string): string[] {
  return html
    .replace(/<[^>]+>/g, " ")
    .split(/\s{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function mapWeekResponse(days: WeekDayResponse[]) {
  const mapped: Record<string, SessionEntry[]> = {};
  for (const day of days) {
    mapped[day.day_date] = day.blocks.map((block) => {
      const raw = block.description ?? "";
      const isHtml = raw.trimStart().startsWith("<");
      return {
        id: block.id,
        title: block.title,
        block: block.score_type,
        blockType: block.block_type ?? "workout",
        htmlContent: raw,
        lines: isHtml ? htmlToPlainLines(raw) : raw.split("\n").map((l) => l.trim()).filter(Boolean),
      };
    });
  }
  return mapped;
}

export default function ProgrammingClient() {
  const datePickerRef = useRef<HTMLInputElement | null>(null);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [showDetails, setShowDetails] = useState(true);

  const [selectedDay, setSelectedDay] = useState(() => formatDateKey(new Date()));
  const [sessions, setSessions] = useState<Record<string, SessionEntry[]>>(fallbackSessions);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [tracks, setTracks] = useState<TrackOption[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingType, setCreatingType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "progression">("details");

  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(() => new Set());
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<"copy" | "move">("copy");
  const [transferTargetTrackId, setTransferTargetTrackId] = useState<string>("");
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const selectionActive = selectedBlockIds.size > 0;

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      return {
        label: toHeaderDayLabel(date),
        date: formatDateKey(date),
        dateObj: date,
      };
    });
  }, [currentDate]);

  const monthDays = useMemo(() => {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);

    const days: Array<{ key: string; dateObj: Date; inMonth: boolean }> = [];
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) {
      days.push({
        key: formatDateKey(d),
        dateObj: new Date(d),
        inMonth: d.getMonth() === currentDate.getMonth(),
      });
    }

    return days;
  }, [currentDate]);

  const selected = useMemo(() => getSessionById(sessions, selectedSessionId), [sessions, selectedSessionId]);
  const selectedDaySessions = sessions[selectedDay] ?? [];

  const editor = selected ?? {
    day: selectedDay,
    session: {
      id: "empty",
      title: "",
      block: "none",
      blockType: "workout",
      lines: [],
      htmlContent: "",
    },
  };

  const dayLabel = toDayLabel(parseDateKey(selectedDay));

  const headerLabel =
    viewMode === "month"
      ? toMonthLabel(currentDate)
      : viewMode === "day"
        ? toDayLabel(currentDate)
        : toWeekRangeLabel(currentDate);

  const visibleColumns =
    viewMode === "week"
      ? weekDays
      : [{ label: toHeaderDayLabel(parseDateKey(selectedDay)), date: selectedDay, dateObj: parseDateKey(selectedDay) }];

  const selectedTrackName = tracks.find((track) => track.id === selectedTrackId)?.name ?? "Programming Track";
  const scheduledDays = weekDays.filter((day) => (sessions[day.date] ?? []).length > 0).length;
  const emptyDays = 7 - scheduledDays;
  const totalBlocks = weekDays.reduce((total, day) => total + (sessions[day.date] ?? []).length, 0);
  const weekStatusLabel = loading ? "Syncing" : totalBlocks > 0 ? "Ready" : "Draft";

  useEffect(() => {
    let isMounted = true;

    const loadBootstrap = async () => {
      try {
        const trackResponse = await fetch(`/api/programming/tracks`, {
          cache: "no-store",
        });
        const trackPayload = await trackResponse.json();
        if (!trackResponse.ok) {
          return;
        }

        const trackRows: TrackOption[] = trackPayload?.tracks ?? [];
        if (!isMounted || trackRows.length === 0) {
          return;
        }

        setTracks(trackRows);
        setSelectedTrackId((prev) => prev || trackRows[0].id);
      } catch {
        // Keep fallback state when bootstrap fails.
      }
    };

    loadBootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadWeek = async () => {
      if (!selectedTrackId) {
        return;
      }

      setLoading(true);
      try {
        const startDate = formatDateKey(startOfWeek(currentDate));
        const response = await fetch(
          `/api/programming/week?trackId=${selectedTrackId}&startDate=${startDate}`,
          { cache: "no-store" }
        );
        const payload = await response.json();
        if (!isMounted || !response.ok) {
          return;
        }

        const nextSessions = mapWeekResponse(payload?.days ?? []);
        setSessions(nextSessions);

        const dayKeys = Object.keys(nextSessions);
        if (dayKeys.length === 0) {
          setSelectedSessionId(null);
        } else {
          const preferredDay = formatDateKey(currentDate);
          const firstDay = nextSessions[preferredDay] ? preferredDay : dayKeys[0];
          setSelectedDay(firstDay);
          setSelectedSessionId(nextSessions[firstDay]?.[0]?.id ?? null);
        }
      } catch {
        // Keep state when fetch fails.
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadWeek();

    return () => {
      isMounted = false;
    };
  }, [selectedTrackId, currentDate]);

  useEffect(() => {
    setActiveTab("details");
  }, [selectedSessionId]);

  useEffect(() => {
    setSelectedBlockIds(new Set());
  }, [selectedTrackId]);

  useEffect(() => {
    if (!selectedDay) {
      return;
    }

    const daySessions = sessions[selectedDay] ?? [];
    if (daySessions.length === 0) {
      if (selectedSessionId !== null) {
        setSelectedSessionId(null);
      }
      return;
    }

    const selectedBelongsToDay = daySessions.some((entry) => entry.id === selectedSessionId);
    if (!selectedBelongsToDay) {
      setSelectedSessionId(daySessions[0].id);
    }
  }, [selectedDay, sessions, selectedSessionId]);

  const stepDate = (delta: number) => {
    setCurrentDate((prev) => {
      if (viewMode === "month") {
        return addMonths(prev, delta);
      }
      if (viewMode === "day") {
        return addDays(prev, delta);
      }
      return addDays(prev, delta * 7);
    });
    setEditorOpen(false);
  };

  const updateEditor = (field: "title" | "block" | "htmlContent", value: string) => {
    setSessions((prev) => {
      const current = getSessionById(prev, selectedSessionId);
      if (!current) {
        return prev;
      }

      const updatedSessions = { ...prev };
      const daySessions = [...(updatedSessions[current.day] ?? [])];
      const index = daySessions.findIndex((entry) => entry.id === current.session.id);
      if (index === -1) {
        return prev;
      }

      const updated = { ...daySessions[index] };
      if (field === "htmlContent") {
        updated.htmlContent = value;
        updated.lines = htmlToPlainLines(value);
      } else {
        updated[field] = value;
      }

      daySessions[index] = updated;
      updatedSessions[current.day] = daySessions;
      return updatedSessions;
    });
  };

  const createBlock = async (blockType: "warmup" | "lift" | "workout" | "cooldown") => {
    if (!selectedTrackId) {
      return;
    }

    setCreatingType(blockType);
    try {
      const daySessions = sessions[selectedDay] ?? [];
      const blockOrder = daySessions.length;
      const scoreType = blockType === "lift" ? "none" : blockType === "workout" ? "time" : "none";
      const defaultTitle =
        blockType === "warmup"
          ? "Warm Up"
          : blockType === "cooldown"
            ? "Cooldown"
            : blockType === "lift"
              ? "Lift"
              : "Workout";

      const response = await fetch("/api/programming/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: selectedTrackId,
          dayDate: selectedDay,
          blockType,
          title: defaultTitle,
          description: "",
          scoreType,
          blockOrder,
          leaderboardEnabled: blockType === "workout" || blockType === "lift",
          benchmarkEnabled: false,
          tags: [],
          levels: blockType === "workout" ? [{ level: 1, title: "RX", instructions: "" }] : [],
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.block?.id) {
        return;
      }

      const created: SessionEntry = {
        id: payload.block.id,
        title: payload.block.title,
        block: payload.block.score_type,
        blockType: blockType,
        lines: [],
        htmlContent: "",
      };

      setSessions((prev) => {
        const next = { ...prev };
        const previousDay = next[selectedDay] ?? [];
        next[selectedDay] = [...previousDay, created];
        return next;
      });

      setSelectedSessionId(created.id);
      setEditorOpen(true);
    } finally {
      setCreatingType(null);
    }
  };

  const saveSelectedSession = async () => {
    if (!selectedTrackId) {
      return;
    }

    const current = getSessionById(sessions, selectedSessionId);
    if (!current) {
      return;
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(current.session.id)) {
      return;
    }

    setSaving(true);
    try {
      await fetch(`/api/programming/blocks/${current.session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: current.session.title,
          scoreType: current.session.block ?? "none",
          description: current.session.htmlContent || current.session.lines.join("\n"),
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleBlockSelection = (blockId: string) => {
    setEditorOpen(false);
    setSelectedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  };

  const openTransferDialog = (mode: "copy" | "move") => {
    if (selectedBlockIds.size === 0) return;
    const firstOther = tracks.find((track) => track.id !== selectedTrackId);
    setTransferMode(mode);
    setTransferTargetTrackId(firstOther?.id ?? "");
    setTransferError(null);
    setTransferOpen(true);
  };

  const submitTransfer = async () => {
    if (!transferTargetTrackId || selectedBlockIds.size === 0) return;
    setTransferring(true);
    setTransferError(null);
    try {
      const response = await fetch("/api/programming/blocks/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockIds: Array.from(selectedBlockIds),
          targetTrackId: transferTargetTrackId,
          mode: transferMode,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setTransferError(payload?.error ?? "Failed to transfer workouts.");
        return;
      }

      setTransferOpen(false);
      setSelectedBlockIds(new Set());

      if (transferMode === "move") {
        // The blocks are gone from the current track — refetch the current week.
        setCurrentDate((prev) => new Date(prev));
      }
    } catch {
      setTransferError("Failed to transfer workouts.");
    } finally {
      setTransferring(false);
    }
  };

  return (
    <>
      <ProgrammingSubheader />
    <section className="programming-dashboard premium-main-glow min-h-[calc(100vh-3.5rem)] space-y-5 px-5 py-5 text-[#17141F] sm:px-8 lg:px-10 lg:py-6 2xl:px-12">
      <header className="relative z-10 flex flex-col items-center gap-3 text-center">
        <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.02em] text-[#17141F] sm:text-[34px]">
          Programming
        </h1>
        <div className="premium-glass-pill flex w-full max-w-[430px] items-center justify-center p-1.5">
          <button
            type="button"
            onClick={() => stepDate(-1)}
            className="grid h-10 w-10 place-items-center rounded-full text-[#475467] transition hover:bg-white hover:text-[#17141F]"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center px-1">
            <button
              type="button"
              onClick={() => datePickerRef.current?.showPicker?.() ?? datePickerRef.current?.click()}
              className="min-w-0 rounded-full px-3 py-2 text-center text-[14px] font-extrabold leading-none text-[#17141F] transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#14D2DC]/35 sm:text-[15px]"
              aria-label="Pick date"
            >
              <span className="block truncate">{headerLabel}</span>
            </button>
            <input
              ref={datePickerRef}
              type="date"
              value={formatDateKey(currentDate)}
              onChange={(event) => {
                if (!event.target.value) {
                  return;
                }
                const next = parseDateKey(event.target.value);
                setCurrentDate(next);
                setSelectedDay(event.target.value);
              }}
              className="sr-only"
            />
          </div>
          <button
            type="button"
            onClick={() => stepDate(1)}
            className="grid h-10 w-10 place-items-center rounded-full text-[#475467] transition hover:bg-white hover:text-[#17141F]"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="premium-glass-card flex w-full flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#667085]">View</span>
            <label className="inline-flex items-center gap-2 rounded-full border border-[#D4DAE4]/85 bg-white/76 px-3 py-2 text-[12px] font-extrabold text-[#475467] shadow-[inset_0_1px_0_rgba(255,255,255,0.94)]">
              <input
                type="checkbox"
                checked={showDetails}
                onChange={(event) => setShowDetails(event.target.checked)}
                className="h-4 w-4 rounded border-[#D0D5DD] accent-[#14D2DC]"
              />
              Show Details
            </label>
          </div>

          <div className="inline-flex justify-center rounded-full border border-[#D0D5DD]/70 bg-white/70 p-0.5 text-[12px] font-bold shadow-inner">
            {(["month", "week", "day"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded-full px-3 py-1.5 transition sm:px-4 ${
                  viewMode === mode ? "bg-[#101828] text-white" : "text-[#667085] hover:bg-white hover:text-[#17141F]"
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(330px,0.42fr)] lg:items-start lg:gap-5 lg:space-y-0">
        <div className="premium-glass-card flex min-w-0 flex-col p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-[18px] font-extrabold text-[#17141F] sm:text-[21px]">
                <CalendarDays className="h-5 w-5 text-[#FF5CA8]" aria-hidden="true" />
                Week Overview
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#667085]" htmlFor="track-selector-redesign">
                  Track
                </label>
                <select
                  id="track-selector-redesign"
                  name="track"
                  className="min-h-10 rounded-full border border-[#D4DAE4]/85 bg-white/86 px-4 py-2 text-[13px] font-extrabold text-[#17141F] shadow-[inset_0_1px_0_rgba(255,255,255,0.94)] focus:border-[#14D2DC]/50 focus:outline-none"
                  value={selectedTrackId}
                  onChange={(event) => setSelectedTrackId(event.target.value)}
                >
                  {tracks.length === 0 ? <option value="">No tracks yet</option> : null}
                  {tracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.name}
                    </option>
                  ))}
                </select>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#14D2DC]/12 px-3 py-1 text-[11px] font-extrabold text-[#0B7C84]">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {weekStatusLabel}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedDay(formatDateKey(currentDate));
                  setSelectedSessionId(null);
                  setEditorOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#FF5CA8] px-4 py-2 text-[12px] font-extrabold text-white shadow-[0_12px_24px_rgba(255,92,168,0.24)] transition hover:brightness-105"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add block
              </button>
              <button
                type="button"
                onClick={() => setSelectedBlockIds(new Set(Object.values(sessions).flat().map((session) => session.id)))}
                disabled={totalBlocks === 0}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D4DAE4]/85 bg-white/84 px-4 py-2 text-[12px] font-extrabold text-[#17141F] shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_8px_18px_rgba(16,24,40,0.06)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy className="h-4 w-4 text-[#0B7C84]" aria-hidden="true" />
                Copy week
              </button>
              <Link
                href="/admin/programming/builder"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D4DAE4]/85 bg-white/84 px-4 py-2 text-[12px] font-extrabold text-[#17141F] shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_8px_18px_rgba(16,24,40,0.06)] transition hover:bg-white"
              >
                <Layers3 className="h-4 w-4 text-[#FF5CA8]" aria-hidden="true" />
                Templates
              </Link>
            </div>
          </div>

          {viewMode === "month" ? (
            <div className="mt-5 rounded-[22px] border border-[#D4DAE4]/85 bg-white/60 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#667085]">
                {weekDayNames.map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {monthDays.map((day) => {
                  const daySessions = sessions[day.key] ?? [];
                  const isSelectedDay = selectedDay === day.key;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => {
                        setSelectedDay(day.key);
                        setCurrentDate(day.dateObj);
                        setSelectedSessionId(daySessions[0]?.id ?? null);
                        setEditorOpen(true);
                      }}
                      className={`min-h-[86px] rounded-[16px] border p-2 text-left transition ${
                        isSelectedDay
                          ? "border-[#14D2DC]/45 bg-[#14D2DC]/16 shadow-[0_10px_22px_rgba(20,210,220,0.14)]"
                          : day.inMonth
                            ? "border-[#DDE2EA] bg-white/76 hover:bg-white"
                            : "border-[#E7EAEE] bg-white/38 text-[#98A2B3]"
                      }`}
                    >
                      <span className="text-[12px] font-extrabold text-[#475467]">{day.dateObj.getDate()}</span>
                      <span className="mt-3 block text-[11px] font-bold text-[#667085]">
                        {daySessions.length ? `${daySessions.length} block${daySessions.length === 1 ? "" : "s"}` : "Open"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={`mt-5 grid gap-3 ${viewMode === "day" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7"}`}>
              {visibleColumns.map((day) => {
                const daySessions = sessions[day.date] ?? [];
                const isSelectedDay = selectedDay === day.date;
                return (
                  <div
                    key={day.date}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedDay(day.date);
                      setSelectedSessionId(daySessions[0]?.id ?? null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setSelectedDay(day.date);
                      setSelectedSessionId(daySessions[0]?.id ?? null);
                    }}
                    className={`group flex min-h-[280px] flex-col rounded-[22px] border p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_10px_24px_rgba(16,24,40,0.055)] transition hover:-translate-y-0.5 hover:bg-white ${
                      isSelectedDay
                        ? "border-[#14D2DC]/45 bg-white ring-2 ring-[#14D2DC]/22"
                        : "border-[#D4DAE4]/85 bg-white/76"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[16px] font-extrabold text-[#17141F]">{day.label.split(" ")[0]}</p>
                        <p className="mt-0.5 text-[12px] font-bold text-[#667085]">
                          {day.dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${
                        daySessions.length ? "bg-[#14D2DC]/12 text-[#0B7C84]" : "bg-[#FF5CA8]/10 text-[#B4236A]"
                      }`}>
                        {daySessions.length ? `${daySessions.length} set` : "Empty"}
                      </span>
                    </div>

                    <div className="mt-3 flex-1 space-y-2">
                      {daySessions.length === 0 ? (
                        <div className="rounded-[18px] border border-[#DDE2EA]/85 bg-white/70 px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                          <p className="text-[14px] font-extrabold text-[#17141F]">No blocks yet</p>
                          <p className="mt-1 text-[12px] font-semibold leading-5 text-[#667085]">Add a workout block</p>
                        </div>
                      ) : null}

                      {daySessions.map((session) => {
                        const scoreLabel = getScoreLabel(session.block);
                        const visibleLines = showDetails ? session.lines : session.lines.slice(0, 2);
                        const isSelected = selectedSessionId === session.id;
                        const isChecked = selectedBlockIds.has(session.id);
                        return (
                          <div
                            key={session.id}
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (selectionActive) {
                                toggleBlockSelection(session.id);
                                return;
                              }
                              setSelectedDay(day.date);
                              setSelectedSessionId(session.id);
                              setEditorOpen(true);
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              if (selectionActive) {
                                toggleBlockSelection(session.id);
                                return;
                              }
                              setSelectedDay(day.date);
                              setSelectedSessionId(session.id);
                              setEditorOpen(true);
                            }}
                            className={`relative rounded-[16px] border px-3 py-3 transition ${
                              isChecked
                                ? "border-[#14D2DC]/55 bg-[#14D2DC]/12 ring-2 ring-[#14D2DC]/20"
                                : isSelected && !selectionActive
                                  ? "border-[#101828]/20 bg-white"
                                  : "border-[#DDE2EA]/85 bg-white/74 hover:border-[#14D2DC]/35"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleBlockSelection(session.id);
                              }}
                              aria-label={isChecked ? "Deselect workout" : "Select workout"}
                              aria-pressed={isChecked}
                              className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border text-[11px] font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14D2DC]/40 ${
                                isChecked
                                  ? "border-[#14D2DC] bg-[#14D2DC] text-[#071A1C]"
                                  : "border-[#D4DAE4] bg-white/82 text-[#98A2B3] opacity-0 group-hover:opacity-100 hover:text-[#17141F]"
                              }`}
                            >
                              ✓
                            </button>
                            <p className="pr-7 text-[14px] font-extrabold leading-tight text-[#17141F]">{session.title}</p>
                            {scoreLabel ? (
                              <span className="mt-2 inline-flex rounded-full bg-[#101828]/8 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#475467]">
                                {scoreLabel}
                              </span>
                            ) : null}
                            {showDetails && visibleLines.length > 0 ? (
                              <div className="mt-2 space-y-1 text-[12px] font-semibold leading-5 text-[#667085]">
                                {visibleLines.slice(0, 4).map((line, idx) => (
                                  <p key={`${session.id}-${idx}`} className="line-clamp-2">{line}</p>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedDay(day.date);
                        setSelectedSessionId(null);
                        setEditorOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedDay(day.date);
                        setSelectedSessionId(null);
                        setEditorOpen(true);
                      }}
                      className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-[#D4DAE4]/85 bg-white/84 text-[12px] font-extrabold text-[#17141F] shadow-[inset_0_1px_0_rgba(255,255,255,0.94)] transition hover:border-[#FF5CA8]/35 hover:text-[#B4236A]"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add block
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="premium-glass-card flex h-full flex-col p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-[18px] font-extrabold text-[#17141F] sm:text-[20px]">
              <Sparkles className="h-5 w-5 text-[#FF5CA8]" aria-hidden="true" />
              Week Summary
            </div>
            <span className="rounded-full border border-[#DDE2EA] bg-white/78 px-3 py-1 text-[11px] font-extrabold text-[#475467]">
              {weekStatusLabel}
            </span>
          </div>

          <div className="mt-4 rounded-[20px] border border-[#DDE2EA]/80 bg-white/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#667085]">Track</p>
            <p className="mt-1 truncate text-[22px] font-extrabold leading-tight text-[#17141F]">{selectedTrackName}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
              {loading ? "Loading this week..." : "Ready to publish"}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Days", value: scheduledDays, color: "#14D2DC" },
              { label: "Empty", value: emptyDays, color: "#FF5CA8" },
              { label: "Blocks", value: totalBlocks, color: "#101828" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[16px] border border-[#D4DAE4]/85 bg-white/78 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.94)]">
                <p className="text-[24px] font-extrabold leading-none" style={{ color: stat.color }}>{stat.value}</p>
                <p className="mt-1 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#667085]">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#101828] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_14px_28px_rgba(16,24,40,0.18)] transition hover:brightness-110"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Publish Week
            </button>
            <button
              type="button"
              onClick={() => setSelectedBlockIds(new Set(Object.values(sessions).flat().map((session) => session.id)))}
              disabled={totalBlocks === 0}
              className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#14D2DC] px-5 py-3 text-[14px] font-extrabold text-[#071A1C] shadow-[0_14px_28px_rgba(20,210,220,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Duplicate Week
            </button>
            <Link
              href="/admin/programming/builder"
              className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-[#D4DAE4]/85 bg-white/84 px-5 py-3 text-[14px] font-extrabold text-[#17141F] shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_8px_18px_rgba(16,24,40,0.06)] transition hover:bg-white"
            >
              <Dumbbell className="h-4 w-4 text-[#FF5CA8]" aria-hidden="true" />
              Open Builder
            </Link>
          </div>
        </aside>
      </section>

      <header className="hidden rounded-2xl border border-white/10 bg-white/5/5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stepDate(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/5 text-slate-300 hover:border-white/25"
              aria-label="Previous"
            >
              {"<"}
            </button>
            <p className="text-xl font-semibold text-slate-200">{headerLabel}</p>
            <button
              type="button"
              onClick={() => stepDate(1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/5 text-slate-300 hover:border-white/25"
              aria-label="Next"
            >
              {">"}
            </button>
            <button
              type="button"
              onClick={() => datePickerRef.current?.showPicker?.() ?? datePickerRef.current?.click()}
              className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/5 text-sm text-slate-300 hover:border-white/25"
              aria-label="Pick date"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
            <input
              ref={datePickerRef}
              type="date"
              value={formatDateKey(currentDate)}
              onChange={(event) => {
                if (!event.target.value) {
                  return;
                }
                const next = parseDateKey(event.target.value);
                setCurrentDate(next);
                setSelectedDay(event.target.value);
              }}
              className="sr-only"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={showDetails}
                onChange={(event) => setShowDetails(event.target.checked)}
                className="h-4 w-4 rounded border-slate-400"
              />
              Show Details
            </label>

            <div className="inline-flex rounded-md border border-white/15 bg-white/5 p-0.5">
              {(["month", "week", "day"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded px-3 py-1 text-sm font-medium transition ${
                    viewMode === mode ? "bg-slate-900 text-white" : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10/80 pt-3">
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-[0.14em] text-slate-500" htmlFor="track-selector">
              Track
            </label>
            <select
              id="track-selector"
              name="track"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-200"
              value={selectedTrackId}
              onChange={(event) => setSelectedTrackId(event.target.value)}
            >
              {tracks.length === 0 ? <option value="">No tracks yet</option> : null}
              {tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-slate-500">{loading ? "Loading programming..." : "Ready"}</span>
        </div>
      </header>

      {selectionActive ? (
        <div className="premium-glass-card flex flex-wrap items-center justify-between gap-3 border-[#14D2DC]/25 bg-[#14D2DC]/10 px-4 py-3 text-sm text-[#17141F]">
          <p className="font-extrabold">
            {selectedBlockIds.size} workout{selectedBlockIds.size === 1 ? "" : "s"} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openTransferDialog("copy")}
              disabled={tracks.length < 2}
              className="rounded-full bg-[#14D2DC] px-3 py-1.5 text-xs font-extrabold text-[#071A1C] shadow-[0_10px_20px_rgba(20,210,220,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Copy to track
            </button>
            <button
              type="button"
              onClick={() => openTransferDialog("move")}
              disabled={tracks.length < 2}
              className="rounded-full bg-[#FF5CA8] px-3 py-1.5 text-xs font-extrabold text-white shadow-[0_10px_20px_rgba(255,92,168,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Move to track
            </button>
            <button
              type="button"
              onClick={() => setSelectedBlockIds(new Set())}
              className="rounded-full border border-[#D4DAE4]/85 bg-white/76 px-3 py-1.5 text-xs font-extrabold text-[#475467] transition hover:bg-white"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      <div className={`relative grid gap-4 transition-[padding] duration-300 ${editorOpen && !selectionActive ? "lg:pr-[26rem]" : ""}`}>
        <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-white/5/5">
          {viewMode === "month" ? (
            <>
              <div className="grid grid-cols-7 border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-500">
                {weekDayNames.map((name) => (
                  <div key={name} className="px-3 py-2 text-center font-semibold">
                    {name}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((day) => {
                  const dayKey = day.key;
                  const daySessions = sessions[dayKey] ?? [];
                  const isSelectedDay = selectedDay === dayKey;
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => {
                        setSelectedDay(dayKey);
                        setCurrentDate(day.dateObj);
                        setSelectedSessionId(daySessions[0]?.id ?? null);
                        setEditorOpen(true);
                      }}
                      className={`min-h-[150px] border-r border-t border-white/10 px-2 py-2 text-left align-top transition ${
                        isSelectedDay ? "bg-blue-500/10" : day.inMonth ? "bg-white/80" : "bg-white/10/60"
                      }`}
                    >
                      <p className="text-xs font-semibold text-slate-400">{day.dateObj.getDate()}</p>
                      <div className="mt-1 space-y-1">
                        {daySessions.slice(0, 2).map((session) => (
                          <button
                            key={session.id}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedDay(dayKey);
                              setCurrentDate(day.dateObj);
                              setSelectedSessionId(session.id);
                              setEditorOpen(true);
                            }}
                            className="w-full rounded-md bg-[#2f3136] px-2 py-1 text-left text-[10px] text-white"
                          >
                            {session.title}
                          </button>
                        ))}
                        {daySessions.length > 2 ? (
                          <p className="text-[10px] text-slate-500">+{daySessions.length - 2} more</p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div
                className="grid border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-500"
                style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(0, 1fr))` }}
              >
                {visibleColumns.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDay(day.date)}
                    className={`px-3 py-3 text-center font-semibold transition ${
                      selectedDay === day.date ? "bg-blue-500/10 text-slate-100" : "hover:bg-white/10"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>

              <div
                className="grid"
                style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(0, 1fr))` }}
              >
                {visibleColumns.map((day) => {
                  const daySessions = sessions[day.date] ?? [];
                  return (
                    <div key={day.date} className="min-h-[540px] border-r border-white/10 px-2.5 pb-4 pt-2.5">
                      <div className="space-y-2">
                        {daySessions.map((session) => {
                          const scoreLabel = getScoreLabel(session.block);
                          const visibleLines = showDetails ? session.lines : session.lines.slice(0, 2);
                          const isSelected = selectedSessionId === session.id;
                          const isChecked = selectedBlockIds.has(session.id);
                          return (
                            <div
                              key={session.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (selectionActive) {
                                  toggleBlockSelection(session.id);
                                  return;
                                }
                                setSelectedDay(day.date);
                                setSelectedSessionId(session.id);
                                setEditorOpen(true);
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                if (selectionActive) {
                                  toggleBlockSelection(session.id);
                                  return;
                                }
                                setSelectedDay(day.date);
                                setSelectedSessionId(session.id);
                                setEditorOpen(true);
                              }}
                              className={`group relative w-full cursor-pointer rounded-xl border px-2.5 py-2 text-left text-white transition ${
                                isChecked
                                  ? "border-cyan-400 bg-[#1c2730] ring-2 ring-cyan-400/60"
                                  : isSelected && !selectionActive
                                    ? "border-slate-800 bg-[#22262f] ring-2 ring-slate-500/50"
                                    : "border-slate-700 bg-[#2f3136] hover:border-slate-500"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleBlockSelection(session.id);
                                }}
                                aria-label={isChecked ? "Deselect workout" : "Select workout"}
                                aria-pressed={isChecked}
                                className={`absolute left-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border text-[12px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                                  isChecked
                                    ? "border-cyan-300 bg-cyan-400 text-slate-900 opacity-100 shadow-[0_0_0_2px_rgba(11,18,32,0.85)]"
                                    : selectionActive
                                      ? "border-white/40 bg-slate-900/70 text-white/50 opacity-100 hover:text-white"
                                      : "border-white/40 bg-slate-900/70 text-white/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-white"
                                }`}
                              >
                                ✓
                              </button>
                              <p className="pl-8 text-[20px] font-semibold leading-none">
                                {session.title}
                              </p>
                              {scoreLabel ? (
                                <span className="ml-8 mt-1 inline-flex rounded-full border border-white/10/40 bg-white/10/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-100">
                                  {scoreLabel}
                                </span>
                              ) : null}
                              {showDetails ? (
                                <div className="mt-2 space-y-0.5 text-[12px] text-slate-100/95">
                                  {visibleLines.map((line, idx) => (
                                    <p key={`${session.id}-${idx}`}>{line}</p>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}

                        {daySessions.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDay(day.date);
                              setSelectedSessionId(null);
                              setEditorOpen(true);
                            }}
                            className="w-full rounded-xl border border-dashed border-slate-400 bg-white/60 px-3 py-5 text-center text-xs text-slate-500 transition hover:border-slate-500 hover:bg-white"
                          >
                            No blocks yet
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setEditorOpen((prev) => !prev)}
          className="fixed bottom-6 right-6 z-40 rounded-full bg-[#101828] px-4 py-2 text-xs font-extrabold text-white shadow-[0_16px_34px_rgba(16,24,40,0.22)] transition hover:brightness-110 lg:hidden"
        >
          {editorOpen ? "Close Editor" : "Open Editor"}
        </button>

        <div
          aria-hidden={!editorOpen}
          onClick={() => setEditorOpen(false)}
          className={`fixed inset-0 z-30 bg-slate-950/40 transition-opacity duration-300 lg:hidden ${
            editorOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />

        <aside
          className={`fixed bottom-0 right-0 top-0 z-40 w-full sm:w-[70vw] lg:w-[48vw] xl:w-[40vw] max-w-[860px] border-l border-white/10 bg-[#12151c] p-5 shadow-2xl transition-transform duration-300 ${
            editorOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Selected Day</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-100">{dayLabel}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-white/25 hover:bg-white/5"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "warmup", label: "Add Warmup" },
                  { key: "lift", label: "Add Lift" },
                  { key: "workout", label: "Add Workout" },
                  { key: "cooldown", label: "Add Cooldown" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      createBlock(item.key as "warmup" | "lift" | "workout" | "cooldown")
                    }
                    disabled={Boolean(creatingType)}
                    className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingType === item.key ? "Creating..." : item.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Entries</p>
                {selectedDaySessions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-3 py-4 text-sm text-slate-500">
                    No entries yet for this day.
                  </div>
                ) : (
                  selectedDaySessions.map((session) => {
                    const isActive = selectedSessionId === session.id;
                    const scoreLabel = getScoreLabel(session.block) ?? "None";
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => setSelectedSessionId(session.id)}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                          isActive
                            ? "border-cyan-400 bg-cyan-500/10"
                            : "border-white/15 bg-white/5 hover:border-cyan-300"
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-100">{session.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{scoreLabel}</p>
                      </button>
                    );
                  })
                )}
              </div>

              {selected ? (
                <>
                  {/* ── Tabs ── */}
                  <div className="flex gap-0.5 rounded-xl border border-white/10 bg-white/5 p-0.5">
                    {(["details", "progression"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                          activeTab === tab
                            ? "bg-slate-800 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>

                  {activeTab === "details" ? (
                    <>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500" htmlFor="session-title">
                        Session Title
                      </label>
                      <input
                        id="session-title"
                        value={editor.session.title}
                        onChange={(event) => updateEditor("title", event.target.value)}
                        className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                      />

                      {selected.session.blockType !== "warmup" && (
                        <>
                          <label className="text-xs uppercase tracking-[0.2em] text-slate-500" htmlFor="session-block">
                            Score Type
                          </label>
                          <select
                            id="session-block"
                            value={editor.session.block ?? "none"}
                            onChange={(event) => updateEditor("block", event.target.value)}
                            className="w-full rounded-2xl border border-white/15 bg-[#1a1d26] px-4 py-3 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                          >
                            <option value="none">None</option>
                            <option value="calories">Calories</option>
                            <option value="distance">Distance</option>
                            <option value="time">For Time</option>
                            <option value="reps">Reps</option>
                            <option value="rounds_reps">Rounds &amp; Reps</option>
                          </select>
                        </>
                      )}

                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Details
                      </label>
                      <TipTapEditor
                        content={editor.session.htmlContent}
                        onChange={(html) => updateEditor("htmlContent", html)}
                        placeholder="Add workout details..."
                      />

                      <div className="flex items-center justify-end gap-2 pb-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={saveSelectedSession}
                          className="rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(2,132,199,0.35)] transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <TrackProgressionPanel
                      blockId={selected.session.id}
                      blockType={selected.session.blockType}
                      trackId={selectedTrackId}
                      selectedDay={selected.day}
                      onApplied={() => setCurrentDate((prev) => new Date(prev))}
                    />
                  )}
                </>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      {transferOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !transferring) {
              setTransferOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12151c] p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-100">
              {transferMode === "copy" ? "Copy" : "Move"} {selectedBlockIds.size} workout
              {selectedBlockIds.size === 1 ? "" : "s"}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {transferMode === "copy"
                ? "Copies of these workouts will be added to the target track on the same dates."
                : "These workouts will be removed from the current track and placed on the target track on the same dates."}
            </p>

            <label
              className="mt-4 block text-xs uppercase tracking-[0.2em] text-slate-500"
              htmlFor="transfer-target-track"
            >
              Target track
            </label>
            <select
              id="transfer-target-track"
              value={transferTargetTrackId}
              onChange={(event) => setTransferTargetTrackId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              {tracks
                .filter((track) => track.id !== selectedTrackId)
                .map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                  </option>
                ))}
              {tracks.filter((track) => track.id !== selectedTrackId).length === 0 ? (
                <option value="">No other tracks available</option>
              ) : null}
            </select>

            {transferError ? (
              <p className="mt-3 text-xs text-pink-300">{transferError}</p>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTransferOpen(false)}
                disabled={transferring}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitTransfer}
                disabled={transferring || !transferTargetTrackId}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  transferMode === "copy"
                    ? "bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500"
                    : "bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500"
                }`}
              >
                {transferring
                  ? transferMode === "copy"
                    ? "Copying..."
                    : "Moving..."
                  : transferMode === "copy"
                    ? "Copy"
                    : "Move"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
    </>
  );
}
