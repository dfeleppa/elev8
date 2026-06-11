import { redirect } from "next/navigation";

import { hasRole, requireUserContext } from "@/lib/member";
import { isMemberRouteLocked } from "@/lib/feature-flags";
import AccountDashboardClient from "./AccountDashboardClient";

export default async function MemberAccountDashboardPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/login");
  }
  if (isMemberRouteLocked(role, "/member/account-dashboard")) {
    redirect("/member/nutrition");
  }

  return (
    <div className="w-full pb-10 lg:pb-16">
      <AccountDashboardClient />
    </div>
  );
}
