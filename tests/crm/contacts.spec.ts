import { randomBytes, randomUUID } from "node:crypto";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { encode } from "next-auth/jwt";

const api = "http://127.0.0.1:54321";
const app = "http://127.0.0.1:3100";
if (process.env.CRM_E2E_LOCAL !== "1" || process.env.SUPABASE_URL !== api || process.env.NEXTAUTH_URL !== app) {
  throw new Error("Fixture writes require the disposable loopback stack.");
}
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const roles = ["member", "coach", "admin", "owner"] as const;
type Identity = { email: string; password: string; authUid: string; appId: string; token: string; refreshToken: string };
const identities: Record<string, Identity> = {};
const freshContact = () => ({ id: randomUUID(), full_name: `Integration ${randomUUID()}`, email: "prospect@example.invalid", source: "manual" });
const authPaths = (token: string): Record<string, string>[] => [{}, { authorization: `Bearer ${token}` }];

test.beforeAll(async () => {
  // Admin createUser does not send email. The returned UID is the sole link proof.
  // Random test credentials and all token material remain in memory, never artifacts.
  for (const role of [...roles, "unlinked", "ambiguous"]) {
    const email = `crm-${role}-${randomUUID()}@example.invalid`;
    const password = randomBytes(24).toString("base64url");
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: `Test ${role}`, role: "owner" },
    });
    expect(error).toBeNull();
    const authUid = data.user!.id;
    const appId = randomUUID(); // Deliberately different from Auth UID.
    const row = { id: appId, email, full_name: `Test ${role}`,
      role: roles.includes(role as typeof roles[number]) ? role : "owner",
      supabase_auth_uid: role === "unlinked" ? null : authUid };
    expect((await admin.from("app_users").insert(row)).error).toBeNull();
    if (role === "ambiguous") {
      expect((await admin.from("app_users").insert({ ...row, id: randomUUID(), email: `duplicate-${email}` })).error).toBeNull();
    }
    const auth = createClient(api, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = await auth.auth.signInWithPassword({ email, password });
    expect(signed.error).toBeNull();
    identities[role] = { email, password, authUid, appId,
      token: signed.data.session!.access_token, refreshToken: signed.data.session!.refresh_token };
  }
});

async function cookieLogin(request: APIRequestContext, identity: Identity) {
  const csrf = await request.get("/api/auth/csrf");
  const response = await request.post("/api/auth/callback/credentials", {
    form: { csrfToken: (await csrf.json()).csrfToken, email: identity.email, password: identity.password,
      callbackUrl: `${app}/api/v1/session`, json: "true" },
  });
  expect(response.ok()).toBe(true);
  expect((await response.json()).url).not.toContain("error=");
}

async function browserLogin(page: Page, identity: Identity) {
  await page.goto("/login?callbackUrl=/admin/crm");
  await page.getByLabel("Email", { exact: true }).fill(identity.email);
  await page.getByLabel("Password", { exact: true }).fill(identity.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contacts", exact: true })).toBeVisible();
}

test("signed-out and malformed clients receive uncached JSON denials", async ({ request }) => {
  for (const path of ["/api/v1/session", "/api/v1/crm/contacts"]) {
    for (const headers of [{}, { authorization: "Basic nope" }, { authorization: "Bearer invalid" }] as Record<string, string>[]) {
      const response = await request.get(path, { headers });
      expect(response.status()).toBe(401);
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    }
  }
});

for (const role of roles) {
  test(`${role}: real web cookie and mobile bearer resolve the same canonical identity and enforce CRM access`, async ({ page }) => {
    const identity = identities[role];
    const allowed = role === "admin" || role === "owner";
    if (role === "admin") await browserLogin(page, identity);
    else await cookieLogin(page.request, identity);

    for (const headers of authPaths(identity.token)) {
      const response = await page.request.get("/api/v1/session", { headers });
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ userId: identity.appId, role,
        capabilities: { member: true, coaching: role !== "member", crm: allowed } });
      const contact = freshContact();
      const created = await page.request.post("/api/v1/crm/contacts", {
        headers: { ...headers, origin: app }, data: contact,
      });
      expect(created.status()).toBe(allowed ? 201 : 403);
      const listed = await page.request.get("/api/v1/crm/contacts", { headers });
      expect(listed.status()).toBe(allowed ? 200 : 403);
      if (allowed) {
        expect((await listed.json()).contacts).toEqual(expect.arrayContaining([expect.objectContaining({ id: contact.id })]));
        expect((await admin.from("crm_contacts").select("created_by").eq("id", contact.id).single()).data?.created_by).toBe(identity.appId);
      } else {
        expect((await admin.from("crm_contacts").select("id").eq("id", contact.id)).data).toEqual([]);
      }
    }

    if (allowed) {
      await page.goto("/admin/crm");
      const name = `Browser ${role} ${randomUUID()}`;
      const countBefore = await admin.from("app_users").select("id", { count: "exact", head: true });
      await page.getByLabel("Name", { exact: true }).fill(name);
      await page.getByLabel("Email", { exact: true }).fill("browser@example.invalid");
      await page.getByRole("button", { name: "Save contact", exact: true }).click();
      await expect(page.getByRole("status")).toHaveText("Contact saved.");
      await expect(page.getByLabel("Contact directory").getByText(name, { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByLabel("Contact directory").getByText(name, { exact: true })).toBeVisible();
      expect((await admin.from("app_users").select("id", { count: "exact", head: true })).count).toBe(countBefore.count);
      const persisted = await admin.from("crm_contacts").select("created_by, email").eq("full_name", name).single();
      expect(persisted.error).toBeNull();
      expect(persisted.data).toEqual({ created_by: identity.appId, email: "browser@example.invalid" });
    } else {
      const deniedPage = await page.request.get("/admin/crm", { maxRedirects: 0 });
      expect(deniedPage.status()).toBe(307);
      expect(deniedPage.headers().location).toBe("/member");
    }
  });
}

test("unlinked and ambiguous identities are denied by both auth paths without linking by email", async ({ playwright }) => {
  for (const kind of ["unlinked", "ambiguous"]) {
    const identity = identities[kind];
    const request = await playwright.request.newContext({ baseURL: app });
    await cookieLogin(request, identity);
    for (const headers of authPaths(identity.token)) {
      expect((await request.get("/api/v1/session", { headers })).status()).toBe(401);
      expect((await request.get("/api/v1/crm/contacts", { headers })).status()).toBe(401);
      expect((await request.post("/api/v1/crm/contacts", { headers: { ...headers, origin: app }, data: freshContact() })).status()).toBe(401);
    }
    const row = await admin.from("app_users").select("supabase_auth_uid").eq("id", identity.appId).single();
    expect(row.data?.supabase_auth_uid).toBe(kind === "unlinked" ? null : identity.authUid);
    await request.dispose();
  }
});

test("an email-only legacy cookie cannot grant versioned CRM access", async ({ context, request }) => {
  const cookie = await encode({ token: { email: identities.owner.email }, secret: process.env.NEXTAUTH_SECRET! });
  await context.addCookies([{ name: "next-auth.session-token", value: cookie, url: app }]);
  expect((await context.request.get("/api/v1/session")).status()).toBe(401);
  expect((await context.request.get("/api/v1/crm/contacts")).status()).toBe(401);
  // Invalid bearer headers may not fall back to a valid browser session either.
  await cookieLogin(request, identities.owner);
  expect((await request.get("/api/v1/session", { headers: { authorization: "Bearer invalid" } })).status()).toBe(401);
  const memberHeaders = { authorization: `Bearer ${identities.member.token}` };
  const memberSession = await request.get("/api/v1/session", { headers: memberHeaders });
  expect((await memberSession.json()).userId).toBe(identities.member.appId);
  expect((await request.get("/api/v1/crm/contacts", { headers: memberHeaders })).status()).toBe(403);
});

test("browser origin, duplicate IDs and caller-supplied identity are enforced", async ({ request }) => {
  await cookieLogin(request, identities.admin);
  for (const origin of [undefined, "https://foreign.invalid"]) {
    expect((await request.post("/api/v1/crm/contacts", { headers: origin ? { origin } : {}, data: freshContact() })).status()).toBe(403);
  }
  const headers = { authorization: `Bearer ${identities.admin.token}` };
  const input = freshContact();
  expect((await request.post("/api/v1/crm/contacts", { headers, data: { ...input, created_by: identities.owner.appId } })).status()).toBe(400);
  expect((await request.post("/api/v1/crm/contacts", { headers, data: input })).status()).toBe(201);
  expect((await request.post("/api/v1/crm/contacts", { headers, data: input })).status()).toBe(409);
  expect((await admin.from("crm_contacts").select("id").eq("id", input.id)).data).toHaveLength(1);
});

test("direct REST access is denied even to signed-in staff, while the server grant stays narrow", async () => {
  for (const token of [publicKey, identities.member.token, identities.admin.token, identities.owner.token]) {
    for (const method of ["GET", "POST"]) {
      const response = await fetch(`${api}/rest/v1/crm_contacts?select=id`, {
        method, headers: { apikey: publicKey, authorization: `Bearer ${token}`, "content-type": "application/json" },
        ...(method === "POST" ? { body: JSON.stringify(freshContact()) } : {}),
      });
      expect([401, 403]).toContain(response.status);
    }
  }
  const id = randomUUID();
  expect((await admin.from("crm_contacts").delete().eq("id", id)).error?.code).toBe("42501");
  expect((await admin.from("crm_contacts").update({ full_name: "Denied" }).eq("id", id)).error?.code).toBe("42501");
});

test("direct profile RLS requires one exact link and denies identity or role writes", async () => {
  for (const kind of [...roles, "unlinked", "ambiguous"]) {
    const identity = identities[kind];
    const headers = { apikey: publicKey, authorization: `Bearer ${identity.token}`, "content-type": "application/json" };
    const profile = await fetch(`${api}/rest/v1/app_users?select=id,role`, { headers });
    expect(profile.status).toBe(200);
    expect(await profile.json()).toEqual(roles.includes(kind as typeof roles[number])
      ? [{ id: identity.appId, role: kind }] : []);
    const privateColumn = await fetch(`${api}/rest/v1/app_users?select=password_hash`, { headers });
    expect(privateColumn.status).toBe(403);
    const change = await fetch(`${api}/rest/v1/app_users?id=eq.${identity.appId}`, {
      method: "PATCH", headers, body: JSON.stringify({ role: "owner", supabase_auth_uid: identity.authUid }),
    });
    expect(change.status).toBe(403);
  }
});

test("Auth updates never claim an unlinked application user by matching email", async () => {
  const identity = identities.unlinked;
  // An ordinary metadata update used to fire the dangerous email-link trigger.
  const updated = await admin.auth.admin.updateUserById(identity.authUid, { user_metadata: { probe: "identity-regression" } });
  expect(updated.error).toBeNull();
  const row = await admin.from("app_users").select("supabase_auth_uid").eq("id", identity.appId).single();
  expect(row.error).toBeNull();
  expect(row.data?.supabase_auth_uid).toBeNull();
});

test("bearer refresh preserves identity and role changes take effect without a new token", async ({ request }) => {
  const identity = identities.owner;
  await cookieLogin(request, identity);
  const auth = createClient(api, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const refreshed = await auth.auth.refreshSession({ refresh_token: identity.refreshToken });
  expect(refreshed.error).toBeNull();
  const headers = { authorization: `Bearer ${refreshed.data.session!.access_token}` };
  expect((await request.get("/api/v1/session", { headers })).status()).toBe(200);
  expect((await admin.from("app_users").update({ role: "member" }).eq("id", identity.appId)).error).toBeNull();
  try {
    expect((await request.get("/api/v1/crm/contacts", { headers })).status()).toBe(403);
    expect((await request.post("/api/v1/crm/contacts", { headers, data: freshContact() })).status()).toBe(403);
    expect((await request.get("/api/v1/crm/contacts")).status()).toBe(403);
  } finally {
    expect((await admin.from("app_users").update({ role: "owner" }).eq("id", identity.appId)).error).toBeNull();
  }
  const csrf = (await (await request.get("/api/auth/csrf")).json()).csrfToken;
  await request.post("/api/auth/signout", { form: { csrfToken: csrf, json: "true", callbackUrl: `${app}/login` } });
  expect((await request.get("/api/v1/session")).status()).toBe(401);
});

test("pagination reads every persisted contact once", async ({ request }) => {
  expect((await admin.from("crm_contacts").insert(Array.from({ length: 55 }, freshContact))).error).toBeNull();
  const expected = await admin.from("crm_contacts").select("id").order("id");
  const headers = { authorization: `Bearer ${identities.admin.token}` };
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const response = await request.get(`/api/v1/crm/contacts${cursor ? `?cursor=${cursor}` : ""}`, { headers });
    expect(response.status()).toBe(200);
    const body: { contacts: { id: string }[]; nextCursor: string | null } = await response.json();
    expect(body.contacts.length).toBeLessThanOrEqual(50);
    ids.push(...body.contacts.map((c: { id: string }) => c.id));
    cursor = body.nextCursor;
    expect(ids.length).toBeLessThan(200);
  } while (cursor);
  expect(ids).toEqual(expected.data!.map(c => c.id));
  expect(new Set(ids).size).toBe(ids.length);
});
