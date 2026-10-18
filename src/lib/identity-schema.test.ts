import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, afterAll, afterEach, expect, it } from "vitest";

const db = new PGlite();
const authId = "10000000-0000-4000-8000-000000000001";
const otherAuthId = "10000000-0000-4000-8000-000000000002";
const appId = "20000000-0000-4000-8000-000000000001";
const unlinkedId = "20000000-0000-4000-8000-000000000002";
const migration = readFileSync("supabase/migrations/20261017233030_trusted_identity_boundary.sql", "utf8");

beforeAll(async () => {
  await db.exec(readFileSync("tests/crm-identity/bootstrap.sql", "utf8"));
  await db.query("insert into app_users(id,email,role,supabase_auth_uid) values ($1,'collision@example.invalid','owner',$2)", [appId, otherAuthId]);
  await db.query("insert into auth.users values ($1,'collision@example.invalid',null)", [authId]);
  // Reproduce the reported defect before installing the fix.
  expect((await db.query<{ supabase_auth_uid: string }>("select supabase_auth_uid from app_users")).rows[0].supabase_auth_uid).toBe(authId);
  await db.exec(migration);
  await db.query("insert into app_users(id,email,role) values ($1,'unlinked@example.invalid','owner')", [unlinkedId]);
  await db.query("insert into auth.users values ($1,'unlinked@example.invalid',now())", [otherAuthId]);
}, 30000);
afterAll(async () => { await db.close(); });
beforeEach(async () => { await db.exec("begin"); });
afterEach(async () => { await db.exec("rollback"); });

async function claims(sub = authId, amr: unknown = [{ method: "password" }]) {
  await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({
    sub, amr, email: "collision@example.invalid", user_metadata: { role: "owner", amr: [{ method: "password" }] },
  })]);
}
async function resolveId() {
  return (await db.query<{ id: string | null }>("select public.mobile_app_user_id() id")).rows[0].id;
}

it("does not link new Auth accounts or overwrite links on Auth email changes", async () => {
  expect((await db.query<{ supabase_auth_uid: string | null }>("select supabase_auth_uid from app_users where id=$1", [unlinkedId])).rows[0].supabase_auth_uid).toBeNull();
  await db.query("update auth.users set email='collision@example.invalid' where id=$1", [otherAuthId]);
  expect((await db.query<{ supabase_auth_uid: string }>("select supabase_auth_uid from app_users where id=$1", [appId])).rows[0].supabase_auth_uid).toBe(authId);
});

it("resolves an exact link to a different canonical application ID", async () => {
  await claims(); await db.exec("set local role authenticated");
  expect(await resolveId()).toBe(appId);
  expect((await db.query("select id,email,role from app_users")).rows).toHaveLength(1);
  await expect(db.query("select password_hash from app_users")).rejects.toThrow();
});

it("does not use a confirmed matching email as identity proof", async () => {
  await claims(otherAuthId); await db.exec("set local role authenticated");
  expect(await resolveId()).toBeNull();
  expect((await db.query("select id from app_users")).rows).toHaveLength(0);
});

it.each([null, [], [{ method: "oauth" }], [{ method: "recovery" }], [{ method: "token_refresh" }], [{ method: "password" }, { method: "oauth" }]].map(amr => ({ amr })))("denies unproven methods $amr", async ({ amr }) => {
  await claims(authId, amr); await db.exec("set local role authenticated");
  expect(await resolveId()).toBeNull();
});

it("preserves password proof across MFA and refresh", async () => {
  await claims(authId, [{ method: "password" }, { method: "totp" }, { method: "token_refresh" }]);
  await db.exec("set local role authenticated"); expect(await resolveId()).toBe(appId);
});

it("fails closed on a null role and on an orphaned Auth link", async () => {
  await claims();
  await db.exec("update app_users set role=null");
  expect(await resolveId()).toBeNull();
  await db.exec("update app_users set role='member'; delete from auth.users");
  expect(await resolveId()).toBeNull();
});

it("keeps production's unique link constraint", async () => {
  await expect(db.query("update app_users set supabase_auth_uid=$1 where id=$2", [authId, unlinkedId])).rejects.toThrow(/unique/i);
});

it("fails closed even in a deliberately corrupted disposable copy with duplicate links", async () => {
  await db.exec("alter table app_users drop constraint app_users_supabase_auth_uid_key");
  await db.query("update app_users set supabase_auth_uid=$1,role=null where id=$2", [authId, unlinkedId]);
  await claims();
  expect(await resolveId()).toBeNull();
});

it.each(["anon", "authenticated"])("denies %s identity/role writes including column grants", async role => {
  await claims(); await db.exec(`set local role ${role}`);
  await expect(db.query("update app_users set role='owner'")).rejects.toThrow(/permission/i);
});

it("removes the unsafe trigger/function and keeps privileged lookup private", async () => {
  expect((await db.query("select oid from pg_proc where proname='sync_supabase_auth_uid'")).rows).toHaveLength(0);
  expect((await db.query("select oid from pg_trigger where tgname='on_auth_user_login'")).rows).toHaveLength(0);
  const rows = (await db.query<{ public_definer: boolean; private_definer: boolean }>(`
    select (select prosecdef from pg_proc where oid='public.mobile_app_user_id()'::regprocedure) public_definer,
      (select prosecdef from pg_proc where oid='private.resolve_mobile_app_user_id()'::regprocedure) private_definer
  `)).rows;
  expect(rows[0]).toEqual({ public_definer: false, private_definer: true });
});

it("rolls back rather than cascading through unexpected trigger dependencies", async () => {
  const copy = new PGlite();
  try {
    await copy.exec(readFileSync("tests/crm-identity/bootstrap.sql", "utf8"));
    await copy.exec("create trigger unexpected_identity_dependency after update on auth.users for each row execute function public.sync_supabase_auth_uid()");
    await expect(copy.exec(migration)).rejects.toThrow(/depend/i);
    await copy.exec("rollback");
    expect((await copy.query("select oid from pg_trigger where tgname='on_auth_user_login'")).rows).toHaveLength(1);
    expect((await copy.query("select oid from pg_proc where proname='sync_supabase_auth_uid'")).rows).toHaveLength(1);
  } finally { await copy.close(); }
}, 30000);
