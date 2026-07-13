import { redirect } from "next/navigation";

import OwnerSettingsSubheader from "@/components/owner/OwnerSettingsSubheader";
import { hasRole, requireUserContext } from "@/lib/member";

export default async function OwnerIntegrationsPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/login");
  }

  return (
    <div className="w-full max-w-none pb-10 lg:pb-16">
      <OwnerSettingsSubheader />
      <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8 lg:py-16">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Owner</p>
          <h1 className="text-3xl font-semibold text-slate-100">Integrations</h1>
          <p className="mt-3 text-sm text-slate-400">
            Connect scheduling and performance systems so your operating data moves through one workflow.
          </p>
        </header>
        <div className="mt-8 flex gap-4 flex-wrap">
          <a
            href="/owner/staff"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10"
          >
            Open Staff
          </a>
        </div>
      </div>
    </div>
  );
}
