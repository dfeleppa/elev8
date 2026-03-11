import SidebarShell from "../../../components/SidebarShell";
import { requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import TrainingEventsCard from "./TrainingEventsCard";
import TrainingSessionsCard from "./TrainingSessionsCard";

type TrainingEvent = {
  id: string;
  name: string;
  event_date: string;
  created_at: string | null;
  updated_at: string | null;
};

type TrainingSession = {
  id: string;
  title: string;
  scheduled_date: string;
  notes: string | null;
  is_complete: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

async function getTrainingEvents(memberId: string): Promise<TrainingEvent[]> {
  const { data, error } = await supabaseAdmin
    .from("training_events")
    .select("id, name, event_date, created_at, updated_at")
    .eq("member_id", memberId)
    .order("event_date", { ascending: true });

  if (error) {
    return [];
  }

  return data ?? [];
}

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

export default async function HealthTrainingPage() {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return null;
  }

  const [events, sessions] = await Promise.all([
    getTrainingEvents(userId),
    getTrainingSessions(userId),
  ]);

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Training</h1>
          <p className="mt-3 text-sm text-slate-400">Plan the blocks and events you are training for.</p>
        </header>

        <TrainingEventsCard initialEvents={events} />
        <TrainingSessionsCard initialSessions={sessions} />
      </section>
    </SidebarShell>
  );
}
