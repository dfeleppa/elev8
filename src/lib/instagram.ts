export const INSTAGRAM_OAUTH_STATE_COOKIE = "instagram_oauth_state";

const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const redirectUri =
  process.env.INSTAGRAM_OAUTH_REDIRECT_URI ??
  (appUrl ? `${appUrl}/api/oauth/instagram/callback` : undefined);

export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
] as const;

type InstagramAsset = {
  mediaUrl: string;
  mediaType: "image" | "video";
};

type InstagramPublishInput = {
  igUserId: string;
  accessToken: string;
  postType: "image" | "carousel" | "reel" | "story";
  caption?: string | null;
  firstComment?: string | null;
  assets: InstagramAsset[];
};

type InstagramPublishResult = {
  mode: "auto" | "reminder";
  mediaId?: string;
  permalink?: string | null;
  providerPayload?: unknown;
  reason?: string;
};

function getConfig() {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!appId || !appSecret || !redirectUri) {
    throw new Error("Missing Instagram OAuth environment variables.");
  }

  return { appId, appSecret, redirectUri };
}

export function getInstagramAuthUrl(state: string) {
  const { appId, redirectUri: callback } = getConfig();
  const url = new URL("https://www.facebook.com/v23.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_OAUTH_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

async function graphFetch<T>(path: string, accessToken: string, query?: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/v23.0/${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  }
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString(), { cache: "no-store" });
  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message || "Instagram Graph request failed.";
    throw new Error(message);
  }

  return payload as T;
}

async function graphPost<T>(path: string, accessToken: string, body?: Record<string, string>) {
  const params = new URLSearchParams();
  params.set("access_token", accessToken);

  if (body) {
    Object.entries(body).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.set(key, value);
      }
    });
  }

  const response = await fetch(`https://graph.facebook.com/v23.0/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
  });
  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message || "Instagram Graph request failed.";
    throw new Error(message);
  }

  return payload as T;
}

async function describePermissionState(accessToken: string) {
  try {
    const payload = await graphFetch<{ data?: Array<{ permission?: string; status?: string }> }>(
      "me/permissions",
      accessToken
    );

    return (payload.data ?? [])
      .filter((entry) => entry.permission)
      .map((entry) => `${entry.permission}:${entry.status ?? "unknown"}`)
      .join(", ");
  } catch {
    return "unavailable";
  }
}

function supportsAutoPublish(postType: InstagramPublishInput["postType"]) {
  return postType !== "story";
}

async function waitForContainerReady(containerId: string, accessToken: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const container = await graphFetch<{ status_code?: string; status?: string }>(containerId, accessToken, {
      fields: "status_code,status",
    });

    const statusCode = container.status_code ?? container.status ?? "";
    if (statusCode === "FINISHED" || statusCode === "PUBLISHED") {
      return;
    }

    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new Error(`Instagram media container failed with status ${statusCode}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

async function createImageContainer(input: InstagramPublishInput) {
  const firstAsset = input.assets[0];
  if (!firstAsset) {
    throw new Error("Image post requires one asset.");
  }

  const payload = await graphPost<{ id: string }>(`${input.igUserId}/media`, input.accessToken, {
    image_url: firstAsset.mediaUrl,
    caption: input.caption ?? "",
  });

  return payload.id;
}

async function createReelContainer(input: InstagramPublishInput) {
  const firstAsset = input.assets[0];
  if (!firstAsset || firstAsset.mediaType !== "video") {
    throw new Error("Reel requires one video asset.");
  }

  const payload = await graphPost<{ id: string }>(`${input.igUserId}/media`, input.accessToken, {
    media_type: "REELS",
    video_url: firstAsset.mediaUrl,
    caption: input.caption ?? "",
  });

  await waitForContainerReady(payload.id, input.accessToken);
  return payload.id;
}

async function createCarouselContainer(input: InstagramPublishInput) {
  if (input.assets.length < 2) {
    throw new Error("Carousel requires at least two assets.");
  }

  const childIds: string[] = [];
  for (const asset of input.assets) {
    const body: Record<string, string> = { is_carousel_item: "true" };
    if (asset.mediaType === "video") {
      body.video_url = asset.mediaUrl;
      body.media_type = "VIDEO";
    } else {
      body.image_url = asset.mediaUrl;
    }
    const child = await graphPost<{ id: string }>(`${input.igUserId}/media`, input.accessToken, body);
    if (asset.mediaType === "video") {
      await waitForContainerReady(child.id, input.accessToken);
    }
    childIds.push(child.id);
  }

  const payload = await graphPost<{ id: string }>(`${input.igUserId}/media`, input.accessToken, {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption: input.caption ?? "",
  });

  return payload.id;
}

async function publishContainer(igUserId: string, accessToken: string, containerId: string) {
  const publishPayload = await graphPost<{ id: string }>(`${igUserId}/media_publish`, accessToken, {
    creation_id: containerId,
  });

  return publishPayload.id;
}

async function publishFirstComment(mediaId: string, accessToken: string, comment: string | null | undefined) {
  const normalized = comment?.trim();
  if (!normalized) return;

  await graphPost(`${mediaId}/comments`, accessToken, { message: normalized });
}

async function fetchMediaPermalink(mediaId: string, accessToken: string) {
  const payload = await graphFetch<{ permalink?: string }>(mediaId, accessToken, {
    fields: "permalink",
  });
  return payload.permalink ?? null;
}

export async function publishInstagramPost(input: InstagramPublishInput): Promise<InstagramPublishResult> {
  if (!supportsAutoPublish(input.postType)) {
    return {
      mode: "reminder",
      reason: "Post type is not supported for direct auto-publish.",
      providerPayload: { postType: input.postType },
    };
  }

  let containerId = "";

  if (input.postType === "image") {
    containerId = await createImageContainer(input);
  } else if (input.postType === "carousel") {
    containerId = await createCarouselContainer(input);
  } else if (input.postType === "reel") {
    containerId = await createReelContainer(input);
  } else {
    return {
      mode: "reminder",
      reason: "Unsupported post type.",
      providerPayload: { postType: input.postType },
    };
  }

  const mediaId = await publishContainer(input.igUserId, input.accessToken, containerId);
  await publishFirstComment(mediaId, input.accessToken, input.firstComment);
  const permalink = await fetchMediaPermalink(mediaId, input.accessToken);

  return {
    mode: "auto",
    mediaId,
    permalink,
    providerPayload: { containerId, mediaId, permalink },
  };
}

export async function exchangeInstagramCode(code: string) {
  const { appId, appSecret, redirectUri: callback } = getConfig();
  const tokenUrl = new URL("https://graph.facebook.com/v23.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", callback);
  tokenUrl.searchParams.set("code", code);

  const response = await fetch(tokenUrl.toString(), { cache: "no-store" });
  const payload = await response.json();

  if (!response.ok || !payload?.access_token) {
    const message = payload?.error?.message || "Failed to exchange Instagram OAuth code.";
    throw new Error(message);
  }

  return {
    accessToken: String(payload.access_token),
    tokenType: payload.token_type ? String(payload.token_type) : null,
    expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : null,
  };
}

export async function fetchInstagramAccount(accessToken: string) {
  const pagesResponse = await graphFetch<{ data?: Array<{ id: string; name?: string; access_token?: string }> }>(
    "me/accounts",
    accessToken,
    { fields: "id,name,access_token" }
  );

  const pages = (pagesResponse.data ?? []).filter(
    (page): page is { id: string; name?: string; access_token: string } =>
      Boolean(page?.id && page?.access_token)
  );

  if (pages.length === 0) {
    const permissionState = await describePermissionState(accessToken);
    throw new Error(
      `No Facebook page was returned for this Meta account. Make sure the Facebook user has page access and re-connect the account. Permission state: ${permissionState}.`
    );
  }

  for (const page of pages) {
    const pageDetails = await graphFetch<{
      instagram_business_account?: { id?: string; username?: string };
    }>(page.id, page.access_token, {
      fields: "instagram_business_account{id,username}",
    });

    const igAccount = pageDetails.instagram_business_account;
    if (!igAccount?.id) {
      continue;
    }

    return {
      igUserId: String(igAccount.id),
      username: igAccount.username ? String(igAccount.username) : null,
      pageId: String(page.id),
      pageAccessToken: String(page.access_token),
    };
  }

  throw new Error("No Instagram business account was found on any connected Facebook page.");
}
