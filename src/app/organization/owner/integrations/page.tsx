import { redirect } from "next/navigation";

import AppPlaceholderPage from "../../../../components/AppPlaceholderPage";
import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";

export default async function OwnerIntegrationsPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <AppPlaceholderPage
        eyebrow="Owner"
        title="Integrations"
        description="Connect billing, scheduling, and performance systems so your operating data moves through one workflow."
        links={[
          { label: "Open Billing", href: "/organization/owner/billing" },
          { label: "Open Staff", href: "/organization/owner/staff" },
        ]}
      />
    </SidebarShell>
  );
}
