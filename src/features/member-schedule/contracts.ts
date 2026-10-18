import { z } from "zod";

export const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + "T00:00:00Z");
  return Number(value.slice(0, 4)) >= 1 && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Use a real calendar date in YYYY-MM-DD format.");
export const bookingInput = z.object({
  classId: z.string().uuid(), date: dateKey, operationId: z.string().uuid(),
}).strict();
export const cancellationInput = z.object({ operationId: z.string().uuid() }).strict();
const named = z.object({ id: z.string().uuid(), name: z.string() });
export const scheduleOccurrence = z.object({
  classId: z.string().uuid(), date: dateKey, name: z.string(),
  timeZone: z.literal("America/New_York"),
  startsAt: z.string().datetime({ offset: true }).nullable(),
  endsAt: z.string().datetime({ offset: true }).nullable(),
  bookingClosesAt: z.string().datetime({ offset: true }).nullable(),
  durationMinutes: z.number().int().positive(), track: named.nullable(), coach: named.nullable(),
  capacity: z.number().int().positive().nullable(), reservedCount: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative().nullable(), reservationId: z.string().uuid().nullable(),
  availability: z.enum(["available", "full", "closed", "invalid_time"]),
  canBook: z.boolean(), canCancel: z.boolean(), waitlistSupported: z.literal(false),
}).strict();
export const scheduleDay = z.object({
  date: dateKey, timeZone: z.literal("America/New_York"),
  serverNow: z.string().datetime({ offset: true }), sessions: z.array(scheduleOccurrence),
}).strict();
export type ScheduleOccurrence = z.infer<typeof scheduleOccurrence>;
export type ScheduleDay = z.infer<typeof scheduleDay>;
export type BookingResult = {
  status: number; code: string; replayed?: boolean;
  classId?: string | null; date?: string | null; reservationId?: string | null;
  session?: ScheduleOccurrence | null;
};
