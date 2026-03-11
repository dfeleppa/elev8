import SidebarShell from "../../../components/SidebarShell";
import HealthStatsPanel from "../stats/HealthStatsPanel";
import { STAT_GROUP_BY_SLUG } from "../stats/health-stats-config";

const group = STAT_GROUP_BY_SLUG.conditioning;

export default function HealthConditioningPage() {
  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <HealthStatsPanel title={group.title} description={group.description} groups={[group]} />
    </SidebarShell>
  );
}
