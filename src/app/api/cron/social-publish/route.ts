import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { logSocialActivity, publishSocialChannel } from "@/lib/social";
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

  const nowIso = new Date().toISOString();
  const { data: dueChannels, error } = await supabaseAdmin
    .from("social_post_channels")
    .select("id, social_post_id, status, scheduled_for")
    .eq("status", "scheduled")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: "Failed to query scheduled channels." }, { status: 500 });
  }

  const processed: Array<Record<string, unknown>> = [];
  for (const row of (dueChannels ?? []) as Array<{ id: string; social_post_id: string }>) {
    try {
      await supabaseAdmin.from("social_post_channels").update({ status: "publishing", updated_at: new Date().toISOString() }).eq("id", row.id).eq("status", "scheduled");
      const result = await publishSocialChannel({ socialPostId: row.social_post_id, channelId: row.id });
      if (!result) continue;

      const isReminder = result.mode === "reminder";
      await supabaseAdmin
        .from("social_post_channels")
        .update({
          status: isReminder ? "reminder_pending" : "published",
          published_at: isReminder ? null : new Date().toISOString(),
          published_external_id: result.externalId,
          published_permalink: result.permalink,
          last_error_message: result.reason,
          retry_count: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (!isReminder) {
        await supabaseAdmin
          .from("social_posts")
          .update({ workflow_state: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", row.social_post_id);
      }

      await logSocialActivity({
          socialPostId: row.social_post_id,
          eventType: isReminder ? "social_publish.reminder_pending" : "social_publish.published",
          summary: isReminder ? "Reminder workflow queued" : "Social channel published",
          payload: { channelId: row.id, externalId: result.externalId, permalink: result.permalink },
        });

      processed.push({ channelId: row.id, socialPostId: row.social_post_id, result: isReminder ? "reminder_pending" : "published" });
    } catch (publishError) {
      const message = publishError instanceof Error ? publishError.message : "Publish failed.";
      await supabaseAdmin
        .from("social_post_channels")
        .update({
          status: "publish_failed",
          retry_count: 1,
          last_error_code: "publish_error",
          last_error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      await logSocialActivity({
          socialPostId: row.social_post_id,
          eventType: "social_publish.failed",
          summary: message,
          payload: { channelId: row.id },
        });

      processed.push({ channelId: row.id, socialPostId: row.social_post_id, result: "publish_failed", error: message });
    }
  }

  return NextResponse.json({ ok: true, processed });
}
