import { redirect } from "next/navigation";

import SidebarShell from "../../../../components/SidebarShell";
import FitnessScoreCard from "../../../../components/health/FitnessScoreCard";
import HealthStatsPanel from "../../../../components/health/HealthStatsPanel";
import TotalWorkoutsLoggedCard from "../../../../components/health/TotalWorkoutsLoggedCard";
import { STAT_GROUPS } from "../../../../components/health/health-stats-config";
import { hasRole, requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

async function getTotalWorkoutsLogged(userId: string) {
  const { count, error } = await supabaseAdmin
    .from("workout_results")
    .select("id", { count: "exact", head: true })
    .eq("member_id", userId);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export default async function MemberAthleteDashboardPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/organization");
  }

  const totalWorkoutsLogged = await getTotalWorkoutsLogged(userId);

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <FitnessScoreCard />
        <TotalWorkoutsLoggedCard totalWorkouts={totalWorkoutsLogged} />
        <HealthStatsPanel
          title="Athlete Dashboard"
          description="Track key performance markers across body composition, strength, and conditioning."
          groups={STAT_GROUPS}
        />
      </section>
    </SidebarShell>
  );
}
