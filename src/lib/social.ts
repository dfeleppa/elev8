import "server-only";

import { createHash } from "node:crypto";

import { publishInstagramPost } from "./instagram";
import { supabaseAdmin } from "./supabase-admin";

export const SOCIAL_WORKFLOW_STATES = [
  "idea",
  "brief",
  "draft",
  "in_review",
  "approved",
  "scheduled",
  "publishing",
  "published",
  "rejected",
  "publish_failed",
  "reminder_pending",
  "archived",
] as const;

export const SOCIAL_CHANNEL_TYPES = ["image", "carousel", "reel", "story", "video", "link"] as const;
export const SOCIAL_PLATFORMS = ["instagram", "facebook"] as const;
export const SOCIAL_PUBLISH_MODES = ["auto", "reminder"] as const;

export type SocialWorkflowState = (typeof SOCIAL_WORKFLOW_STATES)[number];
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialChannelType = (typeof SOCIAL_CHANNEL_TYPES)[number];
export type SocialPublishMode = (typeof SOCIAL_PUBLISH_MODES)[number];

export type SocialAccountSummary = {
  id: string;
  provider: string;
  platform: SocialPlatform;
  external_account_id: string;
  external_page_id: string | null;
  username: string | null;
  display_name: string | null;
  status: string;
  capabilities: Record<string, unknown> | null;
  action_required: string | null;
  last_synced_at: string | null;
  token_expires_at: string | null;
  granted_scopes: string[];
};

export type SocialPostSummary = {
  id: string;
  title: string | null;
  caption: string | null;
  brief: string | null;
  workflow_state: string;
  approval_required: boolean;
  publish_mode: string;
  target_publish_at: string | null;
  published_at: string | null;
  tags: string[];
  campaign_id: string | null;
  content_pillar_id: string | null;
  assigned_to_user_id: string | null;
  created_at: string;
  updated_at: string;
  channels: Array<{
    id: string;
    platform: SocialPlatform;
    channel_type: string;
    status: string;
    publish_mode: string;
    scheduled_for: string | null;
    published_at: string | null;
    published_permalink: string | null;
    last_error_message: string | null;
    social_account_id: string | null;
  }>;
  assets: Array<{
    id: string;
    public_url: string | null;
    source_url: string | null;
    media_type: string;
    title: string | null;
    validation_status: string;
    sort_order: number;
  }>;
  planner_slot: {
    id: string;
    slot_date: string;
    slot_week: string;
    lane: string;
    sort_order: number;
  } | null;
};

export type SocialOverviewPayload = {
  metrics: {
    totalAccounts: number;
    connectedAccounts: number;
    scheduledPosts: number;
    awaitingApproval: number;
    publishFailures: number;
    inboxOpen: number;
    publishedLast30d: number;
  };
  topPosts: Array<{
    id: string;
    title: string;
    platform: string;
    impressions: number;
    reach: number;
    engagements: number;
  }>;
  recentActivity: Array<{
    id: string;
    event_type: string;
    summary: string | null;
    created_at: string;
  }>;
};

const META_API_BASE = "https://graph.facebook.com/v23.0";

function isOneOf<T extends readonly string[]>(value: string | null | undefined, allowed: T, fallback: T[number]) {
  if (!value) return fallback;
  return (allowed as readonly string[]).includes(value) ? (value as T[number]) : fallback;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeWorkflowState(value: unknown, fallback: SocialWorkflowState = "draft"): SocialWorkflowState {
  return isOneOf(normalizeText(value) || null, SOCIAL_WORKFLOW_STATES, fallback);
}

export function normalizePublishMode(value: unknown, fallback: SocialPublishMode = "auto"): SocialPublishMode {
  return isOneOf(normalizeText(value) || null, SOCIAL_PUBLISH_MODES, fallback);
}

export function normalizePlatform(value: unknown, fallback: SocialPlatform = "instagram"): SocialPlatform {
  return isOneOf(normalizeText(value) || null, SOCIAL_PLATFORMS, fallback);
}

export function normalizeChannelType(value: unknown, fallback: SocialChannelType = "image"): SocialChannelType {
  return isOneOf(normalizeText(value) || null, SOCIAL_CHANNEL_TYPES, fallback);
}

export function startOfWeek(input: Date) {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

export function toDateKey(input: Date) {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function listSocialAccounts(): Promise<SocialAccountSummary[]> {
  const { data, error } = await supabaseAdmin
    .from("social_accounts")
    .select(`
      id,
      provider,
      platform,
      external_account_id,
      external_page_id,
      username,
      display_name,
      status,
      capabilities,
      action_required,
      last_synced_at,
      social_account_tokens (
        expires_at,
        granted_scopes,
        updated_at
      )
    `)
    .order("platform", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    return [];
  }

  return ((data ?? []) as any[]).map((row) => {
    const latestToken = Array.isArray(row.social_account_tokens) ? row.social_account_tokens[0] : row.social_account_tokens;
    return {
      id: row.id,
      provider: row.provider,
      platform: row.platform,
      external_account_id: row.external_account_id,
      external_page_id: row.external_page_id ?? null,
      username: row.username ?? null,
      display_name: row.display_name ?? null,
      status: row.status,
      capabilities: row.capabilities ?? null,
      action_required: row.action_required ?? null,
      last_synced_at: row.last_synced_at ?? null,
      token_expires_at: latestToken?.expires_at ?? null,
      granted_scopes: Array.isArray(latestToken?.granted_scopes) ? latestToken.granted_scopes : [],
    };
  });
}

export async function getSocialSettings() {
  const { data } = await supabaseAdmin
    .from("social_org_settings")
    .select("id, approval_mode, allow_admin_bypass, brand_voice, cta_presets, default_hashtags, posting_windows, timezone, ai_generation_preferences")
    .maybeSingle();

  return data ?? null;
}

export async function listSocialCampaigns() {
  const { data, error } = await supabaseAdmin
    .from("social_campaigns")
    .select("id, title, objective, audience, offer_summary, status, start_date, end_date, target_posts, owner_user_id, content_pillar_id, created_at, updated_at")
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as any[];
}

export async function listSocialPillars() {
  const { data, error } = await supabaseAdmin
    .from("social_content_pillars")
    .select("id, name, description, color_token")
    .order("name", { ascending: true });
  if (error) return [];
  return (data ?? []) as any[];
}

export async function listSocialAssets(limit = 60) {
  const { data, error } = await supabaseAdmin
    .from("social_assets")
    .select("id, title, media_type, public_url, source_url, validation_status, tags, created_at, folder_id, orientation, file_size_bytes")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as any[];
}

export async function listInboxItems() {
  const [commentsResult, conversationsResult] = await Promise.all([
    supabaseAdmin
      .from("social_comments")
      .select("id, platform, author_name, author_handle, body, status, priority, created_at, replied_at")
      .order("created_at", { ascending: false })
      .limit(40),
    supabaseAdmin
      .from("social_conversations")
      .select("id, platform, conversation_type, participant_name, participant_handle, status, priority, last_message_at, created_at")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  return {
    comments: (commentsResult.data ?? []) as any[],
    conversations: (conversationsResult.data ?? []) as any[],
  };
}

export async function buildSocialOverview(): Promise<SocialOverviewPayload> {
  const [accounts, postsResult, channelsResult, commentsResult, conversationsResult, activityResult, metricsResult] = await Promise.all([
    listSocialAccounts(),
    supabaseAdmin
      .from("social_posts")
      .select("id, workflow_state, published_at"),
    supabaseAdmin
      .from("social_post_channels")
      .select("status")
      .in(
        "social_post_id",
        (
          await supabaseAdmin.from("social_posts").select("id")
        ).data?.map((row) => row.id) ?? ["00000000-0000-0000-0000-000000000000"]
      ),
    supabaseAdmin.from("social_comments").select("id, status"),
    supabaseAdmin.from("social_conversations").select("id, status"),
    supabaseAdmin
      .from("social_activity_log")
      .select("id, event_type, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("social_post_metrics_daily")
      .select("social_post_id, platform, impressions, reach, engagements")
      .order("metric_date", { ascending: false })
      .limit(100),
  ]);

  const postRows = (postsResult.data ?? []) as Array<{ id: string; workflow_state: string; published_at: string | null }>;
  const channelRows = (channelsResult.data ?? []) as Array<{ status: string }>;
  const comments = (commentsResult.data ?? []) as Array<{ status: string }>;
  const conversations = (conversationsResult.data ?? []) as Array<{ status: string }>;
  const thirtyDaysAgo = Date.now() - 30 * 86_400_000;

  const byPost = new Map<string, { platform: string; impressions: number; reach: number; engagements: number }>();
  for (const metric of (metricsResult.data ?? []) as any[]) {
    const current = byPost.get(metric.social_post_id) ?? {
      platform: metric.platform,
      impressions: 0,
      reach: 0,
      engagements: 0,
    };
    current.platform = metric.platform;
    current.impressions += Number(metric.impressions ?? 0);
    current.reach += Number(metric.reach ?? 0);
    current.engagements += Number(metric.engagements ?? 0);
    byPost.set(metric.social_post_id, current);
  }

  const topPosts = Array.from(byPost.entries())
    .sort((a, b) => b[1].engagements - a[1].engagements)
    .slice(0, 5)
    .map(([id, value]) => ({
      id,
      title: "Top post",
      platform: value.platform,
      impressions: value.impressions,
      reach: value.reach,
      engagements: value.engagements,
    }));

  return {
    metrics: {
      totalAccounts: accounts.length,
      connectedAccounts: accounts.filter((account) => account.status === "connected").length,
      scheduledPosts: postRows.filter((post) => post.workflow_state === "scheduled").length,
      awaitingApproval: postRows.filter((post) => post.workflow_state === "in_review").length,
      publishFailures: channelRows.filter((channel) => channel.status === "publish_failed").length,
      inboxOpen:
        comments.filter((item) => item.status !== "done" && item.status !== "resolved").length +
        conversations.filter((item) => item.status !== "done" && item.status !== "resolved").length,
      publishedLast30d: postRows.filter((post) => post.published_at && new Date(post.published_at).getTime() >= thirtyDaysAgo).length,
    },
    topPosts,
    recentActivity: ((activityResult.data ?? []) as any[]).map((row) => ({
      id: row.id,
      event_type: row.event_type,
      summary: row.summary ?? null,
      created_at: row.created_at,
    })),
  };
}

export async function listSocialPosts(options?: { workflowState?: string; weekOf?: string | null; limit?: number; id?: string }) {
  const limit = Math.min(Math.max(options?.limit ?? 80, 1), 200);
  let query = supabaseAdmin
    .from("social_posts")
    .select("id, title, caption, brief, workflow_state, approval_required, publish_mode, target_publish_at, published_at, tags, campaign_id, content_pillar_id, assigned_to_user_id, created_at, updated_at")
    .order("target_publish_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.workflowState) {
    query = query.eq("workflow_state", options.workflowState);
  }

  if (options?.id) {
    query = query.eq("id", options.id);
  }

  const { data, error } = await query;
  if (error) {
    return [] as SocialPostSummary[];
  }

  const posts = (data ?? []) as any[];
  const postIds = posts.map((post) => post.id);
  if (postIds.length === 0) {
    return [];
  }

  const [channelsResult, assetLinksResult, plannerResult] = await Promise.all([
    supabaseAdmin
      .from("social_post_channels")
      .select("id, social_post_id, platform, channel_type, status, publish_mode, scheduled_for, published_at, published_permalink, last_error_message, social_account_id")
      .in("social_post_id", postIds)
      .order("scheduled_for", { ascending: true, nullsFirst: false }),
    supabaseAdmin
      .from("social_post_asset_links")
      .select("social_post_id, social_asset_id, sort_order, social_assets ( id, public_url, source_url, media_type, title, validation_status )")
      .in("social_post_id", postIds)
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("social_planner_slots")
      .select("id, social_post_id, slot_date, slot_week, lane, sort_order")
      .in("social_post_id", postIds),
  ]);

  const channelMap = new Map<string, any[]>();
  for (const channel of (channelsResult.data ?? []) as any[]) {
    const list = channelMap.get(channel.social_post_id) ?? [];
    list.push(channel);
    channelMap.set(channel.social_post_id, list);
  }

  const assetMap = new Map<string, any[]>();
  for (const link of (assetLinksResult.data ?? []) as any[]) {
    const list = assetMap.get(link.social_post_id) ?? [];
    list.push({
      id: link.social_assets?.id ?? link.social_asset_id,
      public_url: link.social_assets?.public_url ?? null,
      source_url: link.social_assets?.source_url ?? null,
      media_type: link.social_assets?.media_type ?? "image",
      title: link.social_assets?.title ?? null,
      validation_status: link.social_assets?.validation_status ?? "ready",
      sort_order: Number(link.sort_order ?? 0),
    });
    assetMap.set(link.social_post_id, list);
  }

  const plannerMap = new Map<string, any>();
  for (const slot of (plannerResult.data ?? []) as any[]) {
    plannerMap.set(slot.social_post_id, slot);
  }

  let hydrated = posts.map((post) => ({
    ...post,
    tags: Array.isArray(post.tags) ? post.tags : [],
    channels: (channelMap.get(post.id) ?? []).map((channel) => ({
      id: channel.id,
      platform: normalizePlatform(channel.platform),
      channel_type: channel.channel_type,
      status: channel.status,
      publish_mode: channel.publish_mode,
      scheduled_for: channel.scheduled_for ?? null,
      published_at: channel.published_at ?? null,
      published_permalink: channel.published_permalink ?? null,
      last_error_message: channel.last_error_message ?? null,
      social_account_id: channel.social_account_id ?? null,
    })),
    assets: assetMap.get(post.id) ?? [],
    planner_slot: plannerMap.get(post.id) ?? null,
  })) as SocialPostSummary[];

  if (options?.weekOf) {
    hydrated = hydrated.filter((post) => post.planner_slot?.slot_week === options.weekOf);
  }

  return hydrated;
}

export async function logSocialActivity(input: {
  socialPostId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  summary?: string | null;
  payload?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("social_activity_log").insert({
    social_post_id: input.socialPostId ?? null,
    actor_user_id: input.actorUserId ?? null,
    event_type: input.eventType,
    summary: input.summary ?? null,
    payload: input.payload ?? {},
  });
}

export async function ensurePlannerSlot(socialPostId: string, slotDate: string, lane: string, sortOrder = 0) {
  const week = toDateKey(startOfWeek(new Date(`${slotDate}T00:00:00`)));
  const { error } = await supabaseAdmin
    .from("social_planner_slots")
    .upsert(
      {
        social_post_id: socialPostId,
        slot_date: slotDate,
        slot_week: week,
        lane,
        sort_order: sortOrder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "social_post_id" }
    );

  return !error;
}

export async function resolveSocialAccountToken(socialAccountId: string) {
  const { data } = await supabaseAdmin
    .from("social_account_tokens")
    .select("access_token, expires_at")
    .eq("social_account_id", socialAccountId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

async function graphPost<T>(path: string, accessToken: string, body?: Record<string, string>) {
  const params = new URLSearchParams();
  params.set("access_token", accessToken);
  Object.entries(body ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, value);
    }
  });

  const response = await fetch(`${META_API_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Meta Graph request failed.");
  }
  return payload as T;
}

export async function publishFacebookPost(input: {
  pageId: string;
  accessToken: string;
  channelType: string;
  caption?: string | null;
  assets: Array<{ mediaUrl: string; mediaType: "image" | "video" }>;
}) {
  if (input.channelType === "link") {
    const first = input.assets[0];
    if (!first) {
      throw new Error("Facebook link post requires a URL asset.");
    }
    const payload = await graphPost<{ id: string }>(`${input.pageId}/feed`, input.accessToken, {
      message: input.caption ?? "",
      link: first.mediaUrl,
    });
    return { externalId: payload.id, permalink: null };
  }

  const asset = input.assets[0];
  if (!asset) {
    throw new Error("Facebook publish requires at least one asset.");
  }

  if (asset.mediaType === "video" || input.channelType === "video" || input.channelType === "reel") {
    const payload = await graphPost<{ id: string }>(`${input.pageId}/videos`, input.accessToken, {
      file_url: asset.mediaUrl,
      description: input.caption ?? "",
    });
    return { externalId: payload.id, permalink: null };
  }

  const payload = await graphPost<{ post_id?: string; id?: string }>(`${input.pageId}/photos`, input.accessToken, {
    url: asset.mediaUrl,
    caption: input.caption ?? "",
    published: "true",
  });
  return { externalId: payload.post_id ?? payload.id ?? null, permalink: null };
}

export async function publishSocialChannel(input: {
  socialPostId: string;
  channelId: string;
}) {
  const { data: channel } = await supabaseAdmin
    .from("social_post_channels")
    .select(`
      id,
      social_post_id,
      social_account_id,
      platform,
      channel_type,
      publish_mode,
      status,
      scheduled_for,
      retry_count,
      social_posts (
        id,
        caption,
        first_comment
      ),
      social_accounts (
        id,
        external_account_id,
        external_page_id,
        platform
      )
    `)
    .eq("id", input.channelId)
    .eq("social_post_id", input.socialPostId)
    .maybeSingle();

  if (!channel || (channel.status !== "scheduled" && channel.status !== "publishing")) {
    return null;
  }

  const account = Array.isArray(channel.social_accounts) ? channel.social_accounts[0] : channel.social_accounts;
  const post = Array.isArray(channel.social_posts) ? channel.social_posts[0] : channel.social_posts;
  if (!account?.id || !post?.id) {
    throw new Error("Social channel is missing account or post details.");
  }

  const { data: assetLinks } = await supabaseAdmin
    .from("social_post_asset_links")
    .select("sort_order, social_assets ( media_type, public_url, source_url )")
    .eq("social_post_id", input.socialPostId)
    .order("sort_order", { ascending: true });

  const assets: Array<{ mediaUrl: string; mediaType: "image" | "video" }> = ((assetLinks ?? []) as any[])
    .map((row) => ({
      mediaUrl: String(row.social_assets?.public_url ?? row.social_assets?.source_url ?? ""),
      mediaType: (row.social_assets?.media_type === "video" ? "video" : "image") as "image" | "video",
    }))
    .filter((asset) => asset.mediaUrl.length > 0);

  if (channel.publish_mode === "reminder" || channel.channel_type === "story") {
    return { mode: "reminder", externalId: null, permalink: null, reason: "Reminder workflow is required for this channel." };
  }

  const token = await resolveSocialAccountToken(account.id);
  if (!token?.access_token) {
    throw new Error("Account token not found.");
  }

  if (channel.platform === "instagram") {
    const result = await publishInstagramPost({
      igUserId: account.external_account_id,
      accessToken: token.access_token,
      postType: (channel.channel_type === "image" || channel.channel_type === "carousel" || channel.channel_type === "reel" || channel.channel_type === "story"
        ? channel.channel_type
        : "image") as "image" | "carousel" | "reel" | "story",
      caption: post.caption,
      firstComment: post.first_comment,
      assets,
    });

    return {
      mode: result.mode,
      externalId: result.mediaId ?? null,
      permalink: result.permalink ?? null,
      reason: result.reason ?? null,
    };
  }

  const result = await publishFacebookPost({
    pageId: account.external_page_id ?? account.external_account_id,
    accessToken: token.access_token,
    channelType: channel.channel_type,
    caption: post.caption,
    assets,
  });

  return {
    mode: "auto" as const,
    externalId: result.externalId,
    permalink: result.permalink,
    reason: null,
  };
}

export async function fingerprintBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function runSocialAi(input: {
  socialPostId?: string | null;
  memberId?: string | null;
  promptType: string;
  brief: string;
  campaign?: string | null;
  pillar?: string | null;
  platform?: string | null;
  brandVoice?: string | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const promptInput = {
    brief: input.brief,
    campaign: input.campaign ?? null,
    pillar: input.pillar ?? null,
    platform: input.platform ?? null,
    brandVoice: input.brandVoice ?? null,
    promptType: input.promptType,
  };

  let output: Record<string, unknown>;
  let model = "template";

  if (apiKey) {
    model = process.env.OPENAI_SOCIAL_MODEL?.trim() || "gpt-4.1-mini";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You are a social media copilot for a gym brand. Return JSON with keys caption, hooks, ctas, firstComment, scriptOutline, facebookVariant, storyFrames.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(promptInput),
              },
            ],
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));
    const text = Array.isArray(payload?.output)
      ? payload.output
          .flatMap((item: any) => item.content ?? [])
          .map((item: any) => item.text ?? "")
          .join("")
      : "";

    try {
      output = JSON.parse(text);
    } catch {
      output = {
        caption: text || input.brief,
        hooks: [],
        ctas: [],
        firstComment: "",
        scriptOutline: [],
        facebookVariant: text || input.brief,
        storyFrames: [],
      };
    }
  } else {
    const base = input.brief.trim();
    output = {
      caption: `${base}\n\nReady to train with intent this week? Drop "ELEV8" if you want the plan.`,
      hooks: [
        `What happens when you train ${input.pillar ?? "with structure"} consistently?`,
        "This is the gym workflow we keep repeating because it works.",
        "If your routine feels random, start here.",
      ],
      ctas: ["Comment ELEV8", "Save this for your next session", "Send this to your training partner"],
      firstComment: "#gym #fitness #training #elev8",
      scriptOutline: ["Hook", "Problem", "Three takeaways", "CTA"],
      facebookVariant: `${base}\n\nHere is the longer take for our Facebook audience with a clearer CTA and community angle.`,
      storyFrames: ["Hook frame", "Value frame", "Proof frame", "CTA frame"],
    };
  }

  const { data } = await supabaseAdmin
    .from("social_ai_runs")
    .insert({
      social_post_id: input.socialPostId ?? null,
      member_id: input.memberId ?? null,
      run_type: input.promptType,
      model,
      prompt_input: promptInput,
      output,
    })
    .select("id, output, model, created_at")
    .single();

  return data ?? { id: null, output, model, created_at: new Date().toISOString() };
}
