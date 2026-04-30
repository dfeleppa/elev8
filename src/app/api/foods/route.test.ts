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

describe("foods POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists extended nutrient fields for custom foods", async () => {
    requireUserContextMock.mockResolvedValue({ error: null, userId: "member-1" });

    let insertedPayload: Record<string, unknown> | null = null;

    fromMock.mockImplementation((table: string) => {
      if (table === "nutrition_custom_foods") {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            insertedPayload = payload;
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: "food-1",
                    name: "Homemade Oats",
                    calories: 320,
                    protein: 14,
                    carbs: 48,
                    fat: 8,
                    sugar: 6,
                    fiber: 9,
                    saturated_fat: 1,
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
    const request = new Request("http://localhost/api/foods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Homemade Oats",
        calories: 320,
        protein: 14,
        carbs: 48,
        fat: 8,
        sugar: 6,
        fiber: 9,
        saturatedFat: 1,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.food.sugar).toBe(6);
    expect(payload.food.fiber).toBe(9);
    expect(payload.food.saturated_fat).toBe(1);
    expect(insertedPayload).toMatchObject({
      member_id: "member-1",
      name: "Homemade Oats",
      sugar: 6,
      fiber: 9,
      saturated_fat: 1,
    });
  });
});
