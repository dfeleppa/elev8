import { redirect } from "next/navigation";

import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";
import ProgrammingClient from "./ProgrammingClient";

export default async function AdminProgrammingPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("admin", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="w-full px-4 py-4 lg:px-6 lg:py-6">
      <ProgrammingClient />
    </SidebarShell>
  );
}
