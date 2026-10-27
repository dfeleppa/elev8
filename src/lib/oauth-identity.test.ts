import { beforeEach, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("./supabase-admin", () => ({ supabaseAdmin: { rpc } }));
import { resolveOAuthIdentity, registerOAuthMember } from "./oauth-identity";
const identity = { provider: "google" as const, issuer: "https://accounts.google.com", audience: "client", subject: "subject" };
beforeEach(() => vi.resetAllMocks());
it("resolves only an exact binding and current valid role", async () => {
  rpc.mockResolvedValue({ data: [{ app_user_id: "app", role: "coach" }], error: null });
  expect(await resolveOAuthIdentity(identity)).toEqual({ userId: "app", role: "coach" });
  expect(rpc).toHaveBeenCalledWith("resolve_web_oauth_identity", {
    p_provider: "google", p_issuer: identity.issuer, p_audience: "client", p_subject: "subject",
  });
});
it.each([[], [{ app_user_id: "a", role: "bad" }], [{ app_user_id: "a", role: "owner" }, { app_user_id: "b", role: "owner" }]].map(rows => ({ rows })))("denies invalid bindings $rows", async ({ rows }) => {
  rpc.mockResolvedValue({ data: rows, error: null });
  expect(await resolveOAuthIdentity(identity)).toBeNull();
});
it("fails closed on database failure", async () => {
  rpc.mockRejectedValue(new Error("offline")); expect(await resolveOAuthIdentity(identity)).toBeNull();
});
it("does not register an unverified or missing email", async () => {
  expect(await registerOAuthMember(identity, { email: "owner@example.invalid" })).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
it("registration sends no client-selected account id or role", async () => {
  rpc.mockResolvedValue({ data: true, error: null });
  expect(await registerOAuthMember(identity, { email: "NEW@example.invalid", email_verified: true } as never)).toBe(true);
  expect(rpc.mock.calls[0][1]).toEqual({ p_provider: "google", p_issuer: identity.issuer, p_audience: "client", p_subject: "subject", p_email: "new@example.invalid", p_name: null });
});

