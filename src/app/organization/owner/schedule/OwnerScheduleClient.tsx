"use client";

import { useEffect, useMemo, useState } from "react";

type ScheduleTab = "current" | "future" | "past";
type ScheduleView = "list" | "calendar";

type RecurringClass = {
  id: string;
  name: string;
  class_time: string;
  duration_minutes: number;
  class_days: string[];
  start_date: string;
  end_date: string | null;
};

type ClassDraft = {
  name: string;
  time: string;
  durationMinutes: string;
  days: string[];
  startDate: string;
};

const tabs: Array<{ key: ScheduleTab; label: string }> = [
  { key: "current", label: "Current Classes" },
  { key: "future", label: "Future Classes" },
  { key: "past", label: "Past Classes" },
];

const weekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const emptyDraft: ClassDraft = {
  name: "",
  time: "09:00",
  durationMinutes: "60",
  days: ["Mo", "Tu", "We", "Th", "Fr"],
  startDate: toLocalDateKey(new Date()),
};

function formatTime(value: string) {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    return value;
  }

  const hours24 = Number(match[1]);
  const minutes = match[2];
  const suffix = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${suffix}`;
}

function formatDuration(minutes: number) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} minutes`;
}

function toInputDate(value: string | null) {
  if (!value) {
    return "";
  }
  return value.slice(0, 10);
}

function toUiDate(value: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function classifyClassByDate(row: RecurringClass, todayKey: string): ScheduleTab {
  if (row.start_date > todayKey) {
    return "future";
  }

  if (row.end_date && row.end_date < todayKey) {
    return "past";
  }

  return "current";
}

function iconButton(label: string) {
  return (
    <button
      type="button"
      aria-label={label}
      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
    >
      {label}
    </button>
  );
}

export default function OwnerScheduleClient() {
  const [activeTab, setActiveTab] = useState<ScheduleTab>("current");
  const [view, setView] = useState<ScheduleView>("list");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<RecurringClass[]>([]);
  const [organizationId, setOrganizationId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<ClassDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ClassDraft>(emptyDraft);

  const loadClasses = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/owner/schedule/classes", { cache: "no-store" });
      const payload = (await response.json()) as { classes?: RecurringClass[]; organizationId?: string; error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to load classes.");
        return;
      }
      setRows(payload.classes ?? []);
      setOrganizationId(payload.organizationId ?? "");
    } catch {
      setError("Failed to load classes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const setDraft = (setter: (updater: ClassDraft) => void, key: keyof ClassDraft, value: string) => {
    setter({ ...((setter === setCreateDraft ? createDraft : editDraft)), [key]: value });
  };

  const toggleDraftDay = (
    current: ClassDraft,
    setter: (next: ClassDraft) => void,
    day: string
  ) => {
    const exists = current.days.includes(day);
    const days = exists ? current.days.filter((entry) => entry !== day) : [...current.days, day];
    setter({ ...current, days });
  };

  const submitCreate = async () => {
    if (!createDraft.name.trim()) {
      setError("Class name is required.");
      return;
    }
    if (!createDraft.time) {
      setError("Time is required.");
      return;
    }
    if (!createDraft.startDate) {
      setError("Start date is required.");
      return;
    }
    if (createDraft.days.length === 0) {
      setError("Select at least one day.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/owner/schedule/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name: createDraft.name,
          time: createDraft.time,
          durationMinutes: Number(createDraft.durationMinutes),
          days: createDraft.days,
          startDate: createDraft.startDate,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to create class.");
        return;
      }

      setMessage("Class created.");
      setCreateDraft(emptyDraft);
      setCreateOpen(false);
      await loadClasses();
    } catch {
      setError("Failed to create class.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: RecurringClass) => {
    setEditingId(row.id);
    setEditDraft({
      name: row.name,
      time: row.class_time.slice(0, 5),
      durationMinutes: String(row.duration_minutes),
      days: row.class_days,
      startDate: toInputDate(row.start_date),
    });
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/owner/schedule/classes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name: editDraft.name,
          time: editDraft.time,
          durationMinutes: Number(editDraft.durationMinutes),
          days: editDraft.days,
          startDate: editDraft.startDate,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to save class.");
        return;
      }

      setMessage("Class updated.");
      setEditingId(null);
      await loadClasses();
    } catch {
      setError("Failed to save class.");
    } finally {
      setSaving(false);
    }
  };

  const deleteClass = async (id: string) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/owner/schedule/classes/${id}?organizationId=${encodeURIComponent(organizationId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to delete class.");
        return;
      }

      setMessage("Class deleted.");
      await loadClasses();
    } catch {
      setError("Failed to delete class.");
    } finally {
      setSaving(false);
    }
  };

  const copyClass = async (row: RecurringClass) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/owner/schedule/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name: `${row.name} (Copy)`,
          time: row.class_time.slice(0, 5),
          durationMinutes: row.duration_minutes,
          days: row.class_days,
          startDate: row.start_date,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to copy class.");
        return;
      }

      setMessage("Class copied.");
      await loadClasses();
    } catch {
      setError("Failed to copy class.");
    } finally {
      setSaving(false);
    }
  };

  const filteredRows = useMemo(() => {
    const today = toLocalDateKey(new Date());
    const needle = query.trim().toLowerCase();

    return rows
      .filter((row) => classifyClassByDate(row, today) === activeTab)
      .filter((row) => {
        if (!needle) {
          return true;
        }
        const haystack = `${row.name} ${formatTime(row.class_time)} ${formatDuration(row.duration_minutes)} ${row.class_days.join(" ")} ${row.start_date}`.toLowerCase();
        return haystack.includes(needle);
      });
  }, [rows, activeTab, query]);

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-slate-100">Schedule</h1>
        <p className="mt-3 text-sm text-slate-200">
          Class setup and recurring schedule management.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div>
      ) : null}

      <section className="glass-panel overflow-hidden rounded-[28px] border border-white/10">
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 px-6 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/90">
            Class Setup - Recurring
          </p>
          <button
            type="button"
            className="rounded-lg border border-white/30 bg-black/20 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black/30"
          >
            Settings
          </button>
        </div>

        <div className="space-y-5 px-4 py-5 md:px-6 md:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCreateOpen((current) => !current)}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              {createOpen ? "Close" : "+ Create Recurring Class"}
            </button>

            <div className="inline-flex rounded-xl border border-white/10 bg-slate-900/40 p-1">
              <button
                type="button"
                onClick={() => setView("list")}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  view === "list" ? "bg-white/15 text-slate-100" : "text-slate-300 hover:text-slate-100"
                }`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setView("calendar")}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  view === "calendar" ? "bg-white/15 text-slate-100" : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Calendar
              </button>
            </div>
          </div>

          {createOpen ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-100">Class Name</span>
                  <input
                    value={createDraft.name}
                    onChange={(event) => setDraft(setCreateDraft, "name", event.target.value)}
                    placeholder="Class name"
                    className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-300 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-100">Time</span>
                  <input
                    type="time"
                    value={createDraft.time}
                    onChange={(event) => setDraft(setCreateDraft, "time", event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-300 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-100">Duration (Minutes)</span>
                  <input
                    type="number"
                    min="1"
                    value={createDraft.durationMinutes}
                    onChange={(event) => setDraft(setCreateDraft, "durationMinutes", event.target.value)}
                    placeholder="Duration minutes"
                    className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-300 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-100">Start Date</span>
                  <input
                    type="date"
                    value={createDraft.startDate}
                    onChange={(event) => setDraft(setCreateDraft, "startDate", event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-300 focus:outline-none"
                  />
                </label>
                <div className="space-y-1">
                  <span className="text-sm font-medium text-slate-100">Days</span>
                  <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/60 px-2 py-2">
                    {weekDays.map((day) => {
                      const active = createDraft.days.includes(day);
                      return (
                        <button
                          key={`create-${day}`}
                          type="button"
                          onClick={() => toggleDraftDay(createDraft, setCreateDraft, day)}
                          className={`rounded-full px-2 py-1 text-xs transition ${
                            active ? "bg-emerald-300/20 text-emerald-200" : "bg-white/5 text-slate-300 hover:bg-white/10"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={submitCreate}
                  disabled={saving}
                  className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-slate-500"
                >
                  {saving ? "Saving..." : "Create Class"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-t-lg px-3 py-2 text-sm transition ${
                  activeTab === tab.key
                    ? "border-b-2 border-emerald-300 text-emerald-200"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {view === "calendar" ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/30 px-4 py-8 text-center text-sm text-slate-400">
              Calendar view is next. List view is active and ready.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {iconButton("Columns")}
                  {iconButton("Filters")}
                  {iconButton("Export")}
                </div>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search..."
                  className="w-full max-w-xs rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-300 focus:outline-none"
                />
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead className="bg-slate-900/70 text-slate-300">
                    <tr>
                      <th className="px-3 py-3 text-left font-medium">Name</th>
                      <th className="px-3 py-3 text-left font-medium">Time</th>
                      <th className="px-3 py-3 text-left font-medium">Duration</th>
                      <th className="px-3 py-3 text-left font-medium">Days</th>
                      <th className="px-3 py-3 text-left font-medium">Start</th>
                      <th className="px-3 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.id} className="border-t border-white/10 bg-white/[0.02] text-slate-200">
                        <td className="px-3 py-3">
                          {editingId === row.id ? (
                            <input
                              value={editDraft.name}
                              onChange={(event) => setDraft(setEditDraft, "name", event.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-100 focus:border-emerald-300 focus:outline-none"
                            />
                          ) : (
                            row.name
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {editingId === row.id ? (
                            <input
                              type="time"
                              value={editDraft.time}
                              onChange={(event) => setDraft(setEditDraft, "time", event.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-100 focus:border-emerald-300 focus:outline-none"
                            />
                          ) : (
                            formatTime(row.class_time)
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {editingId === row.id ? (
                            <input
                              type="number"
                              min="1"
                              value={editDraft.durationMinutes}
                              onChange={(event) => setDraft(setEditDraft, "durationMinutes", event.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-100 focus:border-emerald-300 focus:outline-none"
                            />
                          ) : (
                            formatDuration(row.duration_minutes)
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {editingId === row.id ? (
                            <div className="flex flex-wrap gap-1.5">
                              {weekDays.map((day) => {
                                const active = editDraft.days.includes(day);
                                return (
                                  <button
                                    key={`${row.id}-edit-${day}`}
                                    type="button"
                                    onClick={() => toggleDraftDay(editDraft, setEditDraft, day)}
                                    className={`rounded-full px-2 py-0.5 text-xs transition ${
                                      active ? "bg-emerald-300/20 text-emerald-200" : "bg-white/5 text-slate-300 hover:bg-white/10"
                                    }`}
                                  >
                                    {day}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {row.class_days.map((day) => (
                                <span
                                  key={`${row.id}-${day}`}
                                  className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-xs text-slate-200"
                                >
                                  {day}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {editingId === row.id ? (
                            <input
                              type="date"
                              value={editDraft.startDate}
                              onChange={(event) => setDraft(setEditDraft, "startDate", event.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-100 focus:border-emerald-300 focus:outline-none"
                            />
                          ) : (
                            toUiDate(row.start_date)
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {editingId === row.id ? (
                            <div className="inline-flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => saveEdit(row.id)}
                                disabled={saving}
                                className="rounded-lg border border-emerald-300/40 bg-emerald-400/10 px-2.5 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-400/20"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                disabled={saving}
                                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => startEdit(row)}
                                disabled={saving}
                                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => copyClass(row)}
                                disabled={saving}
                                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                              >
                                Copy
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteClass(row.id)}
                                disabled={saving}
                                className="rounded-lg border border-rose-300/40 bg-rose-400/10 px-2.5 py-1.5 text-xs text-rose-200 transition hover:bg-rose-400/20"
                              >
                                Del
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-right text-xs text-slate-400">{loading ? "Loading..." : `Total Rows: ${filteredRows.length}`}</div>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
