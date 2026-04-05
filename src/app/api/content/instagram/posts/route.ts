import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

export const runtime = "nodejs";

const ALLOWED_POST_TYPES = new Set(["image", "carousel", "reel", "story"]);
const ALLOWED_PUBLISH_MODES = new Set(["auto", "reminder"]);
const ALLOWED_STATUSES = new Set([
  "draft",
  "scheduled",
  "publishing",
  "published",
  "publish_failed",
  "reminder_pending",
  "reminder_sent",
]);

type CreatePayload = {
  organizationId?: string;
  igUserId?: string;
  caption?: string;
  firstComment?: string;
  postType?: string;
  publishMode?: string;
  status?: string;
  scheduledFor?: string | null;
  assets?: Array<{ mediaUrl?: string; mediaType?: string }>;
};

function normalizeStatus(status: string | undefined, scheduledFor: string | null) {
  if (status && ALLOWED_STATUSES.has(status)) return status;
  if (scheduledFor) return "scheduled";
  return "draft";
}

async function resolveIgUserId(organizationId: string, explicitIgUserId?: string) {
  if (explicitIgUserId) {
    const { data } = await supabaseAdmin
      .from("instagram_oauth_tokens")
      .select("ig_user_id")
      .eq("organization_id", organizationId)
      .eq("ig_user_id", explicitIgUserId)
      .maybeSingle();

    return data?.ig_user_id ?? null;
  }

  const { data } = await supabaseAdmin
    .from("instagram_oauth_tokens")
    .select("ig_user_id")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.ig_user_id ?? null;
}

export async function GET(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error || !hasRole("owner", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() ?? organizationIds[0] ?? null;
  if (!organizationId || !organizationIds.includes(organizationId)) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  const statusFilter = request.nextUrl.searchParams.get("status")?.trim() ?? "";
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? 25);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25;

  let query = supabaseAdmin
    .from("instagram_posts")
    .select("id, ig_user_id, caption, first_comment, post_type, publish_mode, status, scheduled_for, published_at, last_error_message, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (statusFilter && ALLOWED_STATUSES.has(statusFilter)) {
    query = query.eq("status", statusFilter);
  }

  const { data: posts, error: postsError } = await query;
  if (postsError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const postRows = (posts ?? []) as Array<{
    id: string;
    ig_user_id: string;
    caption: string | null;
    first_comment: string | null;
    post_type: string;
    publish_mode: string;
    status: string;
    scheduled_for: string | null;
    published_at: string | null;
    last_error_message: string | null;
    created_at: string;
    updated_at: string;
  }>;

  const ids = postRows.map((row) => row.id);
  const { data: assets } = ids.length
    ? await supabaseAdmin
        .from("instagram_post_assets")
        .select("id, post_id, media_url, media_type, sort_order")
        .in("post_id", ids)
        .order("sort_order", { ascending: true })
    : { data: [] as any[] };

  const assetsByPostId = new Map<string, any[]>();
  for (const asset of assets ?? []) {
    const list = assetsByPostId.get(asset.post_id) ?? [];
    list.push(asset);
    assetsByPostId.set(asset.post_id, list);
  }

  const hydrated = postRows.map((post) => ({
    ...post,
    assets: assetsByPostId.get(post.id) ?? [],
  }));

  return NextResponse.json({ posts: hydrated });
}

export async function POST(request: NextRequest) {
  const { error, role, userId, organizationIds } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as CreatePayload | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const organizationId = payload.organizationId?.trim() ?? organizationIds[0] ?? null;
  if (!organizationId || !organizationIds.includes(organizationId)) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  const caption = (payload.caption ?? "").trim() || null;
  const firstComment = (payload.firstComment ?? "").trim() || null;
  const postType = (payload.postType ?? "image").trim().toLowerCase();
  const publishMode = (payload.publishMode ?? "auto").trim().toLowerCase();
  const scheduledFor = payload.scheduledFor ? String(payload.scheduledFor) : null;

  if (!ALLOWED_POST_TYPES.has(postType)) {
    return NextResponse.json({ error: "Invalid post type." }, { status: 400 });
  }

  if (!ALLOWED_PUBLISH_MODES.has(publishMode)) {
    return NextResponse.json({ error: "Invalid publish mode." }, { status: 400 });
  }

  if (scheduledFor && Number.isNaN(new Date(scheduledFor).getTime())) {
    return NextResponse.json({ error: "Invalid scheduled time." }, { status: 400 });
  }

  const assets = Array.isArray(payload.assets) ? payload.assets : [];
  if ((postType === "carousel" || postType === "reel" || postType === "story") && assets.length === 0) {
    return NextResponse.json({ error: "This post type requires at least one media asset." }, { status: 400 });
  }

  const igUserId = await resolveIgUserId(organizationId, payload.igUserId?.trim());
  if (!igUserId) {
    return NextResponse.json({ error: "Instagram account is not connected." }, { status: 400 });
  }

  const status = normalizeStatus(payload.status?.trim(), scheduledFor);

  const { data: post, error: insertError } = await supabaseAdmin
    .from("instagram_posts")
    .insert({
      organization_id: organizationId,
      member_id: userId,
      ig_user_id: igUserId,
      caption,
      first_comment: firstComment,
      post_type: postType,
      publish_mode: publishMode,
      status,
      scheduled_for: scheduledFor,
    })
    .select("id, ig_user_id, caption, first_comment, post_type, publish_mode, status, scheduled_for, published_at, last_error_message, created_at, updated_at")
    .single();

  if (insertError || !post) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  if (assets.length > 0) {
    const rows = assets
      .map((asset, index) => ({
        post_id: post.id,
        media_url: (asset.mediaUrl ?? "").trim(),
        media_type: (asset.mediaType ?? "image").trim().toLowerCase(),
        sort_order: index,
      }))
      .filter((row) => row.media_url.length > 0);

    if (rows.length > 0) {
      const { error: assetError } = await supabaseAdmin.from("instagram_post_assets").insert(rows);
      if (assetError) {
        return NextResponse.json({ error: "Post created but assets failed to save." }, { status: 500 });
      }
    }
  }

  const { data: postAssets } = await supabaseAdmin
    .from("instagram_post_assets")
    .select("id, post_id, media_url, media_type, sort_order")
    .eq("post_id", post.id)
    .order("sort_order", { ascending: true });

  return NextResponse.json({ post: { ...post, assets: postAssets ?? [] } });
}
