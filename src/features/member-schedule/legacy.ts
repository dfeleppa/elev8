import type { DailyScheduleSession } from "@/lib/class-schedule";
import type { ScheduleOccurrence } from "./contracts";

export function legacyBookingState(session: DailyScheduleSession, current: ScheduleOccurrence | null) {
  if (!current) return { ...session, isReservationClosed: true, reservationCutoffAt: null };
  return { ...session,
    reservedCount: current.reservedCount, capacityRemaining: current.remaining,
    isReservedByCurrentUser: current.reservationId !== null,
    isReservationClosed: current.availability === "closed" || current.availability === "invalid_time",
    reservationCutoffAt: current.bookingClosesAt,
  };
}
