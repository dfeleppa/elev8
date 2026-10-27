import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";
const db = new PGlite();
const appId = "20000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  await db.exec(readFileSync("tests/crm-identity/bootstrap.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261017233030_trusted_identity_boundary.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261027154747_oauth_only_web_identity.sql", "utf8"));
  await db.query("insert into app_users(id,email,role) values ($1,'owner@example.invalid','owner')", [appId]);
  await db.query("insert into private.web_oauth_identities(provider,issuer,audience,subject,app_user_id,verified_by,verification_method) values('google','https://accounts.google.com','client','owner-subject',$1,'reviewer','verified-provider-flow')", [appId]);
}, 30000);
afterAll(async () => { await db.close(); });
beforeEach(async () => { await db.exec("begin"); });
afterEach(async () => { await db.exec("rollback"); });
async function resolve(subject = "owner-subject", audience = "client") {
  return (await db.query("select * from resolve_web_oauth_identity('google','https://accounts.google.com',$1,$2)", [audience, subject])).rows;
}
async function register(email = "new@example.invalid", subject = "new-subject") {
  return (await db.query<{ ok: boolean }>("select register_web_oauth_member('google','https://accounts.google.com','client',$1,$2,'New member') ok", [subject, email])).rows[0].ok;
}
it("resolves the exact subject and audience, never a matching email", async () => {
  expect(await resolve()).toEqual([{ app_user_id: appId, role: "owner" }]);
  expect(await resolve("other-subject")).toEqual([]);
  expect(await resolve("owner-subject", "other-client")).toEqual([]);
});
it("reads role changes and binding revocation immediately", async () => {
  await db.query("update app_users set role='coach' where id=$1", [appId]);
  expect(await resolve()).toEqual([{ app_user_id: appId, role: "coach" }]);
  await db.exec("update private.web_oauth_identities set revoked_at=now()");
  expect(await resolve()).toEqual([]);
});
it("cannot overwrite or reactivate binding history", async () => {
  await expect(db.exec("update private.web_oauth_identities set subject='stolen' ")).rejects.toThrow(/immutable/);
});
it("creates only a new member and rolls back duplicate bindings", async () => {
  expect(await register()).toBe(true);
  expect(await resolve("new-subject")).toMatchObject([{ role: "member" }]);
  expect(await register("second@example.invalid")).toBe(false);
  expect((await db.query("select id from app_users where email='second@example.invalid'")).rows).toEqual([]);
});
it("an invitation cannot claim an existing same-email owner", async () => {
  expect(await register("OWNER@example.invalid")).toBe(false);
  expect(await resolve("new-subject")).toEqual([]);
  expect(await resolve()).toEqual([{ app_user_id: appId, role: "owner" }]);
});
it.each(["anon", "authenticated"])("denies direct %s resolution/provisioning and binding reads", async role => {
  await db.exec(`set local role ${role}`);
  await expect(resolve()).rejects.toThrow(/permission/);
});
it("allows only service-role execution from the API", async () => {
  await db.exec("set local role service_role");
  expect(await resolve()).toEqual([{ app_user_id: appId, role: "owner" }]);
});
