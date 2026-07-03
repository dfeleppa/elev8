import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.fn();

vi.mock("@/lib/member", () => ({
  requireUserContext: requireUserContextMock,

  requireRequestUserContext: requireUserContextMock,
}));

describe("foods image-scan POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("USDA_API_KEY", "test-usda-key");
    vi.stubEnv("ENABLE_FOOD_IMAGE_SCAN", "true");
    vi.unstubAllGlobals();
  });

  it("returns 401 when unauthenticated", async () => {
    requireUserContextMock.mockResolvedValue({ error: "Unauthorized.", userId: null });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/foods/image-scan", {
        method: "POST",
        body: new FormData(),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 when image is missing", async () => {
    requireUserContextMock.mockResolvedValue({ error: null, userId: "member-1" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/foods/image-scan", {
        method: "POST",
        body: new FormData(),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/required/i);
  });

  it("returns isLabel when classification detects a nutrition label", async () => {
    requireUserContextMock.mockResolvedValue({ error: null, userId: "member-1" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("api.openai.com")) {
          return new Response(
            JSON.stringify({
              output_text: JSON.stringify({
                foodName: null,
                confidence: "high",
                notes: null,
                isLabel: true,
              }),
            }),
            { status: 200 },
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const form = new FormData();
    form.append(
      "image",
      new File([new Uint8Array([1, 2, 3])], "label.jpg", { type: "image/jpeg" }),
    );

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/foods/image-scan", {
        method: "POST",
        body: form,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.isLabel).toBe(true);
    expect(payload.result).toBeNull();
  });

  it("returns USDA-backed nutrition for identified food items", async () => {
    requireUserContextMock.mockResolvedValue({ error: null, userId: "member-1" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("api.openai.com")) {
          return new Response(
            JSON.stringify({
              output_text: JSON.stringify({
                foodName: "banana",
                confidence: "high",
                notes: null,
                isLabel: false,
              }),
            }),
            { status: 200 },
          );
        }

        if (url.includes("api.nal.usda.gov")) {
          return new Response(
            JSON.stringify({
              foods: [
                {
                  description: "Bananas, raw",
                  servingSize: 118,
                  servingSizeUnit: "g",
                  foodNutrients: [
                    { nutrientId: 1008, value: 105 },
                    { nutrientId: 1003, value: 1 },
                    { nutrientId: 1005, value: 27 },
                    { nutrientId: 1004, value: 0 },
                  ],
                },
              ],
            }),
            { status: 200 },
          );
        }

        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const form = new FormData();
    form.append(
      "image",
      new File([new Uint8Array([1, 2, 3])], "banana.jpg", { type: "image/jpeg" }),
    );

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/foods/image-scan", {
        method: "POST",
        body: form,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.isLabel).toBe(false);
    expect(payload.result.source).toBe("usda");
    expect(payload.result.identifiedFoodName).toBe("banana");
    expect(payload.result.name).toBe("Bananas, raw");
    expect(payload.result.calories).toBe(105);
  });
});
