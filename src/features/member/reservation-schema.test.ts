import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table schedule_classes(id uuid primary key, size_limit integer not null);
    create table class_reservations(class_id uuid references schedule_classes, class_date date, member_id uuid);
    grant select, update on schedule_classes to service_role;
    grant select, insert, delete on class_reservations to service_role;
    insert into schedule_classes values ('00000000-0000-4000-8000-000000000001', 1);
  `);
  await db.exec(readFileSync("supabase/migrations/20261018001214_member_reservation_capacity_guard.sql", "utf8"));
}, 30000);
afterAll(async () => { await db.close(); });

const reserve = (member: string, date = "2099-04-06") => db.query("insert into class_reservations values ('00000000-0000-4000-8000-000000000001', $1, $2)", [date, member]);
it("enforces capacity and duplicate protection through the actual database trigger", async () => {
  await db.exec("set role service_role");
  try {
    await reserve("00000000-0000-4000-8000-000000000002");
    await expect(reserve("00000000-0000-4000-8000-000000000002")).rejects.toThrow(/Duplicate/);
    await expect(reserve("00000000-0000-4000-8000-000000000003")).rejects.toThrow(/capacity/);
    await reserve("00000000-0000-4000-8000-000000000003", "2099-04-07");
    await db.exec("delete from class_reservations where class_date = '2099-04-06'");
    await reserve("00000000-0000-4000-8000-000000000003");
  } finally { await db.exec("reset role"); }
});
it.each(["anon", "authenticated"])("does not grant %s access or a privileged callable function", async role => {
  const result = await db.query<{ permitted: boolean }>("select has_function_privilege($1, 'public.guard_class_reservation_capacity()', 'EXECUTE') as permitted", [role]);
  expect(result.rows[0].permitted).toBe(false);
  await db.exec(`set role ${role}`);
  try { await expect(reserve("00000000-0000-4000-8000-000000000004")).rejects.toThrow(/permission denied/); }
  finally { await db.exec("reset role"); }
});
