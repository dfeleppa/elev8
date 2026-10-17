import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
import { scheduleDay, scheduleOccurrence, type BookingResult, type ScheduleOccurrence } from "./contracts";

const migration = readFileSync("supabase/migrations/20261017232829_member_schedule_booking.sql", "utf8");
const member = randomUUID(), other = randomUUID(), classId = randomUUID();
let db: PGlite;
async function bootstrap() {
  const instance = new PGlite();
  await instance.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);");
  await instance.exec(readFileSync("tests/crm/bootstrap.sql", "utf8"));
  await instance.exec(readFileSync("tests/member-schedule/schema-fixture.sql", "utf8"));
  return instance;
}
async function value<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<{ value: T }>(sql, params)).rows[0].value;
}
async function occurrence(date = "2099-06-01", now = "2099-05-01T00:00:00Z") {
  return value<ScheduleOccurrence | null>("select member_schedule_occurrence($1,$2,$3,$4) as value", [classId, date, member, now]);
}
async function mutate(action = "book", operation = randomUUID(), who = member, reservation: string | null = null) {
  return value<BookingResult>("select member_schedule_mutate($1,$2,$3,$4,$5,$6) as value",
    [who, operation, action, action === "cancel" ? null : classId, action === "cancel" ? null : "2099-06-01", reservation]);
}
beforeAll(async () => {
  db = await bootstrap();
  await db.exec(migration);
  await db.query("insert into app_users(id,email,role) values ($1,'one@example.invalid','member'),($2,'two@example.invalid','coach')", [member, other]);
}, 30000);
beforeEach(async () => {
  await db.exec("truncate member_booking_operations, class_reservations, schedule_classes cascade");
  await db.query("insert into schedule_classes(id,name,class_time,duration_minutes,class_days,start_date,size_limit,reservation_cutoff_hours) values ($1,'Class','06:00',60,array['Su','Mo','Tu','We','Th','Fr','Sa'],'1900-01-01',1,1)", [classId]);
});
afterAll(async () => { await db?.close(); });

it("books canonical app IDs, enforces uniqueness and full capacity, and returns the response contract", async () => {
  const first = await mutate();
  expect(first.status).toBe(201);
  expect(scheduleOccurrence.safeParse(first.session).success).toBe(true);
  expect(first.session?.reservationId).toBe(first.reservationId);
  expect(first.session?.canCancel).toBe(true);
  expect(first.session?.remaining).toBe(0);
  expect((await mutate()).code).toBe("already_booked");
  expect((await mutate("book", randomUUID(), other)).code).toBe("full");
  await expect(db.query("insert into class_reservations(class_id,class_date,member_id) values ($1,'2099-06-01',$2)", [classId, member])).rejects.toThrow();
  expect((await db.query("select member_id from class_reservations")).rows).toEqual([{ member_id: member }]);
  expect(scheduleDay.safeParse(await value("select member_schedule_day('2099-06-01',$1) as value", [member])).success).toBe(true);
});

it("replays without resurrecting a cancelled booking, rejects changed requests, and isolates operation IDs by member", async () => {
  const op = randomUUID();
  const booked = await mutate("book", op);
  expect((await mutate("cancel", randomUUID(), member, booked.reservationId!)).code).toBe("cancelled");
  const replay = await mutate("book", op);
  expect(replay.replayed).toBe(true);
  expect(replay.session?.reservationId).toBeNull();
  expect((await mutate("legacy_cancel", op)).code).toBe("operation_conflict");
  expect((await mutate("book", op, other)).status).toBe(201);
});

it("cannot cancel another user's booking or a replacement reservation with an old reservation ID", async () => {
  const first = await mutate();
  expect((await mutate("cancel", randomUUID(), other, first.reservationId!)).status).toBe(404);
  const cancelOp = randomUUID();
  await mutate("cancel", cancelOp, member, first.reservationId!);
  const second = await mutate();
  expect(second.reservationId).not.toBe(first.reservationId);
  const replay = await mutate("cancel", cancelOp, member, first.reservationId!);
  expect(replay.session?.reservationId).toBe(second.reservationId);
  expect((await mutate("cancel", randomUUID(), member, first.reservationId!)).status).toBe(404);
});

it("allows cancellation after start and after the recurrence was changed", async () => {
  const id = randomUUID();
  await db.query("insert into class_reservations(id,class_id,class_date,member_id) values ($1,$2,'2020-01-01',$3)", [id, classId, member]);
  await db.query("update schedule_classes set class_days='{}' where id=$1", [classId]);
  const result = await mutate("cancel", randomUUID(), member, id);
  expect(result.status).toBe(200);
  expect(result.session).toBeNull();
  expect((await db.query("select * from class_reservations")).rows).toHaveLength(0);
});

it("preserves unlimited capacity and legacy repeated cancellation semantics", async () => {
  await db.exec("update schedule_classes set size_limit=0");
  expect((await mutate()).status).toBe(201);
  expect((await mutate("book", randomUUID(), other)).status).toBe(201);
  const item = await occurrence();
  expect(item?.capacity).toBeNull(); expect(item?.remaining).toBeNull();
  expect((await mutate("legacy_cancel")).status).toBe(200);
  expect((await mutate("legacy_cancel")).status).toBe(200);
});

it("uses Eastern instants and elapsed cutoff hours across DST regardless of database timezone", async () => {
  for (const zone of ["UTC", "Australia/Sydney"]) {
    await db.exec("set time zone '" + zone + "'");
    const spring = await occurrence("2026-03-08", "2026-03-01T00:00:00Z");
    const fall = await occurrence("2026-11-01", "2026-10-01T00:00:00Z");
    expect(new Date(spring!.startsAt!).toISOString()).toBe("2026-03-08T10:00:00.000Z");
    expect(new Date(fall!.startsAt!).toISOString()).toBe("2026-11-01T11:00:00.000Z");
  }
  await db.exec("set time zone 'UTC'; update schedule_classes set class_time='03:30', reservation_cutoff_hours=2");
  expect(new Date((await occurrence("2026-03-08", "2026-03-01T00:00:00Z"))!.bookingClosesAt!).toISOString()).toBe("2026-03-08T05:30:00.000Z");
  expect((await occurrence("2026-03-08", "2026-03-08T05:30:00Z"))?.availability).toBe("closed");
  expect((await occurrence("2026-03-08", "2026-03-08T05:29:59Z"))?.availability).toBe("available");
});

it("marks DST gaps and repeated hours unavailable without inventing a start instant", async () => {
  await db.exec("update schedule_classes set class_time='02:30'");
  expect(await occurrence("2026-03-08", "2026-03-01T00:00:00Z")).toMatchObject({ startsAt: null, availability: "invalid_time", canBook: false });
  await db.exec("update schedule_classes set class_time='01:30'");
  expect(await occurrence("2026-11-01", "2026-10-01T00:00:00Z")).toMatchObject({ startsAt: null, availability: "invalid_time", canBook: false });
});

it("enforces weekdays and inclusive date boundaries", async () => {
  await db.exec("update schedule_classes set start_date='2026-03-08',end_date='2026-03-08',class_days=array['Su']");
  expect(await occurrence("2026-03-08")).not.toBeNull();
  expect(await occurrence("2026-03-07")).toBeNull();
  expect(await occurrence("2026-03-09")).toBeNull();
  await db.exec("update schedule_classes set class_days=array['Mo']");
  expect(await occurrence("2026-03-08")).toBeNull();
});

it.each(["anon","authenticated"])("denies %s table and RPC access", async role => {
  await db.exec("set role " + role);
  try {
    await expect(db.query("select * from member_booking_operations")).rejects.toThrow();
    await expect(db.query("select * from class_reservations")).rejects.toThrow();
    await expect(occurrence()).rejects.toThrow();
    await expect(mutate()).rejects.toThrow();
  } finally { await db.exec("reset role"); }
});

it("supports the server role and keeps the journal append-only", async () => {
  await db.exec("set role service_role");
  try {
    expect((await mutate()).status).toBe(201);
    await expect(db.exec("delete from member_booking_operations")).rejects.toThrow();
  } finally { await db.exec("reset role"); }
});

it("fails migration preflight without silently removing duplicate reservations", async () => {
  const separate = await bootstrap();
  try {
    await separate.query("insert into app_users(id,email) values ($1,'duplicate@example.invalid')", [member]);
    await separate.query("insert into schedule_classes(id,name,class_time,duration_minutes,start_date) values ($1,'Class','06:00',60,'2000-01-01')", [classId]);
    await separate.query("insert into class_reservations(class_id,member_id,class_date) values ($1,$2,'2099-06-01'),($1,$2,'2099-06-01')", [classId, member]);
    await expect(separate.exec(migration)).rejects.toThrow("Duplicate reservations");
    await separate.exec("rollback");
    expect((await separate.query("select * from class_reservations")).rows).toHaveLength(2);
  } finally { await separate.close(); }
}, 30000);
