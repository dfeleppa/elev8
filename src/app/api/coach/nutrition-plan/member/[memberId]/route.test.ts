import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRequestUserContextMock = vi.fn();
const fromMock = vi.fn();

vi.mock("../../../../../../lib/member", async () => {
  const roleOrder = { member: 1, coach: 2, admin: 3, owner: 4 };
  return {
    requireRequestUserContext: requireRequestUserContextMock,
    hasRole: (required: keyof typeof roleOrder, actual: keyof typeof roleOrder) =>
      roleOrder[actual] >= roleOrder[required],
  };
});

vi.mock("../../../../../../lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

function memberQuery() {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: { id: "member-1", full_name: "Alex Bench", email: "alex@example.com" },
          error: null,
        })),
      })),
    })),
  };
}

function plansQuery(selectSpy: ReturnType<typeof vi.fn>) {
  return {
    select: selectSpy.mockReturnValue({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(async () => ({
            data: [
              {
                id: "plan-1",
                goal_type: "lose_weight",
                target_calories: 2200,
                maintenance_calories: 2600,
                formula_used: "katch_mcardle",
                activity_multiplier: 1.55,
                sessions_per_week: 4,
                weekly_rate_percent: 0.5,
                reverse_diet_weekly_kcal: 105,
                plan_payload: { ageYears: 35, weightLbs: 180 },
              },
            ],
            error: null,
          })),
        })),
      })),
    }),
  };
}

function checkInsQuery() {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
    })),
  };
}

function weightsQuery() {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      })),
    })),
  };
}

describe("coach nutrition member detail GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes macro calculation fields in the plan payload", async () => {
    requireRequestUserContextMock.mockResolvedValue({
      error: null,
      userId: "coach-1",
      role: "coach",
    });
    const planSelectSpy = vi.fn();

    fromMock.mockImplementation((table: string) => {
      if (table === "app_users") return memberQuery();
      if (table === "coach_nutrition_plans") return plansQuery(planSelectSpy);
      if (table === "nutrition_check_ins") return checkInsQuery();
      if (table === "health_stat_entries") return weightsQuery();
      throw new Error(`Unexpected table ${table}`);
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/coach/nutrition-plan/member/member-1"), {
      params: Promise.resolve({ memberId: "member-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(planSelectSpy).toHaveBeenCalledWith(expect.stringContaining("formula_used"));
    expect(planSelectSpy).toHaveBeenCalledWith(expect.stringContaining("activity_multiplier"));
    expect(planSelectSpy).toHaveBeenCalledWith(expect.stringContaining("sessions_per_week"));
    expect(planSelectSpy).toHaveBeenCalledWith(expect.stringContaining("plan_payload"));
    expect(payload.plans[0]).toMatchObject({
      formula_used: "katch_mcardle",
      activity_multiplier: 1.55,
      sessions_per_week: 4,
      plan_payload: { ageYears: 35, weightLbs: 180 },
    });
  });
});
