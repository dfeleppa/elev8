import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
const contactId = "00000000-0000-4000-8000-000000000003";
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.app_users (id uuid primary key);
    insert into public.app_users values ('00000000-0000-4000-8000-000000000001');
  `);
  await db.exec(readFileSync(resolve("supabase/migrations/20261017114730_crm_contacts_foundation.sql"), "utf8"));
}, 30000);
afterAll(async () => { await db.close(); });

it("applies the migration and inserts contacts without creating login identities", async () => {
  await db.query("insert into crm_contacts(id, full_name, email) values ($1, 'Prospect', 'shared@example.com')", [contactId]);
  await db.query("insert into crm_contacts(id, full_name, email) values ($1, 'Family member', 'shared@example.com')", ["00000000-0000-4000-8000-000000000004"]);
  expect((await db.query("select * from app_users")).rows).toHaveLength(1);
});

it("prevents duplicate operation IDs and invalid contact records", async () => {
  await expect(db.query("insert into crm_contacts(id, full_name, email) values ($1, 'Repeated', 'other@example.com')", [contactId])).rejects.toThrow();
  await expect(db.query("insert into crm_contacts(id, full_name) values (gen_random_uuid(), 'No channel')")).rejects.toThrow();
  await expect(db.query("insert into crm_contacts(id, full_name, phone) values (gen_random_uuid(), 'Bad phone', '555-1234')")).rejects.toThrow();
  await expect(db.query("insert into crm_contacts(id, full_name, email) values (gen_random_uuid(), 'Bad email normalization', 'UPPER@example.com')")).rejects.toThrow();
});

it.each(["anon", "authenticated"])("denies direct %s access", async role => {
  await db.exec(`set role ${role}`);
  try { await expect(db.query("select * from crm_contacts")).rejects.toThrow(); }
  finally { await db.exec("reset role"); }
});

it("RLS still hides records if a direct select grant is accidentally added", async () => {
  await db.exec("grant select on crm_contacts to authenticated; set role authenticated");
  try { expect((await db.query("select * from crm_contacts")).rows).toEqual([]); }
  finally { await db.exec("reset role; revoke select on crm_contacts from authenticated"); }
});

it("permits the server role to read while preventing destructive writes", async () => {
  await db.exec("set role service_role");
  try {
    expect((await db.query("select * from crm_contacts")).rows).toHaveLength(2);
    await expect(db.query("delete from crm_contacts")).rejects.toThrow();
  } finally { await db.exec("reset role"); }
});
