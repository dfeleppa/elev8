import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), readGarmin: vi.fn(), member: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/garmin-personal", () => ({ readGarmin: mocks.readGarmin, garminMemberId: mocks.member }));
import { registerPerformanceTools, type PerformanceAccess } from "./performance-mcp";
const closers: Array<() => Promise<void>> = [];
beforeEach(() => { vi.clearAllMocks(); mocks.member.mockReturnValue("member-1"); });
afterEach(async () => { await Promise.all(closers.splice(0).map(close => close())); });
async function client(access: PerformanceAccess = { canReadHealth: true, canReadPerformance: true }, memberId = "member-1") {
  const server = new McpServer({ name: "test", version: "1" });
  registerPerformanceTools(server, memberId, { ...access, resourceMetadataUrl: "https://app.test/.well-known/oauth-protected-resource" });
  const pair = InMemoryTransport.createLinkedPair();
  const caller = new Client({ name: "test-client", version: "1" });
  await server.connect(pair[1]); await caller.connect(pair[0]);
  closers.push(async () => { await caller.close(); await server.close(); });
  return caller;
}
function database(data: unknown[], count = data.length, error: unknown = null) {
  const query = { select: vi.fn(), eq: vi.fn(), gte: vi.fn(), lte: vi.fn(), order: vi.fn(), range: vi.fn() };
  for (const method of [query.select, query.eq, query.gte, query.lte, query.order]) method.mockReturnValue(query);
  query.range.mockResolvedValue({ data, count, error }); mocks.from.mockReturnValue(query); return query;
}
const dates = { start_date: "2026-10-01", end_date: "2026-10-24" };

describe("Lyfe health and performance MCP", () => {
  it("advertises read-only tools with explicit scopes and no arbitrary member argument", async () => {
    const c = await client(); const { tools } = await c.listTools(); expect(tools).toHaveLength(5);
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true });
      expect(tool.inputSchema.properties).not.toHaveProperty("memberId");
      expect(tool._meta?.securitySchemes).toEqual([{ type: "oauth2", scopes: ["nutrition:read", expect.stringMatching(/^(health|performance):read$/)] }]);
    }
  });
  it.each(["get_health_history", "get_workout_history", "get_personal_records", "get_garmin_wellness", "get_garmin_activities"])("does not expand old permissions for %s", async name => {
    const c = await client({}); const r = await c.callTool({ name, arguments: name === "get_personal_records" ? {} : dates });
    expect(r.isError).toBe(true); expect(r._meta?.["mcp/www_authenticate"]).toEqual([expect.stringContaining("insufficient_scope")]);
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.readGarmin).not.toHaveBeenCalled();
  });
  it("never exposes the personal Garmin account to another authenticated member", async () => {
    const c = await client({ canReadHealth: true }, "other-member");
    const r = await c.callTool({ name: "get_garmin_wellness", arguments: dates });
    expect(r.isError).toBe(true); expect(mocks.readGarmin).not.toHaveBeenCalled();
  });
  it.each(["get_health_history", "get_workout_history", "get_personal_records"])("scopes %s to the authenticated member and returns pagination", async name => {
    const q = database([{ id: "row-1", value: null }], 150); const c = await client();
    const r = await c.callTool({ name, arguments: { ...(name === "get_personal_records" ? {} : dates), offset: 50, limit: 50 } });
    expect(q.eq).toHaveBeenCalledWith("member_id", "member-1"); expect(q.range).toHaveBeenCalledWith(50, 99);
    expect(r.structuredContent).toMatchObject({ records: [{ id: "row-1", value: null }], total_count: 150, next_offset: 100 });
  });
  it("queries standalone lift logs with the same member boundary", async () => {
    const q = database([]); const c = await client();
    await c.callTool({ name: "get_workout_history", arguments: { ...dates, source: "lift_logs" } });
    expect(mocks.from).toHaveBeenCalledWith("athlete_lift_logs"); expect(q.eq).toHaveBeenCalledWith("member_id", "member-1");
  });
  it("validates calendar and range limits before querying", async () => {
    const c = await client();
    for (const name of ["get_health_history", "get_workout_history", "get_garmin_wellness"]) {
      const r = await c.callTool({ name, arguments: { start_date: "2026-02-30", end_date: "2026-03-01" } }); expect(r.isError).toBe(true);
    }
    const r = await c.callTool({ name: "get_garmin_wellness", arguments: { start_date: "2026-01-01", end_date: "2026-02-01" } }); expect(r.isError).toBe(true);
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.readGarmin).not.toHaveBeenCalled();
  });
  it("reports partial sources and missing days rather than fabricating zeros", async () => {
    mocks.readGarmin.mockImplementation(async (resource: string) => {
      if (resource === "sleep") throw new Error("secret provider details");
      return resource === "daily" ? { data: [{ calendarDate: "2026-10-24", movement: { steps: { value: 0 } } }] } : { hrvSummaries: [] };
    });
    const c = await client(); const r = await c.callTool({ name: "get_garmin_wellness", arguments: { start_date: "2026-10-23", end_date: "2026-10-24" } });
    expect(r.structuredContent).toMatchObject({ coverage: { daily: "retrieved", sleep: "unavailable", hrv: "retrieved" }, days: [ { date: "2026-10-23", steps: null, sleepSeconds: null }, { date: "2026-10-24", steps: 0, hrv: null } ] });
    expect(JSON.stringify(r)).not.toContain("secret provider details");
  });
  it("normalizes activity units, paginates, and excludes location fields", async () => {
    mocks.readGarmin.mockResolvedValue([{ activityId: 123, duration: 300, distance: 1500, startLatitude: 99 }]);
    const c = await client(); const r = await c.callTool({ name: "get_garmin_activities", arguments: { ...dates, limit: 1 } });
    expect(r.structuredContent).toMatchObject({ activities: [{ id: "123", duration_seconds: 300, distance_meters: 1500 }], next_offset: 1 });
    expect(JSON.stringify(r)).not.toContain("startLatitude");
  });
  it("surfaces a database failure as an error, not empty history", async () => {
    database([], 0, { message: "internal credentials" }); const c = await client();
    const r = await c.callTool({ name: "get_health_history", arguments: dates });
    expect(r.isError).toBe(true); expect(JSON.stringify(r)).not.toContain("internal credentials");
  });
});
