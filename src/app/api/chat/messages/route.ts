import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { CHAT_IMAGE_TYPES, CHAT_MAX_IMAGE_SIZE, isChatThreadSlug, sanitizeChatBody } from "@/lib/chat";
import { requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const MESSAGE_SELECT = `
  id,
  body,
  image_url,
  image_storage_path,
  created_at,
  updated_at,
  author:app_users!chat_messages_author_user_id_fkey (
    id,
    full_name,
    email,
    role
  )
`;

type ThreadLookup = {
  id: string;
  slug: string;
  name: string;
};

async function findThread(slug: string) {
  if (!isChatThreadSlug(slug)) {
    return { thread: null, error: "Invalid chat thread." };
  }

  const { data, error } = await supabaseAdmin
    .from("chat_threads")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { thread: null, error: "Failed to load chat thread." };
  }

  return { thread: (data as ThreadLookup | null) ?? null, error: data ? null : "Chat thread not found." };
}

function normalizeLimit(value: string | null) {
  if (!value) {
    return 50;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 50;
  }
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function formatMessage(row: Record<string, unknown>) {
  const author = row.author as
    | { id?: string; full_name?: string | null; email?: string | null; role?: string | null }
    | { id?: string; full_name?: string | null; email?: string | null; role?: string | null }[]
    | null
    | undefined;
  const authorRow = Array.isArray(author) ? author[0] : author;
  const authorName = authorRow?.full_name?.trim() || authorRow?.email?.trim() || "User";

  return {
    id: row.id,
    body: row.body ?? "",
    imageUrl: row.image_url ?? null,
    imageStoragePath: row.image_storage_path ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: authorRow?.id ?? null,
      name: authorName,
      role: authorRow?.role ?? "member",
    },
  };
}

export async function GET(request: NextRequest) {
  const { error } = await requireUserContext();
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const threadSlug = request.nextUrl.searchParams.get("thread") ?? "main";
  const { thread, error: threadError } = await findThread(threadSlug);
  if (threadError || !thread) {
    return NextResponse.json({ error: threadError ?? "Invalid chat thread." }, { status: 400 });
  }

  const limit = normalizeLimit(request.nextUrl.searchParams.get("limit"));
  const { data, error: messagesError } = await supabaseAdmin
    .from("chat_messages")
    .select(MESSAGE_SELECT)
    .eq("thread_id", thread.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (messagesError) {
    return NextResponse.json({ error: "Failed to load chat messages." }, { status: 500 });
  }

  const messages = ((data ?? []) as Array<Record<string, unknown>>).reverse().map(formatMessage);
  return NextResponse.json({ thread, messages });
}

export async function POST(request: NextRequest) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let threadSlug = "main";
  let body = "";
  let image: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
    }
    threadSlug = String(formData.get("thread") ?? "main");
    body = sanitizeChatBody(formData.get("body"));
    const file = formData.get("image");
    image = file instanceof File && file.size > 0 ? file : null;
  } else {
    const payload = (await request.json().catch(() => null)) as { thread?: unknown; body?: unknown } | null;
    threadSlug = typeof payload?.thread === "string" ? payload.thread : "main";
    body = sanitizeChatBody(payload?.body);
  }

  const { thread, error: threadError } = await findThread(threadSlug);
  if (threadError || !thread) {
    return NextResponse.json({ error: threadError ?? "Invalid chat thread." }, { status: 400 });
  }

  if (!body && !image) {
    return NextResponse.json({ error: "Message text or image is required." }, { status: 400 });
  }

  let imageUrl: string | null = null;
  let imageStoragePath: string | null = null;

  if (image) {
    const ext = CHAT_IMAGE_TYPES[image.type];
    if (!ext) {
      return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
    }
    if (image.size > CHAT_MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "Image exceeds 10 MB upload limit." }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    imageStoragePath = `chat/${thread.slug}/${randomUUID()}${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("chat-uploads")
      .upload(imageStoragePath, buffer, {
        contentType: image.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from("chat-uploads").getPublicUrl(imageStoragePath);
    imageUrl = publicUrlData.publicUrl;
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("chat_messages")
    .insert({
      thread_id: thread.id,
      author_user_id: userId,
      body,
      image_url: imageUrl,
      image_storage_path: imageStoragePath,
      updated_at: new Date().toISOString(),
    })
    .select(MESSAGE_SELECT)
    .single();

  if (insertError || !data) {
    return NextResponse.json({ error: "Failed to send chat message." }, { status: 500 });
  }

  return NextResponse.json({ message: formatMessage(data as Record<string, unknown>) }, { status: 201 });
}
