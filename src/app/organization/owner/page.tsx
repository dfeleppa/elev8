import { redirect } from "next/navigation";

import AppPlaceholderPage from "../../../components/AppPlaceholderPage";
import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";

export default async function OrganizationOwnerPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <AppPlaceholderPage
        eyebrow="Owner"
        title="Owner"
        description="High-level organization controls and strategic settings for growth, operations, and staffing decisions."
        links={[
          { label: "Open Staff", href: "/organization/owner/staff" },
          { label: "Open Schedule", href: "/organization/owner/schedule" },
          { label: "Open Billing", href: "/organization/owner/billing" },
        ]}
      />
    </SidebarShell>
  );
}
