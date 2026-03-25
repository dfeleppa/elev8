import { redirect } from "next/navigation";

import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";
import OwnerPayrollClient from "./OwnerPayrollClient";

export default async function OwnerPayrollPage() {
  const { error, role, userId, organizationIds } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  const organizationId = organizationIds[0] ?? null;

  return (
    <SidebarShell mainClassName="w-full max-w-none px-5 py-10 lg:px-8 lg:py-16">
      <OwnerPayrollClient organizationId={organizationId} />
    </SidebarShell>
  );
}
