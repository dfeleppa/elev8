import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { publishInstagramPost } from "@/lib/instagram";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
const CRON_BATCH_CONCURRENCY = 3;

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

type DuePostRow = {
  id: string;
  ig_user_id: string;
  caption: string | null;
  first_comment: string | null;
  post_type: "image" | "carousel" | "reel" | "story";
  publish_mode: "auto" | "reminder";
  status: string;
  scheduled_for: string | null;
  retry_count: number | null;
};

async function acquirePost(postId: string) {
  const { data, error } = await supabaseAdmin
    .from("instagram_posts")
    .update({ status: "publishing", updated_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("status", "scheduled")
    .select("id, ig_user_id, caption, first_comment, post_type, publish_mode, status, scheduled_for, retry_count")
    .single();

  if (error) {
    return null;
  }

  return data as DuePostRow;
}

async function loadAssets(postId: string) {
  const { data } = await supabaseAdmin
    .from("instagram_post_assets")
    .select("media_url, media_type, sort_order")
    .eq("post_id", postId)
    .order("sort_order", { ascending: true });

  return ((data ?? []) as Array<{ media_url: string; media_type: string; sort_order: number }>).map((asset) => ({
    mediaUrl: String(asset.media_url),
    mediaType: (asset.media_type === "video" ? "video" : "image") as "image" | "video",
  }));
}

async function loadToken(igUserId: string) {
  const { data } = await supabaseAdmin
    .from("instagram_oauth_tokens")
    .select("access_token")
    .eq("ig_user_id", igUserId)
    .maybeSingle();

  return data?.access_token ?? null;
}

async function recordAttempt(postId: string, attemptNo: number, success: boolean, providerPayload: unknown, providerError?: string) {
  await supabaseAdmin.from("instagram_publish_attempts").insert({
    post_id: postId,
    attempt_no: attemptNo,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    success,
    provider_error: providerError ?? null,
    provider_payload: providerPayload ?? null,
  });
}

async function markReminder(post: DuePostRow, reason: string) {
  const nextRetryCount = (post.retry_count ?? 0) + 1;
  await recordAttempt(post.id, nextRetryCount, true, { mode: "reminder", reason });

  await supabaseAdmin
    .from("instagram_posts")
    .update({
      status: "reminder_pending",
      retry_count: nextRetryCount,
      last_error_code: null,
      last_error_message: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", post.id);

  return {
    postId: post.id,
    result: "reminder_pending",
  };
}

async function markFailure(post: DuePostRow, message: string) {
  const nextRetryCount = (post.retry_count ?? 0) + 1;
  await recordAttempt(post.id, nextRetryCount, false, { mode: "error" }, message);

  await supabaseAdmin
    .from("instagram_posts")
    .update({
      status: "publish_failed",
      retry_count: nextRetryCount,
      last_error_code: "publish_error",
      last_error_message: message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", post.id);

  return {
    postId: post.id,
    result: "publish_failed",
    error: message,
  };
}

async function processPost(post: DuePostRow) {
  if (post.publish_mode === "reminder") {
    return markReminder(post, "Post is configured for reminder mode.");
  }

  const token = await loadToken(post.ig_user_id);
  if (!token) {
    return markFailure(post, "Instagram access token not found for organization account.");
  }

  const assets = await loadAssets(post.id);
  if (assets.length === 0) {
    return markFailure(post, "No media assets attached to scheduled post.");
  }

  try {
    const result = await publishInstagramPost({
      igUserId: post.ig_user_id,
      accessToken: token,
      postType: post.post_type,
      caption: post.caption,
      firstComment: post.first_comment,
      assets,
    });

    const nextRetryCount = (post.retry_count ?? 0) + 1;
    await recordAttempt(post.id, nextRetryCount, true, result.providerPayload ?? result, result.reason);

    if (result.mode === "reminder") {
      await supabaseAdmin
        .from("instagram_posts")
        .update({
          status: "reminder_pending",
          retry_count: nextRetryCount,
          last_error_message: result.reason ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", post.id);

      return {
        postId: post.id,
        result: "reminder_pending",
        reason: result.reason ?? null,
      };
    }

    await supabaseAdmin
      .from("instagram_posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        published_media_id: result.mediaId ?? null,
        published_permalink: result.permalink ?? null,
        retry_count: nextRetryCount,
        last_error_code: null,
        last_error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    return {
      postId: post.id,
      result: "published",
      mediaId: result.mediaId ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected publish failure.";
    return markFailure(post, message);
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const expected = `Bearer ${cronSecret}`;
  if (!authHeader || !constantTimeEqual(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const { data: duePosts, error } = await supabaseAdmin
    .from("instagram_posts")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(15);

  if (error) {
    return NextResponse.json({ error: "Failed to query due posts." }, { status: 500 });
  }

  const ids = ((duePosts ?? []) as Array<{ id: string }>).map((row) => row.id);
  // acquirePost is independent per id (each is a separate row UPDATE) — fan
  // them out instead of round-tripping serially.
  const acquired = (await Promise.all(ids.map(acquirePost))).filter(
    (post): post is DuePostRow => post !== null
  );

  const processed: Array<Record<string, unknown>> = [];
  for (let i = 0; i < acquired.length; i += CRON_BATCH_CONCURRENCY) {
    const batch = acquired.slice(i, i + CRON_BATCH_CONCURRENCY);
    const results = await Promise.all(batch.map((post) => processPost(post)));
    processed.push(...results);
  }

  return NextResponse.json({
    ok: true,
    processed,
    dueCount: ids.length,
    acquiredCount: acquired.length,
  });
}
