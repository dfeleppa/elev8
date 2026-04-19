import { redirect } from "next/navigation";

import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";
import MemberWorkoutClient from "./MemberWorkoutClient";

export default async function MemberWorkoutPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-3xl px-4 py-6">
      <MemberWorkoutClient />
    </SidebarShell>
  );
}
