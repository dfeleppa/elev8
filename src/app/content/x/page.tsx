import { redirect } from "next/navigation";

import AppPlaceholderPage from "../../../components/AppPlaceholderPage";
import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";

export default async function ContentXPage() {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("owner", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <AppPlaceholderPage
        eyebrow="Content"
        title="X"
        description="Plan threads, repurpose highlights, and maintain daily publishing consistency for audience growth."
        links={[
          { label: "Back to Content Hub", href: "/content" },
          { label: "View YouTube Workspace", href: "/content/youtube" },
          { label: "View Meta Workspace", href: "/content/meta" },
        ]}
      />
    </SidebarShell>
  );
}
