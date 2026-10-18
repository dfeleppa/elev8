export type ScheduleClassRow = {
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
  track?: { id: string; name: string } | null;
  default_coach?: { id: string; full_name: string | null; email: string | null } | null;
};

export type ReservationRow = {
  id?: string;
  class_id: string;
  member_id: string;
  class_date: string;
  created_at?: string | null;
};

export type ReservedMember = {
  id: string;
  name: string;
  reservedAt: string | null;
};

export type DailyScheduleSession = ScheduleClassRow & {
  classDate: string;
  reservedCount: number;
  capacityRemaining: number | null;
  isReservedByCurrentUser: boolean;
  isReservationClosed: boolean;
  reservationCutoffAt: string | null;
  reservedMembers: ReservedMember[];
};

const JS_DAY_TO_ABBR: Record<number, string> = {
  0: "Su",
  1: "Mo",
  2: "Tu",
  3: "We",
  4: "Th",
  5: "Fr",
  6: "Sa",
};

export function isValidDateKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = parseLocalDate(value);
  return !Number.isNaN(date.getTime()) && toLocalDateString(date) === value;
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getScheduleDateTime(dateKey: string, classTime: string): Date {
  const [hours = "00", minutes = "00", seconds = "00"] = classTime.split(":");
  const date = parseLocalDate(dateKey);
  date.setHours(Number(hours), Number(minutes), Number(seconds), 0);
  return date;
}

export function classOccursOnDate(scheduleClass: ScheduleClassRow, dateKey: string): boolean {
  const date = parseLocalDate(dateKey);
  const classStart = parseLocalDate(scheduleClass.start_date);

  if (date < classStart) {
    return false;
  }

  if (scheduleClass.end_date) {
    const classEnd = parseLocalDate(scheduleClass.end_date);
    if (date > classEnd) {
      return false;
    }
  }

  const dayAbbr = JS_DAY_TO_ABBR[date.getDay()];
  return scheduleClass.class_days.includes(dayAbbr);
}

export function getReservationCutoffAt(scheduleClass: ScheduleClassRow, dateKey: string, timeZone?: string): string | null {
  let sessionStart = getScheduleDateTime(dateKey, scheduleClass.class_time);
  if (timeZone) {
    // Interpret the class's wall clock in the gym's zone, independent of the server's zone.
    const wall = new Date(`${dateKey}T${scheduleClass.class_time.slice(0, 8).padEnd(8, ':00')}Z`).getTime();
    let instant = wall;
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' });
    for (let pass = 0; pass < 3; pass++) {
      const offset = formatter.formatToParts(new Date(instant)).find(part => part.type === 'timeZoneName')?.value ?? 'GMT';
      const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset);
      const minutes = match ? (Number(match[2]) * 60 + Number(match[3])) * (match[1] === '+' ? 1 : -1) : 0;
      instant = wall - minutes * 60_000;
    }
    sessionStart = new Date(instant);
  }

  if (scheduleClass.reservation_cutoff_hours <= 0) {
    return sessionStart.toISOString();
  }

  const cutoff = new Date(sessionStart);
  if (timeZone) cutoff.setTime(sessionStart.getTime() - scheduleClass.reservation_cutoff_hours * 3_600_000);
  else cutoff.setHours(cutoff.getHours() - scheduleClass.reservation_cutoff_hours);
  return cutoff.toISOString();
}

export function isReservationClosed(scheduleClass: ScheduleClassRow, dateKey: string, now = new Date(), timeZone?: string): boolean {
  const cutoffAt = getReservationCutoffAt(scheduleClass, dateKey, timeZone);
  if (!cutoffAt) {
    return false;
  }

  return now >= new Date(cutoffAt);
}

export function buildDailyScheduleSession(params: {
  scheduleClass: ScheduleClassRow;
  dateKey: string;
  reservations: ReservationRow[];
  currentUserId: string;
  memberNameMap: Map<string, string>;
  now?: Date;
  timeZone?: string;
}): DailyScheduleSession {
  const { scheduleClass, dateKey, reservations, currentUserId, memberNameMap, now } = params;
  const reservedMembers = reservations
    .slice()
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return aTime - bTime;
    })
    .map((reservation) => ({
      id: reservation.member_id,
      name: memberNameMap.get(reservation.member_id) ?? "Athlete",
      reservedAt: reservation.created_at ?? null,
    }));

  const reservedCount = reservations.length;
  const capacityRemaining = scheduleClass.size_limit > 0
    ? Math.max(scheduleClass.size_limit - reservedCount, 0)
    : null;

  return {
    ...scheduleClass,
    classDate: dateKey,
    reservedCount,
    capacityRemaining,
    isReservedByCurrentUser: reservations.some((reservation) => reservation.member_id === currentUserId),
    isReservationClosed: isReservationClosed(scheduleClass, dateKey, now, params.timeZone),
    reservationCutoffAt: getReservationCutoffAt(scheduleClass, dateKey, params.timeZone),
    reservedMembers,
  };
}
