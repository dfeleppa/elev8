// Temporary visibility gates. Flip the constant to restore the feature for
// everyone — no other code changes required.

export const HIDE_AI_COACH_UNLESS_OWNER = true;

export function isAICoachVisible(role: string | null | undefined): boolean {
  if (!HIDE_AI_COACH_UNLESS_OWNER) return true;
  return role === "owner";
}

// Soft-launch gate: members only get Nutrition until this is flipped to false.
export const MEMBER_LAUNCH_RESTRICTED = true;

// Member-facing routes that are live at launch.
const LIVE_MEMBER_PATHS = ["/member/nutrition"];

/** True if `path` is a live member route (exact match or nested under one). */
export function isMemberPathLive(path: string): boolean {
  return LIVE_MEMBER_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

/** Members get bounced off locked routes; staff are unaffected. */
export function isMemberRouteLocked(role: string | null | undefined, path: string): boolean {
  return MEMBER_LAUNCH_RESTRICTED && role === "member" && !isMemberPathLive(path);
}
