import { redirect } from "next/navigation";

import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";
import HealthStatsPanel from "../../../health/stats/HealthStatsPanel";
import { STAT_GROUPS } from "../../../health/stats/health-stats-config";

export default async function MemberAthleteDashboardPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <HealthStatsPanel
        title="Athlete Dashboard"
        description="Track key performance markers across body composition, strength, and conditioning."
        groups={STAT_GROUPS}
      />
    </SidebarShell>
  );
}
