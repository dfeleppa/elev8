import { redirect } from "next/navigation";

import { hasRole, requireUserContext } from "@/lib/member";
import OwnerAgentsClient from "./OwnerAgentsClient";

export default async function OwnerAgentsPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/login");
  }

  const configuredMemberId = process.env.AGENT_MEMBER_ID ?? "";

  return (
    <div className="w-full max-w-none pb-10 lg:pb-16">
      <OwnerAgentsClient configuredMemberId={configuredMemberId} />
    </div>
  );
}
