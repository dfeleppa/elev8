/** Versioned, lossless import contract. This module performs no database writes. */
export const CHALK_HEADERS = [
  "Title",
  "Date",
  "Style",
  "RepMax",
  "PrimaryMovement",
  "BestScore",
  "Notes",
] as const;
export const MAX_CHALK_BYTES = 5 * 1024 * 1024;
export type ImportUnits = {
  load: "lb" | "kg" | null;
  distance: "m" | "km" | "mi" | null;
};
export type ChalkRow = {
  rowNumber: number;
  raw: Record<string, string>;
  title: string;
  date: string | null;
  movement: string | null;
  category: "lift" | "workout" | "habit" | "body_measurement" | "aggregate";
  score: {
    type: string;
    text: string;
    load: number | null;
    reps: number | null;
    seconds: number | null;
    rounds: number | null;
    extraReps: number | null;
    distance: number | null;
    unit: string | null;
  };
  rx: null;
  issues: string[];
};

// A character parser preserves embedded newlines, whitespace, and escaped quotes.
function csvRecords(content: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const pushField = () => {
    record.push(field);
    field = "";
    closed = false;
  };
  const pushRecord = () => {
    pushField();
    if (record.some((value) => value !== "")) records.push(record);
    record = [];
    if (records.length > 10001)
      throw new Error("Use an export with at most 10,000 results.");
  };
  const text = content.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += char;
    } else if (char === ",") pushField();
    else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      pushRecord();
    } else if (char === '"' && field === "" && !closed) quoted = true;
    else {
      if (closed || char === '"')
        throw new Error("Malformed CSV quoting. Export the file again.");
      field += char;
    }
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  if (field !== "" || record.length || closed) pushRecord();
  return records;
}

function numeric(text: string, integer = false): number | null {
  if (!/^\d+(?:\.\d+)?$/.test(text.trim())) return null;
  const value = Number(text);
  return Number.isFinite(value) &&
    value <= Number.MAX_SAFE_INTEGER &&
    (!integer || Number.isInteger(value))
    ? value
    : null;
}

function dateValue(text: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, m, d, y] = match;
  const date = new Date(
    `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00Z`,
  );
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() + 1 !== Number(m) ||
    date.getUTCDate() !== Number(d)
  )
    return null;
  return date.toISOString().slice(0, 10);
}

export function previewChalkResults(
  content: string,
  units: ImportUnits = { load: null, distance: null },
  today = new Date().toISOString().slice(0, 10),
) {
  if (new TextEncoder().encode(content).length > MAX_CHALK_BYTES)
    throw new Error("The expanded CSV must be 5 MB or smaller.");
  const [header, ...records] = csvRecords(content);
  if (!header) throw new Error("The CSV is empty.");
  if (
    new Set(header).size !== header.length ||
    !CHALK_HEADERS.every((name) => header.includes(name))
  ) {
    throw new Error(
      `Expected unique columns including: ${CHALK_HEADERS.join(", ")}.`,
    );
  }
  if (!records.length) throw new Error("The CSV has no results.");
  const seen = new Map<string, number>();
  const rows: ChalkRow[] = records.map((fields, index) => {
    if (fields.length !== header.length)
      throw new Error(
        `Record ${index + 2} has ${fields.length} fields; expected ${header.length}.`,
      );
    const raw = Object.fromEntries(
      header.map((name, column) => [name, fields[column]]),
    );
    const title = raw.Title.trim();
    const movement = raw.PrimaryMovement.trim() || null;
    const style = raw.Style.trim().toLowerCase();
    const text = raw.BestScore.trim();
    const date = dateValue(raw.Date);
    const issues: string[] = [];
    if (!title) issues.push("Missing title");
    if (!date) issues.push("Invalid date");
    else if (date.startsWith("1990-")) issues.push("1990 date needs review");
    else if (date > today) issues.push("Future date needs review");
    const category: ChalkRow["category"] = /^LYFE35\b/i.test(title)
      ? "habit"
      : /^body weight$/i.test(movement ?? title)
        ? "body_measurement"
        : /^crossfit total$/i.test(title)
          ? "aggregate"
          : style === "load"
            ? "lift"
            : "workout";
    if (["habit", "body_measurement", "aggregate"].includes(category))
      issues.push("Confirm result category");
    const score: ChalkRow["score"] = {
      type: style,
      text: raw.BestScore,
      load: null,
      reps: null,
      seconds: null,
      rounds: null,
      extraReps: null,
      distance: null,
      unit: null,
    };
    if (style === "load") {
      score.load = numeric(text);
      score.reps = numeric(raw.RepMax, true);
      score.unit = units.load;
      if (score.load === null) issues.push("Invalid load");
      if (category === "lift" && (!score.reps || !movement))
        issues.push("Missing movement or valid rep count");
      if (!units.load) issues.push("Choose weight unit");
    } else if (style === "time") {
      if (/^\d+:[0-5]\d(?::[0-5]\d)?$/.test(text)) {
        const value = text
          .split(":")
          .reduce((total, part) => total * 60 + Number(part), 0);
        if (Number.isSafeInteger(value)) score.seconds = value;
      }
      if (score.seconds === null)
        issues.push("Invalid time (use mm:ss or hh:mm:ss)");
    } else if (style === "rounds") {
      const match = /^(\d+)\s*\+\s*(\d+)$/.exec(text);
      if (match) {
        score.rounds = numeric(match[1], true);
        score.extraReps = numeric(match[2], true);
      }
      if (score.rounds === null || score.extraReps === null)
        issues.push("Invalid rounds + reps");
    } else if (style === "reps") {
      score.reps = numeric(text, true);
      if (score.reps === null) issues.push("Invalid rep count");
    } else if (style === "distance") {
      score.distance = numeric(text);
      score.unit = units.distance;
      if (score.distance === null) issues.push("Invalid distance");
      if (!units.distance) issues.push("Choose distance unit");
    } else issues.push(`Unsupported style: ${raw.Style}`);
    const fingerprint = JSON.stringify(header.map((name) => raw[name]));
    const prior = seen.get(fingerprint);
    if (prior !== undefined)
      issues.push(`Possible duplicate of record ${prior}`);
    else seen.set(fingerprint, index + 2);
    return {
      rowNumber: index + 2,
      raw,
      title,
      date,
      movement,
      category,
      score,
      rx: null,
      issues,
    };
  });
  return {
    version: 1 as const,
    source: "chalk_it_pro" as const,
    units,
    rows,
    summary: {
      total: rows.length,
      review: rows.filter((row) => row.issues.length).length,
      suspiciousDates: rows.filter(
        (row) => !row.date || row.date.startsWith("1990-") || row.date > today,
      ).length,
      byStyle: Object.fromEntries(
        ["load", "time", "reps", "rounds", "distance"].map((style) => [
          style,
          rows.filter((row) => row.score.type === style).length,
        ]),
      ),
    },
  };
}
export type ChalkPreview = ReturnType<typeof previewChalkResults>;
