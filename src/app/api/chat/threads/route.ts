import { NextResponse } from "next/server";

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
