import { redirect } from "next/navigation";

import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";

export default async function OrganizationAdminPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("admin", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Admin</h1>
          <p className="mt-3 text-sm text-slate-400">
            Operational access, member management, and organization setup.
          </p>
        </header>
      </section>
    </SidebarShell>
  );
}
