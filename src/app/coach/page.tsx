import { redirect } from "next/navigation";

import AppPlaceholderPage from "@/components/AppPlaceholderPage";
import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";

export default async function OrganizationCoachPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("coach", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <AppPlaceholderPage
        eyebrow="Coach"
        title="Coach"
        description="Run the gym-side coaching workflows from one place, from daily floor operations to athlete nutrition oversight."
        links={[
          { label: "Open Gym Dashboard", href: "/gym-dashboard" },
          { label: "Open Nutrition Coach", href: "/coach/nutrition-coach" },
          { label: "Open Schedule", href: "/coach/schedule" },
          { label: "Open Member Reports", href: "/coach/reports-members" },
        ]}
      />
    </SidebarShell>
  );
}
