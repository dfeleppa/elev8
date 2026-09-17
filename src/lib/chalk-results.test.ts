import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import {
  CHALK_HEADERS,
  MAX_CHALK_BYTES,
  previewChalkResults,
} from "./chalk-results";
import { readChalkFile } from "./chalk-results-file";

const csv = (...rows: string[]) =>
  [CHALK_HEADERS.join(","), ...rows].join("\n");
const units = { load: "lb", distance: "m" } as const;
describe("Chalk It Pro import contract", () => {
  it("normalizes every score style without inventing Rx or units", () => {
    const result = previewChalkResults(
      csv(
        "Squat,1/2/2026,Load,3,Back Squats,315,",
        "Metcon,1/2/2026,Time,,,12:58,",
        "Test,1/2/2026,Reps,,,0,",
        "Rounds,1/2/2026,Rounds,,,8 + 30,",
        "Row,1/2/2026,Distance,,,1000,",
      ),
    );
    expect(result.rows[0].score).toMatchObject({
      load: 315,
      reps: 3,
      unit: null,
    });
    expect(result.rows[0].rx).toBeNull();
    expect(result.rows[1].score.seconds).toBe(778);
    expect(result.rows[2].score.reps).toBe(0);
    expect(result.rows[3].score).toMatchObject({ rounds: 8, extraReps: 30 });
    expect(result.rows[4].issues).toContain("Choose distance unit");
  });
  it("preserves quoted commas, escaped quotes, Unicode, multiline notes, and unknown fields", () => {
    const result = previewChalkResults(
      "\uFEFF" +
        CHALK_HEADERS.join(",") +
        ',Extra\r\n"“René” ""test"", day",1/2/2026,Time,,,1:02," first\r\nsecond ",original',
    );
    expect(result.rows[0].raw).toMatchObject({
      Title: '“René” "test", day',
      Notes: " first\r\nsecond ",
      Extra: "original",
    });
  });
  it("flags impossible, suspicious, and future dates without correcting them", () => {
    const result = previewChalkResults(
      csv(
        "Test,2/30/2026,Reps,,,1,",
        "Test,1/2/1990,Reps,,,1,",
        "Test,1/2/2099,Reps,,,1,",
      ),
      units,
      "2026-09-17",
    );
    expect(result.summary.suspiciousDates).toBe(3);
    expect(result.rows[0].date).toBeNull();
    expect(result.rows[1].date).toBe("1990-01-02");
  });
  it("keeps habits, measurements, and aggregate scores distinct", () => {
    const result = previewChalkResults(
      csv(
        "LYFE35 Daily,1/1/1990,Reps,,,5,",
        "Body Weight,1/2/2026,Load,1,Body Weight,193,",
        "CrossFit Total,1/2/2026,Reps,,,1000,",
      ),
      units,
    );
    expect(result.rows.map((row) => row.category)).toEqual([
      "habit",
      "body_measurement",
      "aggregate",
    ]);
  });
  it("keeps duplicate-looking records and flags the later occurrence", () => {
    const row = "Squat,1/2/2026,Load,3,Back Squats,315,";
    const result = previewChalkResults(csv(row, row), units);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[1].issues).toContain("Possible duplicate of record 2");
  });
  it("rejects malformed structure rather than shifting data into wrong columns", () => {
    for (const text of [
      "Title,Date\nTest,1/1/2026",
      csv('"unfinished'),
      csv("Too,few,columns"),
      csv('"Title"garbage,1/1/2026,Reps,,,1,'),
    ]) {
      expect(() => previewChalkResults(text)).toThrow();
    }
  });
  it("does not coerce absent reps, malformed scores, or unsupported styles", () => {
    const result = previewChalkResults(
      csv(
        "Squat,1/2/2026,Load,,Squat,200,",
        "Run,1/2/2026,Time,,,1:99,",
        "Test,1/2/2026,Points,,,50,",
      ),
      units,
    );
    expect(result.rows[0].score.reps).toBeNull();
    expect(result.rows.every((row) => row.issues.length > 0)).toBe(true);
  });
  it("accepts CSV and zipped results.csv and refuses missing/ambiguous archives", () => {
    const text = csv("Test,1/2/2026,Reps,,,10,");
    expect(readChalkFile("results.csv", strToU8(text))).toBe(text);
    expect(
      readChalkFile("results.zip", zipSync({ "results.csv": strToU8(text) })),
    ).toBe(text);
    expect(() =>
      readChalkFile("results.zip", zipSync({ "other.csv": strToU8(text) })),
    ).toThrow("one results.csv");
    expect(() =>
      readChalkFile(
        "results.zip",
        zipSync({
          "results.csv": strToU8(text),
          "nested/results.csv": strToU8(text),
        }),
      ),
    ).toThrow("multiple");
  });
  it("enforces compressed and expanded limits", () => {
    expect(() =>
      readChalkFile("results.csv", new Uint8Array(MAX_CHALK_BYTES + 1)),
    ).toThrow("5 MB");
    const archive = zipSync({
      "results.csv": new Uint8Array(MAX_CHALK_BYTES + 1),
    });
    expect(() => readChalkFile("results.zip", archive)).toThrow("5 MB");
  });
});
