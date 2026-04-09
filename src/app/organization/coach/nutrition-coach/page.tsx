import { redirect } from "next/navigation";

import AppPlaceholderPage from "../../../../components/AppPlaceholderPage";
import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";

export default async function CoachNutritionCoachPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("coach", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <AppPlaceholderPage
        eyebrow="Coach"
        title="Nutrition Coach"
        description="Member nutrition oversight will live here for coaches, admins, and owners, including plan review, check-ins, and adherence monitoring."
        links={[
          { label: "Open Gym Dashboard", href: "/organization/gym-dashboard" },
          { label: "Open Schedule", href: "/organization/coach/schedule" },
          { label: "Open Member Reports", href: "/organization/coach/reports-members" },
        ]}
      />
    </SidebarShell>
  );
}
