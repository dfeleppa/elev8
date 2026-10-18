import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
const actor = "00000000-0000-4000-8000-000000000001";
const id = "00000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    alter default privileges in schema public grant all on tables to service_role;
    create table public.app_users (id uuid primary key);
    insert into public.app_users values ('${actor}');
  `);
  await db.exec(readFileSync(resolve("supabase/migrations/20261017114730_crm_contacts_foundation.sql"), "utf8"));
  await db.query("insert into crm_contacts(id, full_name, email, created_by, created_at) values ($1, 'Before edit', 'shared@example.invalid', $2, '2026-01-01T00:00:00Z')", [id, actor]);
  await db.exec(readFileSync(resolve("supabase/migrations/20261017232622_crm_contact_edit.sql"), "utf8"));
}, 30000);
afterAll(async () => { await db.close(); });

it("upgrades existing rows without changing their identity or creation metadata", async () => {
  const row = (await db.query("select id, created_by, revision, updated_by, updated_at = created_at as preserved from crm_contacts where id = $1", [id])).rows[0];
  expect(row).toEqual({ id, created_by: actor, revision: 1, updated_by: null, preserved: true });
});

it("allows only intended server updates and stamps the revision atomically", async () => {
  await db.exec("set role service_role");
  try {
    const updated = await db.query("update crm_contacts set full_name = 'After edit', updated_by = $1 where id = $2 and revision = 1 returning revision, updated_by, created_by, updated_at > created_at as newer", [actor, id]);
    expect(updated.rows).toEqual([{ revision: 2, updated_by: actor, created_by: actor, newer: true }]);
    expect((await db.query("update crm_contacts set full_name = 'Lost write' where id = $1 and revision = 1 returning id", [id])).rows).toEqual([]);
    for (const assignment of ["id = gen_random_uuid()", "revision = 99", "created_by = null", "created_at = now()", "updated_at = now()"]) {
      await expect(db.query(`update crm_contacts set ${assignment} where id = $1`, [id])).rejects.toThrow();
    }
    await expect(db.query("delete from crm_contacts where id = $1", [id])).rejects.toThrow();
    await expect(db.query("truncate crm_contacts")).rejects.toThrow();
  } finally { await db.exec("reset role"); }
});

it("rolls back invalid channel edits and their revision bump", async () => {
  await db.exec("set role service_role");
  try {
    await expect(db.query("update crm_contacts set email = null, phone = null where id = $1", [id])).rejects.toThrow();
    await expect(db.query("update crm_contacts set phone = '555-1234' where id = $1", [id])).rejects.toThrow();
    expect((await db.query("select revision, full_name, email from crm_contacts where id = $1", [id])).rows)
      .toEqual([{ revision: 2, full_name: "After edit", email: "shared@example.invalid" }]);
  } finally { await db.exec("reset role"); }
});

it.each(["anon", "authenticated"])("denies all direct %s operations and trigger execution", async role => {
  await db.exec(`set role ${role}`);
  try {
    for (const sql of ["select * from crm_contacts", "update crm_contacts set full_name = 'Denied'", "delete from crm_contacts",
      "insert into crm_contacts(id, full_name, email) values(gen_random_uuid(), 'Denied', 'denied@example.invalid')",
      "select public.crm_stamp_contact_edit()"]) {
      await expect(db.query(sql)).rejects.toThrow();
    }
  } finally { await db.exec("reset role"); }
});

it("keeps RLS closed even if client SELECT and UPDATE grants are accidentally added", async () => {
  await db.exec("grant select, update on crm_contacts to authenticated; set role authenticated");
  try {
    expect((await db.query("select * from crm_contacts")).rows).toEqual([]);
    expect((await db.query("update crm_contacts set full_name = 'Hidden' returning id")).rows).toEqual([]);
  } finally { await db.exec("reset role; revoke select, update on crm_contacts from authenticated"); }
  expect((await db.query("select count(*)::integer as count from app_users")).rows).toEqual([{ count: 1 }]);
});
