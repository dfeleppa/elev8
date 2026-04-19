import { redirect } from "next/navigation";

import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";
import OwnerScheduleClient from "./OwnerScheduleClient";

export default async function OwnerSchedulePage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="w-full max-w-none px-5 py-10 lg:px-8 lg:py-16">
      <OwnerScheduleClient />
    </SidebarShell>
  );
}
