import { redirect } from "next/navigation";

import AppPlaceholderPage from "@/components/AppPlaceholderPage";
import SidebarShell from "@/components/SidebarShell";
import { hasRole, requireUserContext } from "@/lib/member";

export default async function AdminAnalyticsPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("admin", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <AppPlaceholderPage
        eyebrow="Admin"
        title="Business Analytics"
        description="Track KPIs, monitor revenue movement, and align operating decisions across coaching and membership funnels."
        links={[
          { label: "Open Programming", href: "/admin/programming" },
          { label: "Open Organization Hub", href: "/organization" },
        ]}
      />
    </SidebarShell>
  );
}
