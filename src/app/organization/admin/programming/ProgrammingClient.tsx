"use client";

import { useEffect, useMemo, useState } from "react";

type SessionEntry = {
  id: string;
  title: string;
  block?: string;
  lines: string[];
};

type DayEntry = {
  label: string;
  date: string;
};

type TrackOption = {
  id: string;
  organization_id: string;
  name: string;
};

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

const weekDays: DayEntry[] = [
  { label: "Mon 3/9", date: "2026-03-09" },
  { label: "Tue 3/10", date: "2026-03-10" },
  { label: "Wed 3/11", date: "2026-03-11" },
  { label: "Thu 3/12", date: "2026-03-12" },
  { label: "Fri 3/13", date: "2026-03-13" },
  { label: "Sat 3/14", date: "2026-03-14" },
  { label: "Sun 3/15", date: "2026-03-15" },
];

const fallbackSessions: Record<string, SessionEntry[]> = {
  "2026-03-09": [
    {
      id: "mon-warmup",
      title: "Warm Up",
      block: "time",
      lines: [":30 Bike (increase pace)", "10/side banded side step", "5/5 Step Up + Depth Drop", "6 HR Pushups"],
    },
  ],
  "2026-03-11": [
    {
      id: "wed-deadlift",
      title: "Deadlift",
      block: "lift",
      lines: ["EMOM 10:00", "Deadlift x 1 @ 70-85%", "*SPEED FOCUS", "*Building"],
    },
  ],
};

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
      lines: (block.description ?? "").split("\n").map((line) => line.trim()).filter(Boolean),
    }));
  }
  return mapped;
}

export default function ProgrammingClient() {
  const [selectedDay, setSelectedDay] = useState("2026-03-11");
  const [sessions, setSessions] = useState<Record<string, SessionEntry[]>>(fallbackSessions);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>("wed-deadlift");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackOption[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingType, setCreatingType] = useState<string | null>(null);

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
        // Keep fallback local state when bootstrap fails.
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
        const response = await fetch(
          `/api/programming/week?organizationId=${organizationId}&trackId=${selectedTrackId}&startDate=2026-03-09`,
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
        const firstDay = Object.keys(nextSessions)[0];
        const firstSession = nextSessions[firstDay]?.[0];
        if (firstSession) {
          setSelectedDay(firstDay);
          setSelectedSessionId(firstSession.id);
        }
      } catch {
        // Keep existing state when fetch fails.
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
  }, [organizationId, selectedTrackId]);

  const dayLabel = weekDays.find((day) => day.date === selectedDay)?.label ?? "";

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
        updated.lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
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
    } finally {
      setCreatingType(null);
    }
  };

  const saveSelectedSession = async () => {
    if (!organizationId || !selectedTrackId) {
      return;
    }

    const current = getSessionById(sessions, selectedSessionId);
    if (
      !current ||
      !current.session.id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        current.session.id
      )
    ) {
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
    <section className="space-y-8">
      <header className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-100">Programming</h1>
          <p className="mt-3 text-sm text-slate-400">Plan training cycles, templates, and program releases.</p>
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:max-w-xs">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="track-selector">
              Track
            </label>
            <div className="relative">
              <select
                id="track-selector"
                name="track"
                className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 shadow-inner focus:border-white/30 focus:outline-none"
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
          </div>

          <div className="flex flex-1 items-center justify-end text-xs text-slate-400">
            {loading ? "Loading week..." : "Mar 9 - 15, 2026"}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2.2fr_1fr]">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/5">
          <div className="grid min-w-[980px] grid-cols-7 border-b border-white/10 text-xs uppercase tracking-[0.2em] text-slate-400">
            {weekDays.map((day) => (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDay(day.date)}
                className={`px-4 py-3 text-center transition ${
                  selectedDay === day.date ? "bg-white/10 text-slate-100" : "hover:text-white"
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
          <div className="grid min-w-[980px] grid-cols-7">
            {weekDays.map((day, index) => {
              const daySessions = sessions[day.date] ?? [];
              const highlightColumn = index === 2;
              return (
                <div
                  key={day.date}
                  className={`min-h-[520px] border-r border-white/10 px-3 pb-6 pt-4 ${
                    highlightColumn ? "bg-sky-400/15" : "bg-transparent"
                  }`}
                >
                  <div className="space-y-3">
                    {daySessions.map((session) => {
                      const isSelected = selectedSessionId === session.id;
                      return (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => {
                            setSelectedDay(day.date);
                            setSelectedSessionId(session.id);
                          }}
                          className={`w-full rounded-2xl border p-4 text-left text-xs text-white shadow-[0_0_0_1px_rgba(56,189,248,0.15)] transition ${
                            isSelected
                              ? "border-sky-200/70 bg-indigo-500/95 ring-2 ring-sky-300/40"
                              : "border-sky-300/30 bg-indigo-600/90 hover:border-sky-200/70"
                          }`}
                        >
                          <p className="text-sm font-semibold">{session.title}</p>
                          {session.block && (
                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-100/80">
                              {session.block}
                            </p>
                          )}
                          <div className="mt-2 space-y-1 text-[12px] text-white/90">
                            {session.lines.map((line, lineIndex) => (
                              <p key={`${session.id}-${lineIndex}`}>{line}</p>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                    {daySessions.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-xs text-slate-500">
                        No sessions yet
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Selected Day</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-100">{dayLabel}</h2>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                {selected?.session.title || "No session"}
              </span>
            </div>
            <div className="mt-4 space-y-3">
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
                className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
              />

              <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="session-block">
                Score Type
              </label>
              <input
                id="session-block"
                value={editor.session.block ?? "none"}
                onChange={(event) => updateEditor("block", event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
              />

              <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="session-lines">
                Details
              </label>
              <textarea
                id="session-lines"
                rows={8}
                value={editor.session.lines.join("\n")}
                onChange={(event) => updateEditor("lines", event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
              />

              <div className="flex items-center justify-end gap-2">
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
