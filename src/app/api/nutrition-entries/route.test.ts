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

describe("nutrition-entries POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists extended nutrient fields when creating an entry", async () => {
    requireUserContextMock.mockResolvedValue({ error: null, userId: "member-1" });

    let insertedPayload: Record<string, unknown> | null = null;

    fromMock.mockImplementation((table: string) => {
      if (table === "nutrition_days") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "day-1",
                    calorie_target: 2400,
                    protein_target: 180,
                    carbs_target: 250,
                    fat_target: 70,
                  },
                  error: null,
                })),
              })),
            })),
          })),
        };
      }

      if (table === "nutrition_entries") {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            insertedPayload = payload;
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: "entry-1",
                    meal_type: "lunch",
                    entry_name: "Greek Yogurt",
                    quantity: 1,
                    calories: 140,
                    protein: 18,
                    carbs: 9,
                    fat: 3,
                    sugar: 7,
                    fiber: 0,
                    saturated_fat: 2,
                    created_at: "2026-04-30T12:00:00.000Z",
                  },
                  error: null,
                })),
              })),
            };
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/nutrition-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayDate: "2026-04-30",
        mealType: "lunch",
        name: "Greek Yogurt",
        quantity: 1,
        calories: 140,
        protein: 18,
        carbs: 9,
        fat: 3,
        sugar: 7,
        fiber: 0,
        saturatedFat: 2,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.entry.sugar).toBe(7);
    expect(payload.entry.fiber).toBe(0);
    expect(payload.entry.saturated_fat).toBe(2);
    expect(insertedPayload).toMatchObject({
      member_id: "member-1",
      day_id: "day-1",
      meal_type: "lunch",
      entry_name: "Greek Yogurt",
      sugar: 7,
      fiber: 0,
      saturated_fat: 2,
    });
  });
});
