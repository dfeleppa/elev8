import { redirect } from "next/navigation";

import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";

export default async function ContentXPage() {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("owner", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section>
        <h1 className="text-3xl font-semibold text-slate-100">X</h1>
        <p className="mt-3 text-sm text-slate-400">Blank page placeholder.</p>
      </section>
    </SidebarShell>
  );
}
