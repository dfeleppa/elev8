import { redirect } from "next/navigation";

import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";
import ProgramBuilderEditor from "./ProgramBuilderEditor";

export default async function ProgramBuilderPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("admin", role)) {
    redirect("/login");
  }

  return (
    <SidebarShell mainClassName="w-full">
      <ProgramBuilderEditor />
    </SidebarShell>
  );
}
