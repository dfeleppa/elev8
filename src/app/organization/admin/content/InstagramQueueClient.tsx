"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type InstagramPost = {
  id: string;
  caption: string | null;
  post_type: string;
  publish_mode: string;
  status: string;
  scheduled_for: string | null;
  updated_at: string;
  assets: Array<{ id: string; media_url: string; media_type: string; sort_order: number }>;
};

type Props = {
  organizationId: string;
  initialPosts: InstagramPost[];
};

export default function InstagramQueueClient({ organizationId, initialPosts }: Props) {
  const router = useRouter();
  const [posts, setPosts] = useState<InstagramPost[]>(initialPosts);
  const [caption, setCaption] = useState("");
  const [postType, setPostType] = useState("image");
  const [publishMode, setPublishMode] = useState("auto");
  const [scheduledFor, setScheduledFor] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createPost() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/content/instagram/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          caption,
          postType,
          publishMode,
          scheduledFor: scheduledFor || null,
          assets: mediaUrl.trim() ? [{ mediaUrl: mediaUrl.trim(), mediaType: postType === "reel" ? "video" : "image" }] : [],
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error ?? "Failed to create post.");
        return;
      }

      setCaption("");
      setScheduledFor("");
      setMediaUrl("");
      setPosts((current) => [payload.post, ...current]);
      router.refresh();
    } catch {
      setError("Failed to create post.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePost(postId: string) {
    setError(null);
    try {
      const response = await fetch(
        `/api/content/instagram/posts/${postId}?organizationId=${encodeURIComponent(organizationId)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload?.error ?? "Failed to delete post.");
        return;
      }

      setPosts((current) => current.filter((post) => post.id !== postId));
      router.refresh();
    } catch {
      setError("Failed to delete post.");
    }
  }

  async function updateStatus(postId: string, status: string) {
    setError(null);
    try {
      const response = await fetch(`/api/content/instagram/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, status }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.post) {
        setError(payload?.error ?? "Failed to update post.");
        return;
      }

      setPosts((current) => current.map((post) => (post.id === postId ? payload.post : post)));
      router.refresh();
    } catch {
      setError("Failed to update post.");
    }
  }

  return (
    <section className="grid gap-5 md:grid-cols-2">
      <article className="glass-panel rounded-2xl border border-white/10 p-5">
        <h3 className="text-lg font-semibold text-slate-100">Composer and Queue</h3>
        <p className="mt-2 text-sm text-slate-400">Create a draft or scheduled post for image, carousel, reel, or story.</p>

        <div className="mt-4 space-y-3">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            placeholder="Write caption"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
            >
              <option value="image">Image</option>
              <option value="carousel">Carousel</option>
              <option value="reel">Reel</option>
              <option value="story">Story</option>
            </select>

            <select
              value={publishMode}
              onChange={(e) => setPublishMode(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
            >
              <option value="auto">Auto Publish</option>
              <option value="reminder">Reminder</option>
            </select>
          </div>

          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
          />

          <input
            type="url"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="Optional media URL"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />

          {error && <p className="text-sm text-rose-300">{error}</p>}

          <button
            type="button"
            disabled={saving}
            onClick={createPost}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/15 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create Post"}
          </button>
        </div>
      </article>

      <article className="glass-panel rounded-2xl border border-white/10 p-5">
        <h3 className="text-lg font-semibold text-slate-100">Scheduled and Draft Posts</h3>
        <p className="mt-2 text-sm text-slate-400">Recent queue ordered by schedule time and creation date.</p>

        {posts.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-500">
            No posts yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {posts.map((post) => (
              <article key={post.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <p className="text-sm text-slate-100">{post.caption || "(No caption)"}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {post.post_type} · {post.publish_mode} · {post.status}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {post.scheduled_for ? `Scheduled ${new Date(post.scheduled_for).toLocaleString()}` : "Not scheduled"}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Assets: {post.assets.length}</span>
                  <div className="flex gap-2">
                    {post.status === "publish_failed" && (
                      <button
                        type="button"
                        onClick={() => updateStatus(post.id, "scheduled")}
                        className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300 hover:border-cyan-400/60"
                      >
                        Retry
                      </button>
                    )}
                    {post.status === "reminder_pending" && (
                      <button
                        type="button"
                        onClick={() => updateStatus(post.id, "reminder_sent")}
                        className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-300 hover:border-amber-400/60"
                      >
                        Mark Sent
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deletePost(post.id)}
                      className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-xs text-rose-300 hover:border-rose-400/60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}