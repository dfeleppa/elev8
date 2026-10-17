import { randomBytes, randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { scheduleDay, scheduleOccurrence } from "../../src/features/member-schedule/contracts";

const api = "http://127.0.0.1:55321", app = "http://127.0.0.1:3200";
if (process.env.BOOKING_E2E_LOCAL !== "1" || process.env.SUPABASE_URL !== api || process.env.NEXTAUTH_URL !== app) throw new Error("Disposable stack required.");
const admin = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const roles = ["member","coach","admin","owner"] as const;
type Identity = { appId: string; authUid: string; token: string; email: string; password: string; cookie: APIRequestContext };
const users: Record<string, Identity> = {};
const endpoint = "/api/v1/member/schedule";
const date = "2099-06-01";
const bearer = (who = "member") => ({ authorization: "Bearer " + users[who].token });
const dbQuery = (sql: string) => execFileSync("psql", ["-h","127.0.0.1","-p","55322","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-Atc",sql], { encoding: "utf8", env: { ...process.env, PGPASSWORD: "postgres" } }).trim();
async function newClass(size = 1) {
  const id = randomUUID();
  const { error } = await admin.from("schedule_classes").insert({
    id, name: "Synthetic booking class", class_time: "06:00:00", duration_minutes: 60,
    class_days: ["Su","Mo","Tu","We","Th","Fr","Sa"], start_date: "1900-01-01",
    size_limit: size, reservation_cutoff_hours: 0,
  });
  expect(error).toBeNull();
  return id;
}
const book = (request: APIRequestContext, classId: string, who = "member", operationId = randomUUID(), day = date) =>
  request.post(endpoint + "/reservations", { headers: bearer(who), data: { classId, date: day, operationId } });
const cancel = (request: APIRequestContext, reservationId: string, who = "member", operationId = randomUUID()) =>
  request.delete(endpoint + "/reservations/" + reservationId, { headers: bearer(who), data: { operationId } });

test.beforeAll(async ({ playwright }) => {
  for (const role of [...roles, "unlinked", "ambiguous"]) {
    const email = "booking-" + role + "-" + randomUUID() + "@example.invalid";
    const password = randomBytes(24).toString("base64url");
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: "owner" } });
    expect(created.error).toBeNull();
    const authUid = created.data.user!.id, appId = randomUUID();
    const row = { id: appId, email, role: roles.includes(role as typeof roles[number]) ? role : "member", supabase_auth_uid: role === "unlinked" ? null : authUid };
    expect((await admin.from("app_users").insert(row)).error).toBeNull();
    if (role === "ambiguous") expect((await admin.from("app_users").insert({ ...row, id: randomUUID(), email: "duplicate-" + email })).error).toBeNull();
    const auth = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = await auth.auth.signInWithPassword({ email, password });
    expect(signed.error).toBeNull();
    const cookie = await playwright.request.newContext({ baseURL: app });
    const csrf = await cookie.get("/api/auth/csrf");
    const login = await cookie.post("/api/auth/callback/credentials", { form: {
      csrfToken: (await csrf.json()).csrfToken, email, password, callbackUrl: app + "/api/v1/session", json: "true",
    } });
    expect((await login.json()).url).not.toContain("error=");
    users[role] = { appId, authUid, email, password, token: signed.data.session!.access_token, cookie };
  }
});
test.afterAll(async () => { for (const user of Object.values(users)) await user.cookie.dispose(); });

test("signed out and malformed bearer requests return uncached JSON", async ({ request }) => {
  for (const headers of [{}, { authorization: "Bearer invalid" }, { authorization: "Basic invalid" }] as Record<string, string>[]) {
    const result = await request.get(endpoint, { headers });
    expect(result.status()).toBe(401);
    expect(result.headers()["cache-control"]).toContain("no-store");
    expect((await result.json()).code).toBe("unauthorized");
  }
});

test("empty days, invalid dates and missing class occurrences have explicit responses", async ({ request }) => {
  const empty = await request.get(endpoint + "?date=1000-01-01", { headers: bearer() });
  expect(empty.status()).toBe(200);
  expect((await empty.json()).sessions).toEqual([]);
  expect((await request.get(endpoint + "?date=2026-02-30", { headers: bearer() })).status()).toBe(400);
  expect((await request.get(endpoint + "/classes/" + randomUUID() + "?date=" + date, { headers: bearer() })).status()).toBe(404);
});

for (const role of roles) {
  test(role + ": real cookie and bearer use canonical ownership and support booking/cancellation", async ({ request }) => {
    const user = users[role], classId = await newClass();
    expect(user.appId).not.toBe(user.authUid);
    for (const headers of [{ origin: app }, { ...bearer(role), origin: app }]) {
      const session = await user.cookie.get("/api/v1/session", { headers });
      expect((await session.json()).userId).toBe(user.appId);
      const created = await user.cookie.post(endpoint + "/reservations", { headers, data: { classId, date, operationId: randomUUID() } });
      expect(created.status()).toBe(201);
      const body = await created.json();
      expect(scheduleOccurrence.safeParse(body.session).success).toBe(true);
      const row = await admin.from("class_reservations").select("member_id").eq("id", body.reservationId).single();
      expect(row.data?.member_id).toBe(user.appId);
      const foreign = await cancel(request, body.reservationId, role === "member" ? "coach" : "member");
      expect(foreign.status()).toBe(404);
      const deleted = await user.cookie.delete(endpoint + "/reservations/" + body.reservationId, { headers, data: { operationId: randomUUID() } });
      expect(deleted.status()).toBe(200);
      expect((await deleted.json()).session.reservationId).toBeNull();
    }
  });
}

test("missing/ambiguous links fail without linking email, and bearer cannot inherit a cookie", async ({ request }) => {
  for (const kind of ["unlinked","ambiguous"]) {
    expect((await request.get(endpoint, { headers: bearer(kind) })).status()).toBe(401);
    expect((await users[kind].cookie.get(endpoint)).status()).toBe(401);
    const row = await admin.from("app_users").select("supabase_auth_uid").eq("id", users[kind].appId).single();
    expect(row.data?.supabase_auth_uid).toBe(kind === "unlinked" ? null : users[kind].authUid);
  }
  expect((await users.owner.cookie.get(endpoint, { headers: { authorization: "Bearer invalid" } })).status()).toBe(401);
});

test("rejects forged identity fields and browser origins, and exposes no attendee roster", async ({ request }) => {
  const classId = await newClass();
  const input = { classId, date, operationId: randomUUID() };
  for (const extra of [{ memberId: users.owner.appId }, { role: "owner" }, { email: users.owner.email }, { capacity: 100 }]) {
    expect((await request.post(endpoint + "/reservations", { headers: bearer(), data: { ...input, ...extra } })).status()).toBe(400);
  }
  expect((await users.owner.cookie.post(endpoint + "/reservations", { headers: { origin: "https://foreign.invalid" }, data: input })).status()).toBe(403);
  expect((await book(request, classId, "coach")).status()).toBe(201);
  const day = await request.get(endpoint + "?date=" + date, { headers: bearer() });
  const body = await day.json();
  expect(scheduleDay.safeParse(body).success).toBe(true);
  expect(JSON.stringify(body)).not.toContain(users.coach.appId);
  expect(JSON.stringify(body)).not.toContain(users.coach.email);
  const detail = await request.get(endpoint + "/classes/" + classId + "?date=" + date, { headers: bearer() });
  expect((await detail.json()).session).toMatchObject({ availability: "full", reservationId: null, waitlistSupported: false });
});

test("simultaneous duplicate taps create one reservation and replay the same operation", async ({ request }) => {
  const classId = await newClass(), operationId = randomUUID();
  const responses = await Promise.all(Array.from({ length: 10 }, () => book(request, classId, "member", operationId)));
  expect(responses.filter(r => r.status() === 201)).toHaveLength(1);
  expect(responses.filter(r => r.status() === 200)).toHaveLength(9);
  const bodies = await Promise.all(responses.map(r => r.json()));
  expect(new Set(bodies.map(b => b.reservationId)).size).toBe(1);
  expect((await admin.from("class_reservations").select("id").eq("class_id", classId)).data).toHaveLength(1);
  expect((await request.post(endpoint + "/reservations", { headers: bearer(), data: { classId, date: "2099-06-02", operationId } })).status()).toBe(409);
});

test("legacy cookies and versioned bearer requests compete atomically for the last place", async ({ request }) => {
  const classId = await newClass();
  const responses = await Promise.all([
    users.coach.cookie.post("/api/athlete/schedule/reservations", { data: { classId, date } }),
    users.owner.cookie.post("/api/athlete/schedule/reservations", { data: { classId, date } }),
    book(request, classId, "member"), book(request, classId, "admin"),
  ]);
  expect(responses.filter(r => r.ok())).toHaveLength(1);
  expect(responses.filter(r => r.status() === 409)).toHaveLength(3);
  expect((await admin.from("class_reservations").select("id").eq("class_id", classId)).data).toHaveLength(1);
});

test("lost-response replay never rebooks after cancellation or deletes a later replacement", async ({ request }) => {
  const classId = await newClass(), bookingOp = randomUUID(), cancelOp = randomUUID();
  const first = await (await book(request, classId, "member", bookingOp)).json();
  expect((await cancel(request, first.reservationId, "member", cancelOp)).status()).toBe(200);
  const replay = await (await book(request, classId, "member", bookingOp)).json();
  expect(replay.replayed).toBe(true);
  expect(replay.session.reservationId).toBeNull();
  const replacement = await (await book(request, classId)).json();
  const oldCancel = await (await cancel(request, first.reservationId, "member", cancelOp)).json();
  expect(oldCancel.session.reservationId).toBe(replacement.reservationId);
  expect((await cancel(request, first.reservationId)).status()).toBe(404);
});

test("legacy response shape, duplicate status and repeated cancellation remain compatible", async () => {
  const classId = await newClass(), cookie = users.owner.cookie;
  const created = await cookie.post("/api/athlete/schedule/reservations", { data: { classId, date } });
  expect(created.status()).toBe(200);
  expect((await created.json()).session).toMatchObject({
    id: classId, classDate: date, reservedCount: 1, isReservedByCurrentUser: true,
    capacityRemaining: 0, isReservationClosed: false,
  });
  expect((await cookie.post("/api/athlete/schedule/reservations", { data: { classId, date } })).status()).toBe(409);
  const legacy = await (await cookie.get("/api/athlete/schedule?date=" + date)).json();
  const item = legacy.sessions.find((entry: { id: string }) => entry.id === classId);
  expect(new Date(item.reservationCutoffAt).toISOString()).toBe("2099-06-01T10:00:00.000Z");
  expect(Array.isArray(item.reservedMembers)).toBe(true);
  for (let attempt = 0; attempt < 2; attempt++) {
    const removed = await cookie.delete("/api/athlete/schedule/reservations", { data: { classId, date } });
    expect(removed.status()).toBe(200);
    expect((await removed.json()).session.isReservedByCurrentUser).toBe(false);
  }
});

test("unlimited classes and cancellation after class start retain existing policy", async ({ request }) => {
  const classId = await newClass(0);
  for (const role of roles) expect((await book(request, classId, role)).status()).toBe(201);
  const item = await (await request.get(endpoint + "/classes/" + classId + "?date=" + date, { headers: bearer() })).json();
  expect(item.session).toMatchObject({ capacity: null, remaining: null, reservedCount: 4 });
  const reservationId = randomUUID();
  expect((await admin.from("class_reservations").insert({ id: reservationId, class_id: classId, class_date: "2020-01-01", member_id: users.member.appId })).error).toBeNull();
  expect((await cancel(request, reservationId)).status()).toBe(200);
  expect((await book(request, classId, "member", randomUUID(), "2020-01-01")).status()).toBe(409);
});

test("checks the cutoff after waiting on a real PostgreSQL row lock", async ({ request }) => {
  const classId = await newClass();
  const today = dbQuery("select (clock_timestamp() at time zone 'America/New_York')::date");
  const sql = "begin; update schedule_classes set class_time=((clock_timestamp()+interval '2 seconds') at time zone 'America/New_York')::time where id='" + classId + "'; select 'BOOKING_LOCK_READY'; select pg_sleep(4); commit;";
  const child = spawn("psql", ["-h","127.0.0.1","-p","55322","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-qAt"], { env: { ...process.env, PGPASSWORD: "postgres" } });
  child.stdin.end(sql);
  const finished = new Promise<void>((resolve, reject) => { child.on("error", reject); child.on("close", code => code === 0 ? resolve() : reject(new Error("Lock fixture failed"))); });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Lock fixture did not start")), 10000);
    child.stdout.on("data", chunk => { if (String(chunk).includes("BOOKING_LOCK_READY")) { clearTimeout(timeout); resolve(); } });
    child.on("error", reject);
  });
  const pending = book(request, classId, "member", randomUUID(), today);
  await expect.poll(() => Number(dbQuery("select count(*) from pg_stat_activity where wait_event_type='Lock' and query like '%member_schedule_mutate%'")),
    { timeout: 2500, intervals: [100,200,300] }).toBeGreaterThan(0);
  const result = await pending;
  await finished;
  expect(result.status()).toBe(409);
  expect((await result.json()).code).toBe("closed");
  expect((await admin.from("class_reservations").select("id").eq("class_id", classId)).data).toHaveLength(0);
});

test("direct client REST and booking RPC access are denied even to staff tokens", async () => {
  const classId = await newClass();
  for (const role of ["anon", ...roles]) {
    const headers = { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, ...(role === "anon" ? {} : bearer(role)) };
    for (const table of ["schedule_classes","class_reservations","member_booking_operations"]) {
      const result = await fetch(api + "/rest/v1/" + table + "?select=*", { headers });
      expect([401,403]).toContain(result.status);
    }
    const insert = await fetch(api + "/rest/v1/class_reservations", { method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: classId, class_date: date, member_id: users.owner.appId }) });
    expect([401,403]).toContain(insert.status);
    const rpc = await fetch(api + "/rest/v1/rpc/member_schedule_mutate", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ p_member_id: users.owner.appId, p_operation_id: randomUUID(), p_action: "book" }) });
    expect([401,403]).toContain(rpc.status);
  }
});

test("live role invalidation and token refresh use current server identity", async ({ request }) => {
  const user = users.admin;
  dbQuery("update app_users set role='member' where id='" + user.appId + "'");
  const profile = await users.admin.cookie.get("/api/v1/session");
  expect((await profile.json()).role).toBe("member");
  const auth = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  expect((await auth.auth.signInWithPassword({ email: user.email, password: user.password })).error).toBeNull();
  const refreshed = await auth.auth.refreshSession();
  expect(refreshed.error).toBeNull();
  expect((await request.get(endpoint, { headers: { authorization: "Bearer " + refreshed.data.session!.access_token } })).status()).toBe(200);
  // The fixture's role CHECK models known roles; deleting only its explicit link revokes versioned access.
  expect((await admin.from("app_users").update({ supabase_auth_uid: null }).eq("id", user.appId)).error).toBeNull();
  expect((await request.get(endpoint, { headers: bearer("admin") })).status()).toBe(401);
  expect((await users.admin.cookie.get(endpoint)).status()).toBe(401);
});
