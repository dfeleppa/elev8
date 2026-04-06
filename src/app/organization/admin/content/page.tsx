import { redirect } from "next/navigation";

import SidebarShell from "../../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../../lib/member";
import {
  buildSocialOverview,
  getSocialSettings,
  listInboxItems,
  listSocialAccounts,
  listSocialAssets,
  listSocialCampaigns,
  listSocialPillars,
  listSocialPosts,
  startOfWeek,
  toDateKey,
} from "../../../../lib/social";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import SocialOsClient from "./SocialOsClient";

export const dynamic = "force-dynamic";

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams?: { socialError?: string | string[] } | Promise<{ socialError?: string | string[] }>;
}) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    redirect("/organization");
  }

  const organizationId = organizationIds[0] ?? null;
  if (!organizationId) {
    redirect("/organization");
  }

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const socialErrorParam = Array.isArray(resolvedSearchParams?.socialError)
    ? resolvedSearchParams.socialError[0]
    : resolvedSearchParams?.socialError;
  const socialError = socialErrorParam?.trim() || null;
  const weekOf = toDateKey(startOfWeek(new Date()));

  const [accounts, settings, campaigns, pillars, posts, assets, inbox, overview, googlePhotos, membersResult] = await Promise.all([
    listSocialAccounts(organizationId),
    getSocialSettings(organizationId),
    listSocialCampaigns(organizationId),
    listSocialPillars(organizationId),
    listSocialPosts(organizationId, { limit: 200 }),
    listSocialAssets(organizationId),
    listInboxItems(organizationId),
    buildSocialOverview(organizationId),
    supabaseAdmin
      .from("social_google_photos_sources")
      .select("id, google_account_email, album_id, album_title, status, last_synced_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("organization_memberships")
      .select("user_id, role, app_users ( id, full_name, email )")
      .eq("organization_id", organizationId)
      .order("role", { ascending: false }),
  ]);

  const members = ((membersResult.data ?? []) as any[]).map((row) => ({
    userId: row.user_id,
    role: row.role,
    fullName: Array.isArray(row.app_users) ? row.app_users[0]?.full_name ?? row.app_users[0]?.email ?? "Unknown" : row.app_users?.full_name ?? row.app_users?.email ?? "Unknown",
  }));

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-[1400px] px-4 py-8 lg:px-6 lg:py-12">
      <SocialOsClient
        organizationId={organizationId}
        weekOf={weekOf}
        initialSocialError={socialError}
        initialAccounts={accounts}
        initialSettings={settings}
        initialCampaigns={campaigns}
        initialPillars={pillars}
        initialPosts={posts}
        initialAssets={assets}
        initialInbox={inbox}
        initialOverview={overview}
        initialGooglePhotosSources={(googlePhotos.data ?? []) as any[]}
        members={members}
      />
    </SidebarShell>
  );
}
