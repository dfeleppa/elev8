import { redirect } from "next/navigation";

import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";
import OwnerStaffClient from "./OwnerStaffClient";

export default async function OwnerStaffPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <OwnerStaffClient />
    </SidebarShell>
  );
}
