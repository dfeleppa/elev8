import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { z } from "zod";
import { bookingInput, cancellationInput, dateKey, scheduleDay, scheduleOccurrence } from "./contracts";

const fixture = (name: string) => JSON.parse(readFileSync("packages/contracts/fixtures/" + name + ".json", "utf8"));
it.each(["schedule-day", "schedule-empty"])("%s satisfies the shared day contract", name => {
  expect(scheduleDay.safeParse(fixture(name)).success).toBe(true);
});
it.each(["schedule-unlimited", "schedule-booked", "schedule-full", "schedule-closed"])("%s satisfies the occurrence contract", name => {
  expect(scheduleOccurrence.safeParse(fixture(name)).success).toBe(true);
});
it("encodes explicit DST offsets and unavailable transition-hour occurrences", () => {
  const cases = fixture("schedule-dst").cases;
  for (const item of cases) expect(scheduleOccurrence.safeParse(item).success).toBe(true);
  expect(cases[0].startsAt).toBe("2026-03-08T10:00:00Z");
  expect(cases[1].startsAt).toBe("2026-11-01T11:00:00Z");
  expect(cases[2]).toMatchObject({ startsAt: null, canBook: false, availability: "invalid_time" });
});
it("keeps the standalone OpenAPI schemas synchronized with route validation", () => {
  const spec = JSON.parse(readFileSync("packages/contracts/member-schedule.openapi.json", "utf8"));
  for (const [name, schema] of Object.entries({ BookingInput: bookingInput, CancellationInput: cancellationInput, ScheduleDay: scheduleDay, ScheduleOccurrence: scheduleOccurrence })) {
    expect(spec.components.schemas[name]).toEqual(z.toJSONSchema(schema, { target: "draft-2020-12" }));
  }
  expect(Object.keys(spec.paths)).toHaveLength(4);
});
it.each(["0000-01-01","2026-02-29","2026-02-30","2026-13-01","2026-3-01"])("rejects %s before PostgreSQL", value => {
  expect(dateKey.safeParse(value).success).toBe(false);
});
