import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ web: vi.fn(), getClaims: vi.fn(), getUser: vi.fn(), from: vi.fn(), eq: vi.fn(), limit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next-auth", () => ({ getServerSession: mocks.web }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { auth: { getClaims: mocks.getClaims, getUser: mocks.getUser }, from: mocks.from } }));
import { requireClientContext, allowsMutationOrigin } from "./context";

describe("client identity boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "verified-uid", amr: [{ method: "password" }] } }, error: null });
    mocks.web.mockResolvedValue({ verifiedAuthUid: "web-auth-uid", user: { email: "owner@example.com" } });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "verified-uid", email: "owner@example.com" } }, error: null });
    mocks.limit.mockResolvedValue({ data: [{ id: "app-user", role: "admin" }], error: null });
    mocks.eq.mockReturnValue({ limit: mocks.limit });
    mocks.from.mockReturnValue({ select: () => ({ eq: mocks.eq }) });
  });
  it("uses existing web sessions only when no authorization header is supplied", async () => {
    expect((await requireClientContext(new Request("https://app.test"))).userId).toBe("app-user");
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith("supabase_auth_uid", "web-auth-uid");
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("rejects email-only web sessions without looking up or provisioning an account", async () => {
    mocks.web.mockResolvedValue({ user: { email: "owner@example.com" } });
    expect((await requireClientContext(new Request("https://app.test"))).userId).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each(["Basic abc", "Bearer", "Bearer bad token"])("rejects malformed %s without falling back to cookies", async header => {
    expect((await requireClientContext(new Request("https://app.test", { headers: { authorization: header } }))).error).toBe("Unauthorized");
    expect(mocks.web).not.toHaveBeenCalled();
  });
  it("rejects invalid or expired bearer tokens", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    expect((await requireClientContext(new Request("https://app.test", { headers: { authorization: "Bearer expired" } }))).userId).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("resolves the verified UID without an email lookup or linking write", async () => {
    const ctx = await requireClientContext(new Request("https://app.test", { headers: { authorization: "bearer token" } }));
    expect(ctx).toEqual({ userId: "app-user", role: "admin", error: null });
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith("supabase_auth_uid", "verified-uid");
  });
  it.each([
    { rows: [] },
    { rows: [{ id: "a", role: "owner" }, { id: "b", role: "member" }] },
    { rows: [{ id: "a", role: "superuser" }] },
  ])("fails closed on missing, ambiguous, or unknown-role identities", async ({ rows }) => {
    mocks.limit.mockResolvedValue({ data: rows, error: null });
    const ctx = await requireClientContext(new Request("https://app.test", { headers: { authorization: "Bearer token" } }));
    expect(ctx.userId).toBeNull();
  });
  it("requires matching Origin for browser mutations", () => {
    vi.stubEnv("NEXTAUTH_URL", "https://app.test");
    expect(allowsMutationOrigin(new Request("https://app.test/api", { headers: { origin: "https://evil.test" } }))).toBe(false);
    expect(allowsMutationOrigin(new Request("https://app.test/api"))).toBe(false);
    expect(allowsMutationOrigin(new Request("https://app.test/api", { headers: { origin: "https://app.test" } }))).toBe(true);
    vi.unstubAllEnvs();
  });
});
