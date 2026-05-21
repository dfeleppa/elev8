// Temporary visibility gates. Flip the constant to restore the feature for
// everyone — no other code changes required.

export const HIDE_AI_COACH_UNLESS_OWNER = true;

export function isAICoachVisible(role: string | null | undefined): boolean {
  if (!HIDE_AI_COACH_UNLESS_OWNER) return true;
  return role === "owner";
}
