import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { createDatabaseFixture } from "@/test/supabase-fixture";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/member", () => ({ requireRequestUserContext: mocks.auth, hasRole: (required: string, actual: string) => required === actual }));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: mocks.from } }));
import { POST } from "./route";
let db: ReturnType<typeof createDatabaseFixture>;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: "owner", role: "owner", error: null });
  db = createDatabaseFixture({ app_users: [
    { id: "owner", role: "owner", email: "owner@example.invalid", full_name: "Owner", coaching_payrate: 50 },
    { id: "member", role: "member", email: "member@example.invalid", full_name: "Member" },
  ] });
  mocks.from.mockImplementation(db.from);
});
const post = (payload: Record<string, unknown>) => POST(new NextRequest("https://app.test/api/owner/staff", {
  method: "POST", body: JSON.stringify({ role: "coach", ...payload }),
}));
it.each([
  { existingUserId: "owner" },
  { email: " OWNER@example.invalid ", fullName: "Replacement" },
])("rejects owner changes through either ID or email: %j", async payload => {
  const before = structuredClone(db.tables.app_users);
  expect((await post(payload)).status).toBe(400);
  expect(db.tables.app_users).toEqual(before);
});
it("promotes an existing member and saves rates", async () => {
  expect((await post({ existingUserId: "member", coachingPayrate: 30 })).status).toBe(200);
  expect(db.tables.app_users[1]).toMatchObject({ role: "coach", coaching_payrate: 30 });
});
it("creates new staff", async () => {
  expect((await post({ email: "new@example.invalid", fullName: "New staff", role: "admin" })).status).toBe(200);
  expect(db.tables.app_users[2]).toMatchObject({ role: "admin", full_name: "New staff" });
});
it("does not overwrite a promotion to owner that happens after the lookup", async () => {
  db.beforeUpdate(() => { db.tables.app_users[1].role = "owner"; });
  expect((await post({ existingUserId: "member" })).status).toBe(409);
  expect(db.tables.app_users[1].role).toBe("owner");
});
it("rejects unauthorized callers before accessing the database", async () => {
  mocks.auth.mockResolvedValue({ role: "member", userId: null, error: "Unauthorized" });
  expect((await post({ existingUserId: "owner" })).status).toBe(401);
  expect(mocks.from).not.toHaveBeenCalled();
});
it("fails closed when looking up an existing email fails", async () => {
  db.fail("offline");
  expect((await post({ email: "owner@example.invalid" })).status).toBe(500);
  expect(db.tables.app_users).toHaveLength(2);
});
