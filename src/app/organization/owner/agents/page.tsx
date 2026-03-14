import { redirect } from "next/navigation";

import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";
import OwnerAgentsClient from "./OwnerAgentsClient";

export default async function OwnerAgentsPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  const configuredMemberId = process.env.AGENT_MEMBER_ID ?? "";

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <OwnerAgentsClient configuredMemberId={configuredMemberId} />
    </SidebarShell>
  );
}
