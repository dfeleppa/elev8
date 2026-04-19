import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

type PatchPayload = {
  caption?: string | null;
  firstComment?: string | null;
  postType?: string;
  publishMode?: string;
  status?: string;
  scheduledFor?: string | null;
  assets?: Array<{ mediaUrl?: string; mediaType?: string }>;
};

async function resolvePost(postId: string) {
  const { data } = await supabaseAdmin
    .from("instagram_posts")
    .select("id")
    .eq("id", postId)
    .maybeSingle();

  return data;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as PatchPayload | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const post = await resolvePost(id);
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (payload.caption !== undefined) {
    patch.caption = payload.caption ? payload.caption.trim() : null;
  }

  if (payload.firstComment !== undefined) {
    patch.first_comment = payload.firstComment ? payload.firstComment.trim() : null;
  }

  if (payload.postType !== undefined) {
    const postType = payload.postType.trim().toLowerCase();
    if (!ALLOWED_POST_TYPES.has(postType)) {
      return NextResponse.json({ error: "Invalid post type." }, { status: 400 });
    }
    patch.post_type = postType;
  }

  if (payload.publishMode !== undefined) {
    const publishMode = payload.publishMode.trim().toLowerCase();
    if (!ALLOWED_PUBLISH_MODES.has(publishMode)) {
      return NextResponse.json({ error: "Invalid publish mode." }, { status: 400 });
    }
    patch.publish_mode = publishMode;
  }

  if (payload.status !== undefined) {
    const status = payload.status.trim();
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    patch.status = status;
    if (status === "scheduled" && patch.scheduled_for === undefined) {
      patch.scheduled_for = new Date().toISOString();
    }
  }

  if (payload.scheduledFor !== undefined) {
    if (payload.scheduledFor && Number.isNaN(new Date(payload.scheduledFor).getTime())) {
      return NextResponse.json({ error: "Invalid scheduled time." }, { status: 400 });
    }
    patch.scheduled_for = payload.scheduledFor ?? null;
  }

  const { data: updatedPost, error: patchError } = await supabaseAdmin
    .from("instagram_posts")
    .update(patch)
    .eq("id", id)
    .select("id, ig_user_id, caption, first_comment, post_type, publish_mode, status, scheduled_for, published_at, last_error_message, created_at, updated_at")
    .single();

  if (patchError || !updatedPost) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  if (payload.assets !== undefined) {
    const { error: deleteError } = await supabaseAdmin
      .from("instagram_post_assets")
      .delete()
      .eq("post_id", id);

    if (deleteError) {
      return NextResponse.json({ error: "Failed to update post assets." }, { status: 500 });
    }

    const rows = (payload.assets ?? [])
      .map((asset, index) => ({
        post_id: id,
        media_url: (asset.mediaUrl ?? "").trim(),
        media_type: (asset.mediaType ?? "image").trim().toLowerCase(),
        sort_order: index,
      }))
      .filter((row) => row.media_url.length > 0);

    if (rows.length > 0) {
      const { error: insertAssetsError } = await supabaseAdmin.from("instagram_post_assets").insert(rows);
      if (insertAssetsError) {
        return NextResponse.json({ error: "Failed to save post assets." }, { status: 500 });
      }
    }
  }

  const { data: postAssets } = await supabaseAdmin
    .from("instagram_post_assets")
    .select("id, post_id, media_url, media_type, sort_order")
    .eq("post_id", id)
    .order("sort_order", { ascending: true });

  return NextResponse.json({ post: { ...updatedPost, assets: postAssets ?? [] } });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const post = await resolvePost(id);
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("instagram_posts")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
