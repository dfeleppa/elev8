import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "@/lib/member";
import {
  ensurePlannerSlot,
  listSocialPosts,
  logSocialActivity,
  normalizeChannelType,
  normalizePlatform,
  normalizePublishMode,
  normalizeWorkflowState,
} from "@/lib/social";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type PatchPayload = {
  action?: "duplicate";
  title?: string | null;
  summary?: string | null;
  brief?: string | null;
  caption?: string | null;
  firstComment?: string | null;
  workflowState?: string;
  approvalRequired?: boolean;
  publishMode?: string;
  targetPublishAt?: string | null;
  assignedToUserId?: string | null;
  campaignId?: string | null;
  contentPillarId?: string | null;
  tags?: string[];
  assetIds?: string[];
  channels?: Array<{
    platform?: string;
    channelType?: string;
    socialAccountId?: string | null;
    publishMode?: string;
    status?: string;
    scheduledFor?: string | null;
  }>;
  plannerSlot?: { slotDate?: string; lane?: string; sortOrder?: number } | null;
};

async function resolvePost(id: string) {
  const { data } = await supabaseAdmin.from("social_posts").select("id").eq("id", id).maybeSingle();
  return data;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as PatchPayload | null;
  if (!body) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  const post = await resolvePost(id);
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  if (body.action === "duplicate") {
    const existing = (await listSocialPosts({ limit: 200 })).find((item) => item.id === id);
    if (!existing) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const { data: clone, error: cloneError } = await supabaseAdmin
      .from("social_posts")
      .insert({
        member_id: userId,
        title: existing.title ? `${existing.title} Copy` : "Untitled Copy",
        summary: existing.caption,
        brief: existing.brief,
        caption: existing.caption,
        first_comment: null,
        workflow_state: "draft",
        approval_required: existing.approval_required,
        publish_mode: existing.publish_mode,
        tags: existing.tags,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (cloneError || !clone) {
      return NextResponse.json({ error: "Failed to duplicate post." }, { status: 500 });
    }

    if (existing.channels.length > 0) {
      await supabaseAdmin.from("social_post_channels").insert(
        existing.channels.map((channel) => ({
          social_post_id: clone.id,
          social_account_id: channel.social_account_id,
          platform: normalizePlatform(channel.platform),
          channel_type: normalizeChannelType(channel.channel_type),
          publish_mode: normalizePublishMode(channel.publish_mode),
          status: "draft",
          updated_at: new Date().toISOString(),
        }))
      );
    }

    if (existing.assets.length > 0) {
      await supabaseAdmin.from("social_post_asset_links").insert(
        existing.assets.map((asset, index) => ({
          social_post_id: clone.id,
          social_asset_id: asset.id,
          sort_order: index,
        }))
      );
    }

    await logSocialActivity({
      socialPostId: clone.id,
      actorUserId: userId,
      eventType: "social_post.duplicated",
      summary: "Social post duplicated",
      payload: { sourcePostId: id },
    });

    const duplicated = (await listSocialPosts({ limit: 200 })).find((item) => item.id === clone.id);
    return NextResponse.json({ post: duplicated ?? { id: clone.id } });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) patch.title = body.title?.trim() || null;
  if (body.summary !== undefined) patch.summary = body.summary?.trim() || null;
  if (body.brief !== undefined) patch.brief = body.brief?.trim() || null;
  if (body.caption !== undefined) patch.caption = body.caption?.trim() || null;
  if (body.firstComment !== undefined) patch.first_comment = body.firstComment?.trim() || null;
  if (body.workflowState !== undefined) patch.workflow_state = normalizeWorkflowState(body.workflowState);
  if (body.approvalRequired !== undefined) patch.approval_required = Boolean(body.approvalRequired);
  if (body.publishMode !== undefined) patch.publish_mode = normalizePublishMode(body.publishMode);
  if (body.targetPublishAt !== undefined) patch.target_publish_at = body.targetPublishAt ?? null;
  if (body.assignedToUserId !== undefined) patch.assigned_to_user_id = body.assignedToUserId || null;
  if (body.campaignId !== undefined) patch.campaign_id = body.campaignId || null;
  if (body.contentPillarId !== undefined) patch.content_pillar_id = body.contentPillarId || null;
  if (body.tags !== undefined) patch.tags = Array.isArray(body.tags) ? body.tags.map((tag) => tag.trim()).filter(Boolean) : [];

  const { error: updateError } = await supabaseAdmin.from("social_posts").update(patch).eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: "Failed to update post." }, { status: 500 });
  }

  if (body.channels !== undefined) {
    await supabaseAdmin.from("social_post_channels").delete().eq("social_post_id", id);
    if (body.channels.length > 0) {
      const rows = body.channels.map((channel) => ({
        social_post_id: id,
        social_account_id: channel.socialAccountId || null,
        platform: normalizePlatform(channel.platform),
        channel_type: normalizeChannelType(channel.channelType),
        publish_mode: normalizePublishMode(channel.publishMode),
        status: channel.status?.trim() || normalizeWorkflowState(body.workflowState),
        scheduled_for: channel.scheduledFor ?? body.targetPublishAt ?? null,
        updated_at: new Date().toISOString(),
      }));
      const { error: channelError } = await supabaseAdmin.from("social_post_channels").insert(rows);
      if (channelError) {
        return NextResponse.json({ error: "Failed to update channel targets." }, { status: 500 });
      }
    }
  }

  if (body.assetIds !== undefined) {
    await supabaseAdmin.from("social_post_asset_links").delete().eq("social_post_id", id);
    if (body.assetIds.length > 0) {
      await supabaseAdmin.from("social_post_asset_links").insert(
        body.assetIds.map((assetId, index) => ({
          social_post_id: id,
          social_asset_id: assetId,
          sort_order: index,
        }))
      );
    }
  }

  if (body.plannerSlot?.slotDate && body.plannerSlot?.lane) {
    await ensurePlannerSlot( id, body.plannerSlot.slotDate, body.plannerSlot.lane, Number(body.plannerSlot.sortOrder ?? 0));
  }

  await logSocialActivity({
    socialPostId: id,
    actorUserId: userId,
    eventType: "social_post.updated",
    summary: body.title?.trim() || body.caption?.trim() || "Social post updated",
  });

  const updated = (await listSocialPosts({ limit: 200 })).find((item) => item.id === id);
  return NextResponse.json({ post: updated });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const post = await resolvePost(id);
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabaseAdmin.from("social_posts").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete post." }, { status: 500 });
  }

  await logSocialActivity({
    socialPostId: id,
    actorUserId: userId,
    eventType: "social_post.deleted",
    summary: "Social post deleted",
  });

  return NextResponse.json({ ok: true });
}
