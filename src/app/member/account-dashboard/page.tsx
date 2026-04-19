import { redirect } from "next/navigation";

import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";
import AccountDashboardClient from "./AccountDashboardClient";

export default async function MemberAccountDashboardPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/login");
  }

  return (
    <SidebarShell mainClassName="w-full pb-10 lg:pb-16">
      <AccountDashboardClient />
    </SidebarShell>
  );
}
