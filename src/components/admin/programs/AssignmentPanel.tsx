"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Trash2, Users, X } from "lucide-react";

import { calculateCurrentWeek } from "@/lib/programs";

type Props = {
  programId: string;
  onClose: () => void;
};

type Member = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
};

type Track = {
  id: string;
  name: string;
};

type Assignment = {
  id: string;
  assigned_member_id: string | null;
  assigned_track_id: string | null;
  start_date: string;
  is_active: boolean;
  notes: string | null;
  app_users?: { id: string; full_name: string | null; email: string } | null;
  programming_tracks?: { id: string; name: string } | null;
};

type TabType = "members" | "tracks";

const inputSm =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none";

const selectSm =
  "w-full rounded-xl border border-white/15 bg-[#0d0f14] px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none";

const btnPrimary =
  "rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60";

function memberName(m: Member) {
  return m.full_name || m.email;
}

export default function AssignmentPanel({ programId, onClose }: Props) {
  const [tab, setTab] = useState<TabType>("members");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [assignRes, meRes] = await Promise.all([
          fetch(`/api/programming/programs/${programId}/assignments`),
          fetch("/api/me"),
        ]);
        const assignData = await assignRes.json();
        const [membersData, tracksData] = await Promise.all([
          fetch(`/api/programming/programs/members`).then((r) => r.json()),
          fetch(`/api/programming/tracks`).then((r) => r.json()),
        ]);

        if (!isMounted) return;
        setAssignments(assignData.assignments ?? []);
        setMembers(membersData.members ?? []);
        setTracks(tracksData.tracks ?? []);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [programId]);

  async function handleAssign() {
    if (tab === "members" && !selectedMemberId) { setError("Select a member."); return; }
    if (tab === "tracks" && !selectedTrackId) { setError("Select a track."); return; }
    if (!startDate) { setError("Start date is required."); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/programming/programs/${programId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedMemberId: tab === "members" ? selectedMemberId : null,
          assignedTrackId: tab === "tracks" ? selectedTrackId : null,
          startDate,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to assign."); return; }

      // Refresh assignments
      const refreshRes = await fetch(`/api/programming/programs/${programId}/assignments`);
      const refreshData = await refreshRes.json();
      setAssignments(refreshData.assignments ?? []);

      setSelectedMemberId("");
      setSelectedTrackId("");
      setNotes("");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(assignmentId: string) {
    await fetch(`/api/programming/programs/${programId}/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    setAssignments((prev) =>
      prev.map((a) => (a.id === assignmentId ? { ...a, is_active: false } : a))
    );
  }

  async function handleDelete(assignmentId: string) {
    if (!confirm("Remove this assignment?")) return;
    await fetch(`/api/programming/programs/${programId}/assignments/${assignmentId}`, { method: "DELETE" });
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
  }

  const filteredMembers = members.filter((m) => {
    const q = memberSearch.toLowerCase();
    return (
      !q ||
      (m.full_name ?? "").toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  const memberAssignments = assignments.filter((a) => a.assigned_member_id);
  const trackAssignments = assignments.filter((a) => a.assigned_track_id);

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-in panel */}
      <div className="flex w-full max-w-md flex-col border-l border-white/10 bg-[#0d0f14] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-100">Assign Program</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {(["members", "tracks"] as TabType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium capitalize transition ${
                tab === t
                  ? "border-b-2 border-indigo-400 text-indigo-300"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t === "members" ? <span className="flex items-center justify-center gap-1"><Users className="h-3.5 w-3.5" /> Members</span> : "Tracks"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <>
              {/* Assign form */}
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">New Assignment</p>

                {tab === "members" ? (
                  <>
                    <div>
                      <input
                        type="text"
                        placeholder="Search members..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className={inputSm}
                      />
                    </div>
                    <select
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      className={selectSm}
                      size={5}
                    >
                      <option value="">— select member —</option>
                      {filteredMembers.map((m) => (
                        <option key={m.id} value={m.id}>{memberName(m)}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <select
                    value={selectedTrackId}
                    onChange={(e) => setSelectedTrackId(e.target.value)}
                    className={selectSm}
                  >
                    <option value="">— select track —</option>
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}

                <div>
                  <label className="mb-1 block text-xs text-slate-500">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={inputSm}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-500">Notes (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Post-competition prep"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={inputSm}
                  />
                </div>

                {error && <p className="text-xs text-rose-400">{error}</p>}

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleAssign}
                  className={btnPrimary + " w-full"}
                >
                  {saving ? "Assigning..." : "Assign"}
                </button>
              </div>

              {/* Existing assignments */}
              {(tab === "members" ? memberAssignments : trackAssignments).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Active</p>
                  {(tab === "members" ? memberAssignments : trackAssignments).map((a) => {
                    const label = a.app_users
                      ? (a.app_users.full_name || a.app_users.email)
                      : a.programming_tracks?.name ?? "—";
                    const currentWeek = calculateCurrentWeek(a.start_date, 999); // duration unknown here, capped elsewhere

                    return (
                      <div
                        key={a.id}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                          a.is_active ? "border-white/10 bg-white/5" : "border-white/5 bg-white/[0.02] opacity-50"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{label}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <CalendarDays className="h-3 w-3" />
                            Started {a.start_date} · Wk {currentWeek}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 ml-3 shrink-0">
                          {a.is_active && (
                            <button
                              type="button"
                              onClick={() => handleDeactivate(a.id)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200"
                            >
                              Pause
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(a.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-300/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
