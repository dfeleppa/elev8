import { redirect } from "next/navigation";

import AppPlaceholderPage from "@/components/AppPlaceholderPage";
import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";

export default async function OrganizationAdminPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("admin", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <AppPlaceholderPage
        eyebrow="Admin"
        title="Admin"
        description="Operational access, member management, and organization setup for daily execution across teams."
        links={[
          { label: "Open Programming", href: "/admin/programming" },
          { label: "Open Analytics", href: "/admin/analytics" },
        ]}
      />
    </SidebarShell>
  );
}
