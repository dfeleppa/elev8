import { redirect } from "next/navigation";

import AppPlaceholderPage from "../../../components/AppPlaceholderPage";
import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";

export default async function ContentYouTubePage() {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("owner", role)) {
    redirect("/organization");
  }

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <AppPlaceholderPage
        eyebrow="Content"
        title="YouTube"
        description="Manage production timelines, publishing sequences, and post-launch performance review loops."
        links={[
          { label: "Back to Content Hub", href: "/content" },
          { label: "View X Workspace", href: "/content/x" },
          { label: "View Meta Workspace", href: "/content/meta" },
        ]}
      />
    </SidebarShell>
  );
}
