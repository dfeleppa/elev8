import SidebarShell from "../../../components/SidebarShell";
import HealthStatsPanel from "./HealthStatsPanel";
import { STAT_GROUPS } from "./health-stats-config";

export default function HealthStatsPage() {
  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <HealthStatsPanel
        title="Stats"
        description="Track key performance markers across body composition, strength, and conditioning."
        groups={STAT_GROUPS}
      />
    </SidebarShell>
  );
}
