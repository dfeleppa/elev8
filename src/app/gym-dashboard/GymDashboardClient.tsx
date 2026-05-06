"use client";

import { Bell, CalendarClock, CreditCard, Settings, Users } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Micro, Panel } from "@/components/ui";

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
    <Panel padding="lg">
      <Micro as="p">{title}</Micro>
      <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-5 text-sm text-[var(--text-soft)]">
        under construction
      </div>
    </Panel>
  );
}

export default function GymDashboardClient({ initialTab, metrics, dashboardData }: Props) {
  void initialTab;
  void metrics;

  return (
    <>
      {/* Sub-header strip */}
      <div className="w-full border-b border-[var(--line)] bg-[var(--bg-2)] px-5 py-2">
        <div className="flex items-center justify-between">
          <Micro as="p">Gym Dashboard</Micro>
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 text-[var(--pink)]" />
            <Settings className="h-4 w-4 text-[var(--pink-soft)]" />
          </div>
        </div>
      </div>

      <section className="w-full space-y-8 px-5 pt-8">
        <header>
          <h1 className="text-3xl font-semibold text-[var(--text)]">HQ Overview</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Live operational metrics for today and near-term risk signals.
          </p>
        </header>

        {/* KPI tiles */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel padding="lg">
            <Micro as="p">MRR</Micro>
            <p className="mt-4 text-4xl font-semibold leading-none text-[var(--text)]">
              {formatCurrency(dashboardData.stripeKpis?.mrr ?? 0)}
            </p>
          </Panel>

          <Panel padding="lg">
            <Micro as="p">ARR</Micro>
            <p className="mt-4 text-4xl font-semibold leading-none text-[var(--text)]">
              {formatCurrency(dashboardData.stripeKpis?.arr ?? 0)}
            </p>
          </Panel>

          <Panel padding="lg">
            <Micro as="p">Active Subs</Micro>
            <p className="mt-4 text-4xl font-semibold leading-none text-[var(--text)]">
              {(dashboardData.stripeKpis?.activeSubscriptions ?? 0).toLocaleString()}
            </p>
          </Panel>
        </div>

        {/* Today panels */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel padding="lg">
            <Micro as="p">Class Schedule Today</Micro>
            {dashboardData.todayClasses.length === 0 ? (
              <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-5 text-sm text-[var(--text-soft)]">
                No classes scheduled today.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {dashboardData.todayClasses.map((cls) => (
                  <article
                    key={cls.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--text)]">{cls.name}</p>
                      <span className="text-xs uppercase tracking-[0.14em] text-[var(--cyan)]">
                        {formatTime(cls.classTime)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">
                      {cls.trackName ?? "No track"} | {cls.durationMinutes} min | Coach: {cls.coachName ?? "Unassigned"}
                    </p>
                    {cls.sizeLimit && cls.sizeLimit > 0 && (
                      <p className="mt-1 text-xs text-[var(--cyan)]">Capacity: {cls.sizeLimit}</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel padding="lg">
            <Micro as="p">Workout Scheduled Today</Micro>
            {dashboardData.todayWorkouts.length === 0 ? (
              <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-5 text-sm text-[var(--text-soft)]">
                No workout published for today.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {dashboardData.todayWorkouts.map((workout) => (
                  <article
                    key={workout.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-3"
                  >
                    <p className="text-sm font-semibold text-[var(--text)]">{workout.title}</p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">
                      {workout.trackName ?? "No track"} | {workout.blockCount} blocks
                    </p>
                    {workout.notes && (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{workout.notes}</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Stripe + Birthdays */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel padding="lg">
            <div className="flex items-center justify-between">
              <Micro as="p">Stripe Issues</Micro>
              <CreditCard className="h-4 w-4 text-[var(--pink-soft)]" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
                <Micro as="p">Refunds (30d)</Micro>
                <p className="mt-1 text-lg font-semibold text-[var(--text)]">
                  {dashboardData.stripeIssues.refunds30d}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
                <Micro as="p">Failed Payments (30d)</Micro>
                <p className="mt-1 text-lg font-semibold text-[var(--text)]">
                  {dashboardData.stripeIssues.failedPayments30d}
                </p>
              </div>
            </div>
            {dashboardData.stripeIssues.issues.length === 0 ? (
              <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-5 text-sm text-[var(--text-soft)]">
                No recent Stripe issues.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {dashboardData.stripeIssues.issues.map((issue) => (
                  <article
                    key={issue.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2"
                  >
                    <p className="text-sm text-[var(--text)]">{issue.description}</p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">
                      {issue.kind === "refund" ? "Refund" : "Failed Payment"} | {formatCurrency(issue.amount)} | {issue.currency} | {formatIssueDate(issue.createdAt)}
                    </p>
                  </article>
                ))}
              </div>
            )}
            {!dashboardData.stripeIssues.disputesSupported && (
              <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-4 text-sm text-[var(--text-muted)]">
                Stripe disputes: under construction
              </div>
            )}
          </Panel>

          <Panel padding="lg">
            <Micro as="p">Upcoming Birthdays (Next 2 Weeks)</Micro>
            {dashboardData.upcomingBirthdays.length === 0 ? (
              <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-5 text-sm text-[var(--text-soft)]">
                No birthdays in the next 14 days.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {dashboardData.upcomingBirthdays.map((birthday) => (
                  <article
                    key={`${birthday.email ?? birthday.memberName}-${birthday.birthDate}`}
                    className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-[var(--text)]">{birthday.memberName}</p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">
                      {formatBirthday(birthday.birthDate)} | {birthday.daysUntil === 0 ? "Today" : `${birthday.daysUntil}d`} | {birthday.membership ?? "No membership"}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Member trend chart */}
        {dashboardData.memberTrend.length > 0 ? (
          <Panel padding="lg">
            <Micro as="p">Member Change Metrics (6 Months)</Micro>
            <div className="mt-4 h-72 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboardData.memberTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line-strong)" />
                  <XAxis
                    dataKey="monthLabel"
                    stroke="var(--text-muted)"
                    tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--panel)",
                      border: "1px solid var(--line-strong)",
                      borderRadius: 12,
                      color: "var(--text)",
                    }}
                  />
                  <Legend wrapperStyle={{ color: "var(--text-muted)" }} />
                  <Line type="monotone" dataKey="totalMembers" stroke="var(--cyan)" strokeWidth={3} dot={{ r: 3 }} name="Total" />
                  <Line type="monotone" dataKey="newMembers" stroke="var(--lime)" strokeWidth={2} dot={{ r: 2 }} name="New" />
                  <Line type="monotone" dataKey="cancelledMembers" stroke="var(--pink)" strokeWidth={2} dot={{ r: 2 }} name="Cancelled" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        ) : (
          <UnderConstructionCard title="Member Change Metrics" />
        )}

        {/* Tasks */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel padding="lg">
            <div className="flex items-center justify-between">
              <Micro as="p">Tasks Due Today</Micro>
              <CalendarClock className="h-4 w-4 text-[var(--cyan)]" />
            </div>
            {dashboardData.dueTasksToday.length === 0 ? (
              <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-5 text-sm text-[var(--text-soft)]">
                No tasks due today.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {dashboardData.dueTasksToday.map((task) => (
                  <article
                    key={task.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-[var(--text)]">{task.title}</p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">
                      {task.assignee} | {task.priority ?? "No priority"} | {task.status ?? "planned"}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel padding="lg">
            <div className="flex items-center justify-between">
              <Micro as="p">Tasks Due Tomorrow</Micro>
              <Users className="h-4 w-4 text-[var(--cyan)]" />
            </div>
            {dashboardData.dueTasksTomorrow.length === 0 ? (
              <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-5 text-sm text-[var(--text-soft)]">
                No tasks due tomorrow.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {dashboardData.dueTasksTomorrow.map((task) => (
                  <article
                    key={task.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-[var(--text)]">{task.title}</p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">
                      {task.assignee} | {task.priority ?? "No priority"} | {task.status ?? "planned"}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </section>
    </>
  );
}
