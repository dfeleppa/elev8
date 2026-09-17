export type LoggedLiftSet = { reps: number; weight: number };

export function isLiftDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

/** Reject the entire submission rather than silently dropping incomplete sets. */
export function validateLiftSets(value: unknown): value is LoggedLiftSet[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 100 &&
    value.every(
      (set) =>
        set &&
        typeof set === "object" &&
        Number.isInteger(set.reps) &&
        set.reps > 0 &&
        set.reps <= 10000 &&
        typeof set.weight === "number" &&
        Number.isFinite(set.weight) &&
        set.weight > 0 &&
        set.weight < 1000000,
    )
  );
}
