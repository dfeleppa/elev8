import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.fn();
const fromMock = vi.fn();

vi.mock("../../../lib/member", () => ({
  requireUserContext: requireUserContextMock,
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
    requireUserContextMock.mockResolvedValue({ error: null, userId: "member-1" });

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
});
