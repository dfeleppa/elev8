import { redirect } from "next/navigation";

import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";
import AthleteDashboardV2Client from "./AthleteDashboardV2Client";

export default async function MemberAthleteDashboardV2Page() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="w-full pb-10 lg:pb-16">
      <AthleteDashboardV2Client />
    </SidebarShell>
  );
}
