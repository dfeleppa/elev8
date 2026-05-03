import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("../../../../lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

describe("agent nutrition-ai POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "";
    process.env.AGENT_NUTRITION_TOKEN = "test-token";
    process.env.AGENT_MEMBER_ID = "member-1";
  });

  it("returns a preview for copy commands", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/agent/nutrition-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AGENT-TOKEN": "test-token",
      },
      body: JSON.stringify({
        command: "Copy my dinner from yesterday to today",
        selectedDate: "2026-05-03",
        mode: "preview",
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.intent.intent).toBe("copy_meal");
    expect(payload.preview.operation).toBe("copy_meal");
    expect(payload.preview.sourceDate).toBe("2026-05-02");
    expect(payload.preview.targetDate).toBe("2026-05-03");
    expect(payload.requiresConfirmation).toBe(true);
  });

  it("searches foods and returns nutrition candidates", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "nutrition_custom_foods") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [
                {
                  name: "Chicken Tenders",
                  calories: 280,
                  protein: 20,
                  carbs: 18,
                  fat: 14,
                  fiber: 1,
                  sugar: 0,
                  saturated_fat: 3,
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
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/agent/nutrition-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AGENT-TOKEN": "test-token",
      },
      body: JSON.stringify({
        command: "search for chicken tenders",
        selectedDate: "2026-05-03",
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.intent.intent).toBe("search_foods");
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]).toMatchObject({
      name: "Chicken Tenders",
      calories: 280,
      protein: 20,
    });
  });

  it("previews and then executes add food with confirmation", async () => {
    let insertedEntry: Record<string, unknown> | null = null;

    fromMock.mockImplementation((table: string) => {
      if (table === "nutrition_custom_foods") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [
                {
                  name: "Example Meal",
                  calories: 420,
                  protein: 35,
                  carbs: 32,
                  fat: 18,
                  fiber: 4,
                  sugar: 3,
                  saturated_fat: 5,
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

      throw new Error(`Unexpected table ${table}`);
    });

    const { POST } = await import("./route");

    const previewRequest = new Request("http://localhost/api/agent/nutrition-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AGENT-TOKEN": "test-token",
      },
      body: JSON.stringify({
        command: "add example meal to dinner",
        selectedDate: "2026-05-03",
        mode: "preview",
      }),
    });

    const previewResponse = await POST(previewRequest);
    const previewPayload = await previewResponse.json();

    expect(previewResponse.status).toBe(200);
    expect(previewPayload.intent.intent).toBe("add_food");
    expect(previewPayload.preview.foodName).toBe("Example Meal");
    expect(previewPayload.requiresConfirmation).toBe(true);

    const executeRequest = new Request("http://localhost/api/agent/nutrition-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AGENT-TOKEN": "test-token",
      },
      body: JSON.stringify({
        command: "add example meal to dinner",
        selectedDate: "2026-05-03",
        mode: "execute",
        candidateName: "Example Meal",
      }),
    });

    const executeResponse = await POST(executeRequest);
    const executePayload = await executeResponse.json();

    expect(executeResponse.status).toBe(200);
    expect(executePayload.result.foodName).toBe("Example Meal");
    expect(insertedEntry).toMatchObject({
      member_id: "member-1",
      day_id: "target-day",
      meal_type: "dinner",
      entry_name: "Example Meal",
      quantity: 1,
      calories: 420,
      protein: 35,
    });
  });
});
