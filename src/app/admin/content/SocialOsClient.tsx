"use client";

import { useMemo, useState, type ReactNode } from "react";

import {
  AccentCard,
  Panel,
  Stat,
  uiBannerErrorClass,
  uiBannerSuccessClass,
  uiButtonGhostClass,
  uiButtonInfoClass,
  uiButtonPrimaryClass,
  uiCardCopyClass,
  uiCardHeadClass,
  uiCheckboxRowClass,
  uiCopyClass,
  uiEmptyStateClass,
  uiFieldClass,
  uiInlineCheckClass,
  uiKickerClass,
  uiLabelClass,
  uiPageClass,
  uiPageHeaderRowClass,
  uiSelectClass,
  uiSurfaceClass,
  uiSurfaceMutedClass,
  uiTabActiveClass,
  uiTabClass,
  uiTabStripClass,
  uiTextareaClass,
  uiTitleClass,
  uiTitleSmClass,
} from "@/components/ui";

type Props = {
  weekOf: string;
  initialSocialError: string | null;
  initialAccounts: any[];
  initialSettings: any;
  initialCampaigns: any[];
  initialPillars: any[];
  initialPosts: any[];
  initialAssets: any[];
  initialInbox: { comments: any[]; conversations: any[] };
  initialOverview: any;
  initialGooglePhotosSources: any[];
  members: Array<{ userId: string; fullName: string }>;
};

const TABS = [
  "planner",
  "creator",
  "queue",
  "overview",
  "campaigns",
  "assets",
  "inbox",
  "analytics",
  "ideas",
] as const;
const LANES = ["idea", "brief", "draft", "in_review", "approved", "scheduled"] as const;

const dt = (value?: string | null) => (value ? new Date(value).toLocaleString() : "Not set");

function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="ds-stat-card">
      <Stat label={title} value={value} size="sm" />
      <p className="mt-2 text-xs text-[var(--text-soft)]">{hint}</p>
    </div>
  );
}

function SectionBlock({
  title,
  copy,
  children,
}: {
  title: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <Panel className="rounded-[28px]" padding="lg">
      <div className={uiCardHeadClass}>
        <div>
          <h2 className={uiTitleSmClass}>{title}</h2>
          <p className={uiCardCopyClass}>{copy}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </Panel>
  );
}

function SocialCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <article className={`${uiSurfaceMutedClass} p-4 ${className}`}>{children}</article>;
}

export default function SocialOsClient({
  weekOf,
  initialSocialError,
  initialAccounts,
  initialSettings,
  initialCampaigns,
  initialPillars,
  initialPosts,
  initialAssets,
  initialInbox,
  initialOverview,
  initialGooglePhotosSources,
  members,
}: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("planner");
  const [accounts] = useState(initialAccounts);
  const [settings, setSettings] = useState(initialSettings);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [posts, setPosts] = useState(initialPosts);
  const [assets, setAssets] = useState(initialAssets);
  const [inbox, setInbox] = useState(initialInbox);
  const [overview] = useState(initialOverview);
  const [googleSources, setGoogleSources] = useState(initialGooglePhotosSources);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialSocialError);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [creator, setCreator] = useState({
    title: "",
    brief: "",
    caption: "",
    firstComment: "",
    targetPublishAt: "",
    workflowState: "draft",
    campaignId: "",
    pillarId: "",
    assignedTo: "",
    tags: "",
    approvalRequired: false,
    useInstagram: true,
    useFacebook: true,
  });
  const [pickedAssets, setPickedAssets] = useState<string[]>([]);
  const [campaignDraft, setCampaignDraft] = useState({ title: "", objective: "" });
  const [settingsDraft, setSettingsDraft] = useState({
    brandVoice: initialSettings?.brand_voice ?? "",
    hashtags: (initialSettings?.default_hashtags ?? []).join(", "),
    ctas: (initialSettings?.cta_presets ?? []).join(", "),
    approvalMode: initialSettings?.approval_mode ?? "optional",
    timezone: initialSettings?.timezone ?? "America/New_York",
  });
  const [assetUrl, setAssetUrl] = useState("");
  const [googleDraft, setGoogleDraft] = useState({
    googleAccountEmail: "",
    albumId: "",
    albumTitle: "",
  });

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(`${weekOf}T00:00:00`);
        date.setDate(date.getDate() + i);
        return {
          key: date.toISOString().slice(0, 10),
          label: date.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
        };
      }),
    [weekOf],
  );

<<<<<<< HEAD
  const ideas = useMemo(
    () => posts.filter((post) => post.workflow_state === "idea" || post.workflow_state === "brief"),
    [posts],
  );

  async function j<T>(input: RequestInfo, init?: RequestInit) {
    const response = await fetch(input, init);
    const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }
    return payload;
  }

  async function saveSettings() {
    try {
      const payload = await j<{ settings: any }>("/api/social/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalMode: settingsDraft.approvalMode,
          brandVoice: settingsDraft.brandVoice,
          defaultHashtags: settingsDraft.hashtags
            .split(",")
            .map((x: string) => x.trim())
            .filter(Boolean),
          ctaPresets: settingsDraft.ctas
            .split(",")
            .map((x: string) => x.trim())
            .filter(Boolean),
          timezone: settingsDraft.timezone,
        }),
      });
      setSettings(payload.settings);
      setNotice("Social settings updated.");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function createCampaign() {
    try {
      const payload = await j<{ campaign: any }>("/api/social/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: campaignDraft.title,
          objective: campaignDraft.objective,
        }),
      });
      setCampaigns((current) => [payload.campaign, ...current]);
      setCampaignDraft({ title: "", objective: "" });
      setNotice("Campaign created.");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function generateAi() {
    try {
      const payload = await j<{ run: { output: any } }>("/api/social/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: creator.brief || creator.title,
          campaign: campaigns.find((campaign) => campaign.id === creator.campaignId)?.title ?? null,
          pillar: initialPillars.find((pillar) => pillar.id === creator.pillarId)?.name ?? null,
          brandVoice: settingsDraft.brandVoice,
        }),
      });
      setCreator((current) => ({
        ...current,
        caption: payload.run.output?.caption ?? current.caption,
        firstComment: payload.run.output?.firstComment ?? current.firstComment,
      }));
      setNotice("AI draft generated.");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function createPost() {
    try {
      const channels = [];
      if (creator.useInstagram) {
        channels.push({
          platform: "instagram",
          channelType: "image",
          scheduledFor: creator.targetPublishAt || null,
        });
      }
      if (creator.useFacebook) {
        channels.push({
          platform: "facebook",
          channelType: "image",
          scheduledFor: creator.targetPublishAt || null,
        });
      }

      const payload = await j<{ post: any }>("/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: creator.title,
          brief: creator.brief,
          caption: creator.caption,
          firstComment: creator.firstComment,
          workflowState: creator.targetPublishAt ? "scheduled" : creator.workflowState,
          approvalRequired: creator.approvalRequired,
          targetPublishAt: creator.targetPublishAt || null,
          campaignId: creator.campaignId || null,
          contentPillarId: creator.pillarId || null,
          assignedToUserId: creator.assignedTo || null,
          tags: creator.tags
            .split(",")
            .map((x: string) => x.trim())
            .filter(Boolean),
          assetIds: pickedAssets,
          channels,
          plannerSlot: {
            slotDate: creator.targetPublishAt ? creator.targetPublishAt.slice(0, 10) : weekOf,
            lane: creator.targetPublishAt ? "scheduled" : creator.workflowState,
            sortOrder: 0,
          },
        }),
      });

      setPosts((current) => [payload.post, ...current]);
      setCreator({
        title: "",
        brief: "",
        caption: "",
        firstComment: "",
        targetPublishAt: "",
        workflowState: "draft",
        campaignId: "",
        pillarId: "",
        assignedTo: "",
        tags: "",
        approvalRequired: false,
        useInstagram: true,
        useFacebook: true,
      });
      setPickedAssets([]);
      setNotice("Content item created.");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function duplicatePost(id: string) {
    try {
      const payload = await j<{ post: any }>(`/api/social/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate" }),
      });
      setPosts((current) => [payload.post, ...current]);
      setNotice("Post duplicated.");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function deletePost(id: string) {
    try {
      await j(`/api/social/posts/${id}`, { method: "DELETE" });
      setPosts((current) => current.filter((post) => post.id !== id));
      setNotice("Post deleted.");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function movePlanner(id: string, slotDate: string, lane: string) {
    try {
      await j("/api/social/planner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socialPostId: id, slotDate, lane, sortOrder: 0 }),
      });
      setPosts((current) =>
        current.map((post) =>
          post.id === id
            ? {
                ...post,
                workflow_state: lane,
                planner_slot: {
                  id: post.planner_slot?.id ?? `slot-${id}`,
                  slot_date: slotDate,
                  slot_week: weekOf,
                  lane,
                  sort_order: 0,
                },
              }
            : post,
        ),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function saveAssetUrl() {
    try {
      const payload = await j<{ asset: any }>("/api/social/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: assetUrl, title: "Imported asset" }),
      });
      setAssets((current) => [payload.asset, ...current]);
      setAssetUrl("");
      setNotice("Asset saved.");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function uploadAsset(file: File) {
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/social/assets", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as { asset?: any; error?: string };
      if (!response.ok || !payload.asset) {
        throw new Error(payload.error || "Upload failed.");
      }
      setAssets((current) => [payload.asset!, ...current]);
      setNotice("Asset uploaded.");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function addGoogleSource() {
    try {
      const payload = await j<{ source: any }>("/api/social/google-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...googleDraft }),
      });
      setGoogleSources((current) => [payload.source, ...current]);
      setGoogleDraft({ googleAccountEmail: "", albumId: "", albumTitle: "" });
      setNotice("Google Photos source saved.");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function resolveInbox(itemType: "comment" | "conversation", itemId: string, status: string) {
    try {
      await j("/api/social/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, itemId, status }),
      });
      setInbox((current) => ({
        comments: current.comments.map((item) =>
          itemType === "comment" && item.id === itemId ? { ...item, status } : item,
        ),
        conversations: current.conversations.map((item) =>
          itemType === "conversation" && item.id === itemId ? { ...item, status } : item,
        ),
      }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  }

  return (
    <section className={uiPageClass}>
      <AccentCard tone="ink" className="rounded-[32px] p-6 md:p-7">
        <div className={uiPageHeaderRowClass}>
          <div>
            <p className={uiKickerClass}>Content workspace</p>
            <h1 className={`${uiTitleClass} mt-2`}>Social OS</h1>
            <p className={`${uiCopyClass} mt-3 max-w-3xl`}>
              Plan, create, publish, analyze, and respond for Instagram and Facebook in one place.
            </p>
          </div>
          <a href="/api/social/accounts/connect" className={uiButtonInfoClass}>
            Connect Meta Account
          </a>
        </div>

        <div className="mt-6 ds-grid-stats md:grid-cols-3 xl:grid-cols-7">
          <MetricCard title="Accounts" value={overview.metrics.connectedAccounts} hint="Connected surfaces." />
          <MetricCard title="Scheduled" value={overview.metrics.scheduledPosts} hint="Queued for publish." />
          <MetricCard title="Review" value={overview.metrics.awaitingApproval} hint="Awaiting review." />
          <MetricCard title="Failures" value={overview.metrics.publishFailures} hint="Needs retry." />
          <MetricCard title="Inbox" value={overview.metrics.inboxOpen} hint="Open conversations." />
          <MetricCard title="30d Published" value={overview.metrics.publishedLast30d} hint="Last 30 days." />
          <MetricCard title="Brand Voice" value={settings?.brand_voice ? "Set" : "Missing"} hint="Copilot guidance." />
        </div>
      </AccentCard>

      <div className={uiTabStripClass}>
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={tab === item ? uiTabActiveClass : uiTabClass}
          >
            {item}
          </button>
        ))}
      </div>

      {notice ? <div className={uiBannerSuccessClass}>{notice}</div> : null}
      {error ? <div className={uiBannerErrorClass}>{error}</div> : null}

      {tab === "planner" ? (
        <SectionBlock title="Weekly Planner" copy="Drag cards across the week and move them through workflow lanes.">
          <div className="grid gap-4 xl:grid-cols-7">
            {days.map((day) => (
              <div
                key={day.key}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() =>
                  draggedId &&
                  movePlanner(
                    draggedId,
                    day.key,
                    posts.find((post) => post.id === draggedId)?.workflow_state ?? "draft",
                  )
                }
                className={`${uiSurfaceMutedClass} p-3`}
              >
                <p className={uiKickerClass}>{day.label}</p>
                <div className="mt-3 space-y-3">
                  {posts
                    .filter(
                      (post) =>
                        (post.planner_slot?.slot_date ?? post.target_publish_at?.slice(0, 10)) === day.key,
                    )
                    .map((post) => (
                      <SocialCard
                        key={post.id}
                        className="cursor-grab p-3 active:cursor-grabbing"
                      >
                        <article draggable onDragStart={() => setDraggedId(post.id)}>
                          <p className="text-sm font-semibold text-[var(--text)]">
                            {post.title || post.caption || "Untitled"}
                          </p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            {post.brief || post.caption || "No brief yet."}
                          </p>
                          <select
                            value={post.workflow_state}
                            onChange={(event) => movePlanner(post.id, day.key, event.target.value)}
                            className={`${uiSelectClass} mt-3 px-2 py-2 text-xs`}
                          >
                            {LANES.map((lane) => (
                              <option key={lane} value={lane}>
                                {lane}
                              </option>
                            ))}
                          </select>
                        </article>
                      </SocialCard>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </SectionBlock>
      ) : null}

      {tab === "creator" ? (
        <SectionBlock
          title="Creator"
          copy="Build the brief, attach assets, and generate platform-ready copy."
        >
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={creator.title}
                  onChange={(event) => setCreator((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Content title"
                  className={uiFieldClass}
                />
                <select
                  value={creator.assignedTo}
                  onChange={(event) => setCreator((current) => ({ ...current, assignedTo: event.target.value }))}
                  className={uiSelectClass}
                >
                  <option value="">Assign owner</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                value={creator.brief}
                onChange={(event) => setCreator((current) => ({ ...current, brief: event.target.value }))}
                rows={4}
                placeholder="Brief"
                className={`${uiTextareaClass} mt-4`}
              />
              <textarea
                value={creator.caption}
                onChange={(event) => setCreator((current) => ({ ...current, caption: event.target.value }))}
                rows={4}
                placeholder="Caption"
                className={`${uiTextareaClass} mt-4`}
              />
              <textarea
                value={creator.firstComment}
                onChange={(event) =>
                  setCreator((current) => ({ ...current, firstComment: event.target.value }))
                }
                rows={2}
                placeholder="First comment"
                className={`${uiTextareaClass} mt-4 min-h-[96px]`}
              />

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <select
                  value={creator.campaignId}
                  onChange={(event) => setCreator((current) => ({ ...current, campaignId: event.target.value }))}
                  className={uiSelectClass}
                >
                  <option value="">No campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.title}
                    </option>
                  ))}
                </select>
                <select
                  value={creator.pillarId}
                  onChange={(event) => setCreator((current) => ({ ...current, pillarId: event.target.value }))}
                  className={uiSelectClass}
                >
                  <option value="">No pillar</option>
                  {initialPillars.map((pillar) => (
                    <option key={pillar.id} value={pillar.id}>
                      {pillar.name}
                    </option>
                  ))}
                </select>
                <input
                  value={creator.tags}
                  onChange={(event) => setCreator((current) => ({ ...current, tags: event.target.value }))}
                  placeholder="Tags"
                  className={uiFieldClass}
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <select
                  value={creator.workflowState}
                  onChange={(event) =>
                    setCreator((current) => ({ ...current, workflowState: event.target.value }))
                  }
                  className={uiSelectClass}
                >
                  {LANES.map((lane) => (
                    <option key={lane} value={lane}>
                      {lane}
                    </option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  value={creator.targetPublishAt}
                  onChange={(event) =>
                    setCreator((current) => ({ ...current, targetPublishAt: event.target.value }))
                  }
                  className={uiFieldClass}
                />
                <label className={uiCheckboxRowClass}>
                  <input
                    type="checkbox"
                    checked={creator.approvalRequired}
                    onChange={(event) =>
                      setCreator((current) => ({ ...current, approvalRequired: event.target.checked }))
                    }
                  />
                  Require approval
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <label className={uiInlineCheckClass}>
                  <input
                    type="checkbox"
                    checked={creator.useInstagram}
                    onChange={(event) =>
                      setCreator((current) => ({ ...current, useInstagram: event.target.checked }))
                    }
                  />
                  Instagram
                </label>
                <label className={uiInlineCheckClass}>
                  <input
                    type="checkbox"
                    checked={creator.useFacebook}
                    onChange={(event) =>
                      setCreator((current) => ({ ...current, useFacebook: event.target.checked }))
                    }
                  />
                  Facebook
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={generateAi} className={uiButtonInfoClass}>
                  AI Copilot
                </button>
                <button type="button" onClick={createPost} className={uiButtonPrimaryClass}>
                  Create content item
                </button>
              </div>
            </div>

            <div className="grid max-h-[680px] gap-3 overflow-y-auto md:grid-cols-2">
              {assets.map((asset) => {
                const picked = pickedAssets.includes(asset.id);
                return (
                  <label
                    key={asset.id}
                    className={`${picked ? "border-[var(--info-line)] bg-[var(--info-bg)]" : uiSurfaceMutedClass} cursor-pointer p-3`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {asset.title || "Untitled asset"}
                      </p>
                      <input
                        type="checkbox"
                        checked={picked}
                        onChange={(event) =>
                          setPickedAssets((current) =>
                            event.target.checked
                              ? [...current, asset.id]
                              : current.filter((id) => id !== asset.id),
                          )
                        }
                      />
                    </div>
                    {asset.public_url || asset.source_url ? (
                      <img
                        src={asset.public_url || asset.source_url}
                        alt={asset.title || "Asset"}
                        className="mt-3 h-32 w-full rounded-xl object-cover"
                      />
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>
        </SectionBlock>
      ) : null}

      {tab === "queue" ? (
        <SectionBlock
          title="Queue"
          copy="One queue across Instagram and Facebook with duplicate and delete actions."
        >
          <div className="space-y-4">
            {posts.map((post) => (
              <SocialCard key={post.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-[var(--text)]">
                      {post.title || post.caption || "Untitled"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {post.brief || post.caption || "No copy yet."}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-soft)]">Target {dt(post.target_publish_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => duplicatePost(post.id)} className={uiButtonInfoClass}>
                      Duplicate
                    </button>
                    <button type="button" onClick={() => deletePost(post.id)} className={uiButtonGhostClass}>
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {post.channels.map((channel: any) => (
                    <div key={channel.id} className={`${uiSurfaceClass} p-3`}>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {channel.platform} / {channel.channel_type}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-soft)]">
                        {channel.status}
                      </p>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        Scheduled {dt(channel.scheduled_for)}
                      </p>
                      {channel.last_error_message ? (
                        <p className="mt-2 text-xs text-[var(--danger-text)]">{channel.last_error_message}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </SocialCard>
            ))}
          </div>
        </SectionBlock>
      ) : null}

      {tab === "overview" ? (
        <SectionBlock
          title="Overview"
          copy="Account health and social operating defaults."
        >
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-3">
              {accounts.map((account) => (
                <SocialCard key={account.id}>
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {account.platform} ·{" "}
                    {account.display_name || account.username || account.external_account_id}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">
                    Sync {dt(account.last_synced_at)} · Expiry {dt(account.token_expires_at)}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {account.granted_scopes.join(", ")}
                  </p>
                </SocialCard>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className={uiLabelClass}>Brand voice</label>
                <textarea
                  value={settingsDraft.brandVoice}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({ ...current, brandVoice: event.target.value }))
                  }
                  rows={4}
                  placeholder="Brand voice"
                  className={`${uiTextareaClass} min-h-[120px]`}
                />
              </div>
              <div>
                <label className={uiLabelClass}>Default hashtags</label>
                <input
                  value={settingsDraft.hashtags}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({ ...current, hashtags: event.target.value }))
                  }
                  placeholder="Default hashtags"
                  className={uiFieldClass}
                />
              </div>
              <div>
                <label className={uiLabelClass}>CTA presets</label>
                <input
                  value={settingsDraft.ctas}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, ctas: event.target.value }))}
                  placeholder="CTA presets"
                  className={uiFieldClass}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={uiLabelClass}>Approval mode</label>
                  <select
                    value={settingsDraft.approvalMode}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({ ...current, approvalMode: event.target.value }))
                    }
                    className={uiSelectClass}
                  >
                    <option value="optional">Approval optional</option>
                    <option value="required">Approval required</option>
                  </select>
                </div>
                <div>
                  <label className={uiLabelClass}>Timezone</label>
                  <input
                    value={settingsDraft.timezone}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({ ...current, timezone: event.target.value }))
                    }
                    className={uiFieldClass}
                  />
                </div>
              </div>
              <button type="button" onClick={saveSettings} className={uiButtonPrimaryClass}>
                Save defaults
              </button>
            </div>
          </div>
        </SectionBlock>
      ) : null}

      {tab === "campaigns" ? (
        <SectionBlock
          title="Campaigns"
          copy="Campaigns organize the planner and give AI generation context."
        >
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className={uiLabelClass}>Campaign title</label>
                <input
                  value={campaignDraft.title}
                  onChange={(event) =>
                    setCampaignDraft((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Campaign title"
                  className={uiFieldClass}
                />
              </div>
              <div>
                <label className={uiLabelClass}>Objective</label>
                <textarea
                  value={campaignDraft.objective}
                  onChange={(event) =>
                    setCampaignDraft((current) => ({ ...current, objective: event.target.value }))
                  }
                  rows={3}
                  placeholder="Objective"
                  className={`${uiTextareaClass} min-h-[110px]`}
                />
              </div>
              <button type="button" onClick={createCampaign} className={uiButtonPrimaryClass}>
                Create campaign
              </button>
            </div>

            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <SocialCard key={campaign.id}>
                  <p className="text-sm font-semibold text-[var(--text)]">{campaign.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">
                    {campaign.objective || "No objective yet."}
                  </p>
                </SocialCard>
              ))}
            </div>
          </div>
        </SectionBlock>
      ) : null}

      {tab === "assets" ? (
        <SectionBlock
          title="Assets"
          copy="Supabase Storage is the canonical library, with Google Photos modeled as a source."
        >
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-4">
              <label className={`${uiEmptyStateClass} block cursor-pointer text-center text-sm`}>
                Upload photo or video
                <input
                  type="file"
                  className="mt-3 block w-full text-xs text-[var(--text-muted)]"
                  onChange={(event) => event.target.files?.[0] && uploadAsset(event.target.files[0])}
                />
              </label>

              <div>
                <label className={uiLabelClass}>External media URL</label>
                <input
                  value={assetUrl}
                  onChange={(event) => setAssetUrl(event.target.value)}
                  placeholder="External media URL"
                  className={uiFieldClass}
                />
              </div>

              <button type="button" onClick={saveAssetUrl} className={uiButtonGhostClass}>
                Save external asset
              </button>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className={uiLabelClass}>Google email</label>
                  <input
                    value={googleDraft.googleAccountEmail}
                    onChange={(event) =>
                      setGoogleDraft((current) => ({
                        ...current,
                        googleAccountEmail: event.target.value,
                      }))
                    }
                    placeholder="Google email"
                    className={uiFieldClass}
                  />
                </div>
                <div>
                  <label className={uiLabelClass}>Album ID</label>
                  <input
                    value={googleDraft.albumId}
                    onChange={(event) =>
                      setGoogleDraft((current) => ({ ...current, albumId: event.target.value }))
                    }
                    placeholder="Album ID"
                    className={uiFieldClass}
                  />
                </div>
                <div>
                  <label className={uiLabelClass}>Album title</label>
                  <input
                    value={googleDraft.albumTitle}
                    onChange={(event) =>
                      setGoogleDraft((current) => ({ ...current, albumTitle: event.target.value }))
                    }
                    placeholder="Album title"
                    className={uiFieldClass}
                  />
                </div>
              </div>

              <button type="button" onClick={addGoogleSource} className={uiButtonInfoClass}>
                Save Google Photos source
              </button>

              <div className="space-y-3">
                {googleSources.map((source) => (
                  <SocialCard key={source.id}>
                    <p className="text-sm text-[var(--text)]">
                      {source.album_title || source.album_id || "Untitled album"} · {source.status}
                    </p>
                  </SocialCard>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {assets.map((asset) => (
                <SocialCard key={asset.id} className="p-3">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {asset.title || "Untitled asset"}
                  </p>
                  {asset.public_url || asset.source_url ? (
                    <img
                      src={asset.public_url || asset.source_url}
                      alt={asset.title || "Asset"}
                      className="mt-3 h-32 w-full rounded-xl object-cover"
                    />
                  ) : null}
                </SocialCard>
              ))}
            </div>
          </div>
        </SectionBlock>
      ) : null}

      {tab === "inbox" ? (
        <SectionBlock title="Inbox" copy="Comments and DMs live in the same workspace.">
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-3">
              {inbox.comments.map((comment) => (
                <SocialCard key={comment.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {comment.author_name || comment.author_handle || "Community member"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-soft)]">
                        {comment.platform} · {dt(comment.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        resolveInbox("comment", comment.id, comment.status === "resolved" ? "open" : "resolved")
                      }
                      className={uiButtonGhostClass}
                    >
                      {comment.status === "resolved" ? "Reopen" : "Resolve"}
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-[var(--text-muted)]">{comment.body || "No body."}</p>
                </SocialCard>
              ))}
            </div>

            <div className="space-y-3">
              {inbox.conversations.map((conversation) => (
                <SocialCard key={conversation.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {conversation.participant_name || conversation.participant_handle || "Unknown participant"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-soft)]">
                        {conversation.platform} · {dt(conversation.last_message_at || conversation.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        resolveInbox(
                          "conversation",
                          conversation.id,
                          conversation.status === "resolved" ? "open" : "resolved",
                        )
                      }
                      className={uiButtonGhostClass}
                    >
                      {conversation.status === "resolved" ? "Reopen" : "Resolve"}
                    </button>
                  </div>
                </SocialCard>
              ))}
            </div>
          </div>
        </SectionBlock>
      ) : null}

      {tab === "analytics" ? (
        <SectionBlock
          title="Analytics"
          copy="Top content and recent activity provide the first operational analytics layer."
        >
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-3">
              {overview.topPosts.map((post: any) => (
                <SocialCard key={post.id}>
                  <p className="text-sm font-semibold text-[var(--text)]">{post.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">{post.platform}</p>
                  <p className="mt-3 text-sm text-[var(--text-muted)]">
                    Impressions {post.impressions} · Reach {post.reach} · Engagements {post.engagements}
                  </p>
                </SocialCard>
              ))}
            </div>
            <div className="space-y-3">
              {overview.recentActivity.map((activity: any) => (
                <SocialCard key={activity.id}>
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {activity.summary || activity.event_type}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">
                    {activity.event_type} · {dt(activity.created_at)}
                  </p>
                </SocialCard>
              ))}
            </div>
          </div>
        </SectionBlock>
      ) : null}

      {tab === "ideas" ? (
        <SectionBlock
          title="Ideas"
          copy="Backlog raw concepts before promoting them into drafts and scheduled content."
        >
          <div className="space-y-3">
            {ideas.map((post) => (
              <SocialCard key={post.id}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {post.title || post.caption || "Untitled idea"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">
                      {post.workflow_state} · {dt(post.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => movePlanner(post.id, weekOf, "draft")}
                    className={uiButtonInfoClass}
                  >
                    Move to draft
                  </button>
                </div>
                <p className="mt-3 text-sm text-[var(--text-muted)]">
                  {post.brief || post.caption || "No detail yet."}
                </p>
              </SocialCard>
            ))}
          </div>
        </SectionBlock>
      ) : null}
    </section>
  );
=======
  return <section className="space-y-6"><header className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,247,255,0.12),transparent_40%),linear-gradient(135deg,rgba(255,177,196,0.12),rgba(15,23,42,0.9))] p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.34em] text-slate-400">Content</p><h1 className="mt-2 text-4xl font-semibold text-slate-50">Social OS</h1><p className="mt-3 max-w-3xl text-sm text-slate-300">Plan, create, publish, analyze, and respond for Instagram and Facebook — all in one place.</p></div><a href="/api/social/accounts/connect" className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200">Connect Meta Account</a></div><div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-7">{card("Accounts", overview.metrics.connectedAccounts, "Connected surfaces.")}{card("Scheduled", overview.metrics.scheduledPosts, "Queued for publish.")}{card("Review", overview.metrics.awaitingApproval, "Awaiting review.")}{card("Failures", overview.metrics.publishFailures, "Needs retry.")}{card("Inbox", overview.metrics.inboxOpen, "Open conversations.")}{card("30d Published", overview.metrics.publishedLast30d, "Last 30 days.")}{card("Brand Voice", settings?.brand_voice ? "Set" : "Missing", "Copilot guidance.")}</div></header><div className="flex flex-wrap gap-2">{TABS.map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-4 py-2 text-sm capitalize ${tab === t ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-slate-300"}`}>{t}</button>)}</div>{notice ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div> : null}{error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}
    {tab === "planner" ? panel("Weekly Planner", "Drag cards across the week and move them through workflow lanes.", <div className="grid gap-4 xl:grid-cols-7">{days.map((d) => <div key={d.key} onDragOver={(e) => e.preventDefault()} onDrop={() => draggedId && movePlanner(draggedId, d.key, posts.find((p) => p.id === draggedId)?.workflow_state ?? "draft")} className="rounded-2xl border border-white/10 bg-[#0b1017]/80 p-3"><p className="text-xs uppercase tracking-[0.24em] text-slate-500">{d.label}</p><div className="mt-3 space-y-3">{posts.filter((p) => (p.planner_slot?.slot_date ?? p.target_publish_at?.slice(0, 10)) === d.key).map((p) => <article key={p.id} draggable onDragStart={() => setDraggedId(p.id)} className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-sm font-semibold text-slate-100">{p.title || p.caption || "Untitled"}</p><p className="mt-1 text-xs text-slate-400">{p.brief || p.caption || "No brief yet."}</p><select value={p.workflow_state} onChange={(e) => movePlanner(p.id, d.key, e.target.value)} className="mt-3 w-full rounded-lg border border-white/10 bg-[#0b1017] px-2 py-2 text-xs text-slate-100">{LANES.map((lane) => <option key={lane} value={lane}>{lane}</option>)}</select></article>)}</div></div>)}</div>) : null}
    {tab === "creator" ? panel("Creator", "Build the brief, attach assets, and generate platform-ready copy.", <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><div><div className="grid gap-4 md:grid-cols-2"><input value={creator.title} onChange={(e) => setCreator((c) => ({ ...c, title: e.target.value }))} placeholder="Content title" className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100" /><select value={creator.assignedTo} onChange={(e) => setCreator((c) => ({ ...c, assignedTo: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100"><option value="">Assign owner</option>{members.map((m) => <option key={m.userId} value={m.userId}>{m.fullName}</option>)}</select></div><textarea value={creator.brief} onChange={(e) => setCreator((c) => ({ ...c, brief: e.target.value }))} rows={4} placeholder="Brief" className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100" /><textarea value={creator.caption} onChange={(e) => setCreator((c) => ({ ...c, caption: e.target.value }))} rows={4} placeholder="Caption" className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100" /><textarea value={creator.firstComment} onChange={(e) => setCreator((c) => ({ ...c, firstComment: e.target.value }))} rows={2} placeholder="First comment" className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100" /><div className="mt-4 grid gap-4 md:grid-cols-3"><select value={creator.campaignId} onChange={(e) => setCreator((c) => ({ ...c, campaignId: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100"><option value="">No campaign</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select><select value={creator.pillarId} onChange={(e) => setCreator((c) => ({ ...c, pillarId: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100"><option value="">No pillar</option>{initialPillars.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><input value={creator.tags} onChange={(e) => setCreator((c) => ({ ...c, tags: e.target.value }))} placeholder="Tags" className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100" /></div><div className="mt-4 grid gap-4 md:grid-cols-3"><select value={creator.workflowState} onChange={(e) => setCreator((c) => ({ ...c, workflowState: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100">{LANES.map((lane) => <option key={lane} value={lane}>{lane}</option>)}</select><input type="datetime-local" value={creator.targetPublishAt} onChange={(e) => setCreator((c) => ({ ...c, targetPublishAt: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100" /><label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-300"><input type="checkbox" checked={creator.approvalRequired} onChange={(e) => setCreator((c) => ({ ...c, approvalRequired: e.target.checked }))} />Require approval</label></div><div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-300"><label className="flex items-center gap-2"><input type="checkbox" checked={creator.useInstagram} onChange={(e) => setCreator((c) => ({ ...c, useInstagram: e.target.checked }))} />Instagram</label><label className="flex items-center gap-2"><input type="checkbox" checked={creator.useFacebook} onChange={(e) => setCreator((c) => ({ ...c, useFacebook: e.target.checked }))} />Facebook</label></div><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={generateAi} className="rounded-xl border border-pink-400/30 bg-pink-500/10 px-4 py-2.5 text-sm text-pink-200">AI Copilot</button><button type="button" onClick={createPost} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950">Create content item</button></div></div><div className="grid max-h-[680px] gap-3 overflow-y-auto md:grid-cols-2">{assets.map((a) => <label key={a.id} className={`rounded-2xl border p-3 ${pickedAssets.includes(a.id) ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/10 bg-white/5"}`}><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-100">{a.title || "Untitled asset"}</p><input type="checkbox" checked={pickedAssets.includes(a.id)} onChange={(e) => setPickedAssets((c) => e.target.checked ? [...c, a.id] : c.filter((id) => id !== a.id))} /></div>{(a.public_url || a.source_url) ? <img src={a.public_url || a.source_url} alt={a.title || "Asset"} loading="lazy" decoding="async" className="mt-3 h-32 w-full rounded-xl object-cover" /> : null}</label>)}</div></div>) : null}
    {tab === "queue" ? panel("Queue", "One queue across Instagram and Facebook with duplicate and delete actions.", <div className="space-y-4">{posts.map((p) => <article key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-lg font-semibold text-slate-100">{p.title || p.caption || "Untitled"}</p><p className="mt-1 text-sm text-slate-400">{p.brief || p.caption || "No copy yet."}</p><p className="mt-2 text-xs text-slate-500">Target {dt(p.target_publish_at)}</p></div><div className="flex gap-2"><button type="button" onClick={() => duplicatePost(p.id)} className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200">Duplicate</button><button type="button" onClick={() => deletePost(p.id)} className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200">Delete</button></div></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{p.channels.map((c: any) => <div key={c.id} className="rounded-xl border border-white/10 bg-[#0b1017]/80 p-3"><p className="text-sm font-semibold text-slate-100">{c.platform} / {c.channel_type}</p><p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{c.status}</p><p className="mt-2 text-xs text-slate-400">Scheduled {dt(c.scheduled_for)}</p>{c.last_error_message ? <p className="mt-2 text-xs text-rose-300">{c.last_error_message}</p> : null}</div>)}</div></article>)}</div>) : null}
    {tab === "overview" ? panel("Overview", "Account health and social operating defaults.", <div className="grid gap-6 xl:grid-cols-2"><div className="space-y-3">{accounts.map((a) => <article key={a.id} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm font-semibold text-slate-100">{a.platform} · {a.display_name || a.username || a.external_account_id}</p><p className="mt-1 text-xs text-slate-500">Sync {dt(a.last_synced_at)} · Expiry {dt(a.token_expires_at)}</p><p className="mt-2 text-xs text-slate-400">{a.granted_scopes.join(", ")}</p></article>)}</div><div className="space-y-4"><textarea value={settingsDraft.brandVoice} onChange={(e) => setSettingsDraft((c) => ({ ...c, brandVoice: e.target.value }))} rows={4} placeholder="Brand voice" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100" /><input value={settingsDraft.hashtags} onChange={(e) => setSettingsDraft((c) => ({ ...c, hashtags: e.target.value }))} placeholder="Default hashtags" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100" /><input value={settingsDraft.ctas} onChange={(e) => setSettingsDraft((c) => ({ ...c, ctas: e.target.value }))} placeholder="CTA presets" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100" /><div className="grid gap-4 md:grid-cols-2"><select value={settingsDraft.approvalMode} onChange={(e) => setSettingsDraft((c) => ({ ...c, approvalMode: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100"><option value="optional">Approval optional</option><option value="required">Approval required</option></select><input value={settingsDraft.timezone} onChange={(e) => setSettingsDraft((c) => ({ ...c, timezone: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100" /></div><button type="button" onClick={saveSettings} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950">Save defaults</button></div></div>) : null}
    {tab === "campaigns" ? panel("Campaigns", "Campaigns organize the planner and give AI generation context.", <div className="grid gap-6 xl:grid-cols-2"><div className="space-y-4"><input value={campaignDraft.title} onChange={(e) => setCampaignDraft((c) => ({ ...c, title: e.target.value }))} placeholder="Campaign title" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100" /><textarea value={campaignDraft.objective} onChange={(e) => setCampaignDraft((c) => ({ ...c, objective: e.target.value }))} rows={3} placeholder="Objective" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100" /><button type="button" onClick={createCampaign} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950">Create campaign</button></div><div className="space-y-3">{campaigns.map((c) => <article key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm font-semibold text-slate-100">{c.title}</p><p className="mt-1 text-xs text-slate-500">{c.objective || "No objective yet."}</p></article>)}</div></div>) : null}
    {tab === "assets" ? panel("Assets", "Supabase Storage is the canonical library, with Google Photos modeled as a source.", <div className="grid gap-6 xl:grid-cols-2"><div className="space-y-4"><label className="block rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-slate-300">Upload photo or video<input type="file" className="mt-3 block w-full text-xs text-slate-400" onChange={(e) => e.target.files?.[0] && uploadAsset(e.target.files[0])} /></label><input value={assetUrl} onChange={(e) => setAssetUrl(e.target.value)} placeholder="External media URL" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100" /><button type="button" onClick={saveAssetUrl} className="rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-slate-100">Save external asset</button><div className="grid gap-4 md:grid-cols-3"><input value={googleDraft.googleAccountEmail} onChange={(e) => setGoogleDraft((c) => ({ ...c, googleAccountEmail: e.target.value }))} placeholder="Google email" className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100" /><input value={googleDraft.albumId} onChange={(e) => setGoogleDraft((c) => ({ ...c, albumId: e.target.value }))} placeholder="Album ID" className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100" /><input value={googleDraft.albumTitle} onChange={(e) => setGoogleDraft((c) => ({ ...c, albumTitle: e.target.value }))} placeholder="Album title" className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100" /></div><button type="button" onClick={addGoogleSource} className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-sm text-cyan-200">Save Google Photos source</button><div className="space-y-3">{googleSources.map((s) => <article key={s.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">{s.album_title || s.album_id || "Untitled album"} · {s.status}</article>)}</div></div><div className="grid gap-3 md:grid-cols-2">{assets.map((a) => <article key={a.id} className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-sm font-semibold text-slate-100">{a.title || "Untitled asset"}</p>{(a.public_url || a.source_url) ? <img src={a.public_url || a.source_url} alt={a.title || "Asset"} loading="lazy" decoding="async" className="mt-3 h-32 w-full rounded-xl object-cover" /> : null}</article>)}</div></div>) : null}
    {tab === "inbox" ? panel("Inbox", "Comments and DMs live in the same workspace.", <div className="grid gap-6 xl:grid-cols-2"><div className="space-y-3">{inbox.comments.map((c) => <article key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-100">{c.author_name || c.author_handle || "Community member"}</p><p className="mt-1 text-xs text-slate-500">{c.platform} · {dt(c.created_at)}</p></div><button type="button" onClick={() => resolveInbox("comment", c.id, c.status === "resolved" ? "open" : "resolved")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">{c.status === "resolved" ? "Reopen" : "Resolve"}</button></div><p className="mt-3 text-sm text-slate-300">{c.body || "No body."}</p></article>)}</div><div className="space-y-3">{inbox.conversations.map((c) => <article key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-100">{c.participant_name || c.participant_handle || "Unknown participant"}</p><p className="mt-1 text-xs text-slate-500">{c.platform} · {dt(c.last_message_at || c.created_at)}</p></div><button type="button" onClick={() => resolveInbox("conversation", c.id, c.status === "resolved" ? "open" : "resolved")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">{c.status === "resolved" ? "Reopen" : "Resolve"}</button></div></article>)}</div></div>) : null}
    {tab === "analytics" ? panel("Analytics", "Top content and recent activity provide the first operational analytics layer.", <div className="grid gap-6 xl:grid-cols-2"><div className="space-y-3">{overview.topPosts.map((p: any) => <article key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm font-semibold text-slate-100">{p.title}</p><p className="mt-1 text-xs text-slate-500">{p.platform}</p><p className="mt-3 text-sm text-slate-300">Impressions {p.impressions} · Reach {p.reach} · Engagements {p.engagements}</p></article>)}</div><div className="space-y-3">{overview.recentActivity.map((a: any) => <article key={a.id} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm font-semibold text-slate-100">{a.summary || a.event_type}</p><p className="mt-1 text-xs text-slate-500">{a.event_type} · {dt(a.created_at)}</p></article>)}</div></div>) : null}
    {tab === "ideas" ? panel("Ideas", "Backlog raw concepts before promoting them into drafts and scheduled content.", <div className="space-y-3">{ideas.map((p) => <article key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-100">{p.title || p.caption || "Untitled idea"}</p><p className="mt-1 text-xs text-slate-500">{p.workflow_state} · {dt(p.created_at)}</p></div><button type="button" onClick={() => movePlanner(p.id, weekOf, "draft")} className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">Move to draft</button></div><p className="mt-3 text-sm text-slate-300">{p.brief || p.caption || "No detail yet."}</p></article>)}</div>) : null}
  </section>;
>>>>>>> origin/main
}
