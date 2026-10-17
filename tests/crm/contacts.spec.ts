import { randomBytes, randomUUID } from "node:crypto";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { encode } from "next-auth/jwt";
import { contactETag } from "../../src/features/crm/contracts";
import { matchesContract } from "./contract-validator";

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
      const detailPath = `/api/v1/crm/contacts/${contact.id}`;
      const detail = await page.request.get(detailPath, { headers });
      expect(detail.status()).toBe(allowed ? 200 : 403);
      const edited = await page.request.patch(detailPath, {
        headers: { ...headers, origin: app, "if-match": detail.headers().etag || contactETag({ id: contact.id, revision: 1 }) },
        data: { email: "EDITED@example.invalid" },
      });
      expect(edited.status()).toBe(allowed ? 200 : 403);
      expect(edited.headers()["cache-control"]).toBe("private, no-store");
      if (allowed) {
        expect(matchesContract("ContactDetailResult", await detail.json())).toBe(true);
        expect(matchesContract("ContactDetailResult", await edited.json())).toBe(true);
        const persistedEdit = await admin.from("crm_contacts").select("email, updated_by, revision").eq("id", contact.id).single();
        expect(persistedEdit.data).toEqual({ email: "edited@example.invalid", updated_by: identity.appId, revision: 2 });
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
      await page.getByLabel("Contact directory").getByRole("link", { name, exact: true }).click();
      await expect(page.getByRole("heading", { name: "Contact details", exact: true })).toBeVisible();
      await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
      await page.getByLabel("Phone", { exact: true }).fill("+15551234567");
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await expect(page.getByRole("status")).toHaveText("Contact updated.");
      await page.reload();
      await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("+15551234567");
    } else {
      const deniedPage = await page.request.get("/admin/crm", { maxRedirects: 0 });
      expect(deniedPage.status()).toBe(307);
      expect(deniedPage.headers().location).toBe("/member");
      const deniedDetailPage = await page.request.get(`/admin/crm/contacts/${randomUUID()}`, { maxRedirects: 0 });
      expect(deniedDetailPage.status()).toBe(307);
      expect(deniedDetailPage.headers().location).toBe("/member");
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
      const detailPath = `/api/v1/crm/contacts/${randomUUID()}`;
      expect((await request.get(detailPath, { headers })).status()).toBe(401);
      expect((await request.patch(detailPath, { headers: { ...headers, origin: app }, data: { full_name: "Denied" } })).status()).toBe(401);
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
  const detailPath = `/api/v1/crm/contacts/${randomUUID()}`;
  expect((await context.request.get(detailPath)).status()).toBe(401);
  expect((await context.request.patch(detailPath, { data: { full_name: "Denied" } })).status()).toBe(401);
  // Invalid bearer headers may not fall back to a valid browser session either.
  await cookieLogin(request, identities.owner);
  expect((await request.get("/api/v1/session", { headers: { authorization: "Bearer invalid" } })).status()).toBe(401);
  const memberHeaders = { authorization: `Bearer ${identities.member.token}` };
  const memberSession = await request.get("/api/v1/session", { headers: memberHeaders });
  expect((await memberSession.json()).userId).toBe(identities.member.appId);
  expect((await request.get("/api/v1/crm/contacts", { headers: memberHeaders })).status()).toBe(403);
  expect((await request.get(detailPath, { headers: { authorization: "Bearer invalid" } })).status()).toBe(401);
  expect((await request.patch(detailPath, { headers: memberHeaders, data: { full_name: "Denied" } })).status()).toBe(403);
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
  for (const origin of [undefined, "https://foreign.invalid"]) {
    const denied = await request.patch(`/api/v1/crm/contacts/${input.id}`, {
      headers: { "if-match": contactETag({ id: input.id, revision: 1 }), ...(origin ? { origin } : {}) },
      data: { full_name: "Origin denied" },
    });
    expect(denied.status()).toBe(403);
  }
});

test("direct REST access is denied even to signed-in staff, while the server grant stays narrow", async () => {
  for (const token of [publicKey, identities.member.token, identities.coach.token, identities.admin.token, identities.owner.token]) {
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      const response = await fetch(`${api}/rest/v1/crm_contacts?select=id`, {
        method, headers: { apikey: publicKey, authorization: `Bearer ${token}`, "content-type": "application/json" },
        ...(method === "POST" ? { body: JSON.stringify(freshContact()) } : method === "PATCH" ? { body: JSON.stringify({ full_name: "Denied" }) } : {}),
      });
      expect([401, 403]).toContain(response.status);
    }
  }
  const id = randomUUID();
  expect((await admin.from("crm_contacts").delete().eq("id", id)).error?.code).toBe("42501");
  expect((await admin.from("crm_contacts").update({ revision: 99 }).eq("id", id)).error?.code).toBe("42501");
  expect((await admin.from("crm_contacts").update({ created_by: identities.owner.appId }).eq("id", id)).error?.code).toBe("42501");
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
    const detailPath = `/api/v1/crm/contacts/${randomUUID()}`;
    for (const authHeaders of [{}, headers]) {
      expect((await request.get(detailPath, { headers: authHeaders })).status()).toBe(403);
      expect((await request.patch(detailPath, { headers: { ...authHeaders, origin: app }, data: { full_name: "Denied" } })).status()).toBe(403);
    }
  } finally {
    expect((await admin.from("app_users").update({ role: "owner" }).eq("id", identity.appId)).error).toBeNull();
  }
  const csrf = (await (await request.get("/api/auth/csrf")).json()).csrfToken;
  await request.post("/api/auth/signout", { form: { csrfToken: csrf, json: "true", callbackUrl: `${app}/login` } });
  expect((await request.get("/api/v1/session")).status()).toBe(401);
  expect((await request.get(`/api/v1/crm/contacts/${randomUUID()}`)).status()).toBe(401);
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

test("contact edit rejects invalid requests without changing stored data or identity links", async ({ request }) => {
  const headers = { authorization: `Bearer ${identities.admin.token}` };
  const input = { ...freshContact(), source: "referral" };
  expect((await request.post("/api/v1/crm/contacts", { headers, data: input })).status()).toBe(201);
  const path = `/api/v1/crm/contacts/${input.id}`;
  const detail = await request.get(path, { headers });
  const before = (await detail.json()).contact;
  const conditional = { ...headers, "if-match": detail.headers().etag };
  const identitiesBefore = (await admin.from("app_users").select("id, supabase_auth_uid, role").order("id")).data;
  const authBefore = (await admin.auth.admin.listUsers()).data.users.map(user => user.id).sort();
  for (const data of [{}, null, [], { full_name: " " }, { email: "bad-email" }, { email: null },
    { phone: "555-1234" }, { source: "unknown" }, { id: randomUUID() }, { revision: 99 },
    { created_by: identities.owner.appId }, { updated_by: identities.owner.appId },
    { created_at: before.created_at }, { updated_at: before.updated_at },
    { owner_user_id: identities.owner.appId }, { linked_user_id: identities.member.appId }]) {
    const invalid = await request.patch(path, { headers: conditional, data });
    expect(invalid.status()).toBe(400);
    expect(invalid.headers()["cache-control"]).toBe("private, no-store");
    expect(matchesContract("ContactEditError", await invalid.json())).toBe(true);
  }
  expect((await request.patch(path, { headers, data: { full_name: "No precondition" } })).status()).toBe(428);
  for (const tag of ["*", "W/" + conditional["if-match"], conditional["if-match"] + ", " + conditional["if-match"]]) {
    expect((await request.patch(path, { headers: { ...headers, "if-match": tag }, data: { full_name: "Invalid precondition" } })).status()).toBe(400);
  }
  expect((await request.patch(path, { headers: { ...conditional, "content-type": "text/plain" }, data: "text" })).status()).toBe(415);
  expect((await request.patch(path, { headers: { ...conditional, "content-type": "application/json" }, data: "{" })).status()).toBe(400);
  expect((await request.patch(path, { headers: conditional, data: { full_name: "x".repeat(17000) } })).status()).toBe(413);
  expect((await request.get("/api/v1/crm/contacts/not-a-uuid", { headers })).status()).toBe(400);
  const absent = `/api/v1/crm/contacts/${randomUUID()}`;
  expect((await request.get(absent, { headers })).status()).toBe(404);
  expect((await request.patch(absent, { headers: conditional, data: { full_name: "Missing" } })).status()).toBe(404);
  expect((await (await request.get(path, { headers })).json()).contact).toEqual(before);

  const cleared = await request.patch(path, { headers: conditional, data: { email: null, phone: "+15551234567" } });
  expect(cleared.status()).toBe(200);
  const saved = (await cleared.json()).contact;
  expect(saved).toEqual({ ...before, email: null, phone: "+15551234567", revision: 2, updated_at: expect.any(String) });
  expect(matchesContract("ContactDetailResult", { contact: saved })).toBe(true);
  expect((await admin.from("app_users").select("id, supabase_auth_uid, role").order("id")).data).toEqual(identitiesBefore);
  expect((await admin.auth.admin.listUsers()).data.users.map(user => user.id).sort()).toEqual(authBefore);
});

test("simultaneous real PATCH requests accept one revision and reject the other without lost updates", async ({ request }) => {
  const adminHeaders = { authorization: `Bearer ${identities.admin.token}` };
  const ownerHeaders = { authorization: `Bearer ${identities.owner.token}` };
  const input = freshContact();
  expect((await request.post("/api/v1/crm/contacts", { headers: adminHeaders, data: input })).status()).toBe(201);
  const path = `/api/v1/crm/contacts/${input.id}`;
  const original = await request.get(path, { headers: adminHeaders });
  const etag = original.headers().etag;
  const updates = [
    { headers: { ...adminHeaders, "if-match": etag }, data: { full_name: "Admin edit" } },
    { headers: { ...ownerHeaders, "if-match": etag }, data: { full_name: "Owner edit" } },
  ];
  const results = await Promise.all(updates.map(options => request.patch(path, options)));
  expect(results.map(response => response.status()).sort()).toEqual([200, 412]);
  const winner = results.findIndex(response => response.status() === 200);
  const row = await admin.from("crm_contacts").select("full_name, revision, updated_by, created_by").eq("id", input.id).single();
  expect(row.data).toEqual({ full_name: updates[winner].data.full_name, revision: 2,
    updated_by: winner === 0 ? identities.admin.appId : identities.owner.appId, created_by: identities.admin.appId });
  for (const response of results) expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect((await request.patch(path, updates[winner])).status()).toBe(412);
  expect((await admin.from("crm_contacts").select("revision").eq("id", input.id).single()).data?.revision).toBe(2);
});

test("two browser editors preserve drafts, review conflicts and recover an accepted save with a lost response", async ({ page }) => {
  const input = freshContact();
  const headers = { authorization: `Bearer ${identities.admin.token}` };
  expect((await page.request.post("/api/v1/crm/contacts", { headers, data: input })).status()).toBe(201);
  await browserLogin(page, identities.admin);
  const path = `/admin/crm/contacts/${input.id}`;
  const apiPath = `/api/v1/crm/contacts/${input.id}`;
  await page.goto(path);
  const second = await page.context().newPage();
  try {
    await second.goto(path);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(input.full_name);
    await expect(second.getByLabel("Name", { exact: true })).toHaveValue(input.full_name);
    await second.getByLabel("Name", { exact: true }).fill("Preserved draft");
    await page.getByLabel("Name", { exact: true }).fill("First editor");
    await page.getByLabel("Source", { exact: true }).selectOption("website");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Contact updated.");
    await second.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(second.getByRole("alert")).toContainText("This contact changed.");
    await expect(second.getByLabel("Name", { exact: true })).toHaveValue("Preserved draft");
    await expect(second.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
    await second.getByRole("button", { name: "Load latest details", exact: true }).click();
    await expect(second.getByLabel("Review latest contact")).toContainText("First editor");
    await second.getByRole("button", { name: "Keep my edits for review", exact: true }).click();
    await expect(second.getByLabel("Source", { exact: true })).toHaveValue("website");
    await second.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(second.getByRole("status")).toHaveText("Contact updated.");
    await second.reload();
    await expect(second.getByLabel("Name", { exact: true })).toHaveValue("Preserved draft");

    await second.route("**" + apiPath, async route => {
      if (route.request().method() !== "PATCH") { await route.continue(); return; }
      const accepted = await route.fetch();
      expect(accepted.status()).toBe(200);
      await route.abort("failed"); // Database committed; browser never receives the result.
    });
    await second.getByLabel("Name", { exact: true }).fill("Accepted but unconfirmed");
    await second.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(second.getByRole("alert")).toContainText("The save could not be confirmed.");
    await expect(second.getByLabel("Name", { exact: true })).toHaveValue("Accepted but unconfirmed");
    await second.getByRole("button", { name: "Load latest details", exact: true }).click();
    await expect(second.getByLabel("Review latest contact")).toContainText("Accepted but unconfirmed");
    await second.getByRole("button", { name: "Use latest details", exact: true }).click();
    await expect(second.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
    const persisted = await admin.from("crm_contacts").select("full_name, source, revision").eq("id", input.id).single();
    expect(persisted.data).toEqual({ full_name: "Accepted but unconfirmed", source: "website", revision: 4 });
  } finally { await second.close(); }
});

test("signed-out contact detail and edits return uncached JSON errors", async ({ request }) => {
  const path = `/api/v1/crm/contacts/${randomUUID()}`;
  for (const headers of [{}, { authorization: "Basic invalid" }, { authorization: "Bearer invalid" }] as Record<string, string>[]) {
    for (const response of [await request.get(path, { headers }), await request.patch(path, { headers, data: { full_name: "Denied" } })]) {
      expect(response.status()).toBe(401);
      expect(response.headers()["cache-control"]).toBe("private, no-store");
      expect(matchesContract("ContactEditError", await response.json())).toBe(true);
    }
  }
});
