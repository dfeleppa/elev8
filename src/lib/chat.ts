export const CHAT_THREAD_SLUGS = ["main", "nutrition", "competition"] as const;

export type ChatThreadSlug = (typeof CHAT_THREAD_SLUGS)[number];

export const CHAT_THREADS: Array<{
  slug: ChatThreadSlug;
  name: string;
  description: string;
  sortOrder: number;
}> = [
  {
    slug: "main",
    name: "Main",
    description: "General gym announcements, questions, and daily conversation.",
    sortOrder: 10,
  },
  {
    slug: "nutrition",
    name: "Nutrition",
    description: "Food, macros, meal ideas, and nutrition coaching discussion.",
    sortOrder: 20,
  },
  {
    slug: "competition",
    name: "Competition",
    description: "Competition prep, events, strategy, and leaderboard talk.",
    sortOrder: 30,
  },
];

export const CHAT_IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

export const CHAT_MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export function isChatThreadSlug(value: string): value is ChatThreadSlug {
  return (CHAT_THREAD_SLUGS as readonly string[]).includes(value);
}

export function sanitizeChatBody(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 4000) : "";
}
