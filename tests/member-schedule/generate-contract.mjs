import { mkdirSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { bookingInput, cancellationInput, scheduleDay, scheduleOccurrence } from "../../src/features/member-schedule/contracts.ts";
const schema = value => z.toJSONSchema(value, { target: "draft-2020-12" });
const ref = name => ({ $ref: "#/components/schemas/" + name });
const content = name => ({ "application/json": { schema: ref(name) } });
const response = (description, name) => ({ description, content: content(name) });
const errors = {
  400: response("Invalid fields, UUID or calendar date", "BookingError"),
  401: response("Verified identity or exact-one link missing", "BookingError"),
  403: response("Staging gate disabled, forbidden role or browser Origin", "BookingError"),
  404: response("Occurrence or owned reservation not found", "BookingError"),
  409: response("Full, closed, invalid DST time or operation ID conflict", "BookingError"),
  503: response("Database unavailable; outcome may be uncertain. Read current state before retrying the same operation.", "BookingError"),
};
const date = { name: "date", in: "query", description: "Gym-local date; defaults to today in America/New_York.", schema: { type: "string", format: "date" } };
const id = name => ({ name, in: "path", required: true, schema: { type: "string", format: "uuid" } });
const spec = {
  openapi: "3.1.0", info: { title: "Elev8 member schedule API", version: "0.1.0",
    description: "Staging-gated addition. Uses an existing exact-one Auth UID link to app_users.id. All four roles may book/cancel only themselves. No waitlist or cancellation deadline. No production enablement. Booking operation IDs are durable per app user; replays never reapply the mutation. Reconcile session, not historical reservationId, after replay." },
  security: [{ bearerAuth: [] }, { webSession: [] }],
  paths: {
    "/api/v1/member/schedule": { get: { operationId: "getMemberSchedule", parameters: [date], responses: { ...errors, 200: response("Gym day with caller's reservation state only", "ScheduleDay") } } },
    "/api/v1/member/schedule/classes/{classId}": { get: { operationId: "getMemberClass", parameters: [id("classId"), date], responses: { ...errors, 200: response("Class occurrence", "ScheduleDetail") } } },
    "/api/v1/member/schedule/reservations": { post: { operationId: "bookMemberClass",
      description: "Reuse operationId after timeout. Same ID with different input returns 409. Already booked returns 200. Full/closed failure is also retained: use a new ID only for a new explicit user action.",
      requestBody: { required: true, content: content("BookingInput") },
      responses: { ...errors, 200: response("Existing booking or replay; session is current state", "BookingResult"), 201: response("Booked", "BookingResult") } } },
    "/api/v1/member/schedule/reservations/{reservationId}": { delete: { operationId: "cancelMemberClass", parameters: [id("reservationId")],
      description: "Only the caller's exact reservation ID. Cancellation is allowed after cutoff/start and after a recurrence edit. Retrying a completed operation returns current state; it never deletes a replacement booking.",
      requestBody: { required: true, content: content("CancellationInput") },
      responses: { ...errors, 200: response("Cancelled or replayed", "BookingResult") } } },
  },
  components: { securitySchemes: {
    bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "Supabase access token" },
    webSession: { type: "apiKey", in: "cookie", name: "__Secure-next-auth.session-token", description: "NextAuth verified password session; development uses next-auth.session-token. Cookie mutations require the canonical Origin." },
  }, schemas: {
    BookingInput: schema(bookingInput), CancellationInput: schema(cancellationInput),
    ScheduleOccurrence: schema(scheduleOccurrence), ScheduleDay: schema(scheduleDay),
    ScheduleDetail: { type: "object", required: ["session"], properties: { session: ref("ScheduleOccurrence") } },
    BookingResult: { type: "object", additionalProperties: false,
      required: ["code", "classId", "date", "reservationId", "session", "replayed"],
      properties: { code: { enum: ["booked","already_booked","cancelled"] },
        classId: { type: "string", format: "uuid" }, date: { type: "string", format: "date" },
        reservationId: { type: ["string","null"], format: "uuid", description: "Historical operation result. For current reservation use session.reservationId." },
        session: { anyOf: [ref("ScheduleOccurrence"), { type: "null" }] }, replayed: { type: "boolean" } } },
    BookingError: { type: "object", additionalProperties: false, required: ["error","code"],
      properties: { error: { type: "string" }, code: { enum: ["unauthorized","forbidden","schedule_disabled","invalid_origin","invalid_input","not_found","full","closed","invalid_time","operation_conflict","unavailable"] } } },
  } },
};
const base = { classId: "10000000-0000-4000-8000-000000000001", date: "2099-06-01", name: "CrossFit",
  timeZone: "America/New_York", startsAt: "2099-06-01T10:00:00Z", endsAt: "2099-06-01T11:00:00Z",
  bookingClosesAt: "2099-06-01T09:00:00Z", durationMinutes: 60, track: null, coach: null,
  capacity: 12, reservedCount: 3, remaining: 9, reservationId: null, availability: "available",
  canBook: true, canCancel: false, waitlistSupported: false };
const day = sessions => ({ date: base.date, timeZone: base.timeZone, serverNow: "2099-06-01T08:00:00Z", sessions });
const fixtures = {
  "schedule-day": day([base]), "schedule-empty": day([]),
  "schedule-unlimited": { ...base, capacity: null, remaining: null },
  "schedule-booked": { ...base, reservationId: "20000000-0000-4000-8000-000000000001", canBook: false, canCancel: true },
  "schedule-full": { ...base, reservedCount: 12, remaining: 0, availability: "full", canBook: false },
  "schedule-closed": { ...base, availability: "closed", canBook: false },
  "schedule-dst": { cases: [
    { ...base, date: "2026-03-08", startsAt: "2026-03-08T10:00:00Z", endsAt: "2026-03-08T11:00:00Z", bookingClosesAt: "2026-03-08T09:00:00Z" },
    { ...base, date: "2026-11-01", startsAt: "2026-11-01T11:00:00Z", endsAt: "2026-11-01T12:00:00Z", bookingClosesAt: "2026-11-01T10:00:00Z" },
    { ...base, date: "2026-03-08", startsAt: null, endsAt: null, bookingClosesAt: null, availability: "invalid_time", canBook: false },
  ] },
  "schedule-error": { error: "This class is already full.", code: "full" },
};
mkdirSync("packages/contracts/fixtures", { recursive: true });
writeFileSync("packages/contracts/member-schedule.openapi.json", JSON.stringify(spec, null, 2) + "\n");
for (const [name, body] of Object.entries(fixtures)) writeFileSync("packages/contracts/fixtures/" + name + ".json", JSON.stringify(body, null, 2) + "\n");
