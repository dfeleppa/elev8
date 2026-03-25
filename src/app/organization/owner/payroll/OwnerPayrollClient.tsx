"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import {
  ownerButtonPrimaryClass,
  ownerIconButtonAccentClass,
  ownerIconButtonDangerClass,
  ownerIconButtonSuccessClass,
} from "../../../../components/owner/buttonStyles";
import OwnerDataTable from "../../../../components/owner/OwnerDataTable";
import OwnerSectionCard from "../../../../components/owner/OwnerSectionCard";

type StaffMember = {
  name: string;
  coachingPayrate: number;
  officePayrate: number;
};

type PayrollEntry = {
  id: string;
  weekEndingDate: string;
  staffName: string;
  coachingHours: number;
  officeHours: number;
  totalPay: number;
  payDate: string;
  notes: string;
};

type EntryDraft = {
  weekEndingDate: string;
  staffName: string;
  coachingHours: string;
  officeHours: string;
  totalPay: string;
  payDate: string;
  notes: string;
};

const EMPTY_DRAFT: EntryDraft = {
  weekEndingDate: "",
  staffName: "",
  coachingHours: "",
  officeHours: "",
  totalPay: "",
  payDate: "",
  notes: "",
};

function toDraft(entry: PayrollEntry): EntryDraft {
  return {
    weekEndingDate: entry.weekEndingDate ?? "",
    staffName: entry.staffName ?? "",
    coachingHours: String(entry.coachingHours ?? ""),
    officeHours: String(entry.officeHours ?? ""),
    totalPay: String(entry.totalPay ?? ""),
    payDate: entry.payDate ?? "",
    notes: entry.notes ?? "",
  };
}

function calcPay(
  staffName: string,
  coachingHours: string,
  officeHours: string,
  staffList: StaffMember[]
): string {
  const member = staffList.find((s) => s.name === staffName);
  if (!member) return "";
  const coaching = parseFloat(coachingHours) || 0;
  const office = parseFloat(officeHours) || 0;
  const total =
    coaching * (member.coachingPayrate ?? 0) +
    office * (member.officePayrate ?? 0);
  return total.toFixed(2);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

const cellInputClass =
  "w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-sm text-slate-100 focus:border-[#ffb1c4]/60 focus:outline-none";
const cellSelectClass =
  "w-full rounded-lg border border-white/15 bg-[#171c22] px-2 py-1.5 text-sm text-slate-100 focus:border-[#ffb1c4]/60 focus:outline-none";
const cellPayClass =
  "w-full rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-2 py-1.5 text-sm font-semibold text-emerald-300 focus:border-emerald-400/60 focus:outline-none";

export default function OwnerPayrollClient({
  organizationId,
}: {
  organizationId: string | null;
}) {
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EntryDraft>(EMPTY_DRAFT);

  const [newDraft, setNewDraft] = useState<EntryDraft>(EMPTY_DRAFT);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const newRowRef = useRef<HTMLTableRowElement>(null);

  // Fetch staff list with pay rates
  useEffect(() => {
    const params = new URLSearchParams();
    if (organizationId) params.set("organizationId", organizationId);
    fetch(`/api/owner/staff?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const members: StaffMember[] = (data.staff ?? [])
          .filter((s: { user?: { fullName?: string } }) => s.user?.fullName)
          .map(
            (s: {
              user: { fullName: string };
              coachingPayrate: number | null;
              officePayrate: number | null;
            }) => ({
              name: s.user.fullName,
              coachingPayrate: Number(s.coachingPayrate ?? 0),
              officePayrate: Number(s.officePayrate ?? 0),
            })
          )
          .sort((a: StaffMember, b: StaffMember) =>
            a.name.localeCompare(b.name)
          );
        setStaffList(members);
      })
      .catch(() => {});
  }, [organizationId]);

  // Load payroll entries
  const loadEntries = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    const params = new URLSearchParams();
    if (organizationId) params.set("organizationId", organizationId);
    const res = await fetch(`/api/owner/payroll?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setPageError(data.error ?? "Failed to load payroll entries.");
    } else {
      setEntries(data.entries ?? []);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Helpers to update a draft field and auto-recalculate pay
  function updateEditDraft(patch: Partial<EntryDraft>) {
    setEditDraft((prev) => {
      const next = { ...prev, ...patch };
      // Recalculate when staff or hours change, unless totalPay was explicitly patched
      if (
        ("staffName" in patch ||
          "coachingHours" in patch ||
          "officeHours" in patch) &&
        !("totalPay" in patch)
      ) {
        next.totalPay = calcPay(
          next.staffName,
          next.coachingHours,
          next.officeHours,
          staffList
        );
      }
      return next;
    });
  }

  function updateNewDraft(patch: Partial<EntryDraft>) {
    setNewDraft((prev) => {
      const next = { ...prev, ...patch };
      if (
        ("staffName" in patch ||
          "coachingHours" in patch ||
          "officeHours" in patch) &&
        !("totalPay" in patch)
      ) {
        next.totalPay = calcPay(
          next.staffName,
          next.coachingHours,
          next.officeHours,
          staffList
        );
      }
      return next;
    });
  }

  const startEdit = (entry: PayrollEntry) => {
    setEditingId(entry.id);
    setEditDraft(toDraft(entry));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    const res = await fetch("/api/owner/payroll", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        organizationId,
        weekEndingDate: editDraft.weekEndingDate,
        staffName: editDraft.staffName,
        coachingHours: parseFloat(editDraft.coachingHours) || 0,
        officeHours: parseFloat(editDraft.officeHours) || 0,
        totalPay: parseFloat(editDraft.totalPay) || 0,
        payDate: editDraft.payDate || null,
        notes: editDraft.notes,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setPageError(data.error ?? "Failed to save entry.");
      return;
    }
    setEntries((prev) => prev.map((e) => (e.id === id ? data.entry : e)));
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
  };

  const deleteEntry = async (id: string) => {
    setDeletingId(id);
    const res = await fetch("/api/owner/payroll", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, organizationId }),
    });
    const data = await res.json();
    setDeletingId(null);
    if (!res.ok) {
      setPageError(data.error ?? "Failed to delete entry.");
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditDraft(EMPTY_DRAFT);
    }
  };

  const saveNew = async () => {
    if (!newDraft.weekEndingDate || !newDraft.staffName) {
      setPageError("Week ending date and staff name are required.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/owner/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        weekEndingDate: newDraft.weekEndingDate,
        staffName: newDraft.staffName,
        coachingHours: parseFloat(newDraft.coachingHours) || 0,
        officeHours: parseFloat(newDraft.officeHours) || 0,
        totalPay: parseFloat(newDraft.totalPay) || 0,
        payDate: newDraft.payDate || null,
        notes: newDraft.notes,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setPageError(data.error ?? "Failed to save entry.");
      return;
    }
    setEntries((prev) => [data.entry, ...prev]);
    setNewDraft(EMPTY_DRAFT);
  };

  const scrollToNewRow = () => {
    newRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const firstInput = newRowRef.current?.querySelector("input");
    firstInput?.focus();
  };

  const thClass =
    "px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/60";

  return (
    <section className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-100">Payroll</h1>
          <p className="mt-3 text-sm text-slate-400">
            Track weekly payroll by staff, pay period, and payout details.
          </p>
        </div>
        <button
          type="button"
          onClick={scrollToNewRow}
          className={`${ownerButtonPrimaryClass} flex shrink-0 items-center gap-2`}
        >
          <Plus size={15} />
          Add Payroll Entry
        </button>
      </header>

      {pageError && (
        <div className="flex items-center justify-between rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-300">
          <span>{pageError}</span>
          <button
            type="button"
            className="ml-4 underline opacity-70 hover:opacity-100"
            onClick={() => setPageError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <OwnerSectionCard title="Payroll" meta={`${entries.length} entries`}>
        <OwnerDataTable minWidthClassName="min-w-[1080px]">
          <thead>
            <tr>
              <th className={thClass}>Week Ending</th>
              <th className={thClass}>Staff Name</th>
              <th className={thClass}>Coaching Hrs</th>
              <th className={thClass}>Office Hrs</th>
              <th className={thClass}>Total Pay</th>
              <th className={thClass}>Pay Date</th>
              <th className={thClass}>Notes</th>
              <th className={thClass + " w-20"}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-sm text-slate-500">
                  Loading payroll entries...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-sm text-slate-500">
                  No payroll entries yet. Use the row below to add the first one.
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const isEditing = editingId === entry.id;
                const isDeleting = deletingId === entry.id;

                if (isEditing) {
                  return (
                    <tr key={entry.id} className="bg-white/[0.025]">
                      <td className="rounded-l-2xl border-y border-white/10 px-3 py-2">
                        <input
                          type="date"
                          value={editDraft.weekEndingDate}
                          onChange={(e) =>
                            updateEditDraft({ weekEndingDate: e.target.value })
                          }
                          className={cellInputClass}
                        />
                      </td>
                      <td className="border-y border-white/10 px-3 py-2">
                        <select
                          value={editDraft.staffName}
                          onChange={(e) =>
                            updateEditDraft({ staffName: e.target.value })
                          }
                          className={cellSelectClass}
                        >
                          <option value="">Select staff...</option>
                          {staffList.map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border-y border-white/10 px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={editDraft.coachingHours}
                          onChange={(e) =>
                            updateEditDraft({ coachingHours: e.target.value })
                          }
                          className={cellInputClass}
                        />
                      </td>
                      <td className="border-y border-white/10 px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={editDraft.officeHours}
                          onChange={(e) =>
                            updateEditDraft({ officeHours: e.target.value })
                          }
                          className={cellInputClass}
                        />
                      </td>
                      <td className="border-y border-white/10 px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editDraft.totalPay}
                          onChange={(e) =>
                            updateEditDraft({ totalPay: e.target.value })
                          }
                          className={cellPayClass}
                        />
                      </td>
                      <td className="border-y border-white/10 px-3 py-2">
                        <input
                          type="date"
                          value={editDraft.payDate}
                          onChange={(e) =>
                            updateEditDraft({ payDate: e.target.value })
                          }
                          className={cellInputClass}
                        />
                      </td>
                      <td className="border-y border-white/10 px-3 py-2">
                        <input
                          type="text"
                          value={editDraft.notes}
                          onChange={(e) =>
                            updateEditDraft({ notes: e.target.value })
                          }
                          placeholder="Notes..."
                          className={cellInputClass}
                        />
                      </td>
                      <td className="rounded-r-2xl border-y border-white/10 px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => saveEdit(entry.id)}
                            disabled={saving}
                            className={ownerIconButtonSuccessClass}
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className={ownerIconButtonDangerClass}
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={entry.id}
                    className="group transition hover:bg-white/[0.02]"
                  >
                    <td className="rounded-l-2xl border-y border-white/10 px-3 py-4 text-sm text-slate-300">
                      {formatDate(entry.weekEndingDate)}
                    </td>
                    <td className="border-y border-white/10 px-3 py-4 text-sm font-medium text-slate-100">
                      {entry.staffName}
                    </td>
                    <td className="border-y border-white/10 px-3 py-4 text-sm text-slate-300">
                      {entry.coachingHours}
                    </td>
                    <td className="border-y border-white/10 px-3 py-4 text-sm text-slate-300">
                      {entry.officeHours}
                    </td>
                    <td className="border-y border-white/10 px-3 py-4 text-sm font-semibold text-emerald-300">
                      {formatMoney(entry.totalPay)}
                    </td>
                    <td className="border-y border-white/10 px-3 py-4 text-sm text-slate-300">
                      {formatDate(entry.payDate)}
                    </td>
                    <td className="border-y border-white/10 px-3 py-4 text-sm text-slate-300">
                      {entry.notes || "—"}
                    </td>
                    <td className="rounded-r-2xl border-y border-white/10 px-3 py-4">
                      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          className={ownerIconButtonAccentClass}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEntry(entry.id)}
                          disabled={isDeleting}
                          className={ownerIconButtonDangerClass}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}

            {/* Divider */}
            <tr>
              <td colSpan={8} className="px-3 pb-1 pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs font-medium uppercase tracking-widest text-white/30">
                    New Entry
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
              </td>
            </tr>

            {/* Blank input row */}
            <tr ref={newRowRef}>
              <td className="rounded-l-2xl px-3 pb-3 pt-2">
                <input
                  type="date"
                  value={newDraft.weekEndingDate}
                  onChange={(e) =>
                    updateNewDraft({ weekEndingDate: e.target.value })
                  }
                  className={cellInputClass}
                />
              </td>
              <td className="px-3 pb-3 pt-2">
                <select
                  value={newDraft.staffName}
                  onChange={(e) =>
                    updateNewDraft({ staffName: e.target.value })
                  }
                  className={cellSelectClass}
                >
                  <option value="">Select staff...</option>
                  {staffList.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 pb-3 pt-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={newDraft.coachingHours}
                  onChange={(e) =>
                    updateNewDraft({ coachingHours: e.target.value })
                  }
                  placeholder="0"
                  className={cellInputClass}
                />
              </td>
              <td className="px-3 pb-3 pt-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={newDraft.officeHours}
                  onChange={(e) =>
                    updateNewDraft({ officeHours: e.target.value })
                  }
                  placeholder="0"
                  className={cellInputClass}
                />
              </td>
              <td className="px-3 pb-3 pt-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newDraft.totalPay}
                  onChange={(e) =>
                    updateNewDraft({ totalPay: e.target.value })
                  }
                  placeholder="Auto"
                  className={cellPayClass}
                />
              </td>
              <td className="px-3 pb-3 pt-2">
                <input
                  type="date"
                  value={newDraft.payDate}
                  onChange={(e) =>
                    updateNewDraft({ payDate: e.target.value })
                  }
                  className={cellInputClass}
                />
              </td>
              <td className="px-3 pb-3 pt-2">
                <input
                  type="text"
                  value={newDraft.notes}
                  onChange={(e) => updateNewDraft({ notes: e.target.value })}
                  placeholder="Notes..."
                  className={cellInputClass}
                />
              </td>
              <td className="rounded-r-2xl px-3 pb-3 pt-2">
                <button
                  type="button"
                  onClick={saveNew}
                  disabled={
                    saving || !newDraft.weekEndingDate || !newDraft.staffName
                  }
                  className={ownerIconButtonSuccessClass}
                  title="Save new entry"
                >
                  <Check size={14} />
                </button>
              </td>
            </tr>
          </tbody>
        </OwnerDataTable>
      </OwnerSectionCard>
    </section>
  );
}
