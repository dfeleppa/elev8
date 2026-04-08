export function normalizeInvitationCode(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toUpperCase();
  return trimmed || null;
}
