import { redirect } from "next/navigation";

import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";
import CoachSetupClient from "./CoachSetupClient";

export default async function OrganizationCoachPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("coach", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <CoachSetupClient />
    </SidebarShell>
  );
}
