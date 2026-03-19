import { redirect } from "next/navigation";
import { AlertTriangle, Bell, CalendarClock, Search, Settings, TrendingUp } from "lucide-react";

import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

type DashboardMetrics = {
  totalMembers: number;
  totalCoaches: number;
  totalAdmins: number;
  totalOwners: number;
  totalMrr: number;
};

async function getGymMetrics(organizationId: string): Promise<DashboardMetrics> {
  const { data, error } = await supabaseAdmin
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId);

  if (error) {
    return {
      totalMembers: 0,
      totalCoaches: 0,
      totalAdmins: 0,
      totalOwners: 0,
      totalMrr: 0,
    };
  }

  const rows = data ?? [];
  const totalMembers = rows.filter((row) => row.role === "member").length;
  const totalCoaches = rows.filter((row) => row.role === "coach").length;
  const totalAdmins = rows.filter((row) => row.role === "admin").length;
  const totalOwners = rows.filter((row) => row.role === "owner").length;

  const estimatedArpu = 150;
  const totalMrr = totalMembers * estimatedArpu;

  return {
    totalMembers,
    totalCoaches,
    totalAdmins,
    totalOwners,
    totalMrr,
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

const attendanceByDay = [72, 94, 88, 110, 126, 101, 78];
const attendanceLabels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const recentBookings = [
  { title: "Neon HIIT Session", coach: "Alex R.", minsAgo: 2 },
  { title: "Zen Flow Yoga", coach: "Sarah L.", minsAgo: 15 },
  { title: "Kickboxing Power", coach: "Leo T.", minsAgo: 45 },
];

const membersAtRisk = [
  { name: "Jaxon Draven", plan: "Yearly Performance", lastVisit: "12 Days Ago", tier: "Gold" },
  { name: "Mila Vance", plan: "Monthly Unlimited", lastVisit: "15 Days Ago", tier: "Elite" },
  { name: "Kai Sterling", plan: "3-Month Prep", lastVisit: "10 Days Ago", tier: "Standard" },
];

const upcomingToday = [
  { time: "16:00 PM", className: "Iron Paradise Lift", coach: "Marcus Vane", badge: "Full" },
  { time: "18:30 PM", className: "Tropic Cardio Blast", coach: "Chloe Night", badge: "6 Slots Left" },
];

export default async function GymDashboardPage() {
  const { error, role, userId, organizationIds } = await requireUserContext();
  if (error || !userId || !hasRole("coach", role)) {
    redirect("/organization/member/athlete-dashboard");
  }

  const organizationId = organizationIds[0] ?? null;
  if (!organizationId) {
    redirect("/organization");
  }

  const metrics = await getGymMetrics(organizationId);
  const churnRisk = Math.max(2, Math.round(metrics.totalMembers * 0.011));
  const monthlyDelta = 12.4;

  return (
    <SidebarShell mainClassName="w-full px-4 py-8 lg:py-10">
      <section className="relative overflow-hidden rounded-[28px] border border-[#223047] bg-[#06101f] p-4 text-[#dbe8f8] shadow-[0_24px_80px_rgba(0,0,0,0.5)] md:p-6">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#ff4b9f]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-[#4bc2ff]/20 blur-3xl" />

        <header className="relative z-10 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#89a1bf]">Lyfe Fitness</p>
            <h1 className="mt-1 text-3xl font-semibold italic tracking-wide text-[#f3f7ff]">HQ Overview</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-[#24344d] bg-[#0b172b] px-3 py-2 text-[#8ea3bf] md:flex">
              <Search className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.14em]">Search members...</span>
            </div>
            <Bell className="h-4 w-4 text-[#ff78b6]" />
            <Settings className="h-4 w-4 text-[#f6a3c8]" />
          </div>
        </header>

        <div className="relative z-10 grid gap-4 lg:grid-cols-12">
          <article className="lg:col-span-7 rounded-2xl border border-[#2d3d58] bg-gradient-to-br from-[#1f2534] to-[#1a2230] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#f7b3d6]">Monthly Recurring Revenue</p>
            <p className="mt-4 text-5xl font-semibold leading-none text-[#e9f5ff]">{formatCurrency(metrics.totalMrr)}</p>
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#6deaff]">
              <TrendingUp className="h-4 w-4" />
              +{monthlyDelta}% vs last month
            </p>
            <p className="mt-2 text-xs text-[#89a1bf]">Estimated from active members x $150 monthly.</p>
          </article>

          <article className="lg:col-span-3 rounded-2xl border border-[#24344d] bg-[#101926] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#9db2cb]">Active Members</p>
            <p className="mt-4 text-5xl font-semibold leading-none text-[#e9f5ff]">{metrics.totalMembers.toLocaleString()}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em]">
              <span className="rounded-md bg-[#19384c] px-2.5 py-1 text-[#74deff]">85% Capacity</span>
              <span className="rounded-md bg-[#2a2237] px-2.5 py-1 text-[#f7b3d6]">High Energy</span>
            </div>
          </article>

          <article className="lg:col-span-2 rounded-2xl border border-[#582a3d] bg-[#2b0f1b] p-6">
            <p className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-[#f7b3d6]">
              Churn Risk
              <AlertTriangle className="h-4 w-4" />
            </p>
            <p className="mt-4 text-5xl font-semibold leading-none text-[#ffc7d8]">{churnRisk}</p>
            <p className="mt-4 text-xs text-[#f0a9c2]">Members have not checked in for {'>'} 10 days.</p>
          </article>

          <section className="lg:col-span-8 rounded-2xl border border-[#22344d] bg-[#0d1625] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-3xl font-semibold italic tracking-[0.08em] text-[#f4f8ff]">Attendance Trends</h2>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em]">
                <span className="rounded-full bg-[#2d3a4f] px-3 py-1 text-[#a9bad0]">Daily</span>
                <span className="rounded-full bg-[#f59bc2] px-3 py-1 text-[#1d2636]">Weekly</span>
              </div>
            </div>
            <div className="rounded-xl border border-[#1d2a3f] bg-[#121d2d] p-4">
              <div className="flex h-56 items-end gap-3">
                {attendanceByDay.map((value, index) => (
                  <div key={attendanceLabels[index]} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-[#ff4b9f] to-[#f8c0d9]"
                      style={{ height: `${Math.max(12, Math.round((value / 130) * 190))}px` }}
                    />
                    <span className="text-[10px] uppercase tracking-[0.16em] text-[#7f96b3]">{attendanceLabels[index]}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="lg:col-span-4 space-y-4">
            <section className="rounded-2xl border border-[#2a384f] bg-[#1a2433] p-5">
              <h3 className="text-3xl font-semibold italic tracking-[0.08em] text-[#f4f8ff]">Recent Bookings</h3>
              <div className="mt-4 space-y-3">
                {recentBookings.map((item) => (
                  <article key={item.title} className="rounded-xl border border-[#28374e] bg-[#111d2d] px-3 py-3">
                    <p className="text-sm font-semibold text-[#e6f1ff]">{item.title}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#87a1be]">Booked by {item.coach}</p>
                    <p className="mt-1 text-xs text-[#f7b3d6]">{item.minsAgo} mins ago</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[#f59bc2] bg-[#121f31] p-5 shadow-[0_0_0_1px_rgba(245,155,194,0.1),0_14px_36px_rgba(245,75,159,0.2)]">
              <h3 className="text-3xl font-semibold italic tracking-[0.08em] text-[#f4f8ff]">Upcoming Today</h3>
              <div className="mt-4 space-y-3">
                {upcomingToday.map((item) => (
                  <article key={item.className} className="rounded-xl border border-[#27364d] bg-[#0f1a2a] px-3 py-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold tracking-[0.14em] text-[#6deaff]">{item.time}</span>
                      <span className="rounded-md bg-[#18384a] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#6deaff]">{item.badge}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#e6f1ff]">{item.className}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#89a1bf]">Coach: {item.coach}</p>
                  </article>
                ))}
              </div>
              <button
                type="button"
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#ff8fc5] to-[#ff4b9f] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-[#1a2231] shadow-[0_12px_30px_rgba(255,75,159,0.35)] transition hover:brightness-110"
              >
                Manage Schedule
              </button>
            </section>
          </aside>

          <section className="lg:col-span-8 rounded-2xl border border-[#22344d] bg-[#111c2c] p-5">
            <h2 className="text-3xl font-semibold italic tracking-[0.08em] text-[#f4f8ff]">Members At Risk</h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-[#29364a]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#1f2a3a] text-left text-[11px] uppercase tracking-[0.18em] text-[#8da3bf]">
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Last Visit</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#25364d]">
                  {membersAtRisk.map((member) => (
                    <tr key={member.name} className="bg-[#121d2d] text-[#dbe8f8]">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-xs uppercase tracking-[0.12em] text-[#7f96b3]">{member.tier} Tier</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#b6c7dc]">{member.plan}</td>
                      <td className="px-4 py-3 text-sm text-[#f7b3d6]">{member.lastVisit}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="rounded-full border border-[#5b4060] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f7b3d6] transition hover:border-[#f7b3d6]"
                        >
                          Nudge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="lg:col-span-4 rounded-2xl border border-[#22344d] bg-[#0e1828] p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#93a9c5]">Gym Snapshot</h3>
            <div className="mt-4 space-y-3 text-sm text-[#dbe8f8]">
              <div className="flex items-center justify-between rounded-lg border border-[#24344d] bg-[#111d2d] px-3 py-2">
                <span>Coach Seats</span>
                <span className="font-semibold">{metrics.totalCoaches}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#24344d] bg-[#111d2d] px-3 py-2">
                <span>Admin Seats</span>
                <span className="font-semibold">{metrics.totalAdmins}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#24344d] bg-[#111d2d] px-3 py-2">
                <span>Owner Seats</span>
                <span className="font-semibold">{metrics.totalOwners}</span>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-[#2a3a52] bg-[#121f31] p-3 text-xs text-[#8ea3bf]">
              <p className="flex items-center gap-2 font-semibold uppercase tracking-[0.12em] text-[#a9bdd7]">
                <CalendarClock className="h-4 w-4 text-[#6deaff]" />
                Next Sync
              </p>
              <p className="mt-2">Tonight at 11:30 PM. Data refresh includes attendance, bookings, and role metrics.</p>
            </div>
          </aside>
        </div>
      </section>
    </SidebarShell>
  );
}
