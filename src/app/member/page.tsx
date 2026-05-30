import { redirect } from "next/navigation";

import AppPlaceholderPage from "@/components/AppPlaceholderPage";
import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";
import { isMemberRouteLocked } from "@/lib/feature-flags";

export default async function OrganizationMemberPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/login");
  }
  if (isMemberRouteLocked(role, "/member")) {
    redirect("/member/nutrition");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <AppPlaceholderPage
        eyebrow="Member"
        title="Member"
        description="Personal access, plans, and day-to-day training workflows delivered inside one consistent dashboard system."
        links={[
          { label: "Open Athlete Dashboard", href: "/member/athlete-dashboard" },
          { label: "Open Workout", href: "/member/workout" },
          { label: "Open Nutrition", href: "/member/nutrition" },
          { label: "Open Nutrition Coach", href: "/member/nutrition-coach" },
        ]}
      />
    </SidebarShell>
  );
}
