import { redirect } from "next/navigation";

import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";

export default async function OwnerBillingPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-slate-100">Billing</h1>
          <p className="mt-3 text-sm text-slate-400">
            Track invoices, subscriptions, and payment settings.
          </p>
        </header>
      </section>
    </SidebarShell>
  );
}
