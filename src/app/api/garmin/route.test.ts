import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/member", () => ({ requireUserContext: mocks.identity }));
vi.mock("@/lib/garmin-personal", () => ({ garminMemberId: () => process.env.GARMIN_PERSONAL_MEMBER_ID ?? "", readGarmin: mocks.read }));
import { GET } from "./route";
import { GarminError } from "@/lib/garmin-data";
vi.mock("@/lib/recovery-trends-server", () => ({ loadRecoveryTrends: vi.fn().mockResolvedValue({ days: [], warnings: [] }) }));
import { loadRecoveryTrends } from "@/lib/recovery-trends-server";
const request = () => new Request("http://localhost/api/garmin?resource=daily&start_date=2026-10-24&end_date=2026-10-24&member_id=owner-1");

describe("private Garmin API", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("GARMIN_PERSONAL_MEMBER_ID", "owner-1"); });
  afterEach(() => vi.unstubAllEnvs());
  it("authenticates trends before loading any combined member data", async () => {
    const req = new Request("http://localhost/api/garmin?resource=trends&start_date=2026-10-19&end_date=2026-10-25&member_id=owner-1");
    mocks.identity.mockResolvedValue({ error: "Unauthorized", userId: null });
    expect((await GET(req)).status).toBe(401);
    mocks.identity.mockResolvedValue({ userId: "another-owner", role: "owner" });
    expect((await GET(req)).status).toBe(403);
    expect(loadRecoveryTrends).not.toHaveBeenCalled();
    mocks.identity.mockResolvedValue({ userId: "owner-1", role: "owner" });
    const response = await GET(req);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(loadRecoveryTrends).toHaveBeenCalledWith("owner-1", "2026-10-19", "2026-10-25");
  });
  it("rejects invalid trend dates before loading sources", async () => {
    mocks.identity.mockResolvedValue({ userId: "owner-1", role: "owner" });
    expect((await GET(new Request("http://localhost/api/garmin?resource=trends&start_date=2026-10-01&end_date=2026-10-31"))).status).toBe(400);
    expect(loadRecoveryTrends).not.toHaveBeenCalled();
  });
  it("rejects signed-out users before contacting Garmin", async () => {
    mocks.identity.mockResolvedValue({ error: "Unauthorized", userId: null, role: "member" });
    expect((await GET(request())).status).toBe(401); expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each(["member", "coach", "admin", "owner"])("rejects another %s even with a spoofed query member ID", async role => {
    mocks.identity.mockResolvedValue({ error: null, userId: "someone-else", role });
    expect((await GET(request())).status).toBe(403); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("requires an explicit binding even for owners", async () => {
    vi.stubEnv("GARMIN_PERSONAL_MEMBER_ID", "");
    mocks.identity.mockResolvedValue({ error: null, userId: "owner-1", role: "owner" });
    expect((await GET(request())).status).toBe(503); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("returns private uncached data only to the bound identity", async () => {
    mocks.identity.mockResolvedValue({ error: null, userId: "owner-1", role: "owner" });
    mocks.read.mockResolvedValue({ data: [] });
    const response = await GET(request());
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ source: "Garmin Personal API", data: { data: [] } });
  });
  it("sanitizes unexpected errors and returns safe rate-limit errors", async () => {
    mocks.identity.mockResolvedValue({ error: null, userId: "owner-1", role: "owner" });
    mocks.read.mockRejectedValueOnce(new Error("secret token"));
    expect(await (await GET(request())).json()).toEqual({ error: "Unable to load Garmin data." });
    mocks.read.mockRejectedValueOnce(new GarminError("Try later", 429));
    expect((await GET(request())).status).toBe(429);
  });
});
