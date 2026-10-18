import { supabaseAdmin } from "@/lib/supabase-admin";
import type { BookingResult, ScheduleDay, ScheduleOccurrence } from "./contracts";

export class ScheduleUnavailable extends Error {}
async function rpc<T>(name: string, parameters: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(name, parameters);
  if (error) throw new ScheduleUnavailable("Schedule is temporarily unavailable.");
  return data as T;
}
export function loadScheduleDay(memberId: string, date: string) {
  return rpc<ScheduleDay>("member_schedule_day", { p_member_id: memberId, p_date: date });
}
export function loadScheduleOccurrence(memberId: string, classId: string, date: string) {
  return rpc<ScheduleOccurrence | null>("member_schedule_occurrence", {
    p_member_id: memberId, p_class_id: classId, p_date: date,
  });
}
export function mutateBooking(memberId: string, operationId: string,
  action: "book" | "cancel" | "legacy_cancel",
  target: { classId?: string; date?: string; reservationId?: string }) {
  return rpc<BookingResult>("member_schedule_mutate", {
    p_member_id: memberId, p_operation_id: operationId, p_action: action,
    p_class_id: target.classId ?? null, p_date: target.date ?? null,
    p_reservation_id: target.reservationId ?? null,
  });
}
export const bookingMessages: Record<string, string> = {
  unauthorized: "Unauthorized.", invalid_input: "Invalid booking request.",
  not_found: "Class or reservation not found.", full: "This class is already full.",
  closed: "Reservations are closed for this class.",
  invalid_time: "This class time needs to be corrected before booking.",
  operation_conflict: "This operation ID was already used for a different request.",
  already_booked: "You already reserved a spot for this class.",
};
