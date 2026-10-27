import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), register: vi.fn(), ticket: vi.fn(), cookie: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }) }));
vi.mock("./invitation-code", () => ({ INVITATION_TICKET_COOKIE: "invite", verifyInvitationTicket: mocks.ticket }));
vi.mock("./oauth-identity", async importOriginal => ({
  ...await importOriginal<typeof import("./oauth-identity")>(),
  resolveOAuthIdentity: mocks.resolve, registerOAuthMember: mocks.register,
}));
vi.mock("./supabase-admin", () => ({ supabaseAdmin: {} }));
let authOptions: typeof import("./auth").authOptions;
beforeAll(async () => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "google-client"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "test");
  vi.stubEnv("APPLE_CLIENT_ID", "apple-client"); vi.stubEnv("APPLE_CLIENT_SECRET", "test");
  authOptions = (await import("./auth")).authOptions;
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(() => { vi.resetAllMocks(); mocks.resolve.mockResolvedValue(null); mocks.ticket.mockReturnValue(false); });
const input = (provider: string) => ({ user: { id: "subject", email: "owner@example.invalid" },
  account: { provider, providerAccountId: "subject", type: "oauth" }, profile: { sub: "subject" } });

it("registers only Google and Apple providers", () => {
  expect(authOptions.providers.map(provider => provider.id)).toEqual(["google", "apple"]);
});
it.each(["google", "apple"])("accepts %s only with an explicit subject binding", async provider => {
  const callback = authOptions.callbacks!.signIn!;
  expect(await callback(input(provider) as Parameters<typeof callback>[0])).toBe("/login?error=identity_link_required");
  mocks.resolve.mockResolvedValue({ userId: "app-id", role: "owner" });
  expect(await callback(input(provider) as Parameters<typeof callback>[0])).toBe(true);
});
it("rejects a mismatched provider subject before any lookup", async () => {
  const callback = authOptions.callbacks!.signIn!;
  const request = { ...input("google"), profile: { sub: "other-subject" } };
  expect(await callback(request as Parameters<typeof callback>[0])).toBe(false);
  expect(mocks.resolve).not.toHaveBeenCalled();
});
it("requires an invitation before attempting new member registration", async () => {
  const callback = authOptions.callbacks!.signIn!;
  await callback(input("google") as Parameters<typeof callback>[0]);
  expect(mocks.register).not.toHaveBeenCalled();
  mocks.ticket.mockReturnValue(true); mocks.register.mockResolvedValue(true);
  expect(await callback(input("google") as Parameters<typeof callback>[0])).toBe(true);
});
it("rejects credentials authentication", async () => {
  const callback = authOptions.callbacks!.signIn!;
  expect(await callback(input("credentials") as Parameters<typeof callback>[0])).toBe(false);
});
it("clears a prior password subject on OAuth account switch", async () => {
  const callback = authOptions.callbacks!.jwt!;
  const token = await callback({ token: { verifiedAuthUid: "old" }, ...input("google") } as Parameters<typeof callback>[0]);
  expect(token.verifiedAuthUid).toBeUndefined();
  expect(token.oauthIdentity).toMatchObject({ provider: "google", subject: "subject", audience: "google-client" });
});
it("ignores identities supplied through client session updates", async () => {
  const callback = authOptions.callbacks!.jwt!;
  const request = { token: {}, account: null, trigger: "update", session: { oauthIdentity: { subject: "forged" } } };
  expect((await callback(request as Parameters<typeof callback>[0])).oauthIdentity).toBeUndefined();
});
