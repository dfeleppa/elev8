import { redirect } from "next/navigation";

import AppPlaceholderPage from "../../../../components/AppPlaceholderPage";
import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";

export default async function MemberAccountDashboardPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <AppPlaceholderPage
        eyebrow="Member"
        title="Account Dashboard"
        description="Manage profile details, notification preferences, and account-level settings for your training experience."
        links={[
          { label: "Open Athlete Dashboard", href: "/organization/member/athlete-dashboard" },
          { label: "Open Nutrition", href: "/organization/member/nutrition" },
        ]}
      />
    </SidebarShell>
  );
}
