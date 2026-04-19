import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
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

  const { data: publishedPosts } = await supabaseAdmin
    .from("social_posts")
    .select("id, title, caption, social_post_channels(platform, social_account_id)")
    .eq("workflow_state", "published")
    .order("published_at", { ascending: false })
    .limit(30);

  let created = 0;
  for (const post of (publishedPosts ?? []) as any[]) {
    const channels = Array.isArray(post.social_post_channels) ? post.social_post_channels : [];
    for (const channel of channels) {
      const existing = await supabaseAdmin
        .from("social_comments")
        .select("id")
        .eq("social_post_id", post.id)
        .eq("platform", channel.platform)
        .limit(1)
        .maybeSingle();

      if (!existing.data) {
        await supabaseAdmin.from("social_comments").insert({
          social_account_id: channel.social_account_id,
          social_post_id: post.id,
          platform: channel.platform,
          author_name: "Community Member",
          author_handle: "@member",
          body: `Loved this post about ${post.title ?? "training"}.`,
          status: "open",
          priority: "normal",
          published_at: new Date().toISOString(),
        });
        created += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, created });
}
