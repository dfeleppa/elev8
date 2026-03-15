"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ownerButtonPrimaryClass,
  ownerButtonSecondaryClass,
  ownerIconButtonNeutralClass,
} from "../../../../components/owner/buttonStyles";

type TrackRow = {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  is_private: boolean;
  number_of_levels: number;
  hide_workouts_days_prior: number;
  hide_workouts_hour: number;
  hide_workouts_minute: number;
};

type TrackDraft = {
  name: string;
  isPrivate: "Y" | "N";
  numberOfLevels: "1" | "2" | "3";
  hideWorkoutsDaysPrior: string;
  hideWorkoutsHour: string;
  hideWorkoutsMinute: string;
  description: string;
};

type TrackColumnKey = "trackName" | "private" | "settings" | "copy" | "members";

type MemberAssignmentRow = {
  email: string;
  fullName: string;
  tracks: string[];
};

const numberOfLevelsOptions: Array<TrackDraft["numberOfLevels"]> = ["1", "2", "3"];

const trackColumnDefs: Array<{ key: TrackColumnKey; label: string }> = [
  { key: "trackName", label: "Track Name" },
  { key: "private", label: "Private" },
  { key: "settings", label: "Settings" },
  { key: "copy", label: "Copy" },
  { key: "members", label: "Members" },
];

const defaultVisibleTrackColumns: Record<TrackColumnKey, boolean> = {
  trackName: true,
  private: true,
  settings: true,
  copy: true,
  members: true,
};

const emptyDraft: TrackDraft = {
  name: "",
  isPrivate: "Y",
  numberOfLevels: "1",
  hideWorkoutsDaysPrior: "0",
  hideWorkoutsHour: "0",
  hideWorkoutsMinute: "0",
  description: "",
};

const settingsIcon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path d="M10 3h4l.6 2.2a7.6 7.6 0 0 1 1.8.8L18.9 5l2.8 2.8-1 1.5c.3.6.6 1.2.8 1.9L24 12l-2.5.8c-.2.7-.5 1.3-.8 1.9l1 1.5-2.8 2.8-1.5-1c-.6.3-1.2.6-1.8.8L14 21h-4l-.6-2.2c-.6-.2-1.2-.5-1.8-.8l-1.5 1-2.8-2.8 1-1.5a7.6 7.6 0 0 1-.8-1.9L0 12l2.5-.8c.2-.7.5-1.3.8-1.9l-1-1.5L5 5l1.5 1c.6-.3 1.2-.6 1.8-.8z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const copyIcon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <rect x="4" y="4" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const membersIcon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <circle cx="9" cy="9" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="16" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M13 20a4.3 4.3 0 0 1 7.5-2.7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

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

export default function OwnerTracksMembershipsClient({ organizationId }: { organizationId: string }) {
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [members, setMembers] = useState<MemberAssignmentRow[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersSavingEmail, setMembersSavingEmail] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [privacyFilter, setPrivacyFilter] = useState<"all" | "Y" | "N">("all");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<TrackColumnKey, boolean>>(defaultVisibleTrackColumns);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [activeMembersTrack, setActiveMembersTrack] = useState<TrackRow | null>(null);
  const [draft, setDraft] = useState<TrackDraft>(emptyDraft);

  const loadTracks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/programming/tracks?organizationId=${encodeURIComponent(organizationId)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as { tracks?: TrackRow[]; error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to load tracks.");
        return;
      }
      setTracks(payload.tracks ?? []);
    } catch {
      setError("Failed to load tracks.");
    } finally {
      setLoading(false);
    }
  };

  const buildMemberCounts = (rows: MemberAssignmentRow[]) => {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      for (const trackName of row.tracks) {
        counts[trackName] = (counts[trackName] ?? 0) + 1;
      }
    }
    return counts;
  };

  const loadMemberCounts = async () => {
    try {
      const response = await fetch(`/api/owner/tracks-memberships/members?organizationId=${encodeURIComponent(organizationId)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as { members?: MemberAssignmentRow[] };
      if (!response.ok) {
        return;
      }
      setMemberCounts(buildMemberCounts(payload.members ?? []));
    } catch {
      // Keep existing counts if this background refresh fails.
    }
  };

  useEffect(() => {
    loadTracks();
    loadMemberCounts();
  }, []);

  const filteredTracks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tracks
      .filter((track) => {
        if (privacyFilter === "all") {
          return true;
        }
        return privacyFilter === "Y" ? track.is_private : !track.is_private;
      })
      .filter((track) => {
        if (!needle) {
          return true;
        }
        const haystack = `${track.name} ${track.number_of_levels} ${track.code ?? ""}`.toLowerCase();
        return haystack.includes(needle);
      });
  }, [tracks, query, privacyFilter]);

  const toggleColumn = (key: TrackColumnKey) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const exportTracks = () => {
    const header = ["Track Name", "Private", "Number of Levels", "Hide Workouts Rule"];
    const lines = filteredTracks.map((track) => {
      const hideRule = `${track.hide_workouts_days_prior} day(s) prior at ${track.hide_workouts_hour}:${String(track.hide_workouts_minute).padStart(2, "0")}`;
      return [
        toCsvCell(track.name),
        toCsvCell(track.is_private ? "Y" : "N"),
        toCsvCell(String(track.number_of_levels)),
        toCsvCell(hideRule),
      ].join(",");
    });

    downloadCsv(`tracks-${new Date().toISOString().slice(0, 10)}.csv`, [header.map(toCsvCell).join(","), ...lines].join("\n"));
    setMessage(`Exported ${filteredTracks.length} track${filteredTracks.length === 1 ? "" : "s"}.`);
  };

  const openMembers = async (track: TrackRow) => {
    setActiveMembersTrack(track);
    setMembersDialogOpen(true);
    setMembersLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/owner/tracks-memberships/members?organizationId=${encodeURIComponent(organizationId)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as { members?: MemberAssignmentRow[]; error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to load members.");
        return;
      }
      const rows = payload.members ?? [];
      setMembers(rows);
      setMemberCounts(buildMemberCounts(rows));
    } catch {
      setError("Failed to load members.");
    } finally {
      setMembersLoading(false);
    }
  };

  const setMemberAssigned = async (member: MemberAssignmentRow, assigned: boolean) => {
    if (!activeMembersTrack) {
      return;
    }

    setMembersSavingEmail(member.email);
    setError(null);
    try {
      const response = await fetch("/api/owner/tracks-memberships/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          email: member.email,
          trackName: activeMembersTrack.name,
          assigned,
        }),
      });

      const payload = (await response.json()) as { tracks?: string[]; error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to update member assignment.");
        return;
      }

      setMembers((prev) =>
        prev.map((row) =>
          row.email === member.email ? { ...row, tracks: payload.tracks ?? row.tracks } : row
        )
      );

      setMemberCounts((prev) => {
        const next = { ...prev };
        const key = activeMembersTrack.name;
        const current = next[key] ?? 0;
        if (assigned) {
          next[key] = current + 1;
        } else {
          next[key] = Math.max(0, current - 1);
        }
        return next;
      });
    } catch {
      setError("Failed to update member assignment.");
    } finally {
      setMembersSavingEmail(null);
    }
  };

  const openCreate = () => {
    setEditingTrackId(null);
    setDraft(emptyDraft);
    setDialogOpen(true);
  };

  const openEdit = (track: TrackRow) => {
    setEditingTrackId(track.id);
    setDraft({
      name: track.name,
      isPrivate: track.is_private ? "Y" : "N",
      numberOfLevels: numberOfLevelsOptions.includes(String(track.number_of_levels) as TrackDraft["numberOfLevels"])
        ? (String(track.number_of_levels) as TrackDraft["numberOfLevels"])
        : "1",
      hideWorkoutsDaysPrior: String(track.hide_workouts_days_prior ?? 0),
      hideWorkoutsHour: String(track.hide_workouts_hour ?? 0),
      hideWorkoutsMinute: String(track.hide_workouts_minute ?? 0),
      description: track.description ?? "",
    });
    setDialogOpen(true);
  };

  const saveTrack = async () => {
    if (!draft.name.trim()) {
      setError("Track name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const payload = {
      organizationId,
      name: draft.name,
      isPrivate: draft.isPrivate === "Y",
      numberOfLevels: Number(draft.numberOfLevels),
      hideWorkoutsDaysPrior: Number(draft.hideWorkoutsDaysPrior || "0"),
      hideWorkoutsHour: Number(draft.hideWorkoutsHour || "0"),
      hideWorkoutsMinute: Number(draft.hideWorkoutsMinute || "0"),
      description: draft.description || null,
    };

    try {
      const response = await fetch(
        editingTrackId ? `/api/programming/tracks/${editingTrackId}` : "/api/programming/tracks",
        {
          method: editingTrackId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const responsePayload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(responsePayload.error ?? "Failed to save track.");
        return;
      }

      setMessage(editingTrackId ? "Track updated." : "Track created.");
      setDialogOpen(false);
      await loadTracks();
    } catch {
      setError("Failed to save track.");
    } finally {
      setSaving(false);
    }
  };

  const copyTrack = async (track: TrackRow) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/programming/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name: `${track.name} Copy`,
          code: track.code,
          description: track.description,
          isPrivate: track.is_private,
          numberOfLevels: track.number_of_levels,
          hideWorkoutsDaysPrior: track.hide_workouts_days_prior,
          hideWorkoutsHour: track.hide_workouts_hour,
          hideWorkoutsMinute: track.hide_workouts_minute,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to copy track.");
        return;
      }

      setMessage("Track copied.");
      await loadTracks();
    } catch {
      setError("Failed to copy track.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-[#101a35]">Tracks</h1>
        <p className="mt-3 text-sm text-[#4a5f86]">Manage recurring training tracks and visibility rules.</p>
      </header>

      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <section className="app-card overflow-hidden rounded-[28px] border border-cyan-400/30 bg-white shadow-[0_18px_44px_rgba(5,9,20,0.25)]">
        <div className="flex items-center justify-between bg-[#e11d8a] px-6 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white">Track Setup</p>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg border border-white/50 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            + New Track
          </button>
        </div>

        <div className="space-y-4 px-4 py-5 md:px-6 md:py-6">
          <div className="app-table-shell overflow-hidden rounded-xl border border-slate-300/80">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-400/40 bg-[#4a4a4a] px-3 py-2">
              <div className="flex items-center gap-4 text-sm text-white">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setColumnsOpen((current) => !current);
                      setFiltersOpen(false);
                    }}
                    className={`inline-flex items-center gap-1.5 px-1 py-1 text-sm font-medium transition ${
                      columnsOpen ? "text-cyan-200" : "text-white hover:text-cyan-200"
                    }`}
                  >
                    {columnsIcon}
                    Columns
                  </button>
                  {columnsOpen ? (
                    <div className="absolute left-0 z-20 mt-2 w-44 rounded-xl border border-slate-300 bg-white p-2 shadow-xl">
                      {trackColumnDefs.map((column) => (
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
                    className={`inline-flex items-center gap-1.5 px-1 py-1 text-sm font-medium transition ${
                      filtersOpen || privacyFilter !== "all" ? "text-cyan-200" : "text-white hover:text-cyan-200"
                    }`}
                  >
                    {filtersIcon}
                    Filters
                  </button>
                  {filtersOpen ? (
                    <div className="absolute left-0 z-20 mt-2 w-44 rounded-xl border border-slate-300 bg-white p-2 shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setPrivacyFilter("all");
                          setFiltersOpen(false);
                        }}
                        className={`w-full rounded-md px-2 py-1 text-left text-xs transition ${
                          privacyFilter === "all" ? "bg-cyan-50 text-cyan-700" : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        All Tracks
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPrivacyFilter("Y");
                          setFiltersOpen(false);
                        }}
                        className={`mt-1 w-full rounded-md px-2 py-1 text-left text-xs transition ${
                          privacyFilter === "Y" ? "bg-cyan-50 text-cyan-700" : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        Private Only
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPrivacyFilter("N");
                          setFiltersOpen(false);
                        }}
                        className={`mt-1 w-full rounded-md px-2 py-1 text-left text-xs transition ${
                          privacyFilter === "N" ? "bg-cyan-50 text-cyan-700" : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        Public Only
                      </button>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={exportTracks}
                  className="inline-flex items-center gap-1.5 px-1 py-1 text-sm font-medium text-white transition hover:text-cyan-200"
                >
                  {exportIcon}
                  Export
                </button>
              </div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search..."
                className="w-full max-w-xs rounded-lg border border-slate-300/60 bg-[#2f2f2f] px-3 py-2 text-sm text-white placeholder:text-slate-300 focus:border-cyan-300 focus:outline-none"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="app-table w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr>
                    {visibleColumns.trackName ? <th className="px-3 py-3 text-left font-medium">Track Name</th> : null}
                    {visibleColumns.private ? <th className="px-3 py-3 text-left font-medium">Private</th> : null}
                    {visibleColumns.settings ? <th className="px-3 py-3 text-center font-medium">Settings</th> : null}
                    {visibleColumns.copy ? <th className="px-3 py-3 text-center font-medium">Copy</th> : null}
                    {visibleColumns.members ? <th className="px-3 py-3 text-center font-medium">Members</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredTracks.length === 0 ? (
                    <tr className="app-table-empty">
                      <td colSpan={Math.max(trackColumnDefs.filter((column) => visibleColumns[column.key]).length, 1)} className="h-14 px-3 py-6 text-center text-sm text-slate-500">
                        {loading ? "Loading tracks..." : "No tracks found."}
                      </td>
                    </tr>
                  ) : (
                    filteredTracks.map((track) => (
                      <tr key={track.id}>
                        {visibleColumns.trackName ? <td className="px-3 py-3 text-slate-900">{track.name}</td> : null}
                        {visibleColumns.private ? <td className="px-3 py-3 text-slate-700">{track.is_private ? "Y" : "N"}</td> : null}
                        {visibleColumns.settings ? <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => openEdit(track)}
                            title="Settings"
                            className={ownerIconButtonNeutralClass}
                          >
                            {settingsIcon}
                          </button>
                        </td> : null}
                        {visibleColumns.copy ? <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => copyTrack(track)}
                            title="Copy"
                            disabled={saving}
                            className={ownerIconButtonNeutralClass}
                          >
                            {copyIcon}
                          </button>
                        </td> : null}
                        {visibleColumns.members ? <td className="px-3 py-3 text-center">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openMembers(track)}
                              title="Members"
                              className={ownerIconButtonNeutralClass}
                            >
                              {membersIcon}
                            </button>
                            <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-800">
                              {memberCounts[track.name] ?? 0}
                            </span>
                          </div>
                        </td> : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-right text-xs text-[#8ca7ce]">{loading ? "Loading..." : `Total Rows: ${filteredTracks.length}`}</div>
        </div>
      </section>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-6">
          <div className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <h2 className="text-3xl font-semibold text-slate-900">{editingTrackId ? "Track Settings" : "New Track Settings"}</h2>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="text-3xl leading-none text-slate-500 transition hover:text-slate-900"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="mb-5 grid grid-cols-4 text-center text-sm text-slate-400">
                <span className="border-b border-slate-300 pb-3">Track Info</span>
                <span className="border-b border-slate-200 pb-3">Members</span>
                <span className="border-b border-slate-200 pb-3">Content</span>
                <span className="border-b border-slate-200 pb-3">Import/Export Data</span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Track Name *</span>
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Private Track *</span>
                  <select
                    value={draft.isPrivate}
                    onChange={(event) => setDraft((prev) => ({ ...prev, isPrivate: event.target.value as "Y" | "N" }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Number of Levels</span>
                  <select
                    value={draft.numberOfLevels}
                    onChange={(event) => setDraft((prev) => ({ ...prev, numberOfLevels: event.target.value as TrackDraft["numberOfLevels"] }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none"
                  >
                    {numberOfLevelsOptions.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-6">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-600">Keep Workouts Hidden Until (Optional)</p>
                <div className="mt-3 flex flex-wrap items-end gap-4 rounded-xl border border-slate-300 bg-[#efefeb] p-3">
                  <label className="space-y-1">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Day(s) Prior</span>
                    <input
                      type="number"
                      min="0"
                      value={draft.hideWorkoutsDaysPrior}
                      onChange={(event) => setDraft((prev) => ({ ...prev, hideWorkoutsDaysPrior: event.target.value }))}
                      placeholder="7"
                      className="w-32 rounded-md border border-slate-400/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] focus:border-slate-600 focus:outline-none"
                    />
                  </label>
                  <div className="pb-2 text-sm font-medium text-slate-600">at</div>
                  <div className="flex items-end gap-2 rounded-md border border-slate-400/80 bg-white px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    <label className="space-y-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">HH</span>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={draft.hideWorkoutsHour}
                        onChange={(event) => setDraft((prev) => ({ ...prev, hideWorkoutsHour: event.target.value }))}
                        placeholder="00"
                        className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-center text-sm text-slate-900 focus:border-slate-600 focus:outline-none"
                      />
                    </label>
                    <div className="pb-2 text-base font-semibold text-slate-600">:</div>
                    <label className="space-y-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">MM</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={draft.hideWorkoutsMinute}
                        onChange={(event) => setDraft((prev) => ({ ...prev, hideWorkoutsMinute: event.target.value }))}
                        placeholder="00"
                        className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-center text-sm text-slate-900 focus:border-slate-600 focus:outline-none"
                      />
                    </label>
                  </div>
                  <p className="pb-2 text-xs font-medium text-slate-500">24-hour time</p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className={ownerButtonSecondaryClass}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveTrack}
                  disabled={saving}
                  className={ownerButtonPrimaryClass}
                >
                  {saving ? "Saving..." : "Save Track"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {membersDialogOpen && activeMembersTrack ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-6">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <h2 className="text-2xl font-semibold text-slate-900">Track Members: {activeMembersTrack.name}</h2>
              <button
                type="button"
                onClick={() => setMembersDialogOpen(false)}
                className="text-3xl leading-none text-slate-500 transition hover:text-slate-900"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              {membersLoading ? (
                <p className="text-sm text-slate-500">Loading members...</p>
              ) : members.length === 0 ? (
                <p className="text-sm text-slate-500">No members found.</p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => {
                    const assigned = member.tracks.includes(activeMembersTrack.name);
                    const disabled = membersSavingEmail === member.email;
                    return (
                      <label key={member.email} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{member.fullName}</p>
                          <p className="text-xs text-slate-500">{member.email}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={assigned}
                          disabled={disabled}
                          onChange={(event) => setMemberAssigned(member, event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
