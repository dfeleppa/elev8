"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import MemberImportButton from "../../../../components/owner/MemberImportButton";
import OwnerMembersTable from "./OwnerMembersTable";
import type { OwnerMemberRow } from "./page";

type TabId = "dashboard" | "membership" | "churn-risk" | "birthdays";

const TABS: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "membership", label: "Membership" },
  { id: "churn-risk", label: "Churn Risk" },
  { id: "birthdays", label: "Birthdays" },
];

function resolveTab(raw: string): TabId {
  const valid: TabId[] = ["dashboard", "membership", "churn-risk", "birthdays"];
  return valid.includes(raw as TabId) ? (raw as TabId) : "dashboard";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function getFullName(row: OwnerMemberRow) {
  const first = row.first_name?.trim() ?? "";
  const last = row.last_name?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full || row.email?.split("@")[0] || "Unknown";
}

function daysSince(value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function upcomingBirthdayDays(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const bd = new Date(birthDate);
  if (Number.isNaN(bd.getTime())) return null;

  const now = new Date();
  const thisYear = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
  if (thisYear < now) {
    thisYear.setFullYear(now.getFullYear() + 1);
  }
  return Math.floor((thisYear.getTime() - now.getTime()) / 86_400_000);
}

type Props = {
  initialTab: string;
  members: OwnerMemberRow[];
  error?: string | null;
};

export default function OwnerMembersClient({ initialTab, members, error }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>(resolveTab(initialTab));

  function switchTab(tab: TabId) {
    setActiveTab(tab);
    router.replace(`?tab=${tab}`, { scroll: false });
  }

  // --- Membership tab data ---
  const membershipBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of members) {
      const key = row.membership?.trim() || "No Membership";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, pct: Math.round((count / members.length) * 100) }));
  }, [members]);

  // --- Churn Risk tab data ---
  const churnRows = useMemo(() => {
    return members
      .map((row) => {
        const lastSeen = row.last_check_in ?? row.last_active ?? row.updated_at ?? null;
        const days = daysSince(lastSeen);
        return { row, lastSeen, days };
      })
      .filter(({ days }) => days === null || days >= 30)
      .sort((a, b) => {
        if (a.days === null && b.days === null) return 0;
        if (a.days === null) return -1;
        if (b.days === null) return 1;
        return b.days - a.days;
      });
  }, [members]);

  // --- Birthdays tab data ---
  const birthdayRows = useMemo(() => {
    return members
      .map((row) => ({ row, daysUntil: upcomingBirthdayDays(row.birth_date ?? null) }))
      .filter(({ daysUntil }) => daysUntil !== null && daysUntil <= 30)
      .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));
  }, [members]);

  return (
    <>
      {/* Sub-header / tab strip */}
      <div className="w-full border-b border-[var(--line)] bg-gradient-to-r from-[var(--pink)]/8 via-[var(--pink)]/4 to-transparent px-5 py-2">
        {error ? (
          <div className="mb-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
            {error}
          </div>
        ) : null}
        <div className="app-subheader-scroll">
          <div className="app-subheader-track">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={
                activeTab === tab.id
                  ? "shrink-0 whitespace-nowrap rounded-xl border border-[var(--pink-soft)]/30 bg-[var(--pink-soft)]/15 px-4 py-2 text-sm font-semibold text-[var(--pink-soft)] transition-colors"
                  : "shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
              }
            >
              {tab.label}
              {tab.id === "churn-risk" && churnRows.length > 0 && (
                <span className="ml-1.5 rounded-full bg-[var(--pink-soft)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--pink-soft)]">
                  {churnRows.length}
                </span>
              )}
              {tab.id === "birthdays" && birthdayRows.length > 0 && (
                <span className="ml-1.5 rounded-full bg-[var(--pink-soft)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--pink-soft)]">
                  {birthdayRows.length}
                </span>
              )}
            </button>
          ))}
          </div>
        </div>
      </div>

      <section className="w-full space-y-8 px-5 pt-8 lg:px-8">

        {/* Dashboard tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-muted)]">{members.length} members</p>
              <MemberImportButton />
            </div>
            <OwnerMembersTable rows={members} />
          </div>
        )}

        {/* Membership tab */}
        {activeTab === "membership" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {membershipBreakdown.map(({ name, count, pct }) => (
                <div key={name} className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-5 py-4">
                  <p className="truncate text-xs text-[var(--text-muted)]">{name}</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--text)]">{count}</p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--line-strong)]">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-[11px] text-[var(--text-soft)]">{pct}%</p>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--panel-2)]">
                    <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Membership</th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Members</th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {membershipBreakdown.map(({ name, count, pct }) => (
                    <tr key={name} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--panel-2)]">
                      <td className="px-4 py-3 text-[var(--text)]">{name}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{count}</td>
                      <td className="px-4 py-3 text-[var(--text-soft)]">{pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Churn Risk tab */}
        {activeTab === "churn-risk" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">
              {churnRows.length} member{churnRows.length !== 1 ? "s" : ""} with no check-in in 30+ days.
            </p>
            {churnRows.length === 0 ? (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-5 py-8 text-center text-sm text-emerald-400">
                No churn risk detected — all members have been active recently.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--panel-2)]">
                      <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Member</th>
                      <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Membership</th>
                      <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Last Seen</th>
                      <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Days Inactive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {churnRows.map(({ row, lastSeen, days }, i) => (
                      <tr key={`${row.email ?? i}`} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--panel-2)]">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[var(--text)]">{getFullName(row)}</p>
                          <p className="text-xs text-[var(--text-soft)]">{row.email ?? "-"}</p>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-muted)]">{row.membership ?? "-"}</td>
                        <td className="px-4 py-3 text-[var(--text-muted)]">{formatDate(lastSeen)}</td>
                        <td className="px-4 py-3">
                          {days === null ? (
                            <span className="rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
                              Never
                            </span>
                          ) : (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${days >= 90 ? "border border-rose-500/30 bg-rose-500/10 text-rose-400" : "border border-amber-500/30 bg-amber-500/10 text-amber-400"}`}>
                              {days}d
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Birthdays tab */}
        {activeTab === "birthdays" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">
              {birthdayRows.length} member{birthdayRows.length !== 1 ? "s" : ""} with a birthday in the next 30 days.
            </p>
            {birthdayRows.length === 0 ? (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-5 py-8 text-center text-sm text-[var(--text-soft)]">
                No birthdays in the next 30 days.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--panel-2)]">
                      <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Member</th>
                      <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Birthday</th>
                      <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Days Away</th>
                      <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Membership</th>
                    </tr>
                  </thead>
                  <tbody>
                    {birthdayRows.map(({ row, daysUntil }, i) => (
                      <tr key={`${row.email ?? i}`} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--panel-2)]">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[var(--text)]">{getFullName(row)}</p>
                          <p className="text-xs text-[var(--text-soft)]">{row.email ?? "-"}</p>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-muted)]">
                          {row.birth_date
                            ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(new Date(row.birth_date))
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {daysUntil === 0 ? (
                            <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                              Today!
                            </span>
                          ) : (
                            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
                              {daysUntil}d
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-soft)]">{row.membership ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </section>
    </>
  );
}
