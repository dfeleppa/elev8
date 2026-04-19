import { redirect } from "next/navigation";

import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { getOrganizationBillingMetrics } from "../../../lib/billing-metrics";
import GymDashboardClient from "./GymDashboardClient";

export const dynamic = "force-dynamic";

type DashboardMetrics = {
  totalMembers: number;
  totalCoaches: number;
  totalAdmins: number;
  totalOwners: number;
  totalMrr: number;
};

type GymMemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  membership: string | null;
  last_check_in: string | null;
  last_active: string | null;
  created_at: string | null;
  updated_at: string | null;
  birth_date: string | null;
  tags: string | null;
  tracks: string | null;
  status: string | null;
  attendance_count: number | null;
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

const JS_DAY_TO_ABBR: Record<number, string> = {
  0: "Su",
  1: "Mo",
  2: "Tu",
  3: "We",
  4: "Th",
  5: "Fr",
  6: "Sa",
};

const CANCELLED_STATUSES = new Set(["inactive", "cancelled", "canceled"]);

function toYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function fullName(firstName: string | null | undefined, lastName: string | null | undefined, email: string | null | undefined) {
  const first = firstName?.trim() ?? "";
  const last = lastName?.trim() ?? "";
  const combined = `${first} ${last}`.trim();
  return combined || email?.split("@")[0] || "Unknown";
}

function daysUntilBirthday(birthDate: string | null | undefined) {
  if (!birthDate) return null;
  const base = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;

  const now = new Date();
  const next = new Date(now.getFullYear(), base.getMonth(), base.getDate());
  next.setHours(0, 0, 0, 0);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (next < today) {
    next.setFullYear(next.getFullYear() + 1);
  }

  return Math.floor((next.getTime() - today.getTime()) / 86_400_000);
}

async function getGymMetrics(): Promise<DashboardMetrics> {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("role");

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

async function getDashboardData(members: GymMemberRow[]): Promise<DashboardData> {
  const now = new Date();
  const todayYmd = toYmd(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowYmd = toYmd(tomorrow);
  const todayAbbr = JS_DAY_TO_ABBR[now.getDay()];
  const thirtyDaysAgoIso = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const [classesResult, tracksResult, stripeMetrics, stripeTxResult] = await Promise.all([
    supabaseAdmin
      .from("schedule_classes")
      .select("id, name, class_time, duration_minutes, class_days, start_date, end_date, track_id, default_coach_user_id, size_limit")
      .order("class_time", { ascending: true }),
    supabaseAdmin.from("programming_tracks").select("id, name"),
    getOrganizationBillingMetrics(),
    supabaseAdmin
      .from("stripe_transactions")
      .select("id, type, amount, currency, status, description, created_at")
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  const coachIds = Array.from(
    new Set(
      ((classesResult.data ?? []) as any[])
        .map((row) => row.default_coach_user_id)
        .filter((value) => typeof value === "string" && value.length > 0)
    )
  ) as string[];

  const coachesResult = coachIds.length
    ? await supabaseAdmin.from("app_users").select("id, full_name, email").in("id", coachIds)
    : { data: [], error: null };

  const trackNameById = new Map<string, string>();
  for (const track of tracksResult.data ?? []) {
    trackNameById.set((track as any).id, (track as any).name);
  }

  const coachNameById = new Map<string, string>();
  for (const coach of coachesResult.data ?? []) {
    const row = coach as any;
    coachNameById.set(row.id, row.full_name ?? row.email ?? "Unknown");
  }

  const todayClasses: TodayClass[] = ((classesResult.data ?? []) as any[])
    .filter((row) => {
      const classDays = Array.isArray(row.class_days) ? row.class_days : [];
      if (!classDays.includes(todayAbbr)) return false;
      if (typeof row.start_date === "string" && row.start_date > todayYmd) return false;
      if (typeof row.end_date === "string" && row.end_date < todayYmd) return false;
      return true;
    })
    .map((row) => ({
      id: row.id,
      name: row.name,
      classTime: row.class_time,
      durationMinutes: row.duration_minutes ?? 0,
      coachName: row.default_coach_user_id ? coachNameById.get(row.default_coach_user_id) ?? null : null,
      trackName: row.track_id ? trackNameById.get(row.track_id) ?? null : null,
      sizeLimit: row.size_limit ?? null,
    }));

  const workoutTrackIds = Array.from(
    new Set(
      ((classesResult.data ?? []) as any[])
        .filter((row) => {
          const classDays = Array.isArray(row.class_days) ? row.class_days : [];
          if (!classDays.includes(todayAbbr)) return false;
          if (typeof row.start_date === "string" && row.start_date > todayYmd) return false;
          if (typeof row.end_date === "string" && row.end_date < todayYmd) return false;
          return typeof row.track_id === "string" && row.track_id.length > 0;
        })
        .map((row) => row.track_id)
    )
  ) as string[];

  const daysResult = workoutTrackIds.length
    ? await supabaseAdmin
        .from("programming_days")
        .select("id, title, notes, day_date, track_id")
        .eq("day_date", todayYmd)
        .in("track_id", workoutTrackIds)
        .order("track_id", { ascending: true })
    : { data: [], error: null };

  const dayIds = ((daysResult.data ?? []) as any[]).map((row) => row.id);

  const blocksResult = dayIds.length
    ? await supabaseAdmin
        .from("workout_blocks")
        .select("id, programming_day_id")
        .in("programming_day_id", dayIds)
    : { data: [], error: null };

  const blockCountByDay = new Map<string, number>();
  for (const block of (blocksResult.data ?? []) as any[]) {
    const dayId = block.programming_day_id as string;
    blockCountByDay.set(dayId, (blockCountByDay.get(dayId) ?? 0) + 1);
  }

  const todayWorkouts: TodayWorkout[] = ((daysResult.data ?? []) as any[]).map((row) => ({
    id: row.id,
    title: row.title ?? "Workout",
    notes: row.notes ?? null,
    dayDate: row.day_date,
    trackName: row.track_id ? trackNameById.get(row.track_id) ?? null : null,
    blockCount: blockCountByDay.get(row.id) ?? 0,
  }));

  let stripeKpis: StripeKpis | null = null;
  if (stripeMetrics) {
    stripeKpis = {
      mrr: Number(stripeMetrics.mrr ?? 0),
      arr: Number(stripeMetrics.arr ?? 0),
      activeSubscriptions: Number(stripeMetrics.active_subscriptions ?? 0),
      totalCustomers: Number(stripeMetrics.total_customers ?? 0),
      totalRevenue: Number(stripeMetrics.total_revenue ?? 0),
    };
  }

  const allTransactions = (stripeTxResult.data ?? []) as any[];
  const issueRows = allTransactions.filter((row) => {
    if (row.type === "refund") return true;
    if (row.type === "payment" && row.status && row.status !== "succeeded") return true;
    return false;
  });

  const issuesLast30d = issueRows.filter((row) => {
    const created = typeof row.created_at === "string" ? row.created_at : "";
    return created >= thirtyDaysAgoIso;
  });

  const stripeIssues: StripeIssuesSummary = {
    refunds30d: issuesLast30d.filter((row) => row.type === "refund").length,
    failedPayments30d: issuesLast30d.filter((row) => row.type === "payment").length,
    issues: issueRows.slice(0, 6).map((row) => ({
      id: row.id,
      kind: row.type === "refund" ? "refund" : "failed_payment",
      amount: Number(row.amount ?? 0),
      currency: String(row.currency ?? "usd").toUpperCase(),
      status: String(row.status ?? "unknown"),
      description: String(row.description ?? (row.type === "refund" ? "Refund" : "Failed payment")),
      createdAt: String(row.created_at ?? new Date().toISOString()),
    })),
    disputesSupported: false,
  };

  const upcomingBirthdays: BirthdayRow[] = members
    .map((row) => {
      const daysUntil = daysUntilBirthday(row.birth_date ?? null);
      if (daysUntil === null || daysUntil > 14) return null;
      return {
        memberName: fullName(row.first_name, row.last_name, row.email),
        email: row.email ?? null,
        birthDate: row.birth_date ?? "",
        daysUntil,
        membership: row.membership ?? null,
      };
    })
    .filter((row): row is BirthdayRow => row !== null)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const memberRows = members;

  const monthStarts: Date[] = [];
  const currentMonth = monthStart(now);
  for (let i = 5; i >= 0; i -= 1) {
    monthStarts.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1));
  }

  function isCancelledBy(date: Date, row: (typeof memberRows)[number]) {
    const status = (row.status ?? "").toLowerCase();
    if (!CANCELLED_STATUSES.has(status)) return false;
    if (!row.updated_at) return false;
    const updated = new Date(row.updated_at);
    return !Number.isNaN(updated.getTime()) && updated <= date;
  }

  const memberTrend: MemberTrendPoint[] = monthStarts.map((start) => {
    const startOfMonth = new Date(start);
    const endOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    const key = monthKey(start);

    let newMembers = 0;
    let cancelledMembers = 0;
    let totalMembers = 0;

    for (const row of memberRows) {
      const created = row.created_at ? new Date(row.created_at) : null;
      const updated = row.updated_at ? new Date(row.updated_at) : null;
      const status = (row.status ?? "").toLowerCase();

      if (created && !Number.isNaN(created.getTime())) {
        if (created >= startOfMonth && created <= endOfMonth) {
          newMembers += 1;
        }
      }

      if (CANCELLED_STATUSES.has(status) && updated && !Number.isNaN(updated.getTime())) {
        if (updated >= startOfMonth && updated <= endOfMonth) {
          cancelledMembers += 1;
        }
      }

      if (created && !Number.isNaN(created.getTime()) && created <= endOfMonth && !isCancelledBy(endOfMonth, row)) {
        totalMembers += 1;
      }
    }

    return {
      monthKey: key,
      monthLabel: start.toLocaleDateString("en-US", { month: "short" }),
      totalMembers,
      newMembers,
      cancelledMembers,
    };
  });

  const tasksResult = await supabaseAdmin
    .from("tasks")
    .select("id, title, due_date, priority, status, is_complete, member_id")
    .gte("due_date", todayYmd)
    .lte("due_date", tomorrowYmd)
    .order("due_date", { ascending: true });

  const taskMemberIds = Array.from(
    new Set(
      ((tasksResult.data ?? []) as any[])
        .map((row) => row.member_id)
        .filter(Boolean)
    )
  ) as string[];

  const taskAssigneesResult = taskMemberIds.length
    ? await supabaseAdmin
        .from("app_users")
        .select("id, full_name, email")
        .in("id", taskMemberIds)
    : { data: [], error: null };

  const assigneeById = new Map<string, string>();
  for (const user of (taskAssigneesResult.data ?? []) as any[]) {
    assigneeById.set(user.id, user.full_name ?? user.email ?? "Unknown");
  }

  const dueTasks = ((!tasksResult.error ? tasksResult.data : []) ?? [] as any[])
    .filter((row) => !row.is_complete)
    .map((row) => ({
      id: row.id,
      title: row.title,
      dueDate: row.due_date,
      priority: row.priority ?? null,
      status: row.status ?? null,
      assignee: assigneeById.get(row.member_id) ?? "Unknown",
    }));

  return {
    todayClasses,
    todayWorkouts,
    stripeKpis,
    stripeIssues,
    upcomingBirthdays,
    memberTrend,
    dueTasksToday: dueTasks.filter((row) => row.dueDate === todayYmd),
    dueTasksTomorrow: dueTasks.filter((row) => row.dueDate === tomorrowYmd),
  };
}


export default async function GymDashboardPage({
  searchParams,
}: {
  searchParams?: { tab?: string | string[] } | Promise<{ tab?: string | string[] }>;
}) {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("coach", role)) {
    redirect("/member/athlete-dashboard");
  }

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const tabParam = Array.isArray(resolvedSearchParams?.tab)
    ? resolvedSearchParams.tab[0]
    : resolvedSearchParams?.tab;
  const initialTab = tabParam?.trim().toLowerCase() ?? "dashboard";

  const [metrics, membersResult] = await Promise.all([
    getGymMetrics(),
    supabaseAdmin
      .from("members")
      .select("id, first_name, last_name, email, membership, last_check_in, last_active, created_at, updated_at, birth_date, tags, tracks, status, attendance_count"),
  ]);

  const members = (membersResult.data ?? []) as GymMemberRow[];
  const dashboardData = await getDashboardData(members);

  return (
    <SidebarShell mainClassName="w-full pb-10 lg:pb-16">
      <GymDashboardClient
        initialTab={initialTab}
        metrics={metrics}
        dashboardData={dashboardData}
      />
    </SidebarShell>
  );
}
