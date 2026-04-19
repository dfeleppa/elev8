import { redirect } from "next/navigation";

import SidebarShell from "@/components/SidebarShell";
import OwnerBillingClient from "./OwnerBillingClient";
import { hasRole, requireUserContext } from "@/lib/member";

export default async function OwnerBillingPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-7xl px-5 py-10 lg:py-16">
      <OwnerBillingClient />
    </SidebarShell>
  );
}
