import { redirect } from "next/navigation";

import SidebarShell from "../../../../components/SidebarShell";
import HealthStatsPanel from "../../../../components/health/HealthStatsPanel";
import { STAT_GROUPS } from "../../../../components/health/health-stats-config";
import { hasRole, requireUserContext } from "../../../../lib/member";

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
