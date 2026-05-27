export const CHAT_THREAD_SLUGS = ["main", "nutrition", "competition"] as const;

export type ChatThreadSlug = (typeof CHAT_THREAD_SLUGS)[number];

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
