import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRequestUserContextMock = vi.fn();
const requireUserContextMock = vi.fn();
const fromMock = vi.fn();

vi.mock("../../../lib/member", () => ({
  requireRequestUserContext: requireRequestUserContextMock,
  requireUserContext: requireUserContextMock,
  hasRole: (required: string, actual: string) => {
    const order: Record<string, number> = { member: 1, coach: 2, admin: 3, owner: 4 };
    return order[actual] >= order[required];
  },
}));

vi.mock("../../../lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

describe("nutrition-days GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("backfills day targets from latest coach plan when day is missing", async () => {
    requireRequestUserContextMock.mockResolvedValue({ error: null, userId: "member-1", role: "member" });

    const createdDay = {
      id: "day-1",
      day_date: "2026-03-17",
      calorie_target: 2400,
      protein_target: 180,
      carbs_target: 250,
      fat_target: 70,
    };

    let upsertPayload: Record<string, unknown> | null = null;

    fromMock.mockImplementation((table: string) => {
      if (table === "nutrition_days") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
          })),
          upsert: vi.fn((payload: Record<string, unknown>) => {
            upsertPayload = payload;
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: createdDay, error: null })),
              })),
            };
          }),
        };
      }

      if (table === "coach_nutrition_plans") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              lte: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: {
                        target_calories: 2400,
                        protein_grams: 180,
                        carbs_grams: 250,
                        fat_grams: 70,
                      },
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === "nutrition_entries") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/nutrition-days?date=2026-03-17");

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.day).toEqual(createdDay);
    expect(payload.entries).toEqual([]);
    expect(upsertPayload).toMatchObject({
      member_id: "member-1",
      day_date: "2026-03-17",
      calorie_target: 2400,
      protein_target: 180,
      carbs_target: 250,
      fat_target: 70,
    });
  });

  it("returns the most recent logged nutrition history with calorie deltas", async () => {
    requireRequestUserContextMock.mockResolvedValue({ error: null, userId: "member-1", role: "member" });

    fromMock.mockImplementation((table: string) => {
      if (table === "nutrition_days") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({
                  data: [
                    { id: "day-2", day_date: "2026-03-18", calorie_target: 2200 },
                    { id: "day-1", day_date: "2026-03-17", calorie_target: 2000 },
                    { id: "day-0", day_date: "2026-03-16", calorie_target: 1900 },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        };
      }

      if (table === "nutrition_entries") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [
                  { day_id: "day-2", calories: 1600, protein: 120, carbs: 140, fat: 50, fiber: 18 },
                  { day_id: "day-2", calories: 300, protein: 20, carbs: 35, fat: 8, fiber: 4 },
                  { day_id: "day-1", calories: 2100, protein: 180, carbs: 220, fat: 70, fiber: 22 },
                ],
                error: null,
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/nutrition-days?recent=14");

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.history).toEqual([
      {
        date: "2026-03-18",
        calories: 1900,
        carbs: 175,
        protein: 140,
        fat: 58,
        fiber: 22,
        calorieTarget: 2200,
        calorieDelta: -300,
      },
      {
        date: "2026-03-17",
        calories: 2100,
        carbs: 220,
        protein: 180,
        fat: 70,
        fiber: 22,
        calorieTarget: 2000,
        calorieDelta: 100,
      },
    ]);
  });

  it("allows a coach to request recent history for a specific member", async () => {
    requireRequestUserContextMock.mockResolvedValue({ error: null, userId: "coach-1", role: "coach" });

    fromMock.mockImplementation((table: string) => {
      if (table === "nutrition_days") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((column: string, value: string) => {
              expect(column).toBe("member_id");
              expect(value).toBe("member-42");
              return {
                order: vi.fn(() => ({
                  limit: vi.fn(async () => ({
                    data: [{ id: "day-1", day_date: "2026-03-17", calorie_target: 2000 }],
                    error: null,
                  })),
                })),
              };
            }),
          })),
        };
      }

      if (table === "nutrition_entries") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [{ day_id: "day-1", calories: 2050, protein: 180, carbs: 210, fat: 68, fiber: 20 }],
                error: null,
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/nutrition-days?recent=14&memberId=member-42");

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.history).toHaveLength(1);
    expect(payload.history[0].calorieDelta).toBe(50);
  });
});
