import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), from: vi.fn(), sharedSignIn: vi.fn(), factory: vi.fn() }));
vi.mock("./supabase-admin", () => ({
  createPasswordAuthClient: mocks.factory,
  supabaseAdmin: { from: mocks.from, auth: { signInWithPassword: mocks.sharedSignIn } },
}));
import { loginWithEmailPassword } from "./supabase-auth-admin";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.factory.mockImplementation(() => ({ auth: { signInWithPassword: mocks.signIn } }));
  mocks.signIn.mockResolvedValue({ data: { user: { id: "auth-subject", email: "test@example.invalid", user_metadata: {} } }, error: null });
});

it("isolates password sessions from the shared service client and returns the verified subject", async () => {
  const first = await loginWithEmailPassword("test@example.invalid", "password");
  await loginWithEmailPassword("second@example.invalid", "password");
  expect(first).toMatchObject({ ok: true, supabaseAuthUid: "auth-subject" });
  expect(mocks.factory).toHaveBeenCalledTimes(2);
  expect(mocks.sharedSignIn).not.toHaveBeenCalled();
  expect(mocks.from).not.toHaveBeenCalled();
});

it("failed password login never looks up, migrates, creates, or links a legacy account", async () => {
  mocks.signIn.mockResolvedValue({ data: { user: null }, error: { message: "Invalid credentials" } });
  expect(await loginWithEmailPassword("owner@example.invalid", "wrong")).toEqual({ ok: false, code: "invalid_credentials" });
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.sharedSignIn).not.toHaveBeenCalled();
});

it("empty credentials do not reach Auth", async () => {
  expect((await loginWithEmailPassword(" ", "password")).ok).toBe(false);
  expect(mocks.factory).not.toHaveBeenCalled();
});
