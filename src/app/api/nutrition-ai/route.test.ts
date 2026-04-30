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

describe("nutrition-ai POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "";
  });

  it("returns a search intent from a natural-language food query", async () => {
    requireUserContextMock.mockResolvedValue({ error: null, userId: "member-1" });

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/nutrition-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: "Search for high protein cereal for breakfast",
        selectedDate: "2026-04-30",
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.intent.intent).toBe("search_foods");
    expect(payload.intent.mealType).toBe("breakfast");
    expect(payload.intent.searchQuery).toContain("high protein cereal");
  });

  it("copies a meal from yesterday into the selected day", async () => {
    requireUserContextMock.mockResolvedValue({ error: null, userId: "member-1" });

    let insertedEntries: Array<Record<string, unknown>> | null = null;

    fromMock.mockImplementation((table: string) => {
      if (table === "nutrition_days") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((columnA: string, valueA: string) => ({
              eq: vi.fn((columnB: string, valueB: string) => ({
                maybeSingle: vi.fn(async () => {
                  if (
                    columnA === "member_id" &&
                    valueA === "member-1" &&
                    columnB === "day_date" &&
                    valueB === "2026-04-29"
                  ) {
                    return { data: { id: "source-day" }, error: null };
                  }
                  if (
                    columnA === "member_id" &&
                    valueA === "member-1" &&
                    columnB === "day_date" &&
                    valueB === "2026-04-30"
                  ) {
                    return { data: { id: "target-day" }, error: null };
                  }
                  return { data: null, error: null };
                }),
              })),
            })),
          })),
        };
      }

      if (table === "nutrition_entries") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(async () => ({
                    data: [
                      {
                        entry_name: "Eggs",
                        quantity: 1,
                        calories: 140,
                        protein: 12,
                        carbs: 1,
                        fat: 10,
                        fiber: 0,
                        sugar: 1,
                        saturated_fat: 3,
                      },
                    ],
                    error: null,
                  })),
                })),
              })),
            })),
          })),
          insert: vi.fn((payload: Array<Record<string, unknown>>) => {
            insertedEntries = payload;
            return Promise.resolve({ error: null });
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
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  })),
                })),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/nutrition-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: "Copy my breakfast from yesterday",
        selectedDate: "2026-04-30",
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.intent.intent).toBe("copy_meal");
    expect(payload.result.copiedCount).toBe(1);
    expect(insertedEntries).toMatchObject([
      {
        member_id: "member-1",
        day_id: "target-day",
        meal_type: "breakfast",
        entry_name: "Eggs",
        sugar: 1,
        fiber: 0,
        saturated_fat: 3,
      },
    ]);
  });

  it("adds food from a natural-language logging command", async () => {
    requireUserContextMock.mockResolvedValue({ error: null, userId: "member-1" });

    let insertedEntry: Record<string, unknown> | null = null;

    fromMock.mockImplementation((table: string) => {
      if (table === "nutrition_days") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { id: "target-day" },
                  error: null,
                })),
              })),
            })),
          })),
        };
      }

      if (table === "nutrition_custom_foods") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [
                {
                  name: "Eggs",
                  calories: 70,
                  protein: 6,
                  carbs: 1,
                  fat: 5,
                  fiber: 0,
                  sugar: 1,
                  saturated_fat: 2,
                },
              ],
              error: null,
            })),
          })),
        };
      }

      if (table === "nutrition_entries") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({
                  data: [],
                  error: null,
                })),
              })),
            })),
          })),
          insert: vi.fn((payload: Record<string, unknown>) => {
            insertedEntry = payload;
            return Promise.resolve({ error: null });
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/nutrition-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: "Add 2 eggs to breakfast",
        selectedDate: "2026-04-30",
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.intent.intent).toBe("add_food");
    expect(payload.result.foodName).toBe("Eggs");
    expect(insertedEntry).toMatchObject({
      member_id: "member-1",
      day_id: "target-day",
      meal_type: "breakfast",
      entry_name: "Eggs",
      quantity: 2,
      calories: 70,
      protein: 6,
      carbs: 1,
      fat: 5,
      fiber: 0,
      sugar: 1,
      saturated_fat: 2,
    });
  });
});
