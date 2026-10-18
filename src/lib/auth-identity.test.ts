import { afterAll, beforeAll, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./supabase-auth-admin", () => ({ loginWithEmailPassword: vi.fn() }));
let authOptions: typeof import("./auth").authOptions;
beforeAll(async () => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "test");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test");
  authOptions = (await import("./auth")).authOptions;
});
afterAll(() => vi.unstubAllEnvs());

it.each(["google", "apple"])("keeps %s gated even with a matching owner email", async provider => {
  const callback = authOptions.callbacks!.signIn!;
  const input = { user: { id: "provider-subject", email: "owner@example.invalid" },
    account: { provider, providerAccountId: "provider-subject", type: "oauth" } };
  expect(await callback(input as Parameters<typeof callback>[0])).toBe("/login?error=identity_link_required");
});

it("records the password provider's verified subject", async () => {
  const token = await authOptions.callbacks!.jwt!({
    token: {}, user: { id: "app-or-auth-id", verifiedAuthUid: "verified-subject" },
    account: { provider: "credentials", type: "credentials", providerAccountId: "test" },
  });
  expect(token.verifiedAuthUid).toBe("verified-subject");
});

it("clears a prior subject when switching to an unmapped OAuth login", async () => {
  const token = await authOptions.callbacks!.jwt!({
    token: { verifiedAuthUid: "old-subject" }, user: { id: "google-subject", email: "owner@example.invalid" },
    account: { provider: "google", type: "oauth", providerAccountId: "google-subject" },
  });
  expect(token.verifiedAuthUid).toBeUndefined();
});

it("ignores subjects supplied through client session updates", async () => {
  // NextAuth does not include `user` on the update trigger.
  const callback = authOptions.callbacks!.jwt!;
  const input = { token: { verifiedAuthUid: "original" }, account: null,
    trigger: "update", session: { verifiedAuthUid: "forged", user: { verifiedAuthUid: "forged" } } };
  const token = await callback(input as Parameters<typeof callback>[0]);
  expect(token.verifiedAuthUid).toBe("original");
});
