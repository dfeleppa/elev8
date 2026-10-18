import { randomBytes, randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const api = "http://127.0.0.1:54321";
if (process.env.CRM_E2E_LOCAL !== "1" || process.env.SUPABASE_URL !== api) throw new Error("Recovery tests require the disposable stack.");
const admin = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const publicClient = () => createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

for (const type of ["recovery", "invite"] as const) {
  test(`${type}: password setup preserves ownership and requires fresh password authentication`, async ({ page }) => {
    const email = `recovery-${randomUUID()}@example.invalid`;
    const appId = randomUUID();
    let authUid: string | undefined;
    try {
      if (type === "recovery") {
        const created = await admin.auth.admin.createUser({ email, email_confirm: true });
        expect(created.error).toBeNull();
        authUid = created.data.user!.id;
      }
      // Generate only: no messages are sent, no production accounts are used.
      const generated = await admin.auth.admin.generateLink({ type, email });
      expect(generated.error).toBeNull();
      authUid = generated.data.user!.id;
      const before = { id: appId, email, full_name: "Recovery fixture", role: "member", supabase_auth_uid: type === "recovery" ? authUid : null };
      expect((await admin.from("app_users").insert(before)).error).toBeNull();
      const fragment = new URLSearchParams({ type, token_hash: generated.data.properties!.hashed_token }).toString();
      await page.goto(`/account-recovery#${fragment}`);
      await expect(page).toHaveURL(/\/account-recovery$/);
      const verifiedResponse = page.waitForResponse(response => response.url() === `${api}/auth/v1/verify`);
      await page.getByRole("button", { name: "Verify link", exact: true }).click();
      const verified = await (await verifiedResponse).json();
      await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
      expect(verified.user.id).toBe(authUid);
      expect((await page.request.get("/api/v1/session", { headers: { authorization: `Bearer ${verified.access_token}` } })).status()).toBe(401);
      expect((await page.request.get("/api/v1/session")).status()).toBe(401);
      const password = randomBytes(24).toString("base64url");
      await page.getByLabel("New password", { exact: true }).fill(password);
      await page.getByLabel("Confirm password", { exact: true }).fill(password + "wrong");
      await page.getByRole("button", { name: "Save password", exact: true }).click();
      await expect(page.getByRole("alert")).toHaveText("The passwords do not match.");
      await page.getByLabel("Confirm password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Save password", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("Password saved.");
      const row = await admin.from("app_users").select("id,email,full_name,role,supabase_auth_uid").eq("id", appId).single();
      expect(row.data).toEqual(before);
      expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.includes("auth-token")))).toBe(false);
      expect((await page.request.get("/api/v1/session")).status()).toBe(401);
      const auth = publicClient();
      const signed = await auth.auth.signInWithPassword({ email, password });
      expect(signed.error).toBeNull();
      const session = await page.request.get("/api/v1/session", { headers: { authorization: `Bearer ${signed.data.session!.access_token}` } });
      expect(session.status()).toBe(type === "recovery" ? 200 : 401);
      if (type === "recovery") expect((await session.json()).userId).toBe(appId);
      await auth.auth.signOut({ scope: "local" });
      await page.goto(`/account-recovery#${fragment}`);
      await page.getByRole("button", { name: "Verify link", exact: true }).click();
      await expect(page.getByRole("alert")).toContainText("missing, expired, or already used");
    } finally {
      expect((await admin.from("app_users").delete().eq("id", appId)).error).toBeNull();
      if (authUid) expect((await admin.auth.admin.deleteUser(authUid)).error).toBeNull();
    }
  });
}

test("missing or unsupported recovery proof cannot open the password form", async ({ page }) => {
  const response = await page.request.get("/account-recovery", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  for (const fragment of ["", "#type=magiclink&token_hash=" + "a".repeat(64), "#type=recovery&token_hash=invalid"]) {
    await page.goto("/account-recovery" + fragment);
    await page.getByRole("button", { name: "Verify link", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("missing, expired, or already used");
    await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  }
});
