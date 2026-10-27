import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createDatabaseFixture, type FixtureRow } from "@/test/supabase-fixture";
const mocks = vi.hoisted(() => ({ from: vi.fn(), recommend: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/nutrition-check-in", () => ({
  METABOLISM_AUTO_UPDATE_DELTA_KCAL: 100, NEXT_CHECK_IN_DAYS: 7,
  todayIsoDate: () => "2026-10-27", datePlusDays: () => "2026-11-03",
  buildCheckInRecommendation: mocks.recommend,
}));
import { GET } from "./route";
let db: ReturnType<typeof createDatabaseFixture>;
const plan = (id: string, member_id: string, effective_date: string, next_check_in_date: string | null) =>
  ({ id, member_id, effective_date, next_check_in_date });
const recommendation = (latestPlan: FixtureRow) => ({ latestPlan, recommendation: { status: "hold" }, metabolismEstimate: { status: "insufficient_data" } });
function seed(plans: FixtureRow[]) {
  db = createDatabaseFixture({ coach_nutrition_plans: plans, nutrition_check_ins: [] });
  mocks.from.mockImplementation(db.from);
  mocks.recommend.mockImplementation(async (memberId: string) => recommendation(
    [...db.tables.coach_nutrition_plans].filter(row => row.member_id === memberId)
      .sort((a, b) => String(b.effective_date).localeCompare(String(a.effective_date)))[0],
  ));
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("CRON_SECRET", "fixture-secret");
});
afterEach(() => vi.unstubAllEnvs());
const run = () => GET(new Request("https://app.test/api/cron/nutrition-check-in", { headers: { authorization: "Bearer fixture-secret" } }));
it.each(["2026-11-01", null])("ignores overdue history when the current plan is not due (%s)", async nextDue => {
  seed([plan("old", "member", "2026-10-01", "2026-10-20"), plan("current", "member", "2026-10-25", nextDue)]);
  const response = await run();
  expect((await response.json()).processed).toBe(0);
  expect(mocks.recommend).not.toHaveBeenCalled();
  expect(db.tables.nutrition_check_ins).toEqual([]);
});
it("queues a due current plan and advances only that plan", async () => {
  seed([plan("old", "member", "2026-10-01", "2026-10-20"), plan("current", "member", "2026-10-25", "2026-10-27")]);
  const result = await (await run()).json();
  expect(result.results).toMatchObject([{ memberId: "member", status: "queued" }]);
  expect(db.tables.nutrition_check_ins).toMatchObject([{ plan_id: "current" }]);
  expect(db.tables.coach_nutrition_plans[0].next_check_in_date).toBe("2026-10-20");
  expect(db.tables.coach_nutrition_plans[1].next_check_in_date).toBe("2026-11-03");
  expect((await (await run()).json()).processed).toBe(0);
});
it("checks members beyond the first history page without reselecting old plans", async () => {
  seed([
    plan("current", "member", "2026-10-26", "2026-11-01"),
    ...Array.from({ length: 400 }, (_, i) => plan(`old-${i}`, "member", "2026-10-20", "2026-10-21")),
    plan("other-current", "other", "2026-10-01", "2026-10-25"),
  ]);
  expect((await (await run()).json()).results).toMatchObject([{ memberId: "other", status: "queued" }]);
  expect(mocks.recommend).toHaveBeenCalledTimes(1);
});
it("keeps the 100-member batch limit", async () => {
  seed(Array.from({ length: 101 }, (_, i) => plan(`p-${i}`, `m-${i}`, "2026-10-20", "2026-10-27")));
  expect((await (await run()).json()).processed).toBe(100);
  expect(db.tables.nutrition_check_ins).toHaveLength(100);
});
it("leaves pending check-ins untouched if the plan changes during recommendation generation", async () => {
  seed([plan("old", "member", "2026-10-20", "2026-10-27")]);
  db.tables.nutrition_check_ins.push({ id: "pending", member_id: "member", status: "pending" });
  mocks.recommend.mockResolvedValue(recommendation(plan("new", "member", "2026-10-27", "2026-11-03")));
  expect((await (await run()).json()).results[0].status).toBe("skipped");
  expect(db.tables.nutrition_check_ins).toEqual([{ id: "pending", member_id: "member", status: "pending" }]);
  expect(db.tables.coach_nutrition_plans[0].next_check_in_date).toBe("2026-10-27");
});
it("rejects requests without the cron secret before accessing plans", async () => {
  expect((await GET(new Request("https://app.test/api/cron/nutrition-check-in"))).status).toBe(401);
  expect(mocks.from).not.toHaveBeenCalled();
});
