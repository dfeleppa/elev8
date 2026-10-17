import { NextResponse } from "next/server";
import { z } from "zod";
import { allowsMutationOrigin, requireClientContext } from "@/features/crm/context";
import { bookingInput, cancellationInput, dateKey } from "./contracts";
import { memberScheduleEnabled } from "./gate";
import { bookingMessages, loadScheduleDay, loadScheduleOccurrence, mutateBooking } from "./service";

const headers = { "Cache-Control": "private, no-store" };
export function scheduleError(status: number, code: string, message: string) {
  return NextResponse.json({ error: message, code }, { status, headers });
}
async function gate(request: Request, mutation = false) {
  const ctx = await requireClientContext(request);
  if (ctx.error || !ctx.userId) return scheduleError(401, "unauthorized", "Unauthorized.");
  if (!memberScheduleEnabled()) return scheduleError(403, "schedule_disabled", "Schedule booking is not enabled.");
  if (!["member", "coach", "admin", "owner"].includes(ctx.role)) return scheduleError(403, "forbidden", "Forbidden.");
  if (mutation && !allowsMutationOrigin(request)) return scheduleError(403, "invalid_origin", "Invalid request origin.");
  return ctx;
}
function selectedDate(request: Request) {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(key => key !== "date") || params.getAll("date").length > 1) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const parsed = dateKey.safeParse(params.get("date") ?? today);
  return parsed.success ? parsed.data : null;
}
function unavailable() {
  return scheduleError(503, "unavailable", "Schedule is temporarily unavailable. Refresh before retrying.");
}
export async function getDay(request: Request) {
  const ctx = await gate(request);
  if (ctx instanceof NextResponse) return ctx;
  const date = selectedDate(request);
  if (!date) return scheduleError(400, "invalid_input", "Use a real date in YYYY-MM-DD format.");
  try { return NextResponse.json(await loadScheduleDay(ctx.userId, date), { headers }); }
  catch { return unavailable(); }
}
export async function getOccurrence(request: Request, classId: string) {
  const ctx = await gate(request);
  if (ctx instanceof NextResponse) return ctx;
  const date = selectedDate(request);
  if (!date || !z.string().uuid().safeParse(classId).success) return scheduleError(400, "invalid_input", "Invalid class ID or date.");
  try {
    const session = await loadScheduleOccurrence(ctx.userId, classId, date);
    return session ? NextResponse.json({ session }, { headers }) : scheduleError(404, "not_found", "Class not found.");
  } catch { return unavailable(); }
}
export async function book(request: Request) {
  const ctx = await gate(request, true);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = bookingInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return scheduleError(400, "invalid_input", "classId, date and operationId are required.");
  try {
    const result = await mutateBooking(ctx.userId, parsed.data.operationId, "book", parsed.data);
    if (result.status >= 400) return scheduleError(result.status, result.code, bookingMessages[result.code] ?? "Booking failed.");
    const { status, ...body } = result;
    return NextResponse.json(body, { status: result.replayed ? 200 : status, headers });
  } catch { return unavailable(); }
}
export async function cancel(request: Request, reservationId: string) {
  const ctx = await gate(request, true);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = cancellationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(reservationId).success) return scheduleError(400, "invalid_input", "A reservation ID and operationId are required.");
  try {
    const result = await mutateBooking(ctx.userId, parsed.data.operationId, "cancel", { reservationId });
    if (result.status >= 400) return scheduleError(result.status, result.code, bookingMessages[result.code] ?? "Cancellation failed.");
    const { status, ...body } = result;
    return NextResponse.json(body, { status, headers });
  } catch { return unavailable(); }
}
