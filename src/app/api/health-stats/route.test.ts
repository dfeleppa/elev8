import { beforeEach, expect, it, vi } from "vitest";
import { createDatabaseFixture } from "@/test/supabase-fixture";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/member", () => ({ requireRequestUserContext: mocks.auth }));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: mocks.from } }));
import { GET } from "./route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: "member", error: null });
});
const reading = (id: string, value: number, entry_date: string, created_at: string | null, stat_key = "body_weight") =>
  ({ id, value, entry_date, created_at, stat_key, member_id: "member", unit: stat_key === "body_weight" ? "lb" : "%" });
it("returns the most recently saved reading for each stat on the same day", async () => {
  const db = createDatabaseFixture({ health_stat_entries: [
    reading("a", 180, "2026-10-27", "2026-10-27T09:00:00Z"),
    reading("b", 178, "2026-10-27", "2026-10-27T12:00:00Z"),
    reading("c", 20, "2026-10-27", "2026-10-27T09:00:00Z", "body_fat"),
    reading("d", 19, "2026-10-27", "2026-10-27T12:00:00Z", "body_fat"),
    { ...reading("other", 999, "2026-10-27", "2026-10-27T15:00:00Z"), member_id: "other" },
  ], member_movement_prs: [] });
  mocks.from.mockImplementation(db.from);
  const response = await GET(new Request("https://app.test/api/health-stats"));
  expect((await response.json()).stats).toMatchObject({ body_weight: { value: "178" }, body_fat: { value: "19" } });
});
it("prioritizes measurement date over creation time and puts undated creation times last", async () => {
  const db = createDatabaseFixture({ health_stat_entries: [
    reading("a", 180, "2026-10-27", null),
    reading("b", 178, "2026-10-27", "2026-10-27T12:00:00Z"),
    reading("c", 181, "2026-10-26", "2026-10-28T12:00:00Z"),
  ], member_movement_prs: [] });
  mocks.from.mockImplementation(db.from);
  expect((await (await GET(new Request("https://app.test/api/health-stats"))).json()).stats.body_weight.value).toBe("178");
});
it("rejects a failed identity even when an authorization header is present", async () => {
  mocks.auth.mockResolvedValue({ userId: null, error: "Unauthorized" });
  const response = await GET(new Request("https://app.test/api/health-stats", { headers: { authorization: "Bearer expired-token" } }));
  expect(response.status).toBe(401);
  expect(mocks.from).not.toHaveBeenCalled();
});
