import { redirect } from "next/navigation";

import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";
import OwnerTracksMembershipsClient from "./OwnerTracksMembershipsClient";

export default async function OwnerTracksMembershipsPage() {
  const { error, role, userId, organizationIds } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  const organizationId = organizationIds[0] ?? null;
  if (!organizationId) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <OwnerTracksMembershipsClient organizationId={organizationId} />
    </SidebarShell>
  );
}
