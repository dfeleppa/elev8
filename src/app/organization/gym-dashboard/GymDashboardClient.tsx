"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CalendarClock, Search, Settings, TrendingUp } from "lucide-react";

import type { OwnerMemberRow } from "../owner/members/page";

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
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
  if (thisYear < now) thisYear.setFullYear(now.getFullYear() + 1);
  return Math.floor((thisYear.getTime() - now.getTime()) / 86_400_000);
}

type DashboardMetrics = {
  totalMembers: number;
  totalCoaches: number;
  totalAdmins: number;
  totalOwners: number;
  totalMrr: number;
};

const attendanceByDay = [72, 94, 88, 110, 126, 101, 78];
const attendanceLabels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const recentBookings = [
  { title: "Neon HIIT Session", coach: "Alex R.", minsAgo: 2 },
  { title: "Zen Flow Yoga", coach: "Sarah L.", minsAgo: 15 },
  { title: "Kickboxing Power", coach: "Leo T.", minsAgo: 45 },
];
const upcomingToday = [
  { time: "16:00 PM", className: "Iron Paradise Lift", coach: "Marcus Vane", badge: "Full" },
  { time: "18:30 PM", className: "Tropic Cardio Blast", coach: "Chloe Night", badge: "6 Slots Left" },
];

type Props = {
  initialTab: string;
  metrics: DashboardMetrics;
  members: OwnerMemberRow[];
};

export default function GymDashboardClient({ initialTab, metrics, members }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>(resolveTab(initialTab));

  function switchTab(tab: TabId) {
    setActiveTab(tab);
    router.replace(`?tab=${tab}`, { scroll: false });
  }

  const churnRisk = Math.max(2, Math.round(metrics.totalMembers * 0.011));
  const monthlyDelta = 12.4;

  // Membership breakdown
  const membershipBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of members) {
      const key = row.membership?.trim() || "No Membership";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, pct: members.length ? Math.round((count / members.length) * 100) : 0 }));
  }, [members]);

  // Churn risk
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

  // Birthdays
  const birthdayRows = useMemo(() => {
    return members
      .map((row) => ({ row, daysUntil: upcomingBirthdayDays(row.birth_date ?? null) }))
      .filter(({ daysUntil }) => daysUntil !== null && daysUntil <= 30)
      .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));
  }, [members]);

  return (
    <>
      {/* Sub-header / tab strip */}
      <div className="w-full border-b border-white/10 bg-gradient-to-r from-pink-500/10 via-rose-500/5 to-transparent px-5 py-2">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={
                activeTab === tab.id
                  ? "rounded-xl border border-[#ffb1c4]/30 bg-[#ffb1c4]/15 px-4 py-2 text-sm font-semibold text-[#ffb1c4] transition-colors"
                  : "rounded-xl px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
              }
            >
              {tab.label}
              {tab.id === "churn-risk" && churnRows.length > 0 && (
                <span className="ml-1.5 rounded-full bg-[#ffb1c4]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#ffb1c4]">
                  {churnRows.length}
                </span>
              )}
              {tab.id === "birthdays" && birthdayRows.length > 0 && (
                <span className="ml-1.5 rounded-full bg-[#ffb1c4]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#ffb1c4]">
                  {birthdayRows.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full px-4 py-8 lg:py-10">

        {/* Dashboard tab */}
        {activeTab === "dashboard" && (
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-4 md:p-6">
            <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Lyfe Fitness</p>
                <h1 className="mt-1 text-3xl font-semibold text-slate-100">HQ Overview</h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-400 md:flex">
                  <Search className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-[0.14em]">Search members...</span>
                </div>
                <Bell className="h-4 w-4 text-pink-400" />
                <Settings className="h-4 w-4 text-pink-300" />
              </div>
            </header>

            <div className="grid gap-4 lg:grid-cols-12">
              <article className="lg:col-span-7 rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-pink-300">Monthly Recurring Revenue</p>
                <p className="mt-4 text-5xl font-semibold leading-none text-slate-100">{formatCurrency(metrics.totalMrr)}</p>
                <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-300">
                  <TrendingUp className="h-4 w-4" />
                  +{monthlyDelta}% vs last month
                </p>
                <p className="mt-2 text-xs text-slate-500">Estimated from active members x $150 monthly.</p>
              </article>

              <article className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Active Members</p>
                <p className="mt-4 text-5xl font-semibold leading-none text-slate-100">{metrics.totalMembers.toLocaleString()}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em]">
                  <span className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1 text-cyan-300">85% Capacity</span>
                  <span className="rounded-md border border-pink-400/40 bg-pink-500/10 px-2.5 py-1 text-pink-300">High Energy</span>
                </div>
              </article>

              <article className="lg:col-span-2 rounded-2xl border border-pink-400/30 bg-pink-500/5 p-6">
                <p className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-pink-300">
                  Churn Risk
                  <AlertTriangle className="h-4 w-4" />
                </p>
                <p className="mt-4 text-5xl font-semibold leading-none text-slate-100">{churnRisk}</p>
                <p className="mt-4 text-xs text-pink-200/80">Members have not checked in for &gt; 10 days.</p>
              </article>

              <section className="lg:col-span-8 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-3xl font-semibold text-slate-100">Attendance Trends</h2>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em]">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-400">Daily</span>
                    <span className="rounded-full bg-pink-500/10 border border-pink-400/40 px-3 py-1 text-pink-300">Weekly</span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex h-56 items-end gap-3">
                    {attendanceByDay.map((value, index) => (
                      <div key={attendanceLabels[index]} className="flex flex-1 flex-col items-center gap-2">
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-pink-400 to-pink-600"
                          style={{ height: `${Math.max(12, Math.round((value / 130) * 190))}px` }}
                        />
                        <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{attendanceLabels[index]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <aside className="lg:col-span-4 space-y-4">
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-3xl font-semibold text-slate-100">Recent Bookings</h3>
                  <div className="mt-4 space-y-3">
                    {recentBookings.map((item) => (
                      <article key={item.title} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                        <p className="text-sm font-semibold text-slate-200">{item.title}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-slate-500">Booked by {item.coach}</p>
                        <p className="mt-1 text-xs text-pink-300">{item.minsAgo} mins ago</p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-pink-400/30 bg-pink-500/5 p-5 shadow-[0_0_0_1px_rgba(255,177,196,0.1),0_14px_36px_rgba(255,75,159,0.2)]">
                  <h3 className="text-3xl font-semibold text-slate-100">Upcoming Today</h3>
                  <div className="mt-4 space-y-3">
                    {upcomingToday.map((item) => (
                      <article key={item.className} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-semibold tracking-[0.14em] text-sky-300">{item.time}</span>
                          <span className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-cyan-300">{item.badge}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-200">{item.className}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-slate-500">Coach: {item.coach}</p>
                      </article>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-4 w-full rounded-xl bg-gradient-to-br from-pink-400 to-pink-600 px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[0_4px_20px_rgba(255,177,196,0.2)] transition hover:brightness-110"
                  >
                    Manage Schedule
                  </button>
                </section>
              </aside>

              <section className="lg:col-span-8 rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-3xl font-semibold text-slate-100">Members At Risk</h2>
                <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-white/5 text-left text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        <th className="px-4 py-3">Member</th>
                        <th className="px-4 py-3">Plan</th>
                        <th className="px-4 py-3">Last Visit</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {[
                        { name: "Jaxon Draven", plan: "Yearly Performance", lastVisit: "12 Days Ago", tier: "Gold" },
                        { name: "Mila Vance", plan: "Monthly Unlimited", lastVisit: "15 Days Ago", tier: "Elite" },
                        { name: "Kai Sterling", plan: "3-Month Prep", lastVisit: "10 Days Ago", tier: "Standard" },
                      ].map((member) => (
                        <tr key={member.name} className="bg-white/5 text-slate-200">
                          <td className="px-4 py-3">
                            <p className="font-semibold">{member.name}</p>
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{member.tier} Tier</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-300">{member.plan}</td>
                          <td className="px-4 py-3 text-sm text-pink-300">{member.lastVisit}</td>
                          <td className="px-4 py-3 text-right">
                            <button type="button" className="rounded-full border border-pink-400/40 bg-pink-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-pink-300 transition hover:border-pink-400">
                              Nudge
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <aside className="lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Gym Snapshot</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <span>Coach Seats</span>
                    <span className="font-semibold text-slate-100">{metrics.totalCoaches}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <span>Admin Seats</span>
                    <span className="font-semibold text-slate-100">{metrics.totalAdmins}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <span>Owner Seats</span>
                    <span className="font-semibold text-slate-100">{metrics.totalOwners}</span>
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
                  <p className="flex items-center gap-2 font-semibold uppercase tracking-[0.12em] text-slate-300">
                    <CalendarClock className="h-4 w-4 text-sky-300" />
                    Next Sync
                  </p>
                  <p className="mt-2">Tonight at 11:30 PM. Data refresh includes attendance, bookings, and role metrics.</p>
                </div>
              </aside>
            </div>
          </section>
        )}

        {/* Membership tab */}
        {activeTab === "membership" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {membershipBreakdown.map(({ name, count, pct }) => (
                <div key={name} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                  <p className="truncate text-xs text-slate-400">{name}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-100">{count}</p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-pink-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-right text-[11px] text-slate-500">{pct}%</p>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-4 py-3 font-semibold text-slate-300">Membership</th>
                    <th className="px-4 py-3 font-semibold text-slate-300">Members</th>
                    <th className="px-4 py-3 font-semibold text-slate-300">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {membershipBreakdown.map(({ name, count, pct }) => (
                    <tr key={name} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                      <td className="px-4 py-3 text-slate-200">{name}</td>
                      <td className="px-4 py-3 text-slate-300">{count}</td>
                      <td className="px-4 py-3 text-slate-400">{pct}%</td>
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
            <p className="text-sm text-slate-400">
              {churnRows.length} member{churnRows.length !== 1 ? "s" : ""} with no check-in in 30+ days.
            </p>
            {churnRows.length === 0 ? (
              <div className="rounded-2xl border border-pink-400/20 bg-pink-500/5 px-5 py-8 text-center text-sm text-pink-300">
                No churn risk detected — all members have been active recently.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-4 py-3 font-semibold text-slate-300">Member</th>
                      <th className="px-4 py-3 font-semibold text-slate-300">Membership</th>
                      <th className="px-4 py-3 font-semibold text-slate-300">Last Seen</th>
                      <th className="px-4 py-3 font-semibold text-slate-300">Days Inactive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {churnRows.map(({ row, lastSeen, days }, i) => (
                      <tr key={`${row.email ?? i}`} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-100">{getFullName(row)}</p>
                          <p className="text-xs text-slate-500">{row.email ?? "-"}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{row.membership ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-400">{formatDate(lastSeen)}</td>
                        <td className="px-4 py-3">
                          {days === null ? (
                            <span className="rounded-full border border-slate-400/30 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-400">Never</span>
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
            <p className="text-sm text-slate-400">
              {birthdayRows.length} member{birthdayRows.length !== 1 ? "s" : ""} with a birthday in the next 30 days.
            </p>
            {birthdayRows.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-8 text-center text-sm text-slate-500">
                No birthdays in the next 30 days.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-4 py-3 font-semibold text-slate-300">Member</th>
                      <th className="px-4 py-3 font-semibold text-slate-300">Birthday</th>
                      <th className="px-4 py-3 font-semibold text-slate-300">Days Away</th>
                      <th className="px-4 py-3 font-semibold text-slate-300">Membership</th>
                    </tr>
                  </thead>
                  <tbody>
                    {birthdayRows.map(({ row, daysUntil }, i) => (
                      <tr key={`${row.email ?? i}`} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-100">{getFullName(row)}</p>
                          <p className="text-xs text-slate-500">{row.email ?? "-"}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {row.birth_date
                            ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(new Date(row.birth_date))
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {daysUntil === 0 ? (
                            <span className="rounded-full border border-[#ffb1c4]/40 bg-[#ffb1c4]/15 px-2.5 py-1 text-[11px] font-bold text-[#ffb1c4]">Today!</span>
                          ) : (
                            <span className="rounded-full border border-[#ffb1c4]/20 bg-[#ffb1c4]/10 px-2.5 py-1 text-[11px] font-semibold text-[#ffb1c4]">{daysUntil}d</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{row.membership ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}
