import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  oauth: vi.fn(), web: vi.fn(), claims: vi.fn(), user: vi.fn(), from: vi.fn(), eq: vi.fn(), limit: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next-auth", () => ({ getServerSession: mocks.web }));
vi.mock("./auth", () => ({ authOptions: {} }));
vi.mock("./supabase-admin", () => ({
  supabaseAdmin: { auth: { getClaims: mocks.claims, getUser: mocks.user }, from: mocks.from },
}));
vi.mock("./oauth-identity", () => ({ resolveOAuthIdentity: mocks.oauth }));
import { hasPasswordProof } from "./identity-context";
import { requireUserContext, requireUserContextFromBearer, requireRequestUserContext } from "./member";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.claims.mockResolvedValue({ data: { claims: { sub: "auth-id", amr: [{ method: "password" }] } }, error: null });
  mocks.user.mockResolvedValue({ data: { user: { id: "auth-id", email: "owner@example.invalid", user_metadata: { role: "owner" } } }, error: null });
  mocks.oauth.mockResolvedValue({ userId: "different-app-id", role: "member" });
  mocks.web.mockResolvedValue({ oauthIdentity: { provider: "google", subject: "bound-subject" }, user: { email: "owner@example.invalid" } });
  mocks.limit.mockResolvedValue({ data: [{ id: "different-app-id", role: "member" }], error: null });
  mocks.eq.mockReturnValue({ limit: mocks.limit });
  mocks.from.mockReturnValue({ select: () => ({ eq: mocks.eq }) });
});
const bearer = () => new Request("https://example.invalid/api", { headers: { authorization: "Bearer test" } });

it("legacy web and bearer paths resolve the same canonical ID without writing", async () => {
  expect(await requireUserContext()).toEqual(await requireUserContextFromBearer(bearer()));
  expect(mocks.eq.mock.calls).toEqual([["supabase_auth_uid", "auth-id"]]);
});

it("rejects legacy email sessions and DEV_AUTH_EMAIL instead of creating users", async () => {
  vi.stubEnv("DEV_AUTH_EMAIL", "owner@example.invalid");
  mocks.web.mockResolvedValue({ user: { email: "owner@example.invalid" } });
  try {
    expect((await requireUserContext()).userId).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  } finally { vi.unstubAllEnvs(); }
});

it.each(["", "Basic password", "Bearer", "Bearer two tokens"])("never falls back to a cookie for header %j", async authorization => {
  expect((await requireRequestUserContext(new Request("https://example.invalid", { headers: { authorization } }))).error).toBe("Unauthorized");
  expect(mocks.web).not.toHaveBeenCalled();
});

it.each([[], [{ id: "a", role: null }], [{ id: "a", role: "invalid" }], [{ id: "a", role: "owner" }, { id: "b", role: "member" }]].map(rows => ({ rows })))("rejects invalid link rows $rows", async ({ rows }) => {
  mocks.limit.mockResolvedValue({ data: rows, error: null });
  expect((await requireUserContextFromBearer(bearer())).userId).toBeNull();
});

it("rejects a failed query and a mismatched verified subject", async () => {
  mocks.oauth.mockResolvedValue(null);
  mocks.limit.mockResolvedValue({ data: null, error: { message: "unavailable" } });
  expect((await requireUserContext()).userId).toBeNull();
  mocks.user.mockResolvedValue({ data: { user: { id: "other" } }, error: null });
  expect((await requireUserContextFromBearer(bearer())).userId).toBeNull();
});

it.each([undefined, null, [], [{ method: "oauth" }], [{ method: "recovery" }], [{ method: "token_refresh" }], [{ method: "password" }, { method: "oauth" }], [{ method: "password" }, {}]].map(amr => ({ amr })))("rejects unproven authentication methods $amr", async ({ amr }) => {
  mocks.claims.mockResolvedValue({ data: { claims: { sub: "auth-id", amr, user_metadata: { amr: [{ method: "password" }] } } }, error: null });
  expect((await requireUserContextFromBearer(bearer())).userId).toBeNull();
  expect(mocks.from).not.toHaveBeenCalled();
});

it("accepts password proof across MFA/refresh, but never unverified claims", async () => {
  expect(hasPasswordProof([{ method: "password" }, { method: "totp" }, { method: "token_refresh" }])).toBe(true);
  mocks.claims.mockResolvedValue({ data: { claims: { sub: "auth-id", amr: [{ method: "password" }] } }, error: { message: "invalid signature" } });
  expect((await requireUserContextFromBearer(bearer())).userId).toBeNull();
  expect(mocks.user).not.toHaveBeenCalled();
});

it("rechecks current database role on every request", async () => {
  expect((await requireUserContext()).role).toBe("member");
  mocks.oauth.mockResolvedValue({ userId: "different-app-id", role: "coach" });
  expect((await requireUserContext()).role).toBe("coach");
});

it("rejects old password sessions even when they contain a verified UID", async () => {
  mocks.web.mockResolvedValue({ verifiedAuthUid: "auth-id" });
  expect((await requireUserContext()).userId).toBeNull();
  expect(mocks.oauth).not.toHaveBeenCalled();
});
it("rechecks binding revocation on each web request", async () => {
  expect((await requireUserContext()).userId).toBe("different-app-id");
  mocks.oauth.mockResolvedValue(null);
  expect((await requireUserContext()).userId).toBeNull();
});
