import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it.each(["fresh", "already-applied-sales"])("preserves both CRM APIs and protected metadata after %s migration order", async order => {
 const db = new PGlite();
 const actor="00000000-0000-4000-8000-000000000001", contact="00000000-0000-4000-8000-000000000002";
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  alter default privileges in schema public grant all on tables to service_role;
  create table public.app_users(id uuid primary key); insert into app_users values('${actor}');`);
  const migrations=["20261017114730_crm_contacts_foundation.sql", ...(order === "fresh" ? ["20261017232622_crm_contact_edit.sql","20261018000955_crm_sales_workflow.sql"] : ["20261018000955_crm_sales_workflow.sql","20261017232622_crm_contact_edit.sql"]), "20261018004829_crm_contact_workflow_compatibility.sql"];
  for (const file of migrations) await db.exec(readFileSync(`supabase/migrations/${file}`,"utf8"));
  await db.query("insert into crm_contacts(id,full_name,email) values($1,'Fixture','fixture@example.invalid')", [contact]);
  await db.exec("set role service_role");
  await db.query("update crm_contacts set full_name='Revision edit', updated_by=$1 where id=$2 and revision=1",[actor,contact]);
  await db.query("update crm_contacts set owner_id=$1, updated_by=$1 where id=$2 and version=2",[actor,contact]);
  expect((await db.query("select revision,version,owner_id,updated_by from crm_contacts where id=$1",[contact])).rows).toEqual([{revision:3,version:3,owner_id:actor,updated_by:actor}]);
  for(const column of ["id","created_by","created_at","revision","version","updated_at"]) {
   await expect(db.exec(`update crm_contacts set ${column}=${column}`)).rejects.toThrow();
  }
  await expect(db.exec("delete from crm_contacts")).rejects.toThrow();
  await db.exec("reset role; set role authenticated");
  await expect(db.exec("update crm_contacts set owner_id=null")).rejects.toThrow();
 } finally { await db.close(); }
},30000);
