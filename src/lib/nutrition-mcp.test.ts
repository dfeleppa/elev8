import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/nutrition-command", () => ({
  executeAddFood: vi.fn(),
  executeCopyMeal: vi.fn(),
  interpretNutritionCommand: vi.fn(),
  isValidDate: vi.fn(),
  resolveFoodCandidate: vi.fn(),
  searchFoodCandidates: vi.fn(),
}));
vi.mock("@/lib/nutrition-schema", () => ({ runNutritionQueryWithFallbacks: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: {} }));

import { createNutritionMcpServer } from "./nutrition-mcp";

const closeCallbacks: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closeCallbacks.splice(0).map((close) => close()));
});

async function connectClient(canWrite: boolean) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createNutritionMcpServer("member-1", {
    canWrite,
    resourceMetadataUrl:
      "https://app.daneff.com/.well-known/oauth-protected-resource/api/mcp/nutrition",
  });
  const client = new Client({ name: "nutrition-mcp-test", version: "1.0.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  closeCallbacks.push(async () => {
    await client.close();
    await server.close();
  });

  return client;
}

describe("nutrition MCP contract", () => {
  it("advertises focused tools with OAuth schemes and complete safety annotations", async () => {
    const client = await connectClient(true);
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      "get_daily_nutrition",
      "search_nutrition_foods",
      "manage_nutrition",
    ]);

    const daily = tools.find((tool) => tool.name === "get_daily_nutrition");
    const search = tools.find((tool) => tool.name === "search_nutrition_foods");
    const manage = tools.find((tool) => tool.name === "manage_nutrition");

    expect(daily?._meta?.securitySchemes).toEqual([{ type: "oauth2", scopes: ["nutrition:read"] }]);
    expect(daily?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    });
    expect(search?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    });
    expect(manage?._meta?.securitySchemes).toEqual([
      { type: "oauth2", scopes: ["nutrition:read", "nutrition:write"] },
    ]);
    expect(manage?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });
  });

  it("returns a reauthorization challenge when the write scope is missing", async () => {
    const client = await connectClient(false);
    const result = await client.callTool({
      name: "manage_nutrition",
      arguments: {
        command: "copy yesterday's dinner to today",
        selectedDate: "2026-08-19",
        mode: "preview",
      },
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.["mcp/www_authenticate"]).toEqual([
      expect.stringContaining("nutrition:write scope is required"),
    ]);
  });
});
