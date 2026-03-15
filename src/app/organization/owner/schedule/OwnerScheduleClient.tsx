"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ownerButtonDarkGhostClass,
  ownerButtonPrimaryClass,
  ownerIconButtonAccentClass,
  ownerIconButtonDangerClass,
  ownerIconButtonNeutralClass,
  ownerIconButtonSuccessClass,
} from "../../../../components/owner/buttonStyles";
import { ownerToolbarActionButtonClass, ownerToolbarSearchInputDarkClass } from "../../../../components/owner/controlStyles";
import OwnerSectionCard from "../../../../components/owner/OwnerSectionCard";

type ScheduleTab = "current" | "future" | "past";
type ScheduleView = "list" | "calendar";

type RecurringClass = {
  id: string;
  track_id: string | null;
  name: string;
  class_time: string;
  duration_minutes: number;
  class_days: string[];
  start_date: string;
  end_date: string | null;
  default_coach_user_id: string | null;
  size_limit: number;
  reservation_cutoff_hours: number;
  calendar_color: string;
  track?: {
    id: string;
    name: string;
  } | null;
  default_coach?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
};

type ClassDraft = {
  trackId: string;
  name: string;
  time: string;
  durationMinutes: string;
  days: string[];
  startDate: string;
  endDate: string;
  defaultCoachUserId: string;
  sizeLimit: string;
  reservationCutoffHours: string;
  calendarColor: string;
};

type TrackOption = {
  id: string;
  name: string;
};

type CoachOption = {
  userId: string;
  label: string;
};

type ColumnKey = "name" | "time" | "duration" | "days" | "start" | "actions";

const tabs: Array<{ key: ScheduleTab; label: string }> = [
  { key: "current", label: "Current Classes" },
  { key: "future", label: "Future Classes" },
  { key: "past", label: "Past Classes" },
];

const weekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const calendarColorOptions = [
  { value: "#3B82F6", label: "Blue" },
  { value: "#10B981", label: "Green" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#EF4444", label: "Red" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#EC4899", label: "Pink" },
];

const columnDefs: Array<{ key: ColumnKey; label: string }> = [
  { key: "name", label: "Name" },
  { key: "time", label: "Time" },
  { key: "duration", label: "Duration" },
  { key: "days", label: "Days" },
  { key: "start", label: "Start" },
  { key: "actions", label: "Actions" },
];

const defaultVisibleColumns: Record<ColumnKey, boolean> = {
  name: true,
  time: true,
  duration: true,
  days: true,
  start: true,
  actions: true,
};

const emptyDraft: ClassDraft = {
  trackId: "",
  name: "",
  time: "09:00",
  durationMinutes: "60",
  days: ["Mo", "Tu", "We", "Th", "Fr"],
  startDate: toLocalDateKey(new Date()),
  endDate: "",
  defaultCoachUserId: "",
  sizeLimit: "0",
  reservationCutoffHours: "0",
  calendarColor: "#3B82F6",
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

function normalizeDateKey(value: string | null) {
  if (!value) {
    return "";
  }
  return value.slice(0, 10);
}

function classifyClassByDate(row: RecurringClass, todayKey: string): ScheduleTab {
  const startKey = normalizeDateKey(row.start_date);
  const endKey = normalizeDateKey(row.end_date);

  if (startKey > todayKey) {
    return "future";
  }

  if (endKey && endKey < todayKey) {
    return "past";
  }

  return "current";
}

function toCsvCell(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function downloadCsv(fileName: string, csvText: string) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const columnsIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path d="M3 5h6v14H3zM10 5h4v14h-4zM15 5h6v14h-6z" fill="currentColor" />
  </svg>
);

const filtersIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path d="M4 6h16l-6 7v5l-4-2v-3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

const exportIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path d="M12 3v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="m8.5 9.5 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 17h16v4H4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

const editIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M4 20h4l10-10-4-4L4 16z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="m12.5 7.5 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const copyIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <rect x="4" y="4" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const deleteIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M5 7h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M9 7V5h6v2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8 7l1 12h6l1-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

const saveIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M4 5h13l3 3v11H4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M8 5v6h8V5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

const cancelIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export default function OwnerScheduleClient() {
  const [activeTab, setActiveTab] = useState<ScheduleTab>("current");
  const [view, setView] = useState<ScheduleView>("list");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<RecurringClass[]>([]);
  const [tracks, setTracks] = useState<TrackOption[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [organizationId, setOrganizationId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<ClassDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ClassDraft>(emptyDraft);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(defaultVisibleColumns);
  const visibleColumnCount = columnDefs.filter((column) => visibleColumns[column.key]).length || 1;

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
      const nextOrganizationId = payload.organizationId ?? "";
      setOrganizationId(nextOrganizationId);

      if (nextOrganizationId) {
        const [tracksResponse, staffResponse] = await Promise.all([
          fetch(`/api/programming/tracks?organizationId=${encodeURIComponent(nextOrganizationId)}`, { cache: "no-store" }),
          fetch(`/api/owner/staff?organizationId=${encodeURIComponent(nextOrganizationId)}`, { cache: "no-store" }),
        ]);

        const tracksPayload = (await tracksResponse.json().catch(() => ({}))) as { tracks?: Array<{ id: string; name: string }> };
        const nextTracks = (tracksPayload.tracks ?? []).map((track) => ({ id: track.id, name: track.name }));
        setTracks(nextTracks);

        const staffPayload = (await staffResponse.json().catch(() => ({}))) as {
          staff?: Array<{ role: string; userId: string; user: { fullName: string | null; email: string | null } | null }>;
        };
        const nextCoaches = (staffPayload.staff ?? [])
          .filter((row) => row.role === "coach" || row.role === "admin" || row.role === "owner")
          .map((row) => ({
            userId: row.userId,
            label: row.user?.fullName || row.user?.email || "Unknown",
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setCoaches(nextCoaches);
      }
    } catch {
      setError("Failed to load classes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (tracks.length === 0) {
      return;
    }

    setCreateDraft((prev) => {
      if (prev.trackId) {
        return prev;
      }
      return { ...prev, trackId: tracks[0]?.id ?? "" };
    });

    setEditDraft((prev) => {
      if (prev.trackId) {
        return prev;
      }
      return { ...prev, trackId: tracks[0]?.id ?? "" };
    });
  }, [tracks]);

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
    if (!createDraft.trackId) {
      setError("Track is required.");
      return;
    }
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
          trackId: createDraft.trackId,
          name: createDraft.name,
          time: createDraft.time,
          durationMinutes: Number(createDraft.durationMinutes),
          days: createDraft.days,
          startDate: createDraft.startDate,
          endDate: createDraft.endDate || null,
          defaultCoachUserId: createDraft.defaultCoachUserId || null,
          sizeLimit: Number(createDraft.sizeLimit || "0"),
          reservationCutoffHours: Number(createDraft.reservationCutoffHours || "0"),
          calendarColor: createDraft.calendarColor,
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
      trackId: row.track_id ?? tracks[0]?.id ?? "",
      name: row.name,
      time: row.class_time.slice(0, 5),
      durationMinutes: String(row.duration_minutes),
      days: row.class_days,
      startDate: toInputDate(row.start_date),
      endDate: toInputDate(row.end_date),
      defaultCoachUserId: row.default_coach_user_id ?? "",
      sizeLimit: String(row.size_limit ?? 0),
      reservationCutoffHours: String(row.reservation_cutoff_hours ?? 0),
      calendarColor: row.calendar_color || "#3B82F6",
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
          trackId: editDraft.trackId,
          name: editDraft.name,
          time: editDraft.time,
          durationMinutes: Number(editDraft.durationMinutes),
          days: editDraft.days,
          startDate: editDraft.startDate,
          endDate: editDraft.endDate || null,
          defaultCoachUserId: editDraft.defaultCoachUserId || null,
          sizeLimit: Number(editDraft.sizeLimit || "0"),
          reservationCutoffHours: Number(editDraft.reservationCutoffHours || "0"),
          calendarColor: editDraft.calendarColor,
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
          trackId: row.track_id,
          name: `${row.name} (Copy)`,
          time: row.class_time.slice(0, 5),
          durationMinutes: row.duration_minutes,
          days: row.class_days,
          startDate: row.start_date,
          endDate: row.end_date,
          defaultCoachUserId: row.default_coach_user_id,
          sizeLimit: row.size_limit,
          reservationCutoffHours: row.reservation_cutoff_hours,
          calendarColor: row.calendar_color,
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
      .filter((row) => (dayFilter === "all" ? true : row.class_days.includes(dayFilter)))
      .filter((row) => {
        if (!needle) {
          return true;
        }
        const haystack = `${row.name} ${formatTime(row.class_time)} ${formatDuration(row.duration_minutes)} ${row.class_days.join(" ")} ${row.start_date}`.toLowerCase();
        return haystack.includes(needle);
      });
  }, [rows, activeTab, dayFilter, query]);

  const calendarRows = useMemo(() => {
    return weekDays.map((day) => ({
      day,
      rows: filteredRows
        .filter((row) => row.class_days.includes(day))
        .sort((a, b) => a.class_time.localeCompare(b.class_time)),
    }));
  }, [filteredRows]);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const exportCurrentRows = () => {
    const exportColumns = columnDefs.filter((column) => column.key !== "actions" && visibleColumns[column.key]);
    const columns = exportColumns.length > 0 ? exportColumns : columnDefs.filter((column) => column.key !== "actions");

    const header = columns.map((column) => toCsvCell(column.label)).join(",");
    const lines = filteredRows.map((row) => {
      const values = columns.map((column) => {
        switch (column.key) {
          case "name":
            return row.name;
          case "time":
            return formatTime(row.class_time);
          case "duration":
            return formatDuration(row.duration_minutes);
          case "days":
            return row.class_days.join(" ");
          case "start":
            return toUiDate(row.start_date);
          default:
            return "";
        }
      });
      return values.map((value) => toCsvCell(value)).join(",");
    });

    const tabLabel = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    const csvText = [header, ...lines].join("\n");
    downloadCsv(`schedule-${tabLabel.toLowerCase()}-${toLocalDateKey(new Date())}.csv`, csvText);
    setMessage(`Exported ${filteredRows.length} class${filteredRows.length === 1 ? "" : "es"}.`);
  };

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-[#101a35]">Schedule</h1>
        <p className="mt-3 text-sm text-[#4a5f86]">
          Class setup and recurring schedule management.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{message}</div>
      ) : null}

      <OwnerSectionCard
        title="Class Setup - Recurring"
        meta={loading ? "Loading..." : `${filteredRows.length} rows`}
        headerClassName="bg-gradient-to-r from-[#e11d8a] to-[#be185d]"
        headerRight={(
          <button
            type="button"
            className={ownerButtonDarkGhostClass}
          >
            Settings
          </button>
        )}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCreateOpen((current) => !current)}
              className={ownerButtonPrimaryClass}
            >
              {createOpen ? "Close" : "+ Create Recurring Class"}
            </button>

            <div className="inline-flex rounded-xl border border-fuchsia-400/35 bg-[#43206f] p-1 shadow-[0_8px_18px_rgba(67,32,111,0.35)]">
              <button
                type="button"
                onClick={() => setView("list")}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  view === "list"
                    ? "bg-white text-[#041327] shadow-[0_4px_12px_rgba(255,255,255,0.35)]"
                    : "text-[#d3c7f5] hover:bg-white/10 hover:text-white"
                }`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setView("calendar")}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  view === "calendar"
                    ? "bg-white text-[#041327] shadow-[0_4px_12px_rgba(255,255,255,0.35)]"
                    : "text-[#d3c7f5] hover:bg-white/10 hover:text-white"
                }`}
              >
                Calendar
              </button>
            </div>
          </div>

          {createOpen ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(9,18,29,0.08)]">
              {tracks.length === 0 ? (
                <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Create at least one track before adding recurring classes.
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-800">Track</span>
                  <select
                    value={createDraft.trackId}
                    onChange={(event) => setDraft(setCreateDraft, "trackId", event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none"
                  >
                    {tracks.length === 0 ? <option value="">No tracks found</option> : null}
                    {tracks.map((track) => (
                      <option key={track.id} value={track.id}>
                        {track.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-800">Class Name</span>
                  <input
                    value={createDraft.name}
                    onChange={(event) => setDraft(setCreateDraft, "name", event.target.value)}
                    placeholder="Class name"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-800">Time</span>
                  <input
                    type="time"
                    value={createDraft.time}
                    onChange={(event) => setDraft(setCreateDraft, "time", event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-800">Duration (Minutes)</span>
                  <input
                    type="number"
                    min="1"
                    value={createDraft.durationMinutes}
                    onChange={(event) => setDraft(setCreateDraft, "durationMinutes", event.target.value)}
                    placeholder="Duration minutes"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-800">Start Date</span>
                  <input
                    type="date"
                    value={createDraft.startDate}
                    onChange={(event) => setDraft(setCreateDraft, "startDate", event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-800">End Date (Optional)</span>
                  <input
                    type="date"
                    value={createDraft.endDate}
                    onChange={(event) => setDraft(setCreateDraft, "endDate", event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-800">Default Coach (Optional)</span>
                  <select
                    value={createDraft.defaultCoachUserId}
                    onChange={(event) => setDraft(setCreateDraft, "defaultCoachUserId", event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="">None</option>
                    {coaches.map((coach) => (
                      <option key={coach.userId} value={coach.userId}>
                        {coach.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-800">Size Limit (0 = no limit)</span>
                  <input
                    type="number"
                    min="0"
                    value={createDraft.sizeLimit}
                    onChange={(event) => setDraft(setCreateDraft, "sizeLimit", event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-800">Reservation Cutoff Hours</span>
                  <input
                    type="number"
                    min="0"
                    value={createDraft.reservationCutoffHours}
                    onChange={(event) => setDraft(setCreateDraft, "reservationCutoffHours", event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-800">Calendar Color</span>
                  <select
                    value={createDraft.calendarColor}
                    onChange={(event) => setDraft(setCreateDraft, "calendarColor", event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none"
                  >
                    {calendarColorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="space-y-1">
                  <span className="text-sm font-medium text-slate-800">Days</span>
                  <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-2">
                    {weekDays.map((day) => {
                      const active = createDraft.days.includes(day);
                      return (
                        <button
                          key={`create-${day}`}
                          type="button"
                          onClick={() => toggleDraftDay(createDraft, setCreateDraft, day)}
                          className={`rounded-full px-2 py-1 text-xs transition ${
                            active ? "bg-cyan-500/15 text-cyan-800" : "bg-slate-100 text-slate-700 hover:bg-cyan-50 hover:text-cyan-800"
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
                  disabled={saving || tracks.length === 0}
                  className={ownerButtonPrimaryClass}
                >
                  {saving ? "Saving..." : "Create Class"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-b border-cyan-500/20 pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-t-lg px-3 py-2 text-sm transition ${
                  activeTab === tab.key
                    ? "border-b-2 border-[#00c5ff] text-slate-900"
                    : "text-slate-700 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {view === "calendar" ? (
            <div className="rounded-2xl border border-slate-300 bg-white p-3 md:p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                {calendarRows.map((bucket) => (
                  <article key={bucket.day} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                    <h3 className="text-sm font-semibold text-slate-900">{bucket.day}</h3>
                    {bucket.rows.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">No classes</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {bucket.rows.map((row) => (
                          <div key={`${bucket.day}-${row.id}`} className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                            <p className="truncate text-xs font-semibold text-slate-900">{row.name}</p>
                            <p className="text-[11px] text-slate-500">{row.track?.name ?? "No track"}</p>
                            <p className="text-xs text-slate-600">{formatTime(row.class_time)}</p>
                            <p className="text-[11px] text-slate-500">{formatDuration(row.duration_minutes)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="app-table-shell overflow-hidden rounded-xl border border-slate-300/80">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-400/40 bg-[#4a4a4a] px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setColumnsOpen((current) => !current);
                          setFiltersOpen(false);
                        }}
                        className={`${ownerToolbarActionButtonClass} ${
                          columnsOpen
                            ? "text-cyan-200"
                            : "text-white hover:text-cyan-200"
                        }`}
                      >
                        {columnsIcon}
                        Columns
                      </button>
                      {columnsOpen ? (
                        <div className="absolute left-0 z-20 mt-2 w-44 rounded-xl border border-slate-300 bg-white p-2 shadow-xl">
                          {columnDefs.map((column) => (
                            <label key={column.key} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">
                              <input
                                type="checkbox"
                                checked={visibleColumns[column.key]}
                                onChange={() => toggleColumn(column.key)}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                              />
                              {column.label}
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setFiltersOpen((current) => !current);
                          setColumnsOpen(false);
                        }}
                        className={`${ownerToolbarActionButtonClass} ${
                          filtersOpen || dayFilter !== "all"
                            ? "text-cyan-200"
                            : "text-white hover:text-cyan-200"
                        }`}
                      >
                        {filtersIcon}
                        Filters
                      </button>
                      {filtersOpen ? (
                        <div className="absolute left-0 z-20 mt-2 w-52 rounded-xl border border-slate-300 bg-white p-2 shadow-xl">
                          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Filter by day</p>
                          <button
                            type="button"
                            onClick={() => {
                              setDayFilter("all");
                              setFiltersOpen(false);
                            }}
                            className={`mb-1 w-full rounded-md px-2 py-1 text-left text-xs transition ${
                              dayFilter === "all" ? "bg-cyan-50 text-cyan-700" : "text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            All days
                          </button>
                          <div className="grid grid-cols-3 gap-1">
                            {weekDays.map((day) => (
                              <button
                                key={`filter-${day}`}
                                type="button"
                                onClick={() => {
                                  setDayFilter(day);
                                  setFiltersOpen(false);
                                }}
                                className={`rounded-md px-2 py-1 text-xs transition ${
                                  dayFilter === day ? "bg-cyan-50 text-cyan-700" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={exportCurrentRows}
                      className={`${ownerToolbarActionButtonClass} text-white hover:text-cyan-200`}
                    >
                      {exportIcon}
                      Export
                    </button>
                  </div>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search..."
                    className={ownerToolbarSearchInputDarkClass}
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="app-table w-full min-w-[900px] border-collapse text-sm">
                    <thead>
                    <tr>
                        {visibleColumns.name ? <th className="px-3 py-3 text-left font-medium">Name</th> : null}
                        {visibleColumns.time ? <th className="px-3 py-3 text-left font-medium">Time</th> : null}
                        {visibleColumns.duration ? <th className="px-3 py-3 text-left font-medium">Duration</th> : null}
                        {visibleColumns.days ? <th className="px-3 py-3 text-left font-medium">Days</th> : null}
                        {visibleColumns.start ? <th className="px-3 py-3 text-left font-medium">Start</th> : null}
                        {visibleColumns.actions ? <th className="px-3 py-3 text-right font-medium">Actions</th> : null}
                    </tr>
                    </thead>
                    <tbody>
                    {filteredRows.length === 0 ? (
                      <tr className="app-table-empty border-t border-slate-200 bg-white text-slate-900">
                        <td colSpan={visibleColumnCount} className="h-14 px-3 py-6">
                          &nbsp;
                        </td>
                      </tr>
                    ) : filteredRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-200 bg-white text-slate-900">
                        {visibleColumns.name ? (
                        <td className="px-3 py-3">
                          {editingId === row.id ? (
                            <input
                              value={editDraft.name}
                              onChange={(event) => setDraft(setEditDraft, "name", event.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-cyan-300 focus:outline-none"
                            />
                          ) : (
                            <div>
                              <p className="font-medium text-slate-900">{row.name}</p>
                              <p className="text-xs text-slate-500">{row.track?.name ?? "No track"}</p>
                            </div>
                          )}
                        </td>
                        ) : null}
                        {visibleColumns.time ? (
                        <td className="px-3 py-3">
                          {editingId === row.id ? (
                            <input
                              type="time"
                              value={editDraft.time}
                              onChange={(event) => setDraft(setEditDraft, "time", event.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-cyan-300 focus:outline-none"
                            />
                          ) : (
                            formatTime(row.class_time)
                          )}
                        </td>
                        ) : null}
                        {visibleColumns.duration ? (
                        <td className="px-3 py-3">
                          {editingId === row.id ? (
                            <input
                              type="number"
                              min="1"
                              value={editDraft.durationMinutes}
                              onChange={(event) => setDraft(setEditDraft, "durationMinutes", event.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-cyan-300 focus:outline-none"
                            />
                          ) : (
                            formatDuration(row.duration_minutes)
                          )}
                        </td>
                        ) : null}
                        {visibleColumns.days ? (
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
                                      active ? "bg-cyan-100 text-cyan-800" : "bg-slate-100 text-slate-700 hover:bg-fuchsia-100 hover:text-fuchsia-800"
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
                                  className="rounded-full border border-cyan-300 bg-cyan-50 px-2 py-0.5 text-xs text-cyan-800"
                                >
                                  {day}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        ) : null}
                        {visibleColumns.start ? (
                        <td className="px-3 py-3">
                          {editingId === row.id ? (
                            <input
                              type="date"
                              value={editDraft.startDate}
                              onChange={(event) => setDraft(setEditDraft, "startDate", event.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-cyan-300 focus:outline-none"
                            />
                          ) : (
                            toUiDate(row.start_date)
                          )}
                        </td>
                        ) : null}
                        {visibleColumns.actions ? (
                        <td className="px-3 py-3 text-right">
                          {editingId === row.id ? (
                            <div className="inline-flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => saveEdit(row.id)}
                                disabled={saving}
                                aria-label="Save class"
                                title="Save"
                                className={ownerIconButtonSuccessClass}
                              >
                                {saveIcon}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                disabled={saving}
                                aria-label="Cancel editing"
                                title="Cancel"
                                className={ownerIconButtonNeutralClass}
                              >
                                {cancelIcon}
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => startEdit(row)}
                                disabled={saving}
                                aria-label="Edit class"
                                title="Edit"
                                className={ownerIconButtonNeutralClass}
                              >
                                {editIcon}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyClass(row)}
                                disabled={saving}
                                aria-label="Copy class"
                                title="Copy"
                                className={ownerIconButtonAccentClass}
                              >
                                {copyIcon}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteClass(row.id)}
                                disabled={saving}
                                aria-label="Delete class"
                                title="Delete"
                                className={ownerIconButtonDangerClass}
                              >
                                {deleteIcon}
                              </button>
                            </div>
                          )}
                        </td>
                        ) : null}
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="text-right text-xs text-[#8ca7ce]">{loading ? "Loading..." : `Total Rows: ${filteredRows.length}`}</div>
            </div>
          )}
        </div>
      </OwnerSectionCard>
    </section>
  );
}
