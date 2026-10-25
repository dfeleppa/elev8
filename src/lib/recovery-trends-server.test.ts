import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ from: vi.fn(), garmin: vi.fn() }));
vi.mock("./supabase-admin", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("./garmin-personal", () => ({ readGarmin: mocks.garmin }));
import { collectTrendPages, loadRecoveryTrends } from "./recovery-trends-server";

beforeEach(() => vi.resetAllMocks());
it("reads all pages and rejects a truncated source", async () => {
  const load = vi.fn().mockResolvedValueOnce([{ id: 1 }, { id: 2 }]).mockResolvedValueOnce([{ id: 3 }]);
  expect(await collectTrendPages(load, 2)).toHaveLength(3);
  expect(load.mock.calls).toEqual([[0], [2]]);
  await expect(collectTrendPages(async () => [{ id: 1 }], 1, 2)).rejects.toThrow("Too many");
});
it("scopes every history query to the member and preserves partial source failures", async () => {
  const eq = vi.fn();
  mocks.from.mockImplementation(() => {
    const q = { select: vi.fn(() => q), eq: vi.fn((...args) => { eq(...args); return q; }), gte: vi.fn(() => q), lte: vi.fn(() => q), order: vi.fn(() => q), range: vi.fn(async () => ({ data: [], error: null })) };
    return q;
  });
  mocks.garmin.mockImplementation(async resource => { if (resource === "sleep") throw new Error("secret upstream detail"); return []; });
  const data = await loadRecoveryTrends("member-1", "2026-10-25", "2026-10-25");
  expect(eq.mock.calls.filter(args => args[0] === "member_id")).toEqual(Array(3).fill(["member_id", "member-1"]));
  expect(eq).toHaveBeenCalledWith("nutrition_days.member_id", "member-1");
  expect(data.warnings).toEqual(["sleep unavailable. Refresh to retry; missing data is not zero."]);
  expect(data.days[0]).toMatchObject({ sleepHours: null, activityMinutes: 0 });
});
