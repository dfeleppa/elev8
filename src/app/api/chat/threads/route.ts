import { NextResponse } from "next/server";

import { CHAT_THREADS } from "@/lib/chat";
import { requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type ThreadRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
};

type MessageSummaryRow = {
  id: string;
  thread_id: string;
  body: string | null;
  image_url: string | null;
  created_at: string;
};

type SocialThreadRow = {
  id: string;
  participant_name: string | null;
  participant_handle: string | null;
  metadata: {
    chatThreadSlug?: string;
    description?: string;
    sortOrder?: number;
  } | null;
  last_message_at: string | null;
  created_at: string;
};

type SocialMessageRow = {
  id: string;
  social_conversation_id: string;
  body: string | null;
  sent_at: string;
  metadata: {
    imageUrl?: string | null;
  } | null;
};

function isMissingChatTable(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "PGRST205" || error?.message?.includes("chat_threads");
}

async function ensureSocialChatThreads() {
  const { data: existing, error } = await supabaseAdmin
    .from("social_conversations")
    .select("id, participant_name, participant_handle, metadata, last_message_at, created_at")
    .eq("conversation_type", "chat_thread")
    .eq("platform", "elev8");

  if (error) {
    throw new Error("Failed to load fallback chat threads.");
  }

  const rows = ((existing ?? []) as SocialThreadRow[]).filter((row) =>
    CHAT_THREADS.some((thread) => thread.slug === row.metadata?.chatThreadSlug)
  );
  const dedupedRows = Array.from(
    rows
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .reduce((map, row) => {
        const slug = row.metadata?.chatThreadSlug;
        if (slug && !map.has(slug)) {
          map.set(slug, row);
        }
        return map;
      }, new Map<string, SocialThreadRow>())
      .values()
  );
  const existingSlugs = new Set(dedupedRows.map((row) => row.metadata?.chatThreadSlug));
  const missing = CHAT_THREADS.filter((thread) => !existingSlugs.has(thread.slug));

  if (missing.length === 0) {
    return dedupedRows;
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("social_conversations")
    .insert(
      missing.map((thread) => ({
        platform: "elev8",
        conversation_type: "chat_thread",
        external_conversation_id: `chat:${thread.slug}`,
        participant_name: thread.name,
        participant_handle: thread.slug,
        status: "open",
        priority: "normal",
        metadata: {
          chatThreadSlug: thread.slug,
          description: thread.description,
          sortOrder: thread.sortOrder,
        },
        updated_at: new Date().toISOString(),
      }))
    )
    .select("id, participant_name, participant_handle, metadata, last_message_at, created_at");

  if (insertError) {
    throw new Error("Failed to create fallback chat threads.");
  }

  return [...dedupedRows, ...((inserted ?? []) as SocialThreadRow[])];
}

async function getFallbackThreadsResponse() {
  const rows = await ensureSocialChatThreads();
  const sortedRows = rows.sort(
    (a, b) => (a.metadata?.sortOrder ?? 999) - (b.metadata?.sortOrder ?? 999)
  );
  const ids = sortedRows.map((row) => row.id);

  const messagesResult = ids.length
    ? await supabaseAdmin
        .from("social_messages")
        .select("id, social_conversation_id, body, sent_at, metadata")
        .in("social_conversation_id", ids)
        .order("sent_at", { ascending: false })
        .limit(150)
    : { data: [], error: null };

  if (messagesResult.error) {
    throw new Error("Failed to load fallback chat metadata.");
  }

  const latestByThread = new Map<string, SocialMessageRow>();
  const counts = new Map<string, number>();
  for (const row of ((messagesResult.data ?? []) as SocialMessageRow[])) {
    counts.set(row.social_conversation_id, (counts.get(row.social_conversation_id) ?? 0) + 1);
    if (!latestByThread.has(row.social_conversation_id)) {
      latestByThread.set(row.social_conversation_id, row);
    }
  }

  return NextResponse.json({
    threads: sortedRows.map((row) => {
      const fallback = CHAT_THREADS.find((thread) => thread.slug === row.metadata?.chatThreadSlug);
      const latest = latestByThread.get(row.id);
      return {
        id: row.id,
        slug: fallback?.slug ?? row.participant_handle ?? "main",
        name: fallback?.name ?? row.participant_name ?? "Chat",
        description: fallback?.description ?? row.metadata?.description ?? null,
        sort_order: fallback?.sortOrder ?? row.metadata?.sortOrder ?? 999,
        messageCount: counts.get(row.id) ?? 0,
        latestMessage: latest
          ? {
              id: latest.id,
              thread_id: row.id,
              body: latest.body,
              image_url: latest.metadata?.imageUrl ?? null,
              created_at: latest.sent_at,
            }
          : null,
      };
    }),
  });
}

export async function GET() {
  const { error } = await requireUserContext();
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { data: threads, error: threadsError } = await supabaseAdmin
    .from("chat_threads")
    .select("id, slug, name, description, sort_order")
    .order("sort_order", { ascending: true });

  if (threadsError) {
    if (isMissingChatTable(threadsError)) {
      try {
        return await getFallbackThreadsResponse();
      } catch (fallbackError) {
        return NextResponse.json(
          { error: fallbackError instanceof Error ? fallbackError.message : "Failed to load chat threads." },
          { status: 500 }
        );
      }
    }
    return NextResponse.json({ error: "Failed to load chat threads." }, { status: 500 });
  }

  const threadRows = (threads ?? []) as ThreadRow[];
  const threadIds = threadRows.map((thread) => thread.id);

  const [messagesResult, countsResult] = await Promise.all([
    threadIds.length
      ? supabaseAdmin
          .from("chat_messages")
          .select("id, thread_id, body, image_url, created_at")
          .in("thread_id", threadIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(150)
      : Promise.resolve({ data: [], error: null }),
    threadIds.length
      ? supabaseAdmin
          .from("chat_messages")
          .select("thread_id", { count: "exact", head: false })
          .in("thread_id", threadIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null, count: 0 }),
  ]);

  if (messagesResult.error || countsResult.error) {
    return NextResponse.json({ error: "Failed to load chat thread metadata." }, { status: 500 });
  }

  const latestByThread = new Map<string, MessageSummaryRow>();
  for (const row of ((messagesResult.data ?? []) as MessageSummaryRow[])) {
    if (!latestByThread.has(row.thread_id)) {
      latestByThread.set(row.thread_id, row);
    }
  }

  const counts = new Map<string, number>();
  for (const row of ((countsResult.data ?? []) as Array<{ thread_id: string }>)) {
    counts.set(row.thread_id, (counts.get(row.thread_id) ?? 0) + 1);
  }

  return NextResponse.json({
    threads: threadRows.map((thread) => ({
      ...thread,
      messageCount: counts.get(thread.id) ?? 0,
      latestMessage: latestByThread.get(thread.id) ?? null,
    })),
  });
}
