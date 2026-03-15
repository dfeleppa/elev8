"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SessionEntry = {
  id: string;
  title: string;
  block?: string;
  lines: string[];
};

type TrackOption = {
  id: string;
  organization_id: string;
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

function getScoreLabel(value?: string) {
  const text = (value ?? "none").trim();
  if (!text || text === "none") {
    return null;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
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

function mapWeekResponse(days: WeekDayResponse[]) {
  const mapped: Record<string, SessionEntry[]> = {};
  for (const day of days) {
    mapped[day.day_date] = day.blocks.map((block) => ({
      id: block.id,
      title: block.title,
      block: block.score_type,
      lines: (block.description ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    }));
  }
  return mapped;
}

export default function ProgrammingClient() {
  const datePickerRef = useRef<HTMLInputElement | null>(null);

  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 2, 14));
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [showDetails, setShowDetails] = useState(true);

  const [selectedDay, setSelectedDay] = useState(() => formatDateKey(new Date(2026, 2, 14)));
  const [sessions, setSessions] = useState<Record<string, SessionEntry[]>>(fallbackSessions);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  // Close the editor with Escape for faster keyboard workflow and better UX
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditorOpen(false);
      }
    };
    if (editorOpen) {
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }
    return () => {};
  }, [editorOpen]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackOption[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingType, setCreatingType] = useState<string | null>(null);

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

  const editor = selected ?? {
    day: selectedDay,
    session: {
      id: "empty",
      title: "",
      block: "none",
      lines: [],
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

  useEffect(() => {
    let isMounted = true;

    const loadBootstrap = async () => {
      try {
        const meResponse = await fetch("/api/me", { cache: "no-store" });
        const mePayload = await meResponse.json();
        const orgId = mePayload?.organizationIds?.[0] as string | undefined;
        if (!meResponse.ok || !orgId) {
          return;
        }

        if (isMounted) {
          setOrganizationId(orgId);
        }

        const trackResponse = await fetch(`/api/programming/tracks?organizationId=${orgId}`, {
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
      if (!organizationId || !selectedTrackId) {
        return;
      }

      setLoading(true);
      try {
        const startDate = formatDateKey(startOfWeek(currentDate));
        const response = await fetch(
          `/api/programming/week?organizationId=${organizationId}&trackId=${selectedTrackId}&startDate=${startDate}`,
          { cache: "no-store" }
        );
        const payload = await response.json();
        if (!response.ok) {
          return;
        }

        const nextSessions = mapWeekResponse(payload?.days ?? []);
        if (!isMounted || Object.keys(nextSessions).length === 0) {
          return;
        }

        setSessions(nextSessions);

        const preferredDay = formatDateKey(currentDate);
        const firstDay = nextSessions[preferredDay] ? preferredDay : Object.keys(nextSessions)[0];
        setSelectedDay(firstDay);
        setSelectedSessionId(nextSessions[firstDay]?.[0]?.id ?? null);
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
  }, [organizationId, selectedTrackId, currentDate]);

  useEffect(() => {
    if (!selectedDay) {
      return;
    }

    const daySessions = sessions[selectedDay] ?? [];
    if (!selectedSessionId && daySessions[0]) {
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

  const updateEditor = (field: "title" | "block" | "lines", value: string) => {
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
      if (field === "lines") {
        updated.lines = value
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
      } else {
        updated[field] = value;
      }

      daySessions[index] = updated;
      updatedSessions[current.day] = daySessions;
      return updatedSessions;
    });
  };

  const createBlock = async (blockType: "warmup" | "lift" | "workout" | "cooldown") => {
    if (!organizationId || !selectedTrackId) {
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
          organizationId,
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
        lines: [],
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
    if (!organizationId || !selectedTrackId) {
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
          description: current.session.lines.join("\n"),
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-300 bg-[#f7f6f2] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stepDate(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              aria-label="Previous"
            >
              {"<"}
            </button>
            <p className="text-xl font-semibold text-slate-800">{headerLabel}</p>
            <button
              type="button"
              onClick={() => stepDate(1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              aria-label="Next"
            >
              {">"}
            </button>
            <button
              type="button"
              onClick={() => datePickerRef.current?.showPicker?.() ?? datePickerRef.current?.click()}
              className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:border-slate-400"
              aria-label="Pick date"
            >
              📅
            </button>

            {/* Quick-jump to Today improves navigation and reduces friction when scheduling */}
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                setCurrentDate(today);
                setSelectedDay(formatDateKey(today));
                setEditorOpen(false);
              }}
              title="Go to today"
              className="ml-2 inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:border-slate-400"
            >
              Today
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
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showDetails}
                onChange={(event) => setShowDetails(event.target.checked)}
                className="h-4 w-4 rounded border-slate-400"
              />
              Show Details
            </label>

            <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
              {(["month", "week", "day"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded px-3 py-1 text-sm font-medium transition ${
                    viewMode === mode ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-300/80 pt-3">
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-[0.14em] text-slate-500" htmlFor="track-selector">
              Track
            </label>
            <select
              id="track-selector"
              name="track"
              aria-label="Select track"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800"
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

            {/* When no tracks exist, show a subtle action to create one to reduce friction for admins */}
            {tracks.length === 0 ? (
              <a
                href="/organization/admin/tracks"
                className="ml-2 text-xs font-semibold text-sky-600 hover:underline"
              >
                Create track
              </a>
            ) : null}
          </div>
          <span className="text-xs text-slate-500">{loading ? "Loading programming..." : tracks.length === 0 ? "No tracks" : "Ready"}</span>
        </div>
      </header>

      <div className={`relative grid gap-4 transition-[padding] duration-300 ${editorOpen ? "lg:pr-[26rem]" : ""}`}>
        <div className="overflow-hidden rounded-2xl border border-slate-300 bg-[#f8f7f4]">
          {viewMode === "month" ? (
            <>
              <div className="grid grid-cols-7 border-b border-slate-300 text-xs uppercase tracking-[0.14em] text-slate-500">
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
                        // If the day already has sessions, open the editor for faster access.
                        // Otherwise keep the editor closed so admins can add blocks intentionally.
                        if ((sessions[dayKey] ?? []).length > 0) {
                          setEditorOpen(true);
                        }
                      }}
                      className={`min-h-[150px] border-r border-t border-slate-300 px-2 py-2 text-left align-top transition ${
                        isSelectedDay ? "bg-blue-50" : day.inMonth ? "bg-white/80" : "bg-slate-100/60"
                      }`}
                    >
                      <p className="text-xs font-semibold text-slate-600">{day.dateObj.getDate()}</p>
                      <div className="mt-1 space-y-1">
                        {daySessions.slice(0, 2).map((session) => (
                          <div key={session.id} className="rounded-md bg-[#2f3136] px-2 py-1 text-[10px] text-white">
                            {session.title}
                          </div>
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
                className="grid border-b border-slate-300 text-xs uppercase tracking-[0.14em] text-slate-500"
                style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(0, 1fr))` }}
              >
                {visibleColumns.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDay(day.date)}
                    className={`px-3 py-3 text-center font-semibold transition ${
                      selectedDay === day.date ? "bg-blue-50 text-slate-900" : "hover:bg-slate-100"
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
                    <div key={day.date} className="min-h-[540px] border-r border-slate-300 px-2.5 pb-4 pt-2.5">
                      <div className="space-y-2">
                        {daySessions.map((session) => {
                          const scoreLabel = getScoreLabel(session.block);
                          const visibleLines = showDetails ? session.lines : session.lines.slice(0, 2);
                          const isSelected = selectedSessionId === session.id;
                          return (
                            <button
                              key={session.id}
                              type="button"
                              onClick={() => {
                                setSelectedDay(day.date);
                                setSelectedSessionId(session.id);
                                setEditorOpen(true);
                              }}
                              className={`w-full rounded-xl border px-2.5 py-2 text-left text-white transition ${
                                isSelected
                                  ? "border-slate-800 bg-[#22262f] ring-2 ring-slate-500/50"
                                  : "border-slate-700 bg-[#2f3136] hover:border-slate-500"
                              }`}
                            >
                              <p className="text-[20px] font-semibold leading-none">{session.title}</p>
                              {scoreLabel ? (
                                <span className="mt-1 inline-flex rounded-full border border-slate-300/40 bg-slate-100/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-100">
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
                            </button>
                          );
                        })}

                        {daySessions.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-400 bg-white/60 px-3 py-5 text-center text-xs text-slate-500">
                            No blocks yet
                          </div>
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
          className="fixed bottom-6 right-6 z-40 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-lg transition hover:border-slate-500 lg:hidden"
        >
          {editorOpen ? "Close Editor" : "Open Editor"}
        </button>

        <div
          aria-hidden={!editorOpen}
          onClick={() => setEditorOpen(false)}
          className={`fixed inset-0 z-30 bg-slate-950/35 transition-opacity duration-300 lg:hidden ${
            editorOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />

        <aside
          className={`fixed bottom-0 right-0 top-0 z-40 w-full max-w-[420px] border-l border-white/10 bg-slate-950/95 p-5 shadow-2xl backdrop-blur transition-transform duration-300 ${
            editorOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Selected Day</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-100">{dayLabel}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                  {selected?.session.title || "No session"}
                </span>
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-white/30"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2">
                {/* If no track is selected, discourage creating blocks and make buttons disabled to avoid confusing errors. */}
                {!selectedTrackId ? (
                  <p className="col-span-2 rounded-xl border border-dashed border-slate-500/30 bg-slate-800/60 px-3 py-3 text-center text-sm text-slate-300">
                    Select a track first to add blocks
                  </p>
                ) : null}

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
                    disabled={Boolean(creatingType) || !selectedTrackId}
                    title={!selectedTrackId ? "Select a track to enable" : undefined}
                    className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingType === item.key ? "Creating..." : item.label}
                  </button>
                ))}
              </div>

              <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="session-title">
                Session Title
              </label>
              <input
                id="session-title"
                value={editor.session.title}
                onChange={(event) => updateEditor("title", event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
              />

              <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="session-block">
                Score Type
              </label>
              <select
                id="session-block"
                value={editor.session.block ?? "none"}
                onChange={(event) => updateEditor("block", event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
              >
                <option value="none">None</option>
                <option value="time">Time</option>
                <option value="reps">Reps</option>
                <option value="weight">Weight</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">Pick the scoring method for this block (affects leaderboard display).</p>

              <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="session-lines">
                Details
              </label>
              <textarea
                id="session-lines"
                rows={8}
                value={editor.session.lines.join("\n")}
                onChange={(event) => updateEditor("lines", event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
              />

              <div className="flex items-center justify-end gap-2 pb-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveSelectedSession}
                  className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
