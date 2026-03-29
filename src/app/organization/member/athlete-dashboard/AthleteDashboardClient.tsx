"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Trash2, Upload, X } from "lucide-react";

import FitnessScoreCard from "../../../../components/health/FitnessScoreCard";
import TodaysWorkoutCard from "../../../../components/health/TodaysWorkoutCard";
import HealthStatsPanel from "../../../../components/health/HealthStatsPanel";
import TotalWorkoutsLoggedCard from "../../../../components/health/TotalWorkoutsLoggedCard";
import NutritionCoachCard from "../../../../components/health/NutritionCoachCard";
import BodyCompTrendChart from "../../../../components/health/BodyCompTrendChart";
import MovementResultsSearch from "../../../../components/health/MovementResultsSearch";
import LogLiftCard from "../../../../components/health/LogLiftCard";
import {
  STAT_GROUP_BY_SLUG,
  STAT_GROUPS,
} from "../../../../components/health/health-stats-config";

type TabId = "dashboard" | "benchmarks" | "workouts" | "body-comp" | "movements";

const TABS: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "benchmarks", label: "Benchmarks" },
  { id: "movements", label: "Movements" },
  { id: "workouts", label: "Log" },
  { id: "body-comp", label: "Body Comp" },
];

type WorkoutResult = {
  id: string;
  day_date: string | null;
  score_type: string | null;
  score_text: string | null;
  total_reps: number | null;
  notes: string | null;
  blockTitle: string | null;
  movementName: string | null;
  blockType: string | null;
};

function resolveStyleLabel(blockType: string | null, scoreType: string | null): string {
  if (blockType === "lift") return "Load";
  return scoreType ?? "—";
}

type WorkoutsResponse = {
  results: WorkoutResult[];
  totalCount: number;
  page: number;
  totalPages: number;
};

type ImportResult = {
  inserted: number;
  totalRows: number;
  failures: number;
  failureSamples: Array<{ line: number; title: string; error: string }>;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function resolveTab(raw: string): TabId {
  const valid: TabId[] = ["dashboard", "benchmarks", "workouts", "body-comp", "movements"];
  return valid.includes(raw as TabId) ? (raw as TabId) : "dashboard";
}

type Props = {
  initialTab: string;
  totalWorkoutsLogged: number;
};

export default function AthleteDashboardClient({ initialTab, totalWorkoutsLogged }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>(resolveTab(initialTab));

  const [workoutsPage, setWorkoutsPage] = useState(1);
  const [workoutsData, setWorkoutsData] = useState<WorkoutsResponse | null>(null);
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [workoutsError, setWorkoutsError] = useState<string | null>(null);

  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [csvRowCount, setCsvRowCount] = useState<number | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<ImportResult | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchWorkouts = useCallback(async (page: number) => {
    setWorkoutsLoading(true);
    setWorkoutsError(null);
    try {
      const res = await fetch(`/api/athlete/workout-results?page=${page}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? "Failed to load workouts.");
      setWorkoutsData(payload as WorkoutsResponse);
    } catch (err) {
      setWorkoutsError(err instanceof Error ? err.message : "Failed to load workouts.");
    } finally {
      setWorkoutsLoading(false);
    }
  }, []);

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/athlete/workout-results/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload?.error ?? "Delete failed.");
      }
      setDeleteConfirmId(null);
      fetchWorkouts(workoutsPage);
    } catch {
      // silently ignore — table will remain unchanged
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (activeTab === "workouts") {
      fetchWorkouts(workoutsPage);
    }
  }, [activeTab, workoutsPage, fetchWorkouts]);

  function switchTab(tab: TabId) {
    setActiveTab(tab);
    router.push(`?tab=${tab}`, { scroll: false });
    if (tab === "workouts" && !workoutsData) {
      fetchWorkouts(1);
    }
  }

  function handlePageChange(next: number) {
    setWorkoutsPage(next);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setCsvFile(file);
    setCsvText(null);
    setCsvRowCount(null);
    setCsvResult(null);
    setCsvError(null);
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const dataRows = Math.max(0, lines.length - 1); // exclude header
    setCsvText(text);
    setCsvRowCount(dataRows);
  }

  async function handleImport() {
    if (!csvText) return;
    setCsvImporting(true);
    setCsvResult(null);
    setCsvError(null);
    try {
      const res = await fetch("/api/programming/results/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, trackName: "My Workouts" }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? "Import failed.");
      setCsvResult(payload as ImportResult);
      // Refresh the workouts table after import
      setWorkoutsPage(1);
      fetchWorkouts(1);
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setCsvImporting(false);
    }
  }

  function closeCsvModal() {
    setCsvModalOpen(false);
    setCsvFile(null);
    setCsvText(null);
    setCsvRowCount(null);
    setCsvResult(null);
    setCsvError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <>
      {/* Sub-header / tab strip — full-width, flush against top bar */}
      <div className="w-full border-b border-white/10 bg-gradient-to-r from-pink-500/10 via-rose-500/5 to-transparent px-5 py-2">
        <div className="flex gap-1 px-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={
                activeTab === tab.id
                  ? "rounded-xl border border-[#ffb1c4]/30 bg-[#ffb1c4]/15 px-4 py-2 text-sm font-semibold text-[#ffb1c4] transition-colors"
                  : "rounded-xl px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <section className="w-full space-y-8 px-5 pt-8">
      {/* Dashboard tab */}
      {activeTab === "dashboard" && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <FitnessScoreCard />
            <TodaysWorkoutCard />
          </div>
          <HealthStatsPanel
            title="Athlete Dashboard"
            description="Track key performance markers across body composition, strength, and conditioning."
            groups={[STAT_GROUP_BY_SLUG["body-comp"], STAT_GROUP_BY_SLUG["strength"], STAT_GROUP_BY_SLUG["conditioning"]]}
          />
          <TotalWorkoutsLoggedCard totalWorkouts={totalWorkoutsLogged} />
        </>
      )}

      {/* Benchmarks tab */}
      {activeTab === "benchmarks" && (
        <div className="space-y-8">
          <HealthStatsPanel
            title="Benchmarks"
            description="Key lift numbers and conditioning benchmarks."
            hideHeader
            onLogLift={() => switchTab("movements")}
            groups={[STAT_GROUP_BY_SLUG["powerlifts"], STAT_GROUP_BY_SLUG["olympic-lifts"], STAT_GROUP_BY_SLUG["strength"], STAT_GROUP_BY_SLUG["gymnastics"], STAT_GROUP_BY_SLUG["conditioning"]]}
          />
        </div>
      )}

      {/* Movements tab */}
      {activeTab === "movements" && (
        <div className="space-y-6">
          <MovementResultsSearch />
          <LogLiftCard />
        </div>
      )}

      {/* Workouts tab */}
      {activeTab === "workouts" && (
        <>
          <TotalWorkoutsLoggedCard totalWorkouts={totalWorkoutsLogged} />

          <section className="glass-panel rounded-3xl border border-white/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Workout History
                </p>
                {workoutsData && (
                  <p className="mt-1 text-sm text-slate-500">
                    {workoutsData.totalCount} total result{workoutsData.totalCount !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCsvModalOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-[#ffb1c4]/40 hover:text-[#ffb1c4]"
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </button>
            </div>

            <div className="app-table-shell mt-5">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Workout</th>
                    <th>Movement</th>
                    <th>Best Score</th>
                    <th>Reps</th>
                    <th>Style</th>
                    <th>Notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {workoutsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="app-table-empty">
                        <td colSpan={7}>
                          <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
                        </td>
                      </tr>
                    ))
                  ) : workoutsError ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-sm text-rose-300">
                        {workoutsError}
                      </td>
                    </tr>
                  ) : workoutsData?.results.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-sm text-slate-500">
                        No workouts logged yet.
                      </td>
                    </tr>
                  ) : (
                    workoutsData?.results.map((row) => (
                      <tr key={row.id}>
                        <td className="text-sm text-slate-300">{formatDate(row.day_date)}</td>
                        <td className="text-sm font-medium text-slate-100">{row.blockTitle ?? "—"}</td>
                        <td className="text-sm text-slate-300">{row.movementName ?? "—"}</td>
                        <td className="text-sm text-slate-300">{row.score_text ?? "—"}</td>
                        <td className="text-sm text-slate-300">{row.total_reps ?? "—"}</td>
                        <td className="text-sm capitalize text-slate-400">{resolveStyleLabel(row.blockType, row.score_type)}</td>
                        <td className="max-w-[200px] truncate text-sm text-slate-400">{row.notes ?? "—"}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(row.id)}
                            className="flex items-center justify-center rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                            aria-label="Delete workout"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {workoutsData && workoutsData.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Page {workoutsData.page} of {workoutsData.totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={workoutsData.page <= 1}
                    onClick={() => handlePageChange(workoutsData.page - 1)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={workoutsData.page >= workoutsData.totalPages}
                    onClick={() => handlePageChange(workoutsData.page + 1)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Body Comp tab */}
      {activeTab === "body-comp" && (
        <div className="space-y-8">
          <BodyCompTrendChart />
          <div className="grid gap-6 lg:grid-cols-2">
            <NutritionCoachCard />
            <HealthStatsPanel
              title="Body Composition"
              description="Baseline composition markers and body measurements."
              groups={[STAT_GROUP_BY_SLUG["body-comp"]]}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60">
          <div className="glass-panel w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-100">Delete workout?</h3>
            <p className="mt-2 text-sm text-slate-400">
              This will permanently remove this result. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleting}
                className="flex-1 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-[0_4px_20px_rgba(244,63,94,0.2)] transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">Import Workouts CSV</h3>
              <button
                type="button"
                onClick={closeCsvModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-300 transition hover:border-white/25 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!csvResult ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">
                  Upload a CSV with these columns:{" "}
                  <span className="font-mono text-xs text-slate-300">
                    Title, Date, Style, RepMax, PrimaryMovement, BestScore, Notes
                  </span>
                </p>
                <p className="text-xs text-slate-500">Date format: MM/DD/YYYY</p>

                <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="cursor-pointer text-sm font-medium text-[#ffb1c4] hover:text-pink-300"
                  >
                    {csvFile ? csvFile.name : "Click to select a .csv file"}
                  </label>
                  {csvRowCount !== null && (
                    <p className="mt-1 text-xs text-slate-400">
                      {csvRowCount} row{csvRowCount !== 1 ? "s" : ""} detected
                    </p>
                  )}
                </div>

                {csvError && <p className="text-sm text-rose-300">{csvError}</p>}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={!csvText || csvImporting}
                    className="flex-1 rounded-xl bg-gradient-to-br from-pink-400 to-pink-600 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-[0_4px_20px_rgba(255,177,196,0.2)] transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {csvImporting ? "Importing..." : "Import"}
                  </button>
                  <button
                    type="button"
                    onClick={closeCsvModal}
                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                  <p className="text-sm font-semibold text-emerald-400">
                    Import complete — {csvResult.inserted} of {csvResult.totalRows} rows imported
                  </p>
                  {csvResult.failures > 0 && (
                    <p className="mt-1 text-xs text-rose-300">
                      {csvResult.failures} row{csvResult.failures !== 1 ? "s" : ""} failed
                    </p>
                  )}
                </div>
                {csvResult.failureSamples.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3">
                    {csvResult.failureSamples.map((f) => (
                      <p key={f.line} className="text-xs text-rose-300">
                        Line {f.line}: {f.title} — {f.error}
                      </p>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={closeCsvModal}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
    </>
  );
}
