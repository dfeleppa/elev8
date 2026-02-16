import { google } from "googleapis";

const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const redirectUri =
  process.env.YOUTUBE_OAUTH_REDIRECT_URI ??
  (appUrl ? `${appUrl}/api/oauth/youtube/callback` : undefined);

const scopes = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

export function getYoutubeOAuthClient() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing YouTube OAuth environment variables.");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getYoutubeAuthUrl() {
  const oauth2Client = getYoutubeOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });
}

export async function exchangeYoutubeCode(code: string) {
  const oauth2Client = getYoutubeOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return { oauth2Client, tokens };
}

export async function fetchYoutubeChannelId(oauth2Client: InstanceType<typeof google.auth.OAuth2>) {
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });
  const response = await youtube.channels.list({
    mine: true,
    part: ["id"],
  });

  const channelId = response.data.items?.[0]?.id;
  if (!channelId) {
    throw new Error("Unable to resolve YouTube channel ID.");
  }

  return channelId;
}

export async function fetchYoutubeAnalytics(params: {
  oauth2Client: InstanceType<typeof google.auth.OAuth2>;
  channelId: string;
  startDate: string;
  endDate: string;
}) {
  const analytics = google.youtubeAnalytics({ version: "v2", auth: params.oauth2Client });
  const response = await analytics.reports.query({
    ids: `channel==${params.channelId}`,
    startDate: params.startDate,
    endDate: params.endDate,
    metrics: "views,estimatedMinutesWatched,subscribersGained",
  });

  const row = response.data.rows?.[0] ?? [];
  return {
    views: Number(row[0] ?? 0),
    watchMinutes: Number(row[1] ?? 0),
    subscribersGained: Number(row[2] ?? 0),
  };
}
