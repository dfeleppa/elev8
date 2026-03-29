"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Clock, Plus, Trash2 } from "lucide-react";

import ProgrammingSubheader from "../../../../../components/admin/ProgrammingSubheader";
import type { Program } from "../../../../../lib/programs";

const WEEK_PRESETS = [4, 8, 12, 16];
const DAYS_PRESETS = [3, 4, 5, 6, 7];

const STATUS_BADGE: Record<string, string> = {
  draft: "rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300",
  published: "rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300",
  archived: "rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-500",
};

const inputClass =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none";

const btnPrimary =
  "rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60";

const btnSecondary =
  "rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10";

export default function ProgrammingBuilderClient() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const orgIdRef = useRef<string | null>(null);

  // Modal form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const meRes = await fetch("/api/me");
        const meData = await meRes.json();
        const orgId: string = meData?.organizationIds?.[0] ?? meData?.organizationId ?? "";
        orgIdRef.current = orgId;

        const res = await fetch(`/api/programming/programs?organizationId=${orgId}`);
        const data = await res.json();
        if (isMounted) setPrograms(data.programs ?? []);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, []);

  function openModal() {
    setName("");
    setDescription("");
    setDurationWeeks(8);
    setDaysPerWeek(5);
    setModalError(null);
    setShowModal(true);
  }

  async function handleCreate() {
    if (!name.trim()) { setModalError("Name is required."); return; }
    const orgId = orgIdRef.current;
    if (!orgId) { setModalError("Organization not found."); return; }

    setCreating(true);
    setModalError(null);
    try {
      const res = await fetch("/api/programming/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, name: name.trim(), description: description.trim() || null, durationWeeks, daysPerWeek }),
      });
      const data = await res.json();
      if (!res.ok) { setModalError(data.error ?? "Failed to create."); return; }
      setShowModal(false);
      router.push(`/organization/admin/programming/builder/${data.program.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(programId: string) {
    if (!confirm("Delete this program and all its data?")) return;
    setDeleting(programId);
    await fetch(`/api/programming/programs/${programId}`, { method: "DELETE" });
    setPrograms((prev) => prev.filter((p) => p.id !== programId));
    setDeleting(null);
  }

  return (
    <>
      <ProgrammingSubheader />

      <section className="px-5 py-8 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Program Builder</h1>
            <p className="mt-1 text-sm text-slate-400">Create multi-week programs with lift and conditioning progressions.</p>
          </div>
          <button type="button" onClick={openModal} className={btnPrimary}>
            <span className="flex items-center gap-1.5"><Plus className="h-4 w-4" /> New Program</span>
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : programs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-slate-400">No programs yet. Create your first one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {programs.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4 transition hover:bg-white/[0.07]"
              >
                <button
                  type="button"
                  className="flex flex-1 items-center gap-4 text-left"
                  onClick={() => router.push(`/organization/admin/programming/builder/${p.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-100 truncate">{p.name}</span>
                      <span className={STATUS_BADGE[p.status] ?? STATUS_BADGE.draft}>{p.status}</span>
                    </div>
                    {p.description && (
                      <p className="mt-0.5 text-xs text-slate-500 truncate">{p.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                    <Clock className="h-3.5 w-3.5" />
                    {p.duration_weeks}w · {p.days_per_week}d/wk
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />
                </button>

                <button
                  type="button"
                  disabled={deleting === p.id}
                  onClick={() => handleDelete(p.id)}
                  className="ml-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-300/30 bg-rose-400/10 text-rose-300 transition hover:bg-rose-400/20 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Program Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1117] p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-100 mb-5">New Program</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Program Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 12-Week Strength Block"
                  className={inputClass}
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief description..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400">Duration</label>
                <div className="flex gap-2 flex-wrap">
                  {WEEK_PRESETS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setDurationWeeks(w)}
                      className={
                        durationWeeks === w
                          ? "rounded-xl border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-sm font-semibold text-indigo-300"
                          : "rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200"
                      }
                    >
                      {w}w
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={durationWeeks}
                    onChange={(e) => setDurationWeeks(Math.max(1, Math.min(52, parseInt(e.target.value) || 1)))}
                    className="w-20 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-center text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400">Training Days Per Week</label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS_PRESETS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDaysPerWeek(d)}
                      className={
                        daysPerWeek === d
                          ? "rounded-xl border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-sm font-semibold text-indigo-300"
                          : "rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200"
                      }
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              {modalError && <p className="text-xs text-rose-400">{modalError}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>Cancel</button>
              <button type="button" onClick={handleCreate} disabled={creating} className={btnPrimary}>
                {creating ? "Creating..." : "Create & Open"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
