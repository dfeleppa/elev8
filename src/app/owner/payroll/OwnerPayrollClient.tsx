"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, Plus, Trash2 } from "lucide-react";

import {
  ownerButtonPrimaryClass,
  ownerIconButtonDangerClass,
  ownerIconButtonSuccessClass,
} from "@/components/owner/buttonStyles";
import OwnerDataTable from "@/components/owner/OwnerDataTable";
import OwnerSectionCard from "@/components/owner/OwnerSectionCard";

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

type DraftCol = keyof EntryDraft;

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
  "w-full rounded-lg border border-[var(--line-strong)] bg-[var(--panel)] px-2 py-1.5 text-sm text-[var(--text)] focus:border-[var(--pink)]/60 focus:outline-none [color-scheme:dark]";
const cellSelectClass =
  "w-full rounded-lg border border-[var(--line-strong)] bg-[var(--panel)] px-2 py-1.5 text-sm text-[var(--text)] focus:border-[var(--pink)]/60 focus:outline-none";
const cellPayClass =
  "w-full rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-2 py-1.5 text-sm font-semibold text-emerald-300 focus:border-emerald-400/60 focus:outline-none";

export default function OwnerPayrollClient() {
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Per-cell inline editing
  const [editingCell, setEditingCell] = useState<{ id: string; col: DraftCol } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EntryDraft>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<EntryDraft>(EMPTY_DRAFT);
  const [savingNew, setSavingNew] = useState(false);
  const newRowRef = useRef<HTMLTableRowElement>(null);

  type SortColumn = "weekEndingDate" | "staffName" | "coachingHours" | "officeHours" | "totalPay" | "payDate";
  const [sortColumn, setSortColumn] = useState<SortColumn>("weekEndingDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Initialize drafts for newly loaded entries
  useEffect(() => {
    setDrafts((prev) => {
      const updates: Record<string, EntryDraft> = {};
      for (const e of entries) {
        if (!prev[e.id]) updates[e.id] = toDraft(e);
      }
      return Object.keys(updates).length ? { ...prev, ...updates } : prev;
    });
  }, [entries]);

  function handleSort(col: SortColumn) {
    if (col === sortColumn) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDir("asc");
    }
  }

  const sortedEntries = [...entries].sort((a, b) => {
    let cmp = 0;
    if (sortColumn === "staffName") cmp = a.staffName.localeCompare(b.staffName);
    else if (sortColumn === "coachingHours") cmp = a.coachingHours - b.coachingHours;
    else if (sortColumn === "officeHours") cmp = a.officeHours - b.officeHours;
    else if (sortColumn === "totalPay") cmp = a.totalPay - b.totalPay;
    else if (sortColumn === "weekEndingDate") cmp = (a.weekEndingDate ?? "").localeCompare(b.weekEndingDate ?? "");
    else if (sortColumn === "payDate") cmp = (a.payDate ?? "").localeCompare(b.payDate ?? "");
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Fetch staff list with pay rates
  useEffect(() => {
    fetch(`/api/owner/staff`)
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
          .sort((a: StaffMember, b: StaffMember) => a.name.localeCompare(b.name));
        setStaffList(members);
      })
      .catch((err) => {
        console.error("Failed to load staff list:", err);
      });
  }, []);

  // Load payroll entries
  const loadEntries = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    const res = await fetch(`/api/owner/payroll`);
    const data = await res.json();
    if (!res.ok) {
      setPageError(data.error ?? "Failed to load payroll entries.");
    } else {
      setEntries(data.entries ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  function updateDraft(id: string, patch: Partial<EntryDraft>) {
    setDrafts((prev) => {
      const current = prev[id] ?? EMPTY_DRAFT;
      const next = { ...current, ...patch };
      if (
        ("staffName" in patch || "coachingHours" in patch || "officeHours" in patch) &&
        !("totalPay" in patch)
      ) {
        next.totalPay = calcPay(next.staffName, next.coachingHours, next.officeHours, staffList);
      }
      return { ...prev, [id]: next };
    });
  }

  async function saveDraft(id: string, currentDrafts: Record<string, EntryDraft>) {
    const draft = currentDrafts[id];
    const original = entries.find((e) => e.id === id);
    if (!draft || !original) return;

    const originalDraft = toDraft(original);
    const changed = (Object.keys(draft) as DraftCol[]).some((k) => draft[k] !== originalDraft[k]);
    if (!changed) return;

    setSavingIds((prev) => new Set(prev).add(id));
    const res = await fetch("/api/owner/payroll", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        weekEndingDate: draft.weekEndingDate,
        staffName: draft.staffName,
        coachingHours: parseFloat(draft.coachingHours) || 0,
        officeHours: parseFloat(draft.officeHours) || 0,
        totalPay: parseFloat(draft.totalPay) || 0,
        payDate: draft.payDate || null,
        notes: draft.notes,
      }),
    });
    const data = await res.json();
    setSavingIds((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
    if (!res.ok) {
      setPageError(data.error ?? "Failed to save entry.");
      setDrafts((prev) => ({ ...prev, [id]: originalDraft }));
      return;
    }
    setEntries((prev) => prev.map((e) => (e.id === id ? data.entry : e)));
  }

  function handleCellBlur(id: string) {
    setEditingCell(null);
    // Read drafts from state at blur time via functional update trick
    setDrafts((prev) => {
      saveDraft(id, prev);
      return prev;
    });
  }

  const deleteEntry = async (id: string) => {
    setDeletingId(id);
    const res = await fetch("/api/owner/payroll", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    setDeletingId(null);
    if (!res.ok) {
      setPageError(data.error ?? "Failed to delete entry.");
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setDrafts((prev) => {
      const d = { ...prev };
      delete d[id];
      return d;
    });
  };

  function updateNewDraft(patch: Partial<EntryDraft>) {
    setNewDraft((prev) => {
      const next = { ...prev, ...patch };
      if (
        ("staffName" in patch || "coachingHours" in patch || "officeHours" in patch) &&
        !("totalPay" in patch)
      ) {
        next.totalPay = calcPay(next.staffName, next.coachingHours, next.officeHours, staffList);
      }
      return next;
    });
  }

  const saveNew = async () => {
    if (!newDraft.weekEndingDate || !newDraft.staffName) {
      setPageError("Week ending date and staff name are required.");
      return;
    }
    setSavingNew(true);
    const res = await fetch("/api/owner/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
    setSavingNew(false);
    if (!res.ok) {
      setPageError(data.error ?? "Failed to save entry.");
      return;
    }
    setEntries((prev) => [...prev, data.entry]);
    setNewDraft(EMPTY_DRAFT);
  };

  const scrollToNewRow = () => {
    newRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const firstInput = newRowRef.current?.querySelector("input");
    firstInput?.focus();
  };

  const thClass =
    "px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]";
  const thSortClass =
    "px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] cursor-pointer select-none hover:text-[var(--text)] transition-colors";

  function SortIcon({ col }: { col: SortColumn }) {
    if (sortColumn !== col) return <ChevronsUpDown size={12} className="ml-1 inline opacity-40" />;
    return sortDir === "asc"
      ? <ChevronUp size={12} className="ml-1 inline text-[var(--pink-soft)]" />
      : <ChevronDown size={12} className="ml-1 inline text-[var(--pink-soft)]" />;
  }

  // Shared td class helpers
  const tdDisplay = "border-y border-[var(--line)] px-3 py-3 cursor-pointer transition-colors hover:bg-[var(--panel-2)]";
  const tdEditing = "border-y border-[var(--line)] px-2 py-2 bg-[var(--panel-2)]";

  return (
    <section className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--text)]">Payroll</h1>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
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
              <th className={thSortClass} onClick={() => handleSort("weekEndingDate")}>
                Week Ending<SortIcon col="weekEndingDate" />
              </th>
              <th className={thSortClass} onClick={() => handleSort("staffName")}>
                Staff Name<SortIcon col="staffName" />
              </th>
              <th className={thSortClass} onClick={() => handleSort("coachingHours")}>
                Coaching Hrs<SortIcon col="coachingHours" />
              </th>
              <th className={thSortClass} onClick={() => handleSort("officeHours")}>
                Office Hrs<SortIcon col="officeHours" />
              </th>
              <th className={thSortClass} onClick={() => handleSort("totalPay")}>
                Total Pay<SortIcon col="totalPay" />
              </th>
              <th className={thSortClass} onClick={() => handleSort("payDate")}>
                Pay Date<SortIcon col="payDate" />
              </th>
              <th className={thClass}>Notes</th>
              <th className={thClass + " w-16"}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-sm text-[var(--text-soft)]">
                  Loading payroll entries...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-sm text-[var(--text-soft)]">
                  No payroll entries yet. Use the row below to add the first one.
                </td>
              </tr>
            ) : (
              sortedEntries.map((entry) => {
                const draft = drafts[entry.id] ?? toDraft(entry);
                const isSaving = savingIds.has(entry.id);
                const isDeleting = deletingId === entry.id;
                const activeCol = editingCell?.id === entry.id ? editingCell.col : null;

                function cell(col: DraftCol) {
                  const isActive = activeCol === col;
                  return {
                    className: isActive ? tdEditing : tdDisplay,
                    onClick: isActive ? undefined : () => setEditingCell({ id: entry.id, col }),
                  };
                }

                const blurProps = {
                  onBlur: () => handleCellBlur(entry.id),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter") handleCellBlur(entry.id);
                    if (e.key === "Escape") setEditingCell(null);
                  },
                };

                return (
                  <tr
                    key={entry.id}
                    className={`group transition ${isSaving ? "opacity-60" : ""}`}
                  >
                    {/* Week Ending */}
                    <td {...cell("weekEndingDate")} className={`rounded-l-2xl ${cell("weekEndingDate").className}`}>
                      {activeCol === "weekEndingDate" ? (
                        <input
                          autoFocus
                          type="date"
                          value={draft.weekEndingDate}
                          onChange={(e) => updateDraft(entry.id, { weekEndingDate: e.target.value })}
                          {...blurProps}
                          className={cellInputClass}
                        />
                      ) : (
                        <span className="text-sm text-[var(--text-muted)]">{formatDate(draft.weekEndingDate)}</span>
                      )}
                    </td>

                    {/* Staff Name */}
                    <td {...cell("staffName")}>
                      {activeCol === "staffName" ? (
                        <select
                          autoFocus
                          value={draft.staffName}
                          onChange={(e) => updateDraft(entry.id, { staffName: e.target.value })}
                          onBlur={() => handleCellBlur(entry.id)}
                          className={cellSelectClass}
                        >
                          <option value="">Select staff...</option>
                          {staffList.map((s) => (
                            <option key={s.name} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm font-medium text-[var(--text)]">{draft.staffName || "—"}</span>
                      )}
                    </td>

                    {/* Coaching Hours */}
                    <td {...cell("coachingHours")}>
                      {activeCol === "coachingHours" ? (
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          step="0.5"
                          value={draft.coachingHours}
                          onChange={(e) => updateDraft(entry.id, { coachingHours: e.target.value })}
                          {...blurProps}
                          className={cellInputClass}
                        />
                      ) : (
                        <span className="text-sm text-[var(--text-muted)]">{draft.coachingHours || "0"}</span>
                      )}
                    </td>

                    {/* Office Hours */}
                    <td {...cell("officeHours")}>
                      {activeCol === "officeHours" ? (
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          step="0.5"
                          value={draft.officeHours}
                          onChange={(e) => updateDraft(entry.id, { officeHours: e.target.value })}
                          {...blurProps}
                          className={cellInputClass}
                        />
                      ) : (
                        <span className="text-sm text-[var(--text-muted)]">{draft.officeHours || "0"}</span>
                      )}
                    </td>

                    {/* Total Pay */}
                    <td {...cell("totalPay")}>
                      {activeCol === "totalPay" ? (
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.totalPay}
                          onChange={(e) => updateDraft(entry.id, { totalPay: e.target.value })}
                          {...blurProps}
                          className={cellPayClass}
                        />
                      ) : (
                        <span className="text-sm font-semibold text-emerald-300">
                          {formatMoney(parseFloat(draft.totalPay) || 0)}
                        </span>
                      )}
                    </td>

                    {/* Pay Date */}
                    <td {...cell("payDate")}>
                      {activeCol === "payDate" ? (
                        <input
                          autoFocus
                          type="date"
                          value={draft.payDate}
                          onChange={(e) => updateDraft(entry.id, { payDate: e.target.value })}
                          {...blurProps}
                          className={cellInputClass}
                        />
                      ) : (
                        <span className="text-sm text-[var(--text-muted)]">{formatDate(draft.payDate)}</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td {...cell("notes")}>
                      {activeCol === "notes" ? (
                        <input
                          autoFocus
                          type="text"
                          value={draft.notes}
                          onChange={(e) => updateDraft(entry.id, { notes: e.target.value })}
                          placeholder="Notes..."
                          {...blurProps}
                          className={cellInputClass}
                        />
                      ) : (
                        <span className="text-sm text-[var(--text-muted)]">{draft.notes || "—"}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="rounded-r-2xl border-y border-[var(--line)] px-3 py-3">
                      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
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
                  <div className="h-px flex-1 bg-[var(--line)]" />
                  <span className="text-xs font-medium uppercase tracking-widest text-[var(--text-soft)]">
                    New Entry
                  </span>
                  <div className="h-px flex-1 bg-[var(--line)]" />
                </div>
              </td>
            </tr>

            {/* Blank input row */}
            <tr ref={newRowRef}>
              <td className="rounded-l-2xl px-3 pb-3 pt-2">
                <input
                  type="date"
                  value={newDraft.weekEndingDate}
                  onChange={(e) => updateNewDraft({ weekEndingDate: e.target.value })}
                  className={cellInputClass}
                />
              </td>
              <td className="px-3 pb-3 pt-2">
                <select
                  value={newDraft.staffName}
                  onChange={(e) => updateNewDraft({ staffName: e.target.value })}
                  className={cellSelectClass}
                >
                  <option value="">Select staff...</option>
                  {staffList.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </td>
              <td className="px-3 pb-3 pt-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={newDraft.coachingHours}
                  onChange={(e) => updateNewDraft({ coachingHours: e.target.value })}
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
                  onChange={(e) => updateNewDraft({ officeHours: e.target.value })}
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
                  onChange={(e) => updateNewDraft({ totalPay: e.target.value })}
                  placeholder="Auto"
                  className={cellPayClass}
                />
              </td>
              <td className="px-3 pb-3 pt-2">
                <input
                  type="date"
                  value={newDraft.payDate}
                  onChange={(e) => updateNewDraft({ payDate: e.target.value })}
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
                  disabled={savingNew || !newDraft.weekEndingDate || !newDraft.staffName}
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
