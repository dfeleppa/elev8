"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, User, Layers } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleClass = {
  id: string;
  name: string;
  class_time: string;         // "HH:MM:SS" or "HH:MM"
  duration_minutes: number;
  class_days: string[];       // ["Mo","Tu","We","Th","Fr","Sa","Su"]
  start_date: string;         // YYYY-MM-DD
  end_date: string | null;
  size_limit: number;
  reservation_cutoff_hours: number;
  calendar_color: string;
  track: { id: string; name: string } | null;
  default_coach: { id: string; full_name: string | null; email: string | null } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

// Maps JS getDay() → day abbreviation used in class_days
const JS_DAY_TO_ABBR: Record<number, string> = {
  0: "Su",
  1: "Mo",
  2: "Tu",
  3: "We",
  4: "Th",
  5: "Fr",
  6: "Sa",
};

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the Monday of the week containing `date` (local time, no TZ shift). */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns YYYY-MM-DD string in local time. */
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses a YYYY-MM-DD string into a local-time Date (no TZ offset). */
function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Formats a "HH:MM" or "HH:MM:SS" time string to "h:mm AM/PM". */
function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

/** Format duration as "45 min" or "1h 30 min". */
function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m} min` : `${h}h`;
}

/** Returns a short month/day label: "Apr 7". */
function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Check whether a schedule class runs on a given date. */
function classOccursOnDate(cls: ScheduleClass, date: Date): boolean {
  const abbr = JS_DAY_TO_ABBR[date.getDay()];
  if (!cls.class_days.includes(abbr)) return false;
  const start = parseLocalDate(cls.start_date);
  if (date < start) return false;
  if (cls.end_date) {
    const end = parseLocalDate(cls.end_date);
    if (date > end) return false;
  }
  return true;
}

/** Lighten a hex color for the track badge background. */
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

// ─── Class Card ───────────────────────────────────────────────────────────────

function ClassCard({ cls }: { cls: ScheduleClass }) {
  const rgb = hexToRgb(cls.calendar_color);
  const coachLabel = cls.default_coach?.full_name ?? cls.default_coach?.email ?? null;

  return (
    <div
      className="rounded-lg border border-white/8 bg-white/5 p-3 transition hover:bg-white/8"
      style={{ borderLeftColor: cls.calendar_color, borderLeftWidth: 3 }}
    >
      {/* Class name */}
      <p className="text-sm font-semibold text-white leading-snug">{cls.name}</p>

      {/* Time + duration */}
      <div className="mt-1.5 flex items-center gap-2 text-white/50">
        <Clock size={11} />
        <span className="text-xs">{formatTime(cls.class_time)}</span>
        <span className="text-white/20">·</span>
        <span className="text-xs">{formatDuration(cls.duration_minutes)}</span>
      </div>

      {/* Track badge */}
      {cls.track && (
        <div className="mt-2">
          <span
            className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              background: `rgba(${rgb}, 0.18)`,
              color: cls.calendar_color,
            }}
          >
            {cls.track.name}
          </span>
        </div>
      )}

      {/* Coach */}
      {coachLabel && (
        <div className="mt-1.5 flex items-center gap-1.5 text-white/35">
          <User size={11} />
          <span className="text-xs">{coachLabel}</span>
        </div>
      )}

      {/* Capacity badge */}
      {cls.size_limit > 0 && (
        <div className="mt-1.5">
          <span className="text-[10px] text-white/30">{cls.size_limit} spots</span>
        </div>
      )}
    </div>
  );
}

// ─── Day Column ───────────────────────────────────────────────────────────────

function DayColumn({
  label,
  date,
  isToday,
  classes,
}: {
  label: string;
  date: Date;
  isToday: boolean;
  classes: ScheduleClass[];
}) {
  return (
    <div className="flex flex-col min-w-0">
      {/* Header */}
      <div className={`mb-3 text-center ${isToday ? "text-white" : "text-white/40"}`}>
        <p className={`text-xs font-semibold uppercase tracking-widest ${isToday ? "text-white/70" : ""}`}>
          {label}
        </p>
        <p
          className={`mt-1 text-xl font-light tabular-nums ${
            isToday
              ? "flex h-8 w-8 mx-auto items-center justify-center rounded-full bg-pink-500 text-white text-base font-semibold"
              : ""
          }`}
        >
          {date.getDate()}
        </p>
      </div>

      {/* Classes */}
      <div className="flex flex-col gap-2">
        {classes.length === 0 ? (
          <p className="text-center text-[11px] text-white/15 pt-2">—</p>
        ) : (
          classes.map((cls) => <ClassCard key={cls.id} cls={cls} />)
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MemberScheduleClient({ organizationId }: { organizationId: string }) {
  const [classes, setClasses] = useState<ScheduleClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));

  // Load schedule classes once
  useEffect(() => {
    setLoading(true);
    fetch(`/api/athlete/schedule?organizationId=${organizationId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setClasses(data.classes ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [organizationId]);

  // Build the 7 dates for the current week (Mon–Sun)
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  // Classes keyed by local date string
  const classesByDate = useMemo(() => {
    const map: Record<string, ScheduleClass[]> = {};
    for (const d of weekDates) {
      const key = toLocalDateString(d);
      map[key] = classes
        .filter((cls) => classOccursOnDate(cls, d))
        .sort((a, b) => a.class_time.localeCompare(b.class_time));
    }
    return map;
  }, [weekDates, classes]);

  const todayStr = toLocalDateString(new Date());

  const weekLabel = useMemo(() => {
    const last = weekDates[6];
    const firstM = weekDates[0].toLocaleDateString("en-US", { month: "short" });
    const lastM = last.toLocaleDateString("en-US", { month: "short" });
    const year = last.getFullYear();
    if (firstM === lastM) {
      return `${firstM} ${weekDates[0].getDate()} – ${last.getDate()}, ${year}`;
    }
    return `${firstM} ${weekDates[0].getDate()} – ${lastM} ${last.getDate()}, ${year}`;
  }, [weekDates]);

  function goToPrevWeek() {
    setWeekStart((w) => {
      const d = new Date(w);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }

  function goToNextWeek() {
    setWeekStart((w) => {
      const d = new Date(w);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }

  function goToToday() {
    setWeekStart(getMonday(new Date()));
  }

  const isCurrentWeek = toLocalDateString(weekStart) === toLocalDateString(getMonday(new Date()));

  // Total classes this week
  const totalThisWeek = useMemo(
    () => weekDates.reduce((sum, d) => sum + (classesByDate[toLocalDateString(d)]?.length ?? 0), 0),
    [weekDates, classesByDate]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Class Schedule</h1>
          <p className="mt-0.5 text-sm text-white/40">
            {loading ? "Loading…" : `${classes.length} recurring class${classes.length !== 1 ? "es" : ""} · ${totalThisWeek} session${totalThisWeek !== 1 ? "s" : ""} this week`}
          </p>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2">
          {!isCurrentWeek && (
            <button
              onClick={goToToday}
              className="rounded px-3 py-1.5 text-xs font-medium text-white/50 border border-white/12 hover:border-white/30 hover:text-white transition"
            >
              Today
            </button>
          )}
          <button
            onClick={goToPrevWeek}
            className="flex h-8 w-8 items-center justify-center rounded border border-white/12 text-white/50 transition hover:border-white/30 hover:text-white"
            aria-label="Previous week"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-[200px] text-center text-sm font-medium text-white/70">
            {weekLabel}
          </span>
          <button
            onClick={goToNextWeek}
            className="flex h-8 w-8 items-center justify-center rounded border border-white/12 text-white/50 transition hover:border-white/30 hover:text-white"
            aria-label="Next week"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-white/30 text-sm">
          Loading schedule…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-400">
          {error}
        </div>
      ) : classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <Layers size={32} className="text-white/20" />
          <p className="text-sm text-white/40">No classes have been scheduled yet.</p>
          <p className="text-xs text-white/25">Check back soon or contact your coach.</p>
        </div>
      ) : (
        <>
          {/* Desktop: 7-column week grid */}
          <div className="hidden md:grid grid-cols-7 gap-3">
            {weekDates.map((date, i) => {
              const key = toLocalDateString(date);
              return (
                <DayColumn
                  key={key}
                  label={WEEK_LABELS[i]}
                  date={date}
                  isToday={key === todayStr}
                  classes={classesByDate[key] ?? []}
                />
              );
            })}
          </div>

          {/* Mobile: vertical list of days that have classes */}
          <div className="flex flex-col gap-6 md:hidden">
            {weekDates.map((date, i) => {
              const key = toLocalDateString(date);
              const dayCls = classesByDate[key] ?? [];
              const isToday = key === todayStr;
              return (
                <div key={key}>
                  {/* Day header */}
                  <div className="mb-2 flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                        isToday ? "bg-pink-500 text-white" : "bg-white/8 text-white/50"
                      }`}
                    >
                      {date.getDate()}
                    </div>
                    <span className={`text-xs font-semibold uppercase tracking-widest ${isToday ? "text-white" : "text-white/40"}`}>
                      {WEEK_LABELS[i]}, {formatShortDate(date)}
                    </span>
                  </div>

                  {dayCls.length === 0 ? (
                    <p className="ml-11 text-xs text-white/20">No classes</p>
                  ) : (
                    <div className="ml-11 flex flex-col gap-2">
                      {dayCls.map((cls) => (
                        <ClassCard key={cls.id} cls={cls} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
