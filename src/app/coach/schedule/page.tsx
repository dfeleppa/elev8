import { redirect } from "next/navigation";

import AppPlaceholderPage from "@/components/AppPlaceholderPage";
import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";

export default async function CoachSchedulePage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("coach", role)) {
    redirect("/login");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <AppPlaceholderPage
        eyebrow="Coach"
        title="Schedule"
        description="Coordinate classes, assign coaching coverage, and keep athlete sessions balanced throughout the week."
        links={[
          { label: "Open Gym Dashboard", href: "/gym-dashboard" },
          { label: "Open Nutrition", href: "/coach/nutrition" },
          { label: "Open Member Reports", href: "/coach/reports-members" },
        ]}
      />
    </SidebarShell>
  );
}
