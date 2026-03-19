import { redirect } from "next/navigation";

import AppPlaceholderPage from "../../../../components/AppPlaceholderPage";
import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";

export default async function MemberStorePage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <AppPlaceholderPage
        eyebrow="Member"
        title="Store"
        description="Browse member-only products, review offers, and prepare a cleaner purchase flow in the next pass."
        links={[
          { label: "Open Account Dashboard", href: "/organization/member/account-dashboard" },
          { label: "Open Class Schedule", href: "/organization/member/class-schedule" },
        ]}
      />
    </SidebarShell>
  );
}
