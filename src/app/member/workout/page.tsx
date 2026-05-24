import { redirect } from "next/navigation";

import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";
import MemberWorkoutClient from "./MemberWorkoutClient";

export default async function MemberWorkoutPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/login");
  }

  return (
    <SidebarShell mainClassName="w-full">
      <MemberWorkoutClient />
    </SidebarShell>
  );
}
