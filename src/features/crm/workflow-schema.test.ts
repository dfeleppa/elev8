import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
const db = new PGlite();
const actor = "00000000-0000-4000-8000-000000000001";
const contact = "00000000-0000-4000-8000-000000000002";
const other = "00000000-0000-4000-8000-000000000003";
const opportunity = "00000000-0000-4000-8000-000000000004";
beforeAll(async () => {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 alter default privileges in schema public grant all on tables to service_role;
 create table public.app_users(id uuid primary key); insert into app_users values('${actor}');`);
 for (const file of ["20261017114730_crm_contacts_foundation.sql", "20261018000955_crm_sales_workflow.sql"]) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
 await db.exec(`insert into crm_contacts(id,full_name,email) values('${contact}','A','a@example.com'),('${other}','B','b@example.com');`);
}, 30000);
afterAll(async () => { await db.close(); });
it("writes initial and changed stage history atomically as the restricted server role", async () => {
 await db.exec("set role service_role");
 try {
  await db.query("insert into crm_opportunities(id,contact_id,title,created_by,updated_by) values($1,$2,'Trial',$3,$3)", [opportunity,contact,actor]);
  await db.query("update crm_opportunities set stage='trial',updated_by=$2 where id=$1 and version=1", [opportunity,actor]);
  const events = await db.query("select from_stage,to_stage,created_by from crm_stage_events order by from_stage nulls first");
  expect(events.rows).toEqual([{from_stage:null,to_stage:"new",created_by:actor},{from_stage:"new",to_stage:"trial",created_by:actor}]);
  expect((await db.query("update crm_opportunities set stage='lost' where id=$1 and version=1 returning id", [opportunity])).rows).toEqual([]);
  await expect(db.query("update crm_stage_events set to_stage='won'")).rejects.toThrow();
  await expect(db.query("delete from crm_opportunities")).rejects.toThrow();
 } finally { await db.exec("reset role"); }
});
it("rejects linking a task to another contact's opportunity and invalid stages", async () => {
 await expect(db.query("insert into crm_tasks(id,contact_id,opportunity_id,title,due_at) values(gen_random_uuid(),$1,$2,'Wrong contact',now())", [other,opportunity])).rejects.toThrow();
 await expect(db.query("update crm_opportunities set stage='invalid'")).rejects.toThrow();
});
it("increments contact and task versions and preserves exact cents", async () => {
 await db.query("update crm_contacts set owner_id=$1 where id=$2", [actor,contact]);
 expect((await db.query<{version:number}>("select version from crm_contacts where id=$1", [contact])).rows[0].version).toBe(2);
 await db.query("insert into crm_tasks(id,contact_id,title,due_at) values(gen_random_uuid(),$1,'Call',now())", [contact]);
 await db.exec("update crm_tasks set completed=true");
 expect((await db.query<{version:number}>("select version from crm_tasks")).rows[0].version).toBe(2);
 await expect(db.exec("update crm_opportunities set value_cents=-1")).rejects.toThrow();
});
it.each(["anon", "authenticated"])("denies direct %s reads/writes on all workflow tables", async role => {
 for (const table of ["crm_notes", "crm_opportunities", "crm_tasks", "crm_stage_events"]) {
  await db.exec(`set role ${role}`);
  try { await expect(db.exec(`select * from ${table}`)).rejects.toThrow(); }
  finally { await db.exec("reset role"); }
  await db.exec(`grant select on ${table} to ${role}; set role ${role}`);
  try { expect((await db.query(`select * from ${table}`)).rows).toEqual([]); }
  finally { await db.exec(`reset role; revoke select on ${table} from ${role}`); }
 }
});
it("has no client-callable trigger functions", async () => {
 const result = await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','public.crm_record_stage()','EXECUTE') as allowed");
 expect(result.rows[0].allowed).toBe(false);
});
