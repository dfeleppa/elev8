"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  MAX_CHALK_BYTES,
  previewChalkResults,
  type ImportUnits,
} from "@/lib/chalk-results";
import { readChalkFile } from "@/lib/chalk-results-file";

export default function ResultsPreview() {
  const [source, setSource] = useState<{
    name: string;
    csv: string;
    hash: string;
  } | null>(null);
  const [units, setUnits] = useState<ImportUnits>({
    load: null,
    distance: null,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [page, setPage] = useState(0);
  const sequence = useRef(0);
  const preview = useMemo(
    () => (source ? previewChalkResults(source.csv, units) : null),
    [source, units],
  );
  const matches =
    preview?.rows.filter(
      (row) =>
        (!reviewOnly || row.issues.length > 0) &&
        `${row.title} ${row.movement ?? ""} ${row.raw.Notes}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) ?? [];
  const maxPage = Math.max(0, Math.ceil(matches.length / 25) - 1);
  const currentPage = Math.min(page, maxPage);
  const bests = useMemo(() => {
    const result = new Map<
      string,
      {
        movement: string;
        reps: number;
        load: number;
        date: string;
        unit: string;
      }
    >();
    for (const row of preview?.rows ?? []) {
      if (
        row.category !== "lift" ||
        row.issues.length ||
        !row.movement ||
        !row.date ||
        row.score.load === null ||
        row.score.reps === null ||
        !row.score.unit
      )
        continue;
      const key = JSON.stringify([
        row.movement,
        row.score.reps,
        row.score.unit,
      ]);
      if (!result.has(key) || result.get(key)!.load < row.score.load)
        result.set(key, {
          movement: row.movement,
          reps: row.score.reps,
          load: row.score.load,
          date: row.date,
          unit: row.score.unit,
        });
    }
    return [...result.values()].sort(
      (a, b) => a.movement.localeCompare(b.movement) || a.reps - b.reps,
    );
  }, [preview]);

  async function loadFile(file: File) {
    const request = ++sequence.current;
    setBusy(true);
    setError("");
    setSource(null);
    setPage(0);
    try {
      if (file.size > MAX_CHALK_BYTES)
        throw new Error("Choose a CSV or ZIP no larger than 5 MB.");
      const buffer = await file.arrayBuffer();
      const csv = readChalkFile(file.name, new Uint8Array(buffer));
      previewChalkResults(csv);
      const digest = await crypto.subtle.digest("SHA-256", buffer);
      const hash = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      if (request === sequence.current)
        setSource({ name: file.name, csv, hash });
    } catch (failure) {
      if (request === sequence.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Unable to read this export.",
        );
    } finally {
      if (request === sequence.current) setBusy(false);
    }
  }

  function downloadPreview() {
    if (!preview || !source) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              ...preview,
              filename: source.name,
              fileSha256: source.hash,
              originalCsv: source.csv,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "chalk-results-preview.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const control =
    "rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--text)]";
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-16 sm:p-8">
      <Link href="/member/workout" className="text-sm text-[var(--text-muted)]">
        ← Workouts
      </Link>
      <header>
        <p className="text-sm text-[var(--pink)]">Training history</p>
        <h1 className="mt-2 text-3xl font-semibold">
          Preview Chalk It Pro results
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--text-muted)]">
          Review your lifts, workouts, and records before importing. Your file
          stays in this browser. This preview does not save results to your
          account.
        </p>
      </header>
      <section
        className="glass-panel space-y-4 rounded-2xl p-5"
        aria-label="Export settings"
      >
        <label className="block space-y-2">
          <span className="block font-medium">Chalk It Pro export</span>
          <input
            type="file"
            accept=".csv,.zip,text/csv,application/zip"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadFile(file);
              event.target.value = "";
            }}
            className="block max-w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:px-4 file:py-2"
          />
          <span className="block text-sm text-[var(--text-muted)]">
            CSV or ZIP containing results.csv · up to 5 MB
          </span>
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="space-y-1">
            <span className="block text-sm">Weight unit used in export</span>
            <select
              className={control}
              value={units.load ?? ""}
              onChange={(e) =>
                setUnits({
                  ...units,
                  load: (e.target.value || null) as ImportUnits["load"],
                })
              }
            >
              <option value="">Choose unit</option>
              <option value="lb">Pounds (lb)</option>
              <option value="kg">Kilograms (kg)</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm">Distance unit used in export</span>
            <select
              className={control}
              value={units.distance ?? ""}
              onChange={(e) =>
                setUnits({
                  ...units,
                  distance: (e.target.value || null) as ImportUnits["distance"],
                })
              }
            >
              <option value="">Choose unit</option>
              <option value="m">Meters</option>
              <option value="km">Kilometers</option>
              <option value="mi">Miles</option>
            </select>
          </label>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Units apply to every corresponding row. If the export mixes units,
          leave them unselected for review. Rx/scaled status remains unknown.
        </p>
        {busy && <p role="status">Reading export…</p>}
        {error && (
          <p role="alert" className="text-[var(--pink)]">
            {error}
          </p>
        )}
      </section>
      {preview && (
        <>
          <section
            aria-label="Import summary"
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {[
              ["Results", preview.summary.total],
              ["Need review", preview.summary.review],
              ["Dates to review", preview.summary.suspiciousDates],
              ["Load results", preview.summary.byStyle.load],
            ].map(([label, count]) => (
              <div key={label} className="glass-panel rounded-xl p-4">
                <p className="text-sm text-[var(--text-muted)]">{label}</p>
                <p className="mt-2 text-3xl font-semibold">{count}</p>
              </div>
            ))}
          </section>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                Results in {source?.name}
              </h2>
              <button
                type="button"
                className={control}
                onClick={downloadPreview}
              >
                Download review JSON
              </button>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Dates in 1990 stay unchanged. Habit scores, body weight, and
              aggregate totals are flagged separately. Duplicate checks cover
              this file only.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <input
                aria-label="Search results"
                className={control}
                value={query}
                placeholder="Search movement, title, or notes"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewOnly}
                  onChange={(e) => {
                    setReviewOnly(e.target.checked);
                    setPage(0);
                  }}
                />
                Needs review only
              </label>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Source results and review issues
                </caption>
                <thead className="bg-[var(--panel)]">
                  <tr>
                    {["Date", "Result", "Score", "Category", "Review"].map(
                      (label) => (
                        <th key={label} className="p-3">
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {matches
                    .slice(currentPage * 25, currentPage * 25 + 25)
                    .map((row) => (
                      <tr
                        key={row.rowNumber}
                        className="border-t border-[var(--line)] align-top"
                      >
                        <td className="whitespace-nowrap p-3">
                          {row.raw.Date}
                        </td>
                        <td className="min-w-48 p-3">
                          <p className="font-medium">{row.title}</p>
                          <p className="text-[var(--text-muted)]">
                            {row.movement}
                          </p>
                          {row.raw.Notes && (
                            <p className="mt-1 whitespace-pre-wrap text-[var(--text-muted)]">
                              {row.raw.Notes}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap p-3">
                          {row.score.text} {row.score.unit}
                          {row.score.type === "load" &&
                            row.score.reps !== null && (
                              <span className="block text-[var(--text-muted)]">
                                {row.score.reps} reps
                              </span>
                            )}
                          <span className="block text-xs text-[var(--text-muted)]">
                            {row.raw.Style}
                          </span>
                        </td>
                        <td className="p-3">
                          {row.category.replaceAll("_", " ")}
                        </td>
                        <td className="min-w-48 p-3">
                          {row.issues.length
                            ? row.issues.join(" · ")
                            : "No validation issues"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!matches.length && <p className="p-5">No matching results.</p>}
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <p>
                {matches.length} results · Page {currentPage + 1} of{" "}
                {maxPage + 1}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={control}
                  disabled={!currentPage}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={control}
                  disabled={currentPage >= maxPage}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </section>
          <section className="glass-panel space-y-3 rounded-2xl p-5">
            <h2 className="text-xl font-semibold">
              Best imported loads by rep count
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              From rows without review issues in this export only. These are
              best-effort summaries, not complete set logs or verified all-time
              PRs. Movement names are kept as exported.
            </p>
            {!bests.length ? (
              <p>Choose a weight unit to preview eligible lifts.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {bests.map((best) => (
                  <div
                    key={`${best.movement}-${best.reps}`}
                    className="rounded-xl border border-[var(--line)] p-3"
                  >
                    <p className="font-medium">{best.movement}</p>
                    <p className="mt-1 text-lg">
                      {best.load} {best.unit} × {best.reps}
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {best.date}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
