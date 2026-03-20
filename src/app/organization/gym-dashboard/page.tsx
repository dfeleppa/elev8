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
            <p className="mt-4 text-xs text-pink-200/80">Members have not checked in for {'>'} 10 days.</p>
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
                  {membersAtRisk.map((member) => (
                    <tr key={member.name} className="bg-white/5 text-slate-200">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{member.tier} Tier</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">{member.plan}</td>
                      <td className="px-4 py-3 text-sm text-pink-300">{member.lastVisit}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="rounded-full border border-pink-400/40 bg-pink-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-pink-300 transition hover:border-pink-400"
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
    </SidebarShell>
  );
}
