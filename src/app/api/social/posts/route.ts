import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
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

type ChannelPayload = {
  platform?: string;
  channelType?: string;
  socialAccountId?: string | null;
  publishMode?: string;
  status?: string;
  scheduledFor?: string | null;
};

type CreatePayload = {
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
  channels?: ChannelPayload[];
  plannerSlot?: { slotDate?: string; lane?: string; sortOrder?: number } | null;
};

async function resolveDefaultAccounts(channels: ChannelPayload[]) {
  const platforms = Array.from(new Set(channels.map((channel) => normalizePlatform(channel.platform))));
  const { data } = await supabaseAdmin
    .from("social_accounts")
    .select("id, platform")
    .in("platform", platforms);

  const accountByPlatform = new Map<string, string>();
  for (const row of (data ?? []) as any[]) {
    if (!accountByPlatform.has(row.platform)) {
      accountByPlatform.set(row.platform, row.id);
    }
  }
  return accountByPlatform;
}

export async function GET(request: NextRequest) {
  const { error, role } = await requireRequestUserContext(request);
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const workflowState = request.nextUrl.searchParams.get("workflowState")?.trim() ?? undefined;
  const weekOf = request.nextUrl.searchParams.get("weekOf")?.trim() ?? undefined;
  const posts = await listSocialPosts({ workflowState, weekOf, limit: 200 });
  return NextResponse.json({ posts });
}

export async function POST(request: NextRequest) {
  const { error, role, userId } = await requireRequestUserContext(request);
  if (error || !userId || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as CreatePayload | null;
  if (!body) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  const workflowState = normalizeWorkflowState(body.workflowState ?? (body.targetPublishAt ? "scheduled" : "draft"));
  const publishMode = normalizePublishMode(body.publishMode);
  const tags = Array.isArray(body.tags) ? body.tags.map((tag) => tag.trim()).filter(Boolean) : [];
  const channelsInput = Array.isArray(body.channels) && body.channels.length > 0 ? body.channels : [{ platform: "instagram", channelType: "image" }];
  const defaultAccounts = await resolveDefaultAccounts(channelsInput);

  const { data: post, error: insertError } = await supabaseAdmin
    .from("social_posts")
    .insert({
      member_id: userId,
      title: body.title?.trim() || null,
      summary: body.summary?.trim() || null,
      brief: body.brief?.trim() || null,
      caption: body.caption?.trim() || null,
      first_comment: body.firstComment?.trim() || null,
      workflow_state: workflowState,
      approval_required: Boolean(body.approvalRequired),
      assigned_to_user_id: body.assignedToUserId || null,
      campaign_id: body.campaignId || null,
      content_pillar_id: body.contentPillarId || null,
      publish_mode: publishMode,
      target_publish_at: body.targetPublishAt || null,
      tags,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !post) {
    return NextResponse.json({ error: "Failed to create post." }, { status: 500 });
  }

  const channelRows = channelsInput.map((channel) => ({
    social_post_id: post.id,
    social_account_id: channel.socialAccountId || defaultAccounts.get(normalizePlatform(channel.platform)) || null,
    platform: normalizePlatform(channel.platform),
    channel_type: normalizeChannelType(channel.channelType),
    publish_mode: normalizePublishMode(channel.publishMode ?? publishMode),
    status: channel.status?.trim() || workflowState,
    scheduled_for: channel.scheduledFor ?? body.targetPublishAt ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error: channelError } = await supabaseAdmin.from("social_post_channels").insert(channelRows);
  if (channelError) {
    return NextResponse.json({ error: "Post created but channel targets failed to save." }, { status: 500 });
  }

  const assetIds = Array.isArray(body.assetIds) ? body.assetIds.filter(Boolean) : [];
  if (assetIds.length > 0) {
    const rows = assetIds.map((assetId, index) => ({ social_post_id: post.id, social_asset_id: assetId, sort_order: index }));
    const { error: assetError } = await supabaseAdmin.from("social_post_asset_links").insert(rows);
    if (assetError) {
      return NextResponse.json({ error: "Post created but assets failed to attach." }, { status: 500 });
    }
  }

  if (body.plannerSlot?.slotDate && body.plannerSlot?.lane) {
    await ensurePlannerSlot( post.id, body.plannerSlot.slotDate, body.plannerSlot.lane, Number(body.plannerSlot.sortOrder ?? 0));
  }

  await logSocialActivity({
    socialPostId: post.id,
    actorUserId: userId,
    eventType: "social_post.created",
    summary: body.title?.trim() || body.caption?.trim() || "Social post created",
    payload: { workflowState, platforms: channelRows.map((row) => row.platform) },
  });

  const hydrated = (await listSocialPosts({ id: post.id, limit: 1 }))[0];
  return NextResponse.json({ post: hydrated ?? { id: post.id } });
}
