"use client";

import { useMemo, useState } from "react";

import { ownerIconButtonCompactClass } from "../../../../components/owner/buttonStyles";
import { ownerControlBarGridClass, ownerControlInputClass, ownerControlSelectClass } from "../../../../components/owner/controlStyles";
import OwnerDataTable from "../../../../components/owner/OwnerDataTable";
import type { OwnerMemberRow } from "./page";

type SortColumn = keyof OwnerMemberRow;
type SortDirection = "asc" | "desc";

const columns = ["member", "status", "membership", "tracks", "last_check_in", "last_active"] as const;

const externalIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M8 8h8v8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 17L16 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 5h7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M5 5v14h14v-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const phoneIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
    <path
      d="M7 4h3l1.4 3.3L9.8 9a13 13 0 0 0 5.2 5.2l1.7-1.6L20 14v3a2 2 0 0 1-2.2 2A15.8 15.8 0 0 1 5 6.2 2 2 0 0 1 7 4z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const messageIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M4 5h16v10H9l-5 4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const mailIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M4 6h16v12H4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="m5 7 7 6 7-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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

function getFullName(row: OwnerMemberRow) {
  const first = row.first_name?.trim() ?? "";
  const last = row.last_name?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  if (full) {
    return full;
  }
  const email = row.email?.trim();
  if (email) {
    return email.split("@")[0] ?? "Unknown Member";
  }
  return "Unknown Member";
}

function getInitials(row: OwnerMemberRow) {
  const full = getFullName(row)
    .split(/\s+/)
    .filter(Boolean);
  if (full.length === 0) {
    return "?";
  }
  if (full.length === 1) {
    return full[0].slice(0, 1).toUpperCase();
  }
  return `${full[0][0] ?? ""}${full[1][0] ?? ""}`.toUpperCase();
}

function getMembershipTag(value: string | null) {
  const text = (value ?? "").toLowerCase();
  if (!text) {
    return null;
  }
  if (text.includes("punch")) {
    return "Punchcard";
  }
  if (text.includes("unlimited") || text.includes("subscription") || text.includes("monthly")) {
    return "Subscription";
  }
  return null;
}

function getTracks(row: OwnerMemberRow) {
  const dbTracks = row.tracks?.trim();
  if (dbTracks) {
    return dbTracks;
  }

  const membership = (row.membership ?? "").toLowerCase();
  if (membership.includes("pt") || membership.includes("personal")) {
    return "Personal Training";
  }
  return "Main";
}

function getStatus(row: OwnerMemberRow) {
  const dbStatus = row.status?.trim();
  if (dbStatus) {
    return dbStatus;
  }

  if (row.role && row.role !== "member") {
    return "Active";
  }
  if (row.last_check_in || row.updated_at) {
    return "Active";
  }
  return "Pending";
}

function getLastActive(row: OwnerMemberRow) {
  return row.last_active ?? row.updated_at;
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

  const headingClass = (column: SortColumn) => {
    const active = sortColumn === column;
    return `font-semibold transition ${active ? "text-white" : "text-white/90 hover:text-white"}`;
  };

  return (
    <div className="space-y-4">
      <div className={ownerControlBarGridClass}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email, membership, role"
          className={ownerControlInputClass}
        />

        <select
          value={membershipFilter}
          onChange={(event) => setMembershipFilter(event.target.value)}
          className={ownerControlSelectClass}
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
          className={ownerControlSelectClass}
        >
          <option value="all">All Roles</option>
          {roleOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <OwnerDataTable minWidthClassName="min-w-[1180px]">
          <thead>
            <tr>
              <th className="border-b border-slate-300/80 px-3 py-3 font-semibold">Member</th>
              <th className="border-b border-slate-300/80 px-3 py-3 font-semibold">Status</th>
              <th className="border-b border-slate-300/80 px-3 py-3 font-semibold">Membership</th>
              <th className="border-b border-slate-300/80 px-3 py-3 font-semibold">Tracks</th>
              <th className="border-b border-slate-300/80 px-3 py-3 font-semibold">
                <button
                  type="button"
                  onClick={() => onSort("last_check_in")}
                  className={headingClass("last_check_in")}
                >
                  Last Check-In{sortColumn === "last_check_in" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                </button>
              </th>
              <th className="border-b border-slate-300/80 px-3 py-3 font-semibold">
                <button
                  type="button"
                  onClick={() => onSort("last_active")}
                  className={headingClass("last_active")}
                >
                  Last Active{sortColumn === "last_active" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-sm text-slate-500"
                >
                  No members match the current filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => {
                const status = getStatus(row);
                return (
                <tr key={`${row.email ?? "member"}-${index}`}>
                  <td className="rounded-l-2xl border-y border-slate-200 px-4 py-4 align-top">
                    <div className="flex items-start gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-400/50 bg-emerald-500/12 text-xs font-semibold text-emerald-700">
                        {getInitials(row)}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-tight text-slate-900">{getFullName(row)}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.email ?? "-"}</p>
                        <div className="mt-2 flex items-center gap-2 text-slate-500">
                          <button type="button" className={ownerIconButtonCompactClass}>{externalIcon}</button>
                          <button type="button" className={ownerIconButtonCompactClass}>{phoneIcon}</button>
                          <button type="button" className={ownerIconButtonCompactClass}>{messageIcon}</button>
                          <button type="button" className={ownerIconButtonCompactClass}>{mailIcon}</button>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="border-y border-slate-200 px-4 py-4 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-emerald-600/35 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                        {status}
                      </span>
                      {!row.last_check_in && !row.status ? (
                        <span className="rounded-full border border-slate-400/40 bg-slate-200/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Pending
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="border-y border-slate-200 px-4 py-4 align-top">
                    <p className="text-sm text-slate-700">{row.membership ?? "-"}</p>
                    {getMembershipTag(row.membership) ? (
                      <span className="mt-2 inline-block rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white">
                        {getMembershipTag(row.membership)}
                      </span>
                    ) : null}
                  </td>
                  <td className="border-y border-slate-200 px-4 py-4 align-top text-sm text-slate-700">{getTracks(row)}</td>
                  <td className="border-y border-slate-200 px-4 py-4 align-top text-sm text-slate-700">{formatDate(row.last_check_in)}</td>
                  <td className="rounded-r-2xl border-y border-slate-200 px-4 py-4 align-top text-sm text-slate-700">{formatDate(getLastActive(row))}</td>
                </tr>
                );
              })
            )}
          </tbody>
      </OwnerDataTable>
    </div>
  );
}
