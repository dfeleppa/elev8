import { redirect } from "next/navigation";

import { hasRole, requireUserContext } from "@/lib/member";
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
} from "@/lib/social";
import { supabaseAdmin } from "@/lib/supabase-admin";
import SocialOsClient from "./SocialOsClient";

export const dynamic = "force-dynamic";

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams?: { socialError?: string | string[] } | Promise<{ socialError?: string | string[] }>;
}) {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    redirect("/admin");
  }

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const socialErrorParam = Array.isArray(resolvedSearchParams?.socialError)
    ? resolvedSearchParams.socialError[0]
    : resolvedSearchParams?.socialError;
  const socialError = socialErrorParam?.trim() || null;
  const weekOf = toDateKey(startOfWeek(new Date()));

  const [accounts, settings, campaigns, pillars, posts, assets, inbox, overview, googlePhotos, membersResult] = await Promise.all([
    listSocialAccounts(),
    getSocialSettings(),
    listSocialCampaigns(),
    listSocialPillars(),
    listSocialPosts({ limit: 200 }),
    listSocialAssets(),
    listInboxItems(),
    buildSocialOverview(),
    supabaseAdmin
      .from("social_google_photos_sources")
      .select("id, google_account_email, album_id, album_title, status, last_synced_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("app_users")
      .select("id, full_name, email, role")
      .order("created_at", { ascending: true }),
  ]);

  const members = ((membersResult.data ?? []) as any[]).map((row) => ({
    userId: row.id,
    role: row.role,
    fullName: row.full_name ?? row.email ?? "Unknown",
  }));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 lg:px-6 lg:py-12">
      <SocialOsClient
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
    </div>
  );
}
