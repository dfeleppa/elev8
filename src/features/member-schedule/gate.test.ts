import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { memberScheduleEnabled } from "./gate";
beforeEach(() => {
  for (const key of ["MEMBER_SCHEDULE_ENABLED","MEMBER_SCHEDULE_ENVIRONMENT","MEMBER_SCHEDULE_STAGING_PROJECT_REF","MEMBER_SCHEDULE_PRODUCTION_PROJECT_REF","VERCEL_ENV","SUPABASE_URL","NEXT_PUBLIC_SUPABASE_URL"]) vi.stubEnv(key, "");
});
afterEach(() => vi.unstubAllEnvs());
it("is disabled by default and cannot enable hosted production through test settings", () => {
  expect(memberScheduleEnabled()).toBe(false);
  vi.stubEnv("MEMBER_SCHEDULE_ENABLED", "true");
  vi.stubEnv("MEMBER_SCHEDULE_ENVIRONMENT", "test");
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:55321");
  expect(memberScheduleEnabled()).toBe(true);
  vi.stubEnv("VERCEL_ENV", "production");
  expect(memberScheduleEnabled()).toBe(false);
});
it("requires explicit production settings pinned to the authorized main project", () => {
  vi.stubEnv("MEMBER_SCHEDULE_ENABLED", "true");
  vi.stubEnv("MEMBER_SCHEDULE_ENVIRONMENT", "production");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("SUPABASE_URL", "https://scghaxpgsibpffbukyws.supabase.co");
  expect(memberScheduleEnabled()).toBe(false);
  vi.stubEnv("MEMBER_SCHEDULE_PRODUCTION_PROJECT_REF", "scghaxpgsibpffbukyws");
  expect(memberScheduleEnabled()).toBe(true);
  vi.stubEnv("MEMBER_SCHEDULE_ENABLED", "false");
  expect(memberScheduleEnabled()).toBe(false);
});
it.each([
  "https://otherprojectabcdefgh.supabase.co", "https://scghaxpgsibpffbukyws.supabase.co.attacker.invalid",
  "http://scghaxpgsibpffbukyws.supabase.co", "https://scghaxpgsibpffbukyws.supabase.co/path",
  "https://user@scghaxpgsibpffbukyws.supabase.co", "https://scghaxpgsibpffbukyws.supabase.co?override=1",
])("rejects a production target mismatch: %s", url => {
  vi.stubEnv("MEMBER_SCHEDULE_ENABLED", "true");
  vi.stubEnv("MEMBER_SCHEDULE_ENVIRONMENT", "production");
  vi.stubEnv("MEMBER_SCHEDULE_PRODUCTION_PROJECT_REF", "scghaxpgsibpffbukyws");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("SUPABASE_URL", url);
  expect(memberScheduleEnabled()).toBe(false);
});
it("does not enable production settings in a preview deployment or follow a different public URL", () => {
  vi.stubEnv("MEMBER_SCHEDULE_ENABLED", "true");
  vi.stubEnv("MEMBER_SCHEDULE_ENVIRONMENT", "production");
  vi.stubEnv("MEMBER_SCHEDULE_PRODUCTION_PROJECT_REF", "scghaxpgsibpffbukyws");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("SUPABASE_URL", "https://scghaxpgsibpffbukyws.supabase.co");
  expect(memberScheduleEnabled()).toBe(false);
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://scghaxpgsibpffbukyws.supabase.co");
  vi.stubEnv("SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
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
