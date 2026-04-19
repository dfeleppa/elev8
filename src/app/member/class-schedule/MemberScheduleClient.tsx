"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, LoaderCircle, User, Users, XCircle } from "lucide-react";

type ReservedMember = {
  id: string;
  name: string;
  reservedAt: string | null;
};

type ScheduleSession = {
  id: string;
  name: string;
  class_time: string;
  duration_minutes: number;
  class_days: string[];
  start_date: string;
  end_date: string | null;
  size_limit: number;
  reservation_cutoff_hours: number;
  calendar_color: string;
  classDate: string;
  reservedCount: number;
  capacityRemaining: number | null;
  isReservedByCurrentUser: boolean;
  isReservationClosed: boolean;
  reservationCutoffAt: string | null;
  reservedMembers: ReservedMember[];
  track: { id: string; name: string } | null;
  default_coach: { id: string; full_name: string | null; email: string | null } | null;
};

type ScheduleResponse = {
  date: string;
  sessions: ScheduleSession[];
  error?: string;
};

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function addDays(dateKey: string, amount: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return toLocalDateString(date);
}

function formatTime(value: string) {
  const [hours = "00", minutes = "00"] = value.split(":");
  const hourNumber = Number(hours);
  const suffix = hourNumber >= 12 ? "PM" : "AM";
  const hour12 = hourNumber % 12 === 0 ? 12 : hourNumber % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes} min` : `${hours}h`;
}

function formatRailDay(dateKey: string) {
  const date = parseDateKey(dateKey);
  return {
    weekday: DAY_NAMES_SHORT[date.getDay()],
    monthDay: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function formatLongDate(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatCutoff(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getSessionStatusCopy(session: ScheduleSession) {
  if (session.isReservedByCurrentUser) {
    return {
      title: "Reserved",
      body: "Your spot is locked in for this class.",
      tone: "text-emerald-300",
    };
  }

  if (session.isReservationClosed) {
    return {
      title: "Reservation closed",
      body: session.reservationCutoffAt
        ? `Reservations closed at ${formatCutoff(session.reservationCutoffAt)}.`
        : "Reservations are closed for this class.",
      tone: "text-amber-200",
    };
  }

  if (session.size_limit > 0 && session.capacityRemaining === 0) {
    return {
      title: "Class full",
      body: "This class has reached capacity.",
      tone: "text-rose-300",
    };
  }

  return {
    title: "Open for reservations",
    body: session.size_limit > 0
      ? `${session.capacityRemaining} spot${session.capacityRemaining === 1 ? "" : "s"} remaining.`
      : "Unlimited spots available.",
    tone: "text-cyan-200",
  };
}

function canReserve(session: ScheduleSession) {
  if (session.isReservedByCurrentUser) {
    return false;
  }

  if (session.isReservationClosed) {
    return false;
  }

  if (session.size_limit > 0 && session.capacityRemaining === 0) {
    return false;
  }

  return true;
}

export default function MemberScheduleClient() {
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateString(new Date()));
  const [sessions, setSessions] = useState<ScheduleSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [rosterSession, setRosterSession] = useState<ScheduleSession | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const todayKey = toLocalDateString(new Date());

  const dayRail = useMemo(
    () => Array.from({ length: 15 }, (_, index) => addDays(selectedDate, index - 7)),
    [selectedDate]
  );

  useEffect(() => {
    let ignore = false;

    async function loadSchedule() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/athlete/schedule?date=${selectedDate}`);
        const payload = (await response.json()) as ScheduleResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load schedule.");
        }

        if (!ignore) {
          setSessions(payload.sessions ?? []);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load schedule.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadSchedule();

    return () => {
      ignore = true;
    };
  }, [selectedDate]);

  useEffect(() => {
    if (!rosterSession) {
      return;
    }

    const updatedSession = sessions.find((session) => session.id === rosterSession.id);
    setRosterSession(updatedSession ?? null);
  }, [rosterSession, sessions]);

  async function mutateReservation(session: ScheduleSession, method: "POST" | "DELETE") {
    setPendingSessionId(session.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/athlete/schedule/reservations", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          classId: session.id,
          date: selectedDate,
        }),
      });

      const payload = (await response.json()) as { error?: string; session?: ScheduleSession };
      if (!response.ok || !payload.session) {
        throw new Error(payload.error ?? "Failed to update reservation.");
      }

      setSessions((current) =>
        current.map((entry) => (entry.id === payload.session?.id ? payload.session : entry))
      );
      setMessage(method === "POST" ? "Spot reserved." : "Reservation canceled.");
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to update reservation.");
    } finally {
      setPendingSessionId(null);
    }
  }

  const sessionsLabel = `${sessions.length} class${sessions.length === 1 ? "" : "es"} scheduled`;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--text)]">Class Schedule</h1>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              {loading ? "Loading daily schedule..." : `${formatLongDate(selectedDate)} · ${sessionsLabel}`}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-2 py-2 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
            <button
              type="button"
              onClick={() => setSelectedDate(todayKey)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                selectedDate === todayKey
                  ? "bg-[var(--pink)]/20 text-[var(--pink)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-[var(--text-muted)] transition hover:border-cyan-300/40 hover:text-cyan-100"
              aria-label="Choose a date"
            >
              <CalendarDays size={18} />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-2">
            {dayRail.map((dateKey) => {
              const isSelected = dateKey === selectedDate;
              const isToday = dateKey === todayKey;
              const label = formatRailDay(dateKey);

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedDate(dateKey)}
                  className={`group flex min-w-[88px] flex-col items-center rounded-2xl border px-3 py-3 text-center transition ${
                    isSelected
                      ? "border-[var(--pink)]/40 bg-[var(--pink)]/10 text-[var(--text)] shadow-[0_10px_28px_rgba(255,74,141,0.12)]"
                      : isToday
                        ? "border-[var(--cyan)]/30 bg-[var(--cyan)]/8 text-[var(--text)]"
                        : "border-[var(--line)] bg-[var(--panel-2)] text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:bg-[var(--panel)] hover:text-[var(--text)]"
                  }`}
                >
                  <span className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isToday && !isSelected ? "text-[var(--cyan)]" : ""}`}>
                    {isToday ? "Today" : label.weekday}
                  </span>
                  <span className="mt-1 text-sm font-medium">{label.monthDay}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-[var(--line)] bg-[var(--panel-2)] text-sm text-[var(--text-muted)]">
          Loading classes...
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--panel-2)] p-8 text-center shadow-[0_26px_70px_rgba(0,0,0,0.25)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] text-[var(--text-soft)]">
            <CalendarDays size={28} />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-[var(--text)]">No classes on this day</h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Pick another date from the bar above or use the calendar picker to jump somewhere else.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => {
            const coachLabel = session.default_coach?.full_name ?? session.default_coach?.email ?? null;
            const status = getSessionStatusCopy(session);
            const isPending = pendingSessionId === session.id;
            const reserveEnabled = canReserve(session);

            return (
              <article
                key={`${session.id}-${session.classDate}`}
                className="relative overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--panel-2)] p-5 shadow-[0_28px_70px_rgba(0,0,0,0.28)]"
              >
                <div
                  className="absolute inset-y-0 left-0 w-1.5 rounded-full"
                  style={{ backgroundColor: session.calendar_color }}
                />

                <div className="flex flex-col gap-5 pl-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-[var(--text)]">{session.name}</h2>
                      {session.track ? (
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
                          style={{
                            color: session.calendar_color,
                            backgroundColor: `${session.calendar_color}22`,
                          }}
                        >
                          {session.track.name}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-2">
                        <Clock3 size={15} />
                        {formatTime(session.class_time)} · {formatDuration(session.duration_minutes)}
                      </span>
                      {coachLabel ? (
                        <span className="inline-flex items-center gap-2">
                          <User size={15} />
                          {coachLabel}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setRosterSession(session)}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text)]"
                      >
                        <Users size={14} />
                        {session.size_limit > 0
                          ? `${session.reservedCount}/${session.size_limit} reserved`
                          : `${session.reservedCount} reserved`}
                      </button>
                    </div>

                    <div className={`text-sm ${status.tone}`}>
                      <p className="font-semibold">{status.title}</p>
                      <p className="mt-1 text-[var(--text-soft)]">{status.body}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 lg:min-w-[220px] lg:items-end">
                    {session.isReservedByCurrentUser ? (
                      <button
                        type="button"
                        onClick={() => void mutateReservation(session, "DELETE")}
                        disabled={isPending}
                        className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPending ? <LoaderCircle size={16} className="animate-spin" /> : <XCircle size={16} />}
                        Cancel reservation
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void mutateReservation(session, "POST")}
                        disabled={!reserveEnabled || isPending}
                        className={`inline-flex min-w-[180px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          reserveEnabled
                            ? "bg-[linear-gradient(135deg,rgba(255,177,196,0.95),rgba(99,247,255,0.88))] text-slate-950 shadow-[0_18px_45px_rgba(99,247,255,0.18)] hover:brightness-105"
                            : "border border-[var(--line)] bg-[var(--panel-2)] text-[var(--text-soft)]"
                        }`}
                      >
                        {isPending ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        {session.isReservationClosed
                          ? "Reservation closed"
                          : session.size_limit > 0 && session.capacityRemaining === 0
                            ? "Class full"
                            : "Reserve spot"}
                      </button>
                    )}

                    <p className="max-w-[220px] text-right text-xs text-[var(--text-soft)]">
                      {session.reservationCutoffAt
                        ? `Reserve before ${formatCutoff(session.reservationCutoffAt)}`
                        : "Reservations available until class starts"}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {rosterSession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-[var(--line)] bg-[var(--bg)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Reserved Members</p>
                <h3 className="mt-2 text-xl font-semibold text-[var(--text)]">{rosterSession.name}</h3>
                <p className="mt-1 text-sm text-[var(--text-soft)]">{formatLongDate(rosterSession.classDate)}</p>
              </div>
              <button
                type="button"
                onClick={() => setRosterSession(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--panel-2)] text-[var(--text-muted)] transition hover:text-[var(--text)]"
                aria-label="Close reserved members list"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <p className="text-sm text-[var(--text-muted)]">
                {rosterSession.size_limit > 0
                  ? `${rosterSession.reservedCount} of ${rosterSession.size_limit} spots reserved`
                  : `${rosterSession.reservedCount} members reserved`}
              </p>

              {rosterSession.reservedMembers.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--text-soft)]">No one has reserved this class yet.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {rosterSession.reservedMembers.map((member, index) => (
                    <div
                      key={`${member.id}-${index}`}
                      className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-3"
                    >
                      <span className="text-sm font-medium text-[var(--text)]">{member.name}</span>
                      <span className="text-xs text-[var(--text-soft)]">
                        {member.reservedAt ? new Date(member.reservedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
