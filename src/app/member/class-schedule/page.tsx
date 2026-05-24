import { redirect } from "next/navigation";

import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";
import MemberScheduleClient from "./MemberScheduleClient";

export default async function MemberClassSchedulePage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/member/athlete-dashboard");
  }

  return (
    <SidebarShell mainClassName="w-full">
      <MemberScheduleClient />
    </SidebarShell>
  );
}
