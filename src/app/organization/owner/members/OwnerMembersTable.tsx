"use client";

import { useMemo, useState } from "react";

import type { OwnerMemberRow } from "./page";

type SortColumn = keyof OwnerMemberRow;
type SortDirection = "asc" | "desc";

const columns: Array<{ key: SortColumn; label: string }> = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "membership", label: "Membership" },
  { key: "last_check_in", label: "Last Check-In" },
  { key: "mrr", label: "MRR" },
  { key: "created_at", label: "Created" },
  { key: "updated_at", label: "Updated" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
];

function textValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function compareValues(a: OwnerMemberRow, b: OwnerMemberRow, key: SortColumn) {
  const left = a[key];
  const right = b[key];

  if (key === "mrr") {
    return (left as number | null ?? -Infinity) - (right as number | null ?? -Infinity);
  }

  const leftText = textValue(left).toLowerCase();
  const rightText = textValue(right).toLowerCase();
  if (leftText < rightText) {
    return -1;
  }
  if (leftText > rightText) {
    return 1;
  }
  return 0;
}

export default function OwnerMembersTable({ rows }: { rows: OwnerMemberRow[] }) {
  const [search, setSearch] = useState("");
  const [membershipFilter, setMembershipFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const membershipOptions = useMemo(() => {
    const values = new Set<string>();
    for (const row of rows) {
      const value = row.membership?.trim();
      if (value) {
        values.add(value);
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const roleOptions = useMemo(() => {
    const values = new Set<string>();
    for (const row of rows) {
      const value = row.role?.trim();
      if (value) {
        values.add(value);
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (membershipFilter !== "all" && (row.membership ?? "") !== membershipFilter) {
          return false;
        }

        if (roleFilter !== "all" && (row.role ?? "") !== roleFilter) {
          return false;
        }

        if (!query) {
          return true;
        }

        const haystack = [
          row.first_name,
          row.last_name,
          row.email,
          row.membership,
          row.role,
        ]
          .map((value) => textValue(value).toLowerCase())
          .join(" ");

        return haystack.includes(query);
      })
      .sort((a, b) => {
        const result = compareValues(a, b, sortColumn);
        return sortDirection === "asc" ? result : -result;
      });
  }, [rows, search, membershipFilter, roleFilter, sortColumn, sortDirection]);

  const onSort = (key: SortColumn) => {
    if (sortColumn === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(key);
    setSortDirection("asc");
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email, membership, role"
          className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
        />

        <select
          value={membershipFilter}
          onChange={(event) => setMembershipFilter(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
        >
          <option value="all">All Memberships</option>
          {membershipOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
        >
          <option value="all">All Roles</option>
          {roleOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] border-separate border-spacing-y-3">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.25em] text-slate-400">
              {columns.map((column) => {
                const active = sortColumn === column.key;
                const arrow = !active ? "" : sortDirection === "asc" ? " ▲" : " ▼";

                return (
                  <th key={column.key} className="px-4">
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className={`font-semibold transition ${active ? "text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      {column.label}
                      {arrow}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-400"
                >
                  No members match the current filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => (
                <tr key={`${row.email ?? "member"}-${index}`}>
                  <td className="rounded-l-2xl border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">{row.first_name ?? "-"}</td>
                  <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">{row.last_name ?? "-"}</td>
                  <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">{row.membership ?? "-"}</td>
                  <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">{formatDate(row.last_check_in)}</td>
                  <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">{formatMoney(row.mrr)}</td>
                  <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">{formatDate(row.created_at)}</td>
                  <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">{formatDate(row.updated_at)}</td>
                  <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">{row.email ?? "-"}</td>
                  <td className="rounded-r-2xl border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">{row.role ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
