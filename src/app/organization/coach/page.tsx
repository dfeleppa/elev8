import { redirect } from "next/navigation";

import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";

export default async function OrganizationCoachPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("coach", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Coach</h1>
          <p className="mt-3 text-sm text-slate-400">
            Program delivery, athlete check-ins, and training oversight.
          </p>
        </header>
      </section>
    </SidebarShell>
  );
}
