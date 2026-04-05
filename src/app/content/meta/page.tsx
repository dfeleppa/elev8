import { redirect } from "next/navigation";

import SidebarShell from "../../../components/SidebarShell";
import { hasRole, requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import InstagramQueueClient from "./InstagramQueueClient";

export const dynamic = "force-dynamic";

export default async function ContentMetaPage() {
  const { error, role, userId, organizationIds } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/organization");
  }

  const organizationId = organizationIds[0] ?? null;
  if (!organizationId) {
    redirect("/organization");
  }

  const { data: accountRow } = await supabaseAdmin
    .from("instagram_oauth_tokens")
    .select("username, ig_user_id, page_id, expires_at, updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isConnected = Boolean(accountRow?.ig_user_id);

  const { data: posts } = isConnected
    ? await supabaseAdmin
        .from("instagram_posts")
        .select("id, caption, post_type, publish_mode, status, scheduled_for, updated_at")
        .eq("organization_id", organizationId)
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] as any[] };

  const postIds = (posts ?? []).map((row) => row.id);
  const { data: assets } = postIds.length
    ? await supabaseAdmin
        .from("instagram_post_assets")
        .select("id, post_id, media_url, media_type, sort_order")
        .in("post_id", postIds)
        .order("sort_order", { ascending: true })
    : { data: [] as any[] };

  const assetsByPostId = new Map<string, any[]>();
  for (const asset of assets ?? []) {
    const list = assetsByPostId.get(asset.post_id) ?? [];
    list.push(asset);
    assetsByPostId.set(asset.post_id, list);
  }

  const initialPosts = (posts ?? []).map((post) => ({
    ...post,
    assets: assetsByPostId.get(post.id) ?? [],
  }));

  return (
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Content</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-100">Instagram Manager</h1>
          <p className="mt-3 text-sm text-slate-400">
            Connect your Instagram business account, then manage drafting, scheduling, and publishing from one workspace.
          </p>
        </header>

        <section className="glass-panel rounded-[28px] border border-white/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Account</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">
                {isConnected ? `Connected: @${accountRow?.username ?? "instagram"}` : "Not connected"}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                {isConnected
                  ? `IG User ID ${accountRow?.ig_user_id} · Page ID ${accountRow?.page_id}`
                  : "OAuth connection is required before scheduling and publishing."}
              </p>
              {accountRow?.expires_at && (
                <p className="mt-2 text-xs text-slate-500">
                  Token expiry: {new Date(accountRow.expires_at).toLocaleString()}
                </p>
              )}
            </div>
            <a
              href="/api/oauth/instagram/start"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
              {isConnected ? "Reconnect Instagram" : "Connect Instagram"}
            </a>
          </div>
        </section>

        {isConnected ? (
          <InstagramQueueClient organizationId={organizationId} initialPosts={initialPosts} />
        ) : (
          <section className="grid gap-5 md:grid-cols-2">
            <article className="glass-panel rounded-2xl border border-white/10 p-5">
              <h3 className="text-lg font-semibold text-slate-100">Composer and Queue</h3>
              <p className="mt-2 text-sm text-slate-400">
                Draft posts, attach assets, and schedule content by publish time.
              </p>
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-500">
                Connect Instagram to enable post management.
              </div>
            </article>

            <article className="glass-panel rounded-2xl border border-white/10 p-5">
              <h3 className="text-lg font-semibold text-slate-100">Publishing and Insights</h3>
              <p className="mt-2 text-sm text-slate-400">
                Auto-publish with reminder fallback and track engagement performance.
              </p>
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-500">
                under construction
              </div>
            </article>
          </section>
        )}

        <div className="flex gap-3">
          <a
            href="/content"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10"
          >
            Back to Content Hub
          </a>
        </div>
      </section>
    </SidebarShell>
  );
}
