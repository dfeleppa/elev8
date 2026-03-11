import SidebarShell from "../../../../components/SidebarShell";
import { requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import WeeklyTrainingBoard from "./WeeklyTrainingBoard";

type TrainingSession = {
  id: string;
  title: string;
  scheduled_date: string;
  notes: string | null;
  is_complete: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type WeekDay = {
  label: string;
  date: string;
};

async function getTrainingSessions(memberId: string): Promise<TrainingSession[]> {
  const { data, error } = await supabaseAdmin
    .from("training_sessions")
    .select("id, title, scheduled_date, notes, is_complete, created_at, updated_at")
    .eq("member_id", memberId)
    .order("scheduled_date", { ascending: true });

  if (error) {
    return [];
  }

  return data ?? [];
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(date.getDate() - diff);
  return start;
}

function formatRange(start: Date, end: Date) {
  const startText = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endText = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startText} - ${endText}`;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function HealthTrainingWeeklyPage() {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return null;
  }

  const sessions = await getTrainingSessions(userId);
  const today = new Date();
  const weekStart = startOfWeek(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const days: WeekDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return { label: formatDayLabel(date), date: formatDateValue(date) };
  });

  const weekSessions = sessions.filter((session) => {
    if (!session.scheduled_date) {
      return false;
    }
    const scheduled = parseLocalDate(session.scheduled_date);
    return scheduled >= weekStart && scheduled <= weekEnd;
  });

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-7xl px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-100">Weekly Training</h1>
            <p className="mt-3 text-sm text-slate-400">
              Plan the week from your existing training sessions.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-300">
            {formatRange(weekStart, weekEnd)}
          </div>
        </header>

        <WeeklyTrainingBoard initialSessions={weekSessions} weekDays={days} />
      </section>
    </SidebarShell>
  );
}
