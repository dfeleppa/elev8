import { redirect } from "next/navigation";

import AppPlaceholderPage from "../../../../components/AppPlaceholderPage";
import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";

export default async function MemberClassSchedulePage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <AppPlaceholderPage
        eyebrow="Member"
        title="Class Schedule"
        description="View upcoming classes, track availability, and reserve training slots without leaving the unified dashboard."
        links={[
          { label: "Open Workout", href: "/organization/member/workout" },
          { label: "Open Athlete Dashboard", href: "/organization/member/athlete-dashboard" },
        ]}
      />
    </SidebarShell>
  );
}
