import { redirect } from "next/navigation";

import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";
import StoreSetupClient from "./StoreSetupClient";

export const dynamic = "force-dynamic";

export default async function StoreSetupPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="w-full max-w-none pb-10 lg:pb-16">
      <StoreSetupClient />
    </SidebarShell>
  );
}
