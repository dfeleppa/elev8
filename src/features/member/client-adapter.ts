import { NextResponse } from "next/server";
import { z } from "zod";
import { allowsMutationOrigin, requireClientContext } from "@/features/crm/context";
import { isValidDateKey } from "@/lib/class-schedule";

type Context = Awaited<ReturnType<typeof requireClientContext>> & { timeZone?: string };
type Handler = (request: Request, context: Context) => Promise<NextResponse>;
const headers = { "Cache-Control": "private, no-store" };
const reservationInput = z.object({ classId: z.string().uuid(), date: z.string().refine(isValidDateKey) }).strict();
const profileInput = z.object({ fullName: z.string().trim().min(1).max(150) }).strict();

/** Canonical identity gate. Legacy route handlers never resolve identity for a new client. */
export async function memberRequest(request: Request, handler: Handler, kind: "profile" | "schedule" | "reservation") {
  const context = await requireClientContext(request);
  if (context.error || !context.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  let forwarded = request;
  if (kind === "schedule" && !isValidDateKey(new URL(request.url).searchParams.get("date"))) {
    return NextResponse.json({ error: "Choose a date using YYYY-MM-DD." }, { status: 400, headers });
  }
  if (request.method !== "GET") {
    if (!allowsMutationOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
    const input = await request.json().catch(() => null);
    const parsed = (kind === "profile" ? profileInput : reservationInput).safeParse(input);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request. Check the fields and try again." }, { status: 400, headers });
    forwarded = new Request(request.url, { method: request.method, headers: request.headers, body: JSON.stringify(parsed.data) });
  }
  const response = await handler(forwarded, { ...context, timeZone: "America/New_York" });
  const body = await response.json();
  if (response.ok && kind === "profile") {
    return NextResponse.json({ fullName: body.fullName, email: body.email, createdAt: body.createdAt }, { status: response.status, headers });
  }
  // The native member contract exposes availability and own status, never another member's identity.
  const session = (value: Record<string, unknown>) => ({
    id: value.id, name: value.name, classDate: value.classDate, classTime: value.class_time,
    durationMinutes: value.duration_minutes, reservedCount: value.reservedCount,
    capacityRemaining: value.capacityRemaining, isReserved: value.isReservedByCurrentUser,
    isClosed: value.isReservationClosed,
  });
  if (response.ok && kind === "schedule") { body.sessions = body.sessions.map(session); body.timeZone = "America/New_York"; }
  if (response.ok && kind === "reservation") body.session = session(body.session);
  return NextResponse.json(body, { status: response.status, headers });
}
