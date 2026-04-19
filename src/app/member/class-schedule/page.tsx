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
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <MemberScheduleClient />
    </SidebarShell>
  );
}
