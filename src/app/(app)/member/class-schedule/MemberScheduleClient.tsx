"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  User,
  Users,
  XCircle,
} from "lucide-react";

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

function formatClassTimeRange(value: string, durationMinutes: number) {
  const [hours = "00", minutes = "00"] = value.split(":");
  const start = new Date();
  start.setHours(Number(hours), Number(minutes), 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const format = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return `${format(start)} - ${format(end)}`;
}

function formatRailDay(dateKey: string) {
  const date = parseDateKey(dateKey);
  return {
    weekday: DAY_NAMES_SHORT[date.getDay()].toUpperCase(),
    dayNum: date.getDate(),
    month: date.toLocaleDateString("en-US", { month: "short" }),
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

function getSessionStatusCopy(session: ScheduleSession) {
  if (session.isReservedByCurrentUser) {
    return {
      title: "Reserved",
    };
  }

  if (session.isReservationClosed) {
    return {
      title: "Reservation closed",
    };
  }

  if (session.size_limit > 0 && session.capacityRemaining === 0) {
    return {
      title: "Class full",
    };
  }

  return {
    title: "Open for reservations",
  };
}

function canReserve(session: ScheduleSession) {
  if (session.isReservedByCurrentUser) return false;
  if (session.isReservationClosed) return false;
  if (session.size_limit > 0 && session.capacityRemaining === 0) return false;
  return true;
}

function statusPillClass(session: ScheduleSession) {
  if (session.isReservedByCurrentUser) {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-700";
  }
  if (session.isReservationClosed) {
    return "border-amber-400/35 bg-amber-500/10 text-amber-700";
  }
  if (session.size_limit > 0 && session.capacityRemaining === 0) {
    return "border-rose-400/30 bg-rose-500/10 text-rose-700";
  }
  return "border-[rgba(20,210,220,0.28)] bg-[rgba(20,210,220,0.09)] text-[#0D98A1]";
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
  const [railStart, setRailStart] = useState(() => addDays(toLocalDateString(new Date()), -7));

  const dayRail = useMemo(
    () => Array.from({ length: 14 }, (_, index) => addDays(railStart, index)),
    [railStart]
  );

  useEffect(() => {
    const railEnd = addDays(railStart, 13);
    if (selectedDate < railStart || selectedDate > railEnd) {
      setRailStart(addDays(selectedDate, -7));
    }
  }, [selectedDate, railStart]);

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
    <div className="premium-main-glow min-h-[calc(100vh-3.5rem)] w-full px-3 py-3 text-[#17141F] sm:px-8 lg:px-10 lg:py-5 2xl:px-12">
      <div className="flex w-full flex-col gap-3 sm:gap-4">
        <header className="hidden min-h-8 items-center sm:flex">
          <h1 className="font-head text-[22px] font-bold leading-tight tracking-normal text-[#17141F] sm:text-[30px]">
            Class Schedule
          </h1>
        </header>

        <section className="premium-glass-card p-2 sm:p-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setRailStart((prev) => addDays(prev, -7))}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 text-[#475467] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:border-[rgba(20,210,220,0.26)] hover:bg-[rgba(20,210,220,0.08)] hover:text-[#17141F] sm:flex"
              aria-label="Previous week"
            >
              <ChevronLeft size={17} />
            </button>

            <div className="min-w-0 flex-1 overflow-x-auto md:overflow-x-visible">
              <div className="flex min-w-max gap-1 md:min-w-0 md:w-full md:gap-1.5">
                {dayRail.map((dateKey) => {
                  const isSelected = dateKey === selectedDate;
                  const isToday = dateKey === todayKey;
                  const label = formatRailDay(dateKey);

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedDate(dateKey)}
                      className={`flex w-[44px] shrink-0 flex-col items-center rounded-xl border px-1 py-2 text-center transition sm:w-[68px] sm:rounded-[18px] sm:px-2 sm:py-2.5 md:w-auto md:flex-1 md:shrink ${
                        isSelected
                          ? "border-white/80 bg-[linear-gradient(135deg,rgba(255,92,168,0.92),rgba(20,210,220,0.88))] text-white shadow-[0_14px_30px_rgba(20,210,220,0.18),0_10px_24px_rgba(255,92,168,0.16)]"
                          : "border-[rgba(16,24,40,0.08)] bg-white/64 text-[#475467] hover:border-[rgba(20,210,220,0.24)] hover:bg-[rgba(20,210,220,0.08)]"
                      }`}
                    >
                      <span
                        className={`whitespace-nowrap text-[9px] font-bold uppercase leading-none sm:text-[10px] sm:tracking-[0.16em] ${
                          isSelected ? "text-white/86" : isToday ? "text-[#0D98A1]" : "text-[#667085]"
                        }`}
                      >
                        {label.weekday}
                      </span>
                      <span
                        className={`mt-1 text-[19px] font-bold leading-none sm:mt-1 sm:text-[22px] ${
                          isSelected ? "text-white" : "text-[#17141F]"
                        }`}
                      >
                        {label.dayNum}
                      </span>
                      <span
                        className={`mt-0.5 text-[9px] font-semibold leading-none sm:mt-1 sm:text-[11px] ${
                          isSelected ? "text-white/78" : "text-[#667085]"
                        }`}
                      >
                        {label.month}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setRailStart((prev) => addDays(prev, 7))}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 text-[#475467] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:border-[rgba(20,210,220,0.26)] hover:bg-[rgba(20,210,220,0.08)] hover:text-[#17141F] sm:flex"
              aria-label="Next week"
            >
              <ChevronRight size={17} />
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedDate(todayKey);
                setRailStart(addDays(todayKey, -7));
              }}
              className="hidden shrink-0 rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 px-3.5 py-2 text-sm font-bold text-[#17141F] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:border-[rgba(20,210,220,0.26)] hover:bg-[rgba(20,210,220,0.08)] sm:inline-flex"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(16,24,40,0.08)] bg-[#17141F] text-white shadow-[0_12px_28px_rgba(16,24,40,0.18)] transition hover:bg-[#101828] sm:rounded-2xl"
              aria-label="Choose a date"
            >
              <CalendarDays size={17} />
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
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-600">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700">
            {message}
          </div>
        ) : null}

        <section className="w-full">
          <div className="premium-glass-card min-h-[320px] p-2 sm:p-4">
            <div className="mb-3 hidden flex-wrap items-end justify-between gap-3 sm:flex">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#667085]">Today&apos;s Classes</p>
              </div>
              <span className="rounded-full border border-[rgba(20,210,220,0.22)] bg-[rgba(20,210,220,0.09)] px-3 py-1 text-xs font-bold text-[#0D98A1]">
                {sessionsLabel}
              </span>
            </div>

            {loading ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-[24px] border border-[rgba(16,24,40,0.08)] bg-white/62 text-sm font-semibold text-[#667085]">
                Loading classes...
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[24px] border border-[rgba(16,24,40,0.08)] bg-white/62 p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(20,210,220,0.18)] bg-[rgba(20,210,220,0.08)] text-[#0D98A1]">
                  <CalendarDays size={25} />
                </div>
                <h3 className="mt-5 text-xl font-bold text-[#17141F]">No classes on this day</h3>
                <p className="mt-2 max-w-md text-sm font-medium leading-6 text-[#667085]">
                  Pick another date from the strip above or use the calendar picker to jump somewhere else.
                </p>
              </div>
            ) : (
              <div className="grid gap-2 sm:gap-3">
                {sessions.map((session) => {
                  const coachLabel = session.default_coach?.full_name ?? session.default_coach?.email ?? null;
                  const status = getSessionStatusCopy(session);
                  const isPending = pendingSessionId === session.id;
                  const reserveEnabled = canReserve(session);
                  const classTimeLabel = formatClassTimeRange(session.class_time, session.duration_minutes);

                  return (
                    <article
                      key={`${session.id}-${session.classDate}`}
                      className="hover-lift relative overflow-hidden rounded-lg border border-[rgba(16,24,40,0.08)] bg-white/76 shadow-[0_8px_18px_rgba(16,24,40,0.08)] sm:rounded-[22px] sm:bg-white/72 sm:shadow-[0_14px_30px_rgba(16,24,40,0.08)]"
                    >
                      <div
                        className="absolute inset-y-0 left-0 w-1.5"
                        style={{ backgroundColor: session.calendar_color }}
                      />

                      <div className="flex items-center gap-2 px-3 py-2 pl-4 sm:hidden">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-bold leading-tight text-[#8A94A3]">
                            {classTimeLabel}
                          </p>
                          <h3 className="mt-0.5 truncate text-[15px] font-bold leading-tight text-[#475467]">
                            {session.name}
                          </h3>
                          {coachLabel ? (
                            <p className="mt-0.5 truncate text-[12px] font-medium leading-tight text-[#8A94A3]">
                              {coachLabel}
                            </p>
                          ) : null}
                          <p className="mt-1 truncate text-[11px] font-semibold leading-tight text-rose-300">
                            {status.title}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setRosterSession(session)}
                            className="text-right text-[20px] font-bold leading-none text-[#667085]"
                            aria-label={`View class roster for ${session.name} at ${classTimeLabel}`}
                          >
                            {session.reservedCount}
                            {session.size_limit > 0 ? (
                              <span className="text-[12px] font-semibold text-[#8A94A3]">/{session.size_limit}</span>
                            ) : null}
                          </button>
                          {session.isReservedByCurrentUser ? (
                            <button
                              type="button"
                              onClick={() => void mutateReservation(session, "DELETE")}
                              disabled={isPending}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/12 text-rose-600 disabled:opacity-60"
                              aria-label="Cancel reservation"
                            >
                              {isPending ? <LoaderCircle size={16} className="animate-spin" /> : <XCircle size={16} />}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void mutateReservation(session, "POST")}
                              disabled={!reserveEnabled || isPending}
                              className="flex h-9 w-9 items-center justify-center rounded-full text-[#0D807B] disabled:cursor-not-allowed disabled:opacity-45"
                              style={{ backgroundColor: `${session.calendar_color}66` }}
                              aria-label={
                                reserveEnabled ? `Reserve ${session.name}` : `${session.name} is not available`
                              }
                            >
                              {isPending ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={17} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="hidden flex-col gap-4 p-4 pl-5 sm:flex lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="space-y-1.5">
                            <p className="text-sm font-extrabold leading-tight text-[#17141F]">
                              {classTimeLabel}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full shadow-[0_0_0_5px_rgba(20,210,220,0.08)]"
                                style={{ backgroundColor: session.calendar_color }}
                              />
                              <h3 className="text-[22px] font-bold leading-tight text-[#17141F]">{session.name}</h3>
                              {session.track ? (
                                <span
                                  className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
                                  style={{
                                    color: session.calendar_color,
                                    backgroundColor: `${session.calendar_color}22`,
                                  }}
                                >
                                  {session.track.name}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-[#667085]">
                            {coachLabel ? (
                              <span className="inline-flex items-center gap-1.5">
                                <User size={14} />
                                {coachLabel}
                              </span>
                            ) : null}
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusPillClass(session)}`}>
                              {session.isReservedByCurrentUser ? <CheckCircle2 size={12} /> : null}
                              {status.title}
                            </span>
                          </div>

                        </div>

                        <div className="flex flex-col gap-2.5 lg:min-w-[190px] lg:items-end">
                          <button
                            type="button"
                            onClick={() => setRosterSession(session)}
                            className="inline-flex min-w-[170px] items-center justify-between gap-3 rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 px-4 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] transition hover:border-[rgba(20,210,220,0.3)] hover:bg-[rgba(20,210,220,0.08)]"
                            aria-label={`View class roster for ${session.name} at ${classTimeLabel}`}
                          >
                            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#667085]">
                              <Users size={14} />
                              Reserved
                            </span>
                            <span className="text-sm font-extrabold text-[#17141F]">
                              {session.size_limit > 0 ? `${session.reservedCount} / ${session.size_limit}` : session.reservedCount}
                            </span>
                          </button>

                          {session.isReservedByCurrentUser ? (
                            <button
                              type="button"
                              onClick={() => void mutateReservation(session, "DELETE")}
                              disabled={isPending}
                              className="inline-flex min-w-[170px] items-center justify-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isPending ? <LoaderCircle size={15} className="animate-spin" /> : <XCircle size={15} />}
                              Cancel reservation
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void mutateReservation(session, "POST")}
                              disabled={!reserveEnabled || isPending}
                              className={`inline-flex min-w-[170px] items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                reserveEnabled
                                  ? "bg-[#14D2DC] text-[#071317] shadow-[0_14px_30px_rgba(20,210,220,0.24)] hover:brightness-105"
                                  : "border border-[rgba(16,24,40,0.08)] bg-white/70 text-[#667085]"
                              }`}
                            >
                              {isPending ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                              {session.isReservationClosed
                                ? "Reservation closed"
                                : session.size_limit > 0 && session.capacityRemaining === 0
                                  ? "Class full"
                                  : "Reserve spot"}
                            </button>
                          )}

                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

        </section>

        {rosterSession ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <div className="premium-glass-card w-full max-w-md p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#667085]">Class Roster</p>
                  <h3 className="mt-2 text-xl font-bold text-[#17141F]">{rosterSession.name}</h3>
                  <p className="mt-1 text-sm font-medium text-[#667085]">
                    {formatLongDate(rosterSession.classDate)} · {formatClassTimeRange(rosterSession.class_time, rosterSession.duration_minutes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRosterSession(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/70 text-[#667085] transition hover:bg-[rgba(20,210,220,0.08)] hover:text-[#17141F]"
                  aria-label="Close reserved members list"
                >
                  <XCircle size={18} />
                </button>
              </div>

              <div className="mt-5 rounded-[24px] border border-[rgba(16,24,40,0.08)] bg-white/66 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#667085]">Reserved</p>
                    <p className="mt-1 text-base font-extrabold text-[#17141F]">
                      {rosterSession.size_limit > 0
                        ? `${rosterSession.reservedCount} / ${rosterSession.size_limit}`
                        : rosterSession.reservedCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#667085]">Checked in</p>
                    <p className="mt-1 text-base font-extrabold text-[#17141F]">0</p>
                  </div>
                </div>

                {rosterSession.reservedMembers.length === 0 ? (
                  <p className="mt-4 text-sm font-medium text-[#667085]">No one has reserved this class yet.</p>
                ) : (
                  <div className="mt-4 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#667085]">Reserved athletes</p>
                    {rosterSession.reservedMembers.map((member, index) => (
                      <div
                        key={`${member.id}-${index}`}
                        className="flex items-center justify-between rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 px-3 py-3"
                      >
                        <span className="text-sm font-bold text-[#17141F]">{member.name}</span>
                        <span className="text-xs font-semibold text-[#667085]">
                          {member.reservedAt
                            ? new Date(member.reservedAt).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-dashed border-[rgba(16,24,40,0.12)] bg-white/48 px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#667085]">Checked in</p>
                  <p className="mt-1 text-sm font-medium text-[#667085]">No check-ins recorded yet.</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
