import { redirect } from "next/navigation";

import AppPlaceholderPage from "@/components/AppPlaceholderPage";
import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";

export default async function CoachReportsMembersPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("coach", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <AppPlaceholderPage
        eyebrow="Coach"
        title="Reports - Members"
        description="Review athlete adherence, attendance patterns, and progress trends to inform next coaching decisions."
        links={[
          { label: "Open Coach Schedule", href: "/coach/schedule" },
          { label: "Open Nutrition Coach", href: "/coach/nutrition-coach" },
          { label: "Open Gym Dashboard", href: "/gym-dashboard" },
        ]}
      />
    </SidebarShell>
  );
}
