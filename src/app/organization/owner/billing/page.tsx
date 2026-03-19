import { redirect } from "next/navigation";

import AppPlaceholderPage from "../../../../components/AppPlaceholderPage";
import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";

export default async function OwnerBillingPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <AppPlaceholderPage
        eyebrow="Owner"
        title="Billing"
        description="Track invoices, subscriptions, and payment controls with a cleaner finance workflow coming in the next pass."
        links={[
          { label: "Open Integrations", href: "/organization/owner/integrations" },
          { label: "Open Payroll", href: "/organization/owner/payroll" },
        ]}
      />
    </SidebarShell>
  );
}
