"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Link as LinkIcon, Loader2, MessageCircle, Send, X } from "lucide-react";

type ChatThread = {
  id: string;
  slug: "main" | "nutrition" | "competition";
  name: string;
  description: string | null;
  messageCount: number;
  latestMessage: {
    body: string | null;
    image_url: string | null;
    created_at: string;
  } | null;
};

type ChatMessage = {
  id: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  author: {
    id: string | null;
    name: string;
    role: string;
  };
};

const threadFallbacks: ChatThread[] = [
  {
    id: "main",
    slug: "main",
    name: "Main",
    description: "General gym conversation.",
    messageCount: 0,
    latestMessage: null,
  },
  {
    id: "nutrition",
    slug: "nutrition",
    name: "Nutrition",
    description: "Food, macros, and meal ideas.",
    messageCount: 0,
    latestMessage: null,
  },
  {
    id: "competition",
    slug: "competition",
    name: "Competition",
    description: "Events, prep, and strategy.",
    messageCount: 0,
    latestMessage: null,
  },
];

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function roleLabel(role: string) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "coach") return "Coach";
  return "Member";
}

function LinkifiedText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const pattern = /(https?:\/\/[^\s]+)/g;
    const segments: Array<{ type: "text" | "link"; value: string }> = [];
    let lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      if (index > lastIndex) {
        segments.push({ type: "text", value: text.slice(lastIndex, index) });
      }
      segments.push({ type: "link", value: match[0] });
      lastIndex = index + match[0].length;
    }
    if (lastIndex < text.length) {
      segments.push({ type: "text", value: text.slice(lastIndex) });
    }
    return segments.length ? segments : [{ type: "text" as const, value: text }];
  }, [text]);

  return (
    <>
      {parts.map((part, index) =>
        part.type === "link" ? (
          <a
            key={`${part.value}-${index}`}
            href={part.value}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 break-all font-semibold text-[#047C84] underline decoration-[#14D2DC]/40 underline-offset-2"
          >
            <LinkIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
            {part.value}
          </a>
        ) : (
          <span key={`${part.value}-${index}`}>{part.value}</span>
        )
      )}
    </>
  );
}

export default function ChatClient() {
  const [threads, setThreads] = useState<ChatThread[]>(threadFallbacks);
  const [activeThread, setActiveThread] = useState<ChatThread["slug"]>("main");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const selectedThread = threads.find((thread) => thread.slug === activeThread) ?? threadFallbacks[0];

  const loadThreads = useCallback(async () => {
    try {
      const response = await fetch("/api/chat/threads", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load threads.");
      }
      setThreads(payload.threads ?? threadFallbacks);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load threads.");
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const loadMessages = useCallback(async (threadSlug: ChatThread["slug"], quiet = false) => {
    if (!quiet) {
      setLoadingMessages(true);
    }
    try {
      const response = await fetch(`/api/chat/messages?thread=${encodeURIComponent(threadSlug)}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load messages.");
      }
      setMessages(payload.messages ?? []);
      if (!quiet) {
        setError("");
      }
    } catch (loadError) {
      if (!quiet) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load messages.");
      }
    } finally {
      if (!quiet) {
        setLoadingMessages(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    void loadMessages(activeThread);
  }, [activeThread, loadMessages]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadMessages(activeThread, true);
        void loadThreads();
      }
    }, 12000);

    return () => window.clearInterval(interval);
  }, [activeThread, loadMessages, loadThreads]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, loadingMessages]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const nextPreview = URL.createObjectURL(imageFile);
    setImagePreview(nextPreview);
    return () => URL.revokeObjectURL(nextPreview);
  }, [imageFile]);

  function handleImageSelect(file: File | null | undefined) {
    setError("");
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Images must be 10 MB or smaller.");
      return;
    }
    setImageFile(file);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed && !imageFile) {
      setError("Write a message or attach an image first.");
      return;
    }

    setSending(true);
    setError("");
    try {
      let response: Response;
      if (imageFile) {
        const formData = new FormData();
        formData.set("thread", activeThread);
        formData.set("body", trimmed);
        formData.set("image", imageFile);
        response = await fetch("/api/chat/messages", {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thread: activeThread, body: trimmed }),
        });
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to send message.");
      }

      setMessages((current) => [...current, payload.message]);
      setDraft("");
      setImageFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      void loadThreads();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--line)] px-5 py-5 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#047C84]">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Gym Chat
            </div>
            <h1 className="mt-2 font-head text-3xl font-bold tracking-tight text-[var(--text)]">
              Shared threads
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              Post updates, links, and images for the whole Elev8 crew.
            </p>
          </div>
          {loadingThreads ? (
            <div className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading threads
            </div>
          ) : null}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--line)] p-3 lg:border-b-0 lg:border-r lg:p-4">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {threads.map((thread) => {
              const active = thread.slug === activeThread;
              return (
                <button
                  key={thread.slug}
                  type="button"
                  onClick={() => setActiveThread(thread.slug)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-[#14D2DC]/50 bg-[#14D2DC]/10 shadow-[0_14px_40px_rgba(20,210,220,0.12)]"
                      : "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--line-strong)]"
                  }`}
                  aria-pressed={active}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-head text-base font-bold">{thread.name}</span>
                    <span className="rounded-full border border-[var(--line)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                      {thread.messageCount}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">
                    {thread.description}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-[var(--line)] px-5 py-4 lg:px-8">
            <h2 className="font-head text-xl font-bold">{selectedThread.name}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{selectedThread.description}</p>
          </div>

          <div ref={scrollRef} className="min-h-[360px] flex-1 overflow-y-auto px-5 py-5 lg:px-8">
            {error ? (
              <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {loadingMessages ? (
              <div className="flex h-full min-h-[260px] items-center justify-center text-sm text-[var(--text-muted)]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Loading messages
              </div>
            ) : messages.length === 0 ? (
              <div className="grid min-h-[260px] place-items-center rounded-3xl border border-dashed border-[var(--line)] bg-[var(--panel)] p-8 text-center">
                <div>
                  <MessageCircle className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
                  <h3 className="mt-3 font-head text-lg font-bold">Start the {selectedThread.name} thread</h3>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">Share an update, question, link, or image.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <article key={message.id} className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-head text-sm font-bold">{message.author.name}</span>
                      <span className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        {roleLabel(message.author.role)}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--text-soft)]">
                        {formatMessageTime(message.createdAt)}
                      </span>
                    </div>
                    {message.body ? (
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text)]">
                        <LinkifiedText text={message.body} />
                      </p>
                    ) : null}
                    {message.imageUrl ? (
                      <a href={message.imageUrl} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]">
                        <img src={message.imageUrl} alt="Chat attachment" className="max-h-[420px] w-full object-contain" />
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={sendMessage} className="sticky bottom-0 border-t border-[var(--line)] bg-[var(--bg)] px-5 py-4 lg:px-8">
            {imagePreview ? (
              <div className="mb-3 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2">
                <img src={imagePreview} alt="Selected attachment preview" className="h-14 w-14 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{imageFile?.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">Ready to attach</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line)] text-[var(--text-muted)] transition hover:text-[var(--text)]"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            <div className="flex items-end gap-2 rounded-3xl border border-[var(--line-strong)] bg-[var(--panel)] p-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => handleImageSelect(event.target.files?.[0])}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[var(--text-muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
                aria-label="Attach image"
                title="Attach image"
              >
                <ImageIcon className="h-5 w-5" aria-hidden="true" />
              </button>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Message ${selectedThread.name}`}
                rows={2}
                className="min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-5 outline-none placeholder:text-[var(--text-soft)]"
              />
              <button
                type="submit"
                disabled={sending || (!draft.trim() && !imageFile)}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl bg-[#17141F] px-4 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
