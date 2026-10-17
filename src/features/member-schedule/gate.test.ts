import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { memberScheduleEnabled } from "./gate";
beforeEach(() => {
  for (const key of ["MEMBER_SCHEDULE_ENABLED","MEMBER_SCHEDULE_ENVIRONMENT","MEMBER_SCHEDULE_STAGING_PROJECT_REF","VERCEL_ENV","SUPABASE_URL","NEXT_PUBLIC_SUPABASE_URL"]) vi.stubEnv(key, "");
});
afterEach(() => vi.unstubAllEnvs());
it("is disabled by default and cannot enable hosted production", () => {
  expect(memberScheduleEnabled()).toBe(false);
  vi.stubEnv("MEMBER_SCHEDULE_ENABLED", "true");
  vi.stubEnv("MEMBER_SCHEDULE_ENVIRONMENT", "test");
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:55321");
  expect(memberScheduleEnabled()).toBe(true);
  vi.stubEnv("VERCEL_ENV", "production");
  expect(memberScheduleEnabled()).toBe(false);
});
it("requires the explicit staging project and excludes the known live database", () => {
  vi.stubEnv("MEMBER_SCHEDULE_ENABLED", "true");
  vi.stubEnv("MEMBER_SCHEDULE_ENVIRONMENT", "staging");
  vi.stubEnv("SUPABASE_URL", "https://scghaxpgsibpffbukyws.supabase.co");
  vi.stubEnv("MEMBER_SCHEDULE_STAGING_PROJECT_REF", "scghaxpgsibpffbukyws");
  expect(memberScheduleEnabled()).toBe(false);
  vi.stubEnv("MEMBER_SCHEDULE_STAGING_PROJECT_REF", "abcdefghijklmnopqrst");
  expect(memberScheduleEnabled()).toBe(false);
  vi.stubEnv("SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
  expect(memberScheduleEnabled()).toBe(true);
  vi.stubEnv("SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co.attacker.invalid");
  expect(memberScheduleEnabled()).toBe(false);
});
it("test mode only permits the dedicated disposable loopback port", () => {
  vi.stubEnv("MEMBER_SCHEDULE_ENABLED", "true");
  vi.stubEnv("MEMBER_SCHEDULE_ENVIRONMENT", "test");
  for (const url of ["https://example.supabase.co", "http://127.0.0.1:54321", "invalid"]) {
    vi.stubEnv("SUPABASE_URL", url);
    expect(memberScheduleEnabled()).toBe(false);
  }
});
