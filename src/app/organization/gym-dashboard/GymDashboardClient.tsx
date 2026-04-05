"use client";

import { Bell, CalendarClock, CreditCard, Settings, Users } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type DashboardMetrics = {
  totalMembers: number;
  totalCoaches: number;
  totalAdmins: number;
  totalOwners: number;
  totalMrr: number;
};

type TodayClass = {
  id: string;
  name: string;
  classTime: string;
  durationMinutes: number;
  coachName: string | null;
  trackName: string | null;
  sizeLimit: number | null;
};

type TodayWorkout = {
  id: string;
  title: string;
  notes: string | null;
  dayDate: string;
  trackName: string | null;
  blockCount: number;
};

type StripeKpis = {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  totalCustomers: number;
  totalRevenue: number;
};

type StripeIssue = {
  id: string;
  kind: "refund" | "failed_payment";
  amount: number;
  currency: string;
  status: string;
  description: string;
  createdAt: string;
};

type StripeIssuesSummary = {
  refunds30d: number;
  failedPayments30d: number;
  issues: StripeIssue[];
  disputesSupported: boolean;
};

type BirthdayRow = {
  memberName: string;
  email: string | null;
  birthDate: string;
  daysUntil: number;
  membership: string | null;
};

type MemberTrendPoint = {
  monthKey: string;
  monthLabel: string;
  totalMembers: number;
  newMembers: number;
  cancelledMembers: number;
};

type DueTask = {
  id: string;
  title: string;
  dueDate: string;
  priority: string | null;
  status: string | null;
  assignee: string;
};

type DashboardData = {
  todayClasses: TodayClass[];
  todayWorkouts: TodayWorkout[];
  stripeKpis: StripeKpis | null;
  stripeIssues: StripeIssuesSummary;
  upcomingBirthdays: BirthdayRow[];
  memberTrend: MemberTrendPoint[];
  dueTasksToday: DueTask[];
  dueTasksTomorrow: DueTask[];
};

type Props = {
  initialTab: string;
  metrics: DashboardMetrics;
  dashboardData: DashboardData;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTime(t: string) {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

function formatBirthday(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(date);
}

function formatIssueDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function UnderConstructionCard({ title }: { title: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-xl font-semibold text-slate-100">{title}</h3>
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-400">
        under construction
      </div>
    </section>
  );
}

export default function GymDashboardClient({ initialTab, metrics, dashboardData }: Props) {
  void initialTab;

  return (
    <>
      <div className="w-full border-b border-white/10 bg-gradient-to-r from-pink-500/10 via-rose-500/5 to-transparent px-5 py-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Gym Dashboard</p>
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 text-pink-400" />
            <Settings className="h-4 w-4 text-pink-300" />
          </div>
        </div>
      </div>

      <div className="w-full px-4 py-8 lg:py-10">
        <section className="rounded-[28px] border border-white/10 bg-white/5 p-4 md:p-6">
          <header className="mb-6">
            <h1 className="text-3xl font-semibold text-slate-100">HQ Overview</h1>
            <p className="mt-1 text-sm text-slate-400">Live operational metrics for today and near-term risk signals.</p>
          </header>

          <div className="grid gap-4 lg:grid-cols-12">
            <article className="lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">MRR</p>
              <p className="mt-4 text-4xl font-semibold leading-none text-slate-100">
                {formatCurrency(dashboardData.stripeKpis?.mrr ?? 0)}
              </p>
            </article>

            <article className="lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">ARR</p>
              <p className="mt-4 text-4xl font-semibold leading-none text-slate-100">
                {formatCurrency(dashboardData.stripeKpis?.arr ?? 0)}
              </p>
            </article>

            <article className="lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Active Subs</p>
              <p className="mt-4 text-4xl font-semibold leading-none text-slate-100">
                {(dashboardData.stripeKpis?.activeSubscriptions ?? 0).toLocaleString()}
              </p>
            </article>

            <section className="lg:col-span-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-xl font-semibold text-slate-100">Class Schedule Today</h3>
              {dashboardData.todayClasses.length === 0 ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-500">
                  No classes scheduled today.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {dashboardData.todayClasses.map((cls) => (
                    <article key={cls.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-200">{cls.name}</p>
                        <span className="text-xs uppercase tracking-[0.14em] text-sky-300">{formatTime(cls.classTime)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {cls.trackName ?? "No track"} · {cls.durationMinutes} min · Coach: {cls.coachName ?? "Unassigned"}
                      </p>
                      {cls.sizeLimit && cls.sizeLimit > 0 && (
                        <p className="mt-1 text-xs text-cyan-300">Capacity: {cls.sizeLimit}</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="lg:col-span-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-xl font-semibold text-slate-100">Workout Scheduled Today</h3>
              {dashboardData.todayWorkouts.length === 0 ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-500">
                  No workout published for today.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {dashboardData.todayWorkouts.map((workout) => (
                    <article key={workout.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                      <p className="text-sm font-semibold text-slate-200">{workout.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {workout.trackName ?? "No track"} · {workout.blockCount} blocks
                      </p>
                      {workout.notes && <p className="mt-1 text-xs text-slate-400">{workout.notes}</p>}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="lg:col-span-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-100">Stripe Issues</h3>
                <CreditCard className="h-4 w-4 text-pink-300" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Refunds (30d)</p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">{dashboardData.stripeIssues.refunds30d}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Failed Payments (30d)</p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">{dashboardData.stripeIssues.failedPayments30d}</p>
                </div>
              </div>
              {dashboardData.stripeIssues.issues.length === 0 ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-500">
                  No recent Stripe issues.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {dashboardData.stripeIssues.issues.map((issue) => (
                    <article key={issue.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-sm text-slate-200">{issue.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {issue.kind === "refund" ? "Refund" : "Failed Payment"} · {formatCurrency(issue.amount)} · {issue.currency} · {formatIssueDate(issue.createdAt)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
              {!dashboardData.stripeIssues.disputesSupported && (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-400">
                  Stripe disputes: under construction
                </div>
              )}
            </section>

            <section className="lg:col-span-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-xl font-semibold text-slate-100">Upcoming Birthdays (Next 2 Weeks)</h3>
              {dashboardData.upcomingBirthdays.length === 0 ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-500">
                  No birthdays in the next 14 days.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {dashboardData.upcomingBirthdays.map((birthday) => (
                    <article key={`${birthday.email ?? birthday.memberName}-${birthday.birthDate}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-200">{birthday.memberName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatBirthday(birthday.birthDate)} · {birthday.daysUntil === 0 ? "Today" : `${birthday.daysUntil}d`} · {birthday.membership ?? "No membership"}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {dashboardData.memberTrend.length > 0 ? (
              <section className="lg:col-span-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-xl font-semibold text-slate-100">Member Change Metrics (6 Months)</h3>
                <div className="mt-4 h-72 rounded-xl border border-white/10 bg-[#0d1014] p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.memberTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                      <XAxis dataKey="monthLabel" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          background: "#0b1117",
                          border: "1px solid rgba(148,163,184,0.25)",
                          borderRadius: 12,
                          color: "#e2e8f0",
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="totalMembers" stroke="#63f7ff" strokeWidth={3} dot={{ r: 3 }} name="Total" />
                      <Line type="monotone" dataKey="newMembers" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} name="New" />
                      <Line type="monotone" dataKey="cancelledMembers" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} name="Cancelled" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ) : (
              <div className="lg:col-span-6">
                <UnderConstructionCard title="Member Change Metrics" />
              </div>
            )}

            <section className="lg:col-span-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-100">Tasks Due Today</h3>
                <CalendarClock className="h-4 w-4 text-sky-300" />
              </div>
              {dashboardData.dueTasksToday.length === 0 ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-500">
                  No tasks due today.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {dashboardData.dueTasksToday.map((task) => (
                    <article key={task.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-200">{task.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {task.assignee} · {task.priority ?? "No priority"} · {task.status ?? "planned"}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="lg:col-span-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-100">Tasks Due Tomorrow</h3>
                <Users className="h-4 w-4 text-sky-300" />
              </div>
              {dashboardData.dueTasksTomorrow.length === 0 ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-500">
                  No tasks due tomorrow.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {dashboardData.dueTasksTomorrow.map((task) => (
                    <article key={task.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-200">{task.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {task.assignee} · {task.priority ?? "No priority"} · {task.status ?? "planned"}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </>
  );
}
