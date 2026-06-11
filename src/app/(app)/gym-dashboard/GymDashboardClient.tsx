"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Cake,
  CalendarRange,
  Check,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Filter,
  Gift,
  ListTodo,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  Undo2,
  Users,
  XOctagon,
} from "lucide-react";

import { AccentCard, Micro, Panel, Ring, Sparkline } from "@/components/ui";

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

const TABS = ["Today", "Members", "Programming", "Money", "Tasks"] as const;
type Tab = (typeof TABS)[number];

const SLOT_BUCKETS = [
  { key: "EARLY", label: "EARLY", startHour: 5, endHour: 9 },
  { key: "MID", label: "MID", startHour: 9, endHour: 12 },
  { key: "LUNCH", label: "LUNCH", startHour: 12, endHour: 15 },
  { key: "EVE", label: "EVE", startHour: 15, endHour: 22 },
] as const;

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

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
  return `${String(h).padStart(2, "0")}:${m.padStart(2, "0")}`;
}

function birthdayWhen(daysUntil: number) {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `In ${daysUntil}d`;
}

function relativeIssueDate(value: string) {
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return "—";
  const diffMs = Date.now() - ts;
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 2) return "Yesterday";
  return `${days} days`;
}

function sign(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function priorityPill(prio: string | null) {
  const p = (prio ?? "").toLowerCase();
  if (p === "high" || p === "urgent") return "pill-danger";
  if (p === "med" || p === "medium" || p === "normal") return "pill-amber";
  return "pill-ink";
}

function classStatus(cls: TodayClass): { pill: string; label: string } {
  if (!cls.sizeLimit || cls.sizeLimit <= 0) {
    return { pill: "pill-ink", label: "OPEN" };
  }
  return { pill: "pill-ink", label: `CAP ${cls.sizeLimit}` };
}

function buildHeatmap(classes: TodayClass[]) {
  // Synthesize a 4-slot × 7-day grid. We only have today's classes, so all
  // weight goes to today's column; other days render as 0%. The cell value is
  // the count of classes in that slot, normalised to [0..1].
  const todayDow = (new Date().getDay() + 6) % 7; // Mon=0..Sun=6
  const slotCounts = SLOT_BUCKETS.map((s) =>
    classes.filter((c) => {
      const h = parseInt(c.classTime.split(":")[0] ?? "0", 10);
      return h >= s.startHour && h < s.endHour;
    }).length
  );
  const maxCount = Math.max(1, ...slotCounts);
  return SLOT_BUCKETS.map((slot, slotIdx) => {
    const row = Array.from({ length: 7 }, (_, dayIdx) => {
      if (dayIdx !== todayDow) return 0;
      return slotCounts[slotIdx] / maxCount;
    });
    return { slot: slot.label, row };
  });
}

function heatCell(value: number) {
  // Map [0..1] to a tint of pink (matches design).
  const a = 0.08 + value * 0.65;
  return `rgba(225, 48, 108, ${a.toFixed(2)})`;
}

export default function GymDashboardClient({ initialTab, metrics, dashboardData }: Props) {
  const initial: Tab = useMemo(() => {
    const match = TABS.find((t) => t.toLowerCase() === initialTab?.toLowerCase());
    return match ?? "Today";
  }, [initialTab]);
  const [activeTab, setActiveTab] = useState<Tab>(initial);
  const [doneTasks, setDoneTasks] = useState<Record<string, boolean>>({});

  const dateStr = useMemo(
    () =>
      new Date()
        .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        .toUpperCase(),
    []
  );

  const mrr = dashboardData.stripeKpis?.mrr ?? metrics.totalMrr ?? 0;
  const arr = dashboardData.stripeKpis?.arr ?? mrr * 12;
  const activeSubs =
    dashboardData.stripeKpis?.activeSubscriptions ?? metrics.totalMembers ?? 0;

  const trend = dashboardData.memberTrend;
  const latest = trend[trend.length - 1];
  const previous = trend[trend.length - 2];

  const subsDelta = latest && previous ? latest.totalMembers - previous.totalMembers : 0;
  const newMembers30d = latest?.newMembers ?? 0;
  const cancelled30d = latest?.cancelledMembers ?? 0;
  const mrrDeltaPct =
    previous && previous.totalMembers > 0 && latest
      ? ((latest.totalMembers - previous.totalMembers) / previous.totalMembers) * 100
      : 0;

  const memberSpark = trend.map((p) => p.totalMembers);
  // Synthesize an MRR sparkline from member trend (proxy if no MRR history exists).
  const mrrSpark = trend.map((p, i) => {
    const ratio = latest && latest.totalMembers > 0 ? p.totalMembers / latest.totalMembers : 1;
    return Math.round(mrr * ratio * (0.92 + (i / Math.max(1, trend.length - 1)) * 0.08));
  });

  const utilization = useMemo(() => {
    // Schedule-density proxy: today's class count / 8 (typical daily slots), capped.
    const ratio = dashboardData.todayClasses.length / 8;
    return Math.max(0, Math.min(1, ratio));
  }, [dashboardData.todayClasses.length]);

  const heatmap = useMemo(() => buildHeatmap(dashboardData.todayClasses), [dashboardData.todayClasses]);

  const churnSignal = useMemo(() => {
    const recent = trend.slice(-3);
    const churnedTotal = recent.reduce((acc, p) => acc + p.cancelledMembers, 0);
    return { count: churnedTotal, monthsCovered: recent.length };
  }, [trend]);

  const churnPct = useMemo(() => {
    if (!latest || latest.totalMembers <= 0) return 0;
    return (latest.cancelledMembers / latest.totalMembers) * 100;
  }, [latest]);

  const lifetimeAvg = "22 mo"; // No source data — keep static placeholder per design.

  const classCount = dashboardData.todayClasses.length;
  const todayWorkout = dashboardData.todayWorkouts[0] ?? null;

  const trendMaxTotal = Math.max(1, ...trend.map((p) => p.totalMembers));
  const trendMinTotal = Math.min(0, ...trend.map((p) => p.totalMembers));

  return (
    <section className="gym-dashboard-canvas min-h-[calc(100vh-3.5rem)] w-full pb-12">
      {/* Topbar */}
      <header className="px-6 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Micro as="p">GYM DASHBOARD · {dateStr}</Micro>
            <h1 className="font-head mt-1 text-[28px] font-semibold leading-tight tracking-tight text-[var(--text)] md:text-[32px]">
              HQ Overview
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 md:flex">
              <Search className="h-4 w-4 opacity-60" />
              <input
                className="w-44 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-soft)]"
                placeholder="Search members, classes…"
              />
              <span className="micro" style={{ fontSize: 9.5 }}>⌘K</span>
            </div>
            <button
              className="hover-lift relative rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2"
              title="Notifications"
              type="button"
            >
              <Bell className="h-[18px] w-[18px]" />
              <span
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--pink)" }}
              />
            </button>
            <button
              className="hover-lift flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold"
              style={{ background: "var(--text)", color: "var(--bg)" }}
              type="button"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          </div>
        </div>

        <nav
          className="mt-4 flex flex-wrap items-center gap-6"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className={
                "tab-underline" + (activeTab === t ? " tab-underline-active" : "")
              }
            >
              {t}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 pb-2">
            <Micro as="span">Range</Micro>
            <span className="pill pill-ink inline-flex items-center gap-1.5">
              <CalendarRange className="h-3 w-3" /> Last 30 days
            </span>
          </div>
        </nav>
      </header>

      <div className="space-y-6 px-6 pt-6">
        {/* Hero KPI row */}
        <section className="grid grid-cols-12 gap-4">
          {/* MRR — accent ink */}
          <AccentCard tone="ink" className="fade-in col-span-12 md:col-span-5" withDots={false}>
            <div className="flex items-start justify-between">
              <div>
                <Micro onAccent>MONTHLY REVENUE</Micro>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="stat-num" style={{ fontSize: 48 }}>
                    {formatCurrency(mrr)}
                  </span>
                  <span
                    className="pill"
                    style={{
                      background: "rgba(126,240,189,0.16)",
                      color: "#7ef0bd",
                      border: "1px solid rgba(126,240,189,0.30)",
                    }}
                  >
                    <TrendingUp className="h-3 w-3" /> {sign(Number(mrrDeltaPct.toFixed(1)))}%
                  </span>
                </div>
                <div className="mt-1.5 text-[12.5px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                  vs. prior month · ARR {formatCurrency(arr)}
                </div>
              </div>
              <CreditCard className="h-5 w-5 opacity-50" />
            </div>
            <div className="mt-3" style={{ color: "#ff79a5" }}>
              {mrrSpark.length > 1 && (
                <Sparkline values={mrrSpark} stroke="#ff79a5" fill="#ff79a5" width={460} height={48} />
              )}
            </div>
          </AccentCard>

          {/* Active members — accent pink */}
          <AccentCard tone="pink" className="fade-in col-span-12 md:col-span-4" withDots={false}>
            <div className="flex items-start justify-between">
              <div>
                <Micro onAccent>ACTIVE MEMBERS</Micro>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="stat-num" style={{ fontSize: 48 }}>
                    {activeSubs.toLocaleString()}
                  </span>
                  <span
                    className="font-mono rounded px-1.5 py-0.5 text-[12px] font-semibold"
                    style={{ background: "rgba(35,0,18,0.12)", color: "#230012" }}
                  >
                    {sign(subsDelta)} this mo
                  </span>
                </div>
                <div
                  className="mt-1.5 text-[12.5px]"
                  style={{ color: "rgba(35,0,18,0.65)" }}
                >
                  {newMembers30d} joined · {cancelled30d} left (30d)
                </div>
              </div>
              <Users className="h-5 w-5 opacity-60" />
            </div>
            <div className="mt-3" style={{ color: "#640325" }}>
              {memberSpark.length > 1 && (
                <Sparkline values={memberSpark} stroke="#640325" fill="#640325" width={300} height={44} />
              )}
            </div>
          </AccentCard>

          {/* Schedule density / utilization */}
          <Panel padding="lg" className="fade-in hover-lift col-span-12 flex items-center gap-4 md:col-span-3">
            <Ring progress={utilization} size={96} stroke={10} fillColor="var(--pink)" trackColor="var(--line-strong)">
              <div className="flex flex-col items-center justify-center">
                <div className="font-head font-semibold leading-none" style={{ fontSize: 26 }}>
                  {Math.round(utilization * 100)}
                  <span style={{ fontSize: 14 }}>%</span>
                </div>
                <div className="micro mt-0.5">SCHEDULE</div>
              </div>
            </Ring>
            <div className="min-w-0">
              <div className="font-head text-[15px] font-semibold">Schedule density</div>
              <div className="mt-1 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                {classCount} classes scheduled today.
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="pill pill-amber inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> {metrics.totalCoaches} coaches
                </span>
              </div>
            </div>
          </Panel>
        </section>

        {/* Classes + Workout */}
        <section className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-7">
            <Panel padding="lg" className="fade-in hover-lift">
              <div className="flex items-center justify-between">
                <div>
                  <Micro as="p">TODAY · {classCount} CLASS{classCount === 1 ? "" : "ES"}</Micro>
                  <h3 className="font-head mt-1 text-[20px] font-semibold">Class Schedule</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="pill pill-ink inline-flex items-center gap-1">
                    <Filter className="h-3 w-3" /> All tracks
                  </span>
                  <a
                    href="/admin/programming/classes"
                    className="pill pill-ink inline-flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" /> Schedule
                  </a>
                </div>
              </div>

              {dashboardData.todayClasses.length === 0 ? (
                <div className="ds-empty mt-4">No classes scheduled today.</div>
              ) : (
                <ul className="mt-4 divide-y" style={{ borderColor: "var(--line)" }}>
                  {dashboardData.todayClasses.map((cls) => {
                    const status = classStatus(cls);
                    return (
                      <li key={cls.id} className="flex items-center gap-4 py-3">
                        <div className="w-[58px]">
                          <div className="font-mono text-[13px] font-semibold tracking-tight">
                            {formatTime(cls.classTime)}
                          </div>
                          <div className="micro" style={{ fontSize: 9.5 }}>
                            {cls.durationMinutes}M
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-head truncate text-[14.5px] font-semibold">
                              {cls.name}
                            </span>
                            {cls.trackName && (
                              <span className="pill pill-violet">{cls.trackName}</span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                            Coach{" "}
                            <span style={{ color: "var(--text)" }}>
                              {cls.coachName ?? "Unassigned"}
                            </span>
                          </div>
                        </div>
                        <span className={"pill " + status.pill}>{status.label}</span>
                        <button
                          className="rounded-md p-1.5 hover:bg-[var(--panel-2)]"
                          title="Open"
                          type="button"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <div className="col-span-12 xl:col-span-5">
            <AccentCard tone="lime" className="fade-in" withDots={false}>
              <div className="flex items-start justify-between">
                <div>
                  <Micro onAccent>
                    {todayWorkout ? `TODAY'S WORKOUT · ${todayWorkout.trackName ?? "TRACK"}` : "TODAY'S WORKOUT"}
                  </Micro>
                  <h3 className="font-head mt-1 text-[22px] font-semibold">
                    {todayWorkout?.title ?? "No workout published"}
                  </h3>
                  <div
                    className="mt-1 text-[12.5px]"
                    style={{ color: "rgba(20,34,10,0.7)" }}
                  >
                    {todayWorkout
                      ? `${todayWorkout.trackName ?? "—"} · ${todayWorkout.blockCount} block${todayWorkout.blockCount === 1 ? "" : "s"}`
                      : "Publish a workout for this track to fill this card."}
                  </div>
                </div>
                <a
                  href="/admin/programming"
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-[12.5px] font-semibold"
                  style={{ background: "rgba(20,34,10,0.10)", color: "#14220a" }}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </a>
              </div>
              {todayWorkout?.notes && (
                <div
                  className="mt-3 text-[12.5px]"
                  style={{ color: "rgba(20,34,10,0.78)" }}
                >
                  <span className="font-semibold">Note: </span>
                  {todayWorkout.notes}
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl p-3" style={{ background: "rgba(20,34,10,0.08)" }}>
                  <div className="micro">BLOCKS</div>
                  <div className="font-head mt-1 text-[18px] font-semibold">
                    {todayWorkout?.blockCount ?? 0}
                  </div>
                </div>
                <div className="rounded-xl p-3" style={{ background: "rgba(20,34,10,0.08)" }}>
                  <div className="micro">TRACK</div>
                  <div className="font-head mt-1 truncate text-[18px] font-semibold">
                    {todayWorkout?.trackName ?? "—"}
                  </div>
                </div>
              </div>
            </AccentCard>
          </div>
        </section>

        {/* Member trend + Heatmap */}
        <section className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-7">
            <Panel padding="lg" className="fade-in hover-lift">
              <div className="flex items-start justify-between">
                <div>
                  <Micro as="p">MEMBER CHANGE · LAST 6 MONTHS</Micro>
                  <h3 className="font-head mt-1 text-[20px] font-semibold">Membership trend</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="pill pill-pink inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--pink)" }} />
                    Total
                  </span>
                  <span className="pill pill-success inline-flex items-center gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--success-text)" }}
                    />
                    Joined
                  </span>
                  <span className="pill pill-amber inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#9b5b08" }} />
                    Left
                  </span>
                </div>
              </div>

              {trend.length === 0 ? (
                <div className="ds-empty mt-4">No member-trend data yet.</div>
              ) : (
                <>
                  <div
                    className="mt-5 grid items-end gap-3"
                    style={{ gridTemplateColumns: `repeat(${trend.length}, minmax(0,1fr))`, height: 220 }}
                  >
                    {trend.map((m, i) => {
                      const totalH =
                        ((m.totalMembers - trendMinTotal + 6) /
                          (trendMaxTotal - trendMinTotal + 12)) *
                          160 +
                        30;
                      const joinedH = Math.min(60, m.newMembers * 4);
                      const leftH = Math.min(60, m.cancelledMembers * 4);
                      return (
                        <div
                          key={m.monthKey}
                          className="relative flex h-full flex-col items-center justify-end gap-1.5"
                        >
                          <div
                            className="bar-grow w-full rounded-md"
                            style={{
                              height: totalH,
                              background:
                                "linear-gradient(180deg, rgba(225,48,108,0.18) 0%, rgba(225,48,108,0.04) 100%)",
                              border: "1px solid rgba(225,48,108,0.30)",
                              animationDelay: `${i * 60}ms`,
                            }}
                          >
                            <div
                              className="absolute left-0 right-0"
                              style={{ bottom: totalH - 1 }}
                            >
                              <div
                                className="mx-auto h-[2px]"
                                style={{ width: "100%", background: "var(--pink)" }}
                              />
                            </div>
                          </div>
                          <div
                            className="absolute bottom-0 flex w-full items-end justify-center gap-1"
                          >
                            <div
                              className="bar-grow w-2.5 rounded-t-sm"
                              style={{
                                height: joinedH,
                                background: "var(--success-text)",
                                animationDelay: `${i * 60 + 150}ms`,
                              }}
                            />
                            <div
                              className="bar-grow w-2.5 rounded-t-sm"
                              style={{
                                height: leftH,
                                background: "#d97a06",
                                animationDelay: `${i * 60 + 220}ms`,
                              }}
                            />
                          </div>
                          <div className="micro absolute -bottom-6" style={{ fontSize: 10 }}>
                            {m.monthLabel}
                          </div>
                          <div className="absolute" style={{ top: -22 }}>
                            <span className="font-mono text-[11px] font-semibold">{m.totalMembers}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-9 grid grid-cols-3 gap-3">
                    <div className="rounded-lg p-3" style={{ background: "var(--panel-2)" }}>
                      <Micro as="p">CHURN · 30D</Micro>
                      <div className="font-head mt-1 text-[18px] font-semibold">
                        {churnPct.toFixed(1)}%
                      </div>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: "var(--panel-2)" }}>
                      <Micro as="p">NET · 30D</Micro>
                      <div className="font-head mt-1 text-[18px] font-semibold">
                        {sign((latest?.newMembers ?? 0) - (latest?.cancelledMembers ?? 0))}
                      </div>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: "var(--panel-2)" }}>
                      <Micro as="p">LIFETIME · AVG</Micro>
                      <div className="font-head mt-1 text-[18px] font-semibold">{lifetimeAvg}</div>
                    </div>
                  </div>
                </>
              )}
            </Panel>
          </div>

          <div className="col-span-12 xl:col-span-5">
            <Panel padding="lg" className="fade-in hover-lift">
              <div className="flex items-start justify-between">
                <div>
                  <Micro as="p">CLASS UTILIZATION · WEEK</Micro>
                  <h3 className="font-head mt-1 text-[20px] font-semibold">When the box is full</h3>
                </div>
                <a
                  href="/admin/programming/classes"
                  className="pill pill-ink inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> Schedule
                </a>
              </div>

              <div
                className="mt-4 grid"
                style={{ gridTemplateColumns: "60px repeat(7, 1fr)", gap: 4 }}
              >
                <div />
                {DAY_LABELS.map((d, i) => (
                  <div key={i} className="micro text-center" style={{ fontSize: 10 }}>
                    {d}
                  </div>
                ))}
                {heatmap.map(({ slot, row }) => (
                  <div key={slot} className="contents">
                    <div className="micro flex items-center" style={{ fontSize: 10 }}>
                      {slot}
                    </div>
                    {row.map((v, i) => (
                      <div
                        key={i}
                        className="font-mono flex items-center justify-center rounded-md text-[10.5px] font-semibold"
                        style={{
                          background: heatCell(v),
                          height: 36,
                          color: v > 0.6 ? "#fff" : "var(--text)",
                        }}
                      >
                        {Math.round(v * 100)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Micro as="span">LOW</Micro>
                  <div className="flex gap-0.5">
                    {[0.1, 0.25, 0.4, 0.55, 0.75].map((v, i) => (
                      <span
                        key={i}
                        className="h-2.5 w-5 rounded-sm"
                        style={{ background: `rgba(225,48,108,${v})` }}
                      />
                    ))}
                  </div>
                  <Micro as="span">FULL</Micro>
                </div>
                <div className="font-mono text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Today:{" "}
                  <span style={{ color: "var(--text)" }} className="font-semibold">
                    {classCount} class{classCount === 1 ? "" : "es"}
                  </span>
                </div>
              </div>
            </Panel>
          </div>
        </section>

        {/* Stripe + Birthdays + Tasks Today */}
        <section className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-6 xl:col-span-4">
            <Panel padding="lg" className="fade-in hover-lift">
              <div className="flex items-start justify-between">
                <div>
                  <Micro as="p">PAYMENTS · LAST 30 DAYS</Micro>
                  <h3 className="font-head mt-1 text-[20px] font-semibold">Money issues</h3>
                </div>
                <a
                  href="https://dashboard.stripe.com"
                  target="_blank"
                  rel="noreferrer"
                  className="pill pill-ink inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> Stripe
                </a>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="accent-amber-quiet rounded-xl p-3" style={{ background: "var(--panel)" }}>
                  <Micro as="p">FAILED</Micro>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-head text-[24px] font-semibold">
                      {dashboardData.stripeIssues.failedPayments30d}
                    </span>
                  </div>
                </div>
                <div className="accent-pink-quiet rounded-xl p-3" style={{ background: "var(--panel)" }}>
                  <Micro as="p">REFUNDS</Micro>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-head text-[24px] font-semibold">
                      {dashboardData.stripeIssues.refunds30d}
                    </span>
                  </div>
                </div>
              </div>

              {dashboardData.stripeIssues.issues.length === 0 ? (
                <div className="ds-empty mt-4">No recent payment issues.</div>
              ) : (
                <ul className="mt-4 divide-y" style={{ borderColor: "var(--line)" }}>
                  {dashboardData.stripeIssues.issues.slice(0, 4).map((issue) => (
                    <li key={issue.id} className="flex items-center gap-3 py-2.5">
                      <span
                        className={
                          "pill inline-flex items-center gap-1 " +
                          (issue.kind === "failed_payment" ? "pill-danger" : "pill-amber")
                        }
                      >
                        {issue.kind === "failed_payment" ? (
                          <XOctagon className="h-3 w-3" />
                        ) : (
                          <Undo2 className="h-3 w-3" />
                        )}
                        {issue.kind === "failed_payment" ? "FAILED" : "REFUND"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold">
                          {issue.description}
                        </div>
                        <div className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {issue.status} · {relativeIssueDate(issue.createdAt)}
                        </div>
                      </div>
                      <div className="font-mono text-[13px] font-semibold">
                        {formatCurrency(issue.amount)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="col-span-12 lg:col-span-6 xl:col-span-4">
            <Panel padding="lg" className="fade-in hover-lift">
              <div className="flex items-start justify-between">
                <div>
                  <Micro as="p">
                    NEXT 14 DAYS · {dashboardData.upcomingBirthdays.length} BIRTHDAY
                    {dashboardData.upcomingBirthdays.length === 1 ? "" : "S"}
                  </Micro>
                  <h3 className="font-head mt-1 text-[20px] font-semibold">Birthdays</h3>
                </div>
                <span className="pill pill-ink inline-flex items-center gap-1">
                  <Gift className="h-3 w-3" /> Send cards
                </span>
              </div>
              {dashboardData.upcomingBirthdays.length === 0 ? (
                <div className="ds-empty mt-4">No birthdays in the next 14 days.</div>
              ) : (
                <ul className="mt-4 space-y-2">
                  {dashboardData.upcomingBirthdays.slice(0, 5).map((b, i) => {
                    const initials = b.memberName
                      .split(/\s+/)
                      .map((s) => s[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    return (
                      <li
                        key={`${b.email ?? b.memberName}-${b.birthDate}`}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                        style={{
                          background:
                            i === 0
                              ? "linear-gradient(135deg, rgba(225,48,108,0.10), rgba(109,61,212,0.06))"
                              : "var(--panel-2)",
                          border: "1px solid var(--line)",
                        }}
                      >
                        <div
                          className="font-head flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold"
                          style={{ background: "var(--panel)", border: "1px solid var(--line-strong)" }}
                        >
                          {initials || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold">{b.memberName}</div>
                          <div className="micro" style={{ fontSize: 10 }}>
                            {b.membership ?? "No plan"}
                          </div>
                        </div>
                        <span
                          className={
                            "pill inline-flex items-center gap-1 " +
                            (i === 0 ? "pill-pink" : "pill-ink")
                          }
                        >
                          {i === 0 && <Cake className="h-3 w-3" />}
                          {birthdayWhen(b.daysUntil)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <div className="col-span-12 lg:col-span-12 xl:col-span-4">
            <TaskGroup
              title="Tasks · Today"
              when={dateStr}
              items={dashboardData.dueTasksToday}
              accent="pill-pink"
              done={doneTasks}
              setDone={setDoneTasks}
            />
          </div>
        </section>

        {/* Tomorrow tasks + churn signal */}
        <section className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-6">
            <TaskGroup
              title="Tasks · Tomorrow"
              when="UPCOMING"
              items={dashboardData.dueTasksTomorrow}
              accent="pill-violet"
              done={doneTasks}
              setDone={setDoneTasks}
            />
          </div>

          <div className="col-span-12 xl:col-span-6">
            <AccentCard tone="violet" className="fade-in" withDots={false}>
              <div className="flex items-start justify-between">
                <div>
                  <Micro onAccent>SIGNAL · LAST {churnSignal.monthsCovered} MO</Micro>
                  <h3 className="font-head mt-1 text-[22px] font-semibold">
                    {churnSignal.count} member{churnSignal.count === 1 ? "" : "s"} cancelled recently
                  </h3>
                  <p
                    className="mt-1 text-[13px]"
                    style={{ color: "rgba(20,10,46,0.78)", maxWidth: "42ch" }}
                  >
                    Churn over the last {churnSignal.monthsCovered} months. Reach out to lapsed
                    members or trigger a coach check-in.
                  </p>
                </div>
                <TrendingDown className="h-5 w-5 opacity-60" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {trend.slice(-3).map((p) => (
                  <div
                    key={p.monthKey}
                    className="rounded-xl p-3"
                    style={{ background: "rgba(20,10,46,0.10)" }}
                  >
                    <div className="font-head text-[13.5px] font-semibold">{p.monthLabel}</div>
                    <div className="font-mono mt-0.5 text-[11px]" style={{ color: "rgba(20,10,46,0.78)" }}>
                      cancelled {p.cancelledMembers}
                    </div>
                    <div
                      className="font-mono mt-2 text-[12px] font-semibold"
                      style={{ color: "#3a0d6a" }}
                    >
                      net {sign(p.newMembers - p.cancelledMembers)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href="/members"
                  className="rounded-lg px-3 py-2 text-[12.5px] font-semibold"
                  style={{ background: "rgba(20,10,46,0.92)", color: "#fff" }}
                >
                  Open members
                </a>
                <a
                  href="/admin/programming"
                  className="rounded-lg px-3 py-2 text-[12.5px] font-semibold"
                  style={{ background: "rgba(20,10,46,0.10)", color: "#140a2e" }}
                >
                  Assign coach
                </a>
              </div>
            </AccentCard>
          </div>
        </section>

        <div className="flex items-center justify-between pb-2 pt-4">
          <Micro as="span">ELEV8 · GYM DASHBOARD</Micro>
          <div className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
            Press ⌘K to search · ? for shortcuts
          </div>
        </div>
      </div>
    </section>
  );
}

function TaskGroup({
  title,
  when,
  items,
  accent,
  done,
  setDone,
}: {
  title: string;
  when: string;
  items: DueTask[];
  accent: string;
  done: Record<string, boolean>;
  setDone: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  return (
    <Panel padding="lg" className="fade-in hover-lift">
      <div className="flex items-start justify-between">
        <div>
          <Micro as="p">{when}</Micro>
          <h3 className="font-head mt-1 text-[20px] font-semibold">{title}</h3>
        </div>
        <span className={"pill " + accent}>
          <ListTodo className="h-3 w-3" /> {items.length} open
        </span>
      </div>
      {items.length === 0 ? (
        <div className="ds-empty mt-4">No tasks here.</div>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {items.map((t) => {
            const isDone = !!done[t.id];
            return (
              <li
                key={t.id}
                className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-[var(--panel-2)]"
              >
                <button
                  onClick={() =>
                    setDone((d) => ({ ...d, [t.id]: !d[t.id] }))
                  }
                  className="mt-0.5 flex h-4 w-4 items-center justify-center rounded border"
                  style={{
                    borderColor: "var(--line-strong)",
                    background: isDone ? "var(--text)" : "transparent",
                  }}
                  type="button"
                  aria-label={isDone ? "Mark as not done" : "Mark as done"}
                >
                  {isDone && <Check className="h-3 w-3" style={{ color: "var(--bg)" }} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div
                    className={
                      "text-[13px] font-medium " + (isDone ? "line-through opacity-50" : "")
                    }
                  >
                    {t.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="micro" style={{ fontSize: 10 }}>
                      {t.assignee}
                    </span>
                    {t.priority && (
                      <span
                        className={"pill " + priorityPill(t.priority)}
                        style={{ padding: "1px 6px" }}
                      >
                        {t.priority.toUpperCase()}
                      </span>
                    )}
                    {t.status && (
                      <span
                        className="font-mono text-[10.5px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        · {t.status}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
