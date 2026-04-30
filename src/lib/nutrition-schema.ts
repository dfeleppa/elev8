type QueryResult<T> = {
  data: T | null;
  error: {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
  } | null;
};

const OPTIONAL_NUTRITION_COLUMNS = [
  "fiber",
  "fiber_target",
  "fiber_grams",
  "sugar",
  "saturated_fat",
] as const;

export function isMissingOptionalNutritionColumnError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
  };

  const text = [maybeError.message, maybeError.details, maybeError.hint]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  if (!text) {
    return false;
  }

  const looksLikeMissingColumn =
    maybeError.code === "PGRST204" ||
    maybeError.code === "42703" ||
    text.includes("column") ||
    text.includes("schema cache");

  return looksLikeMissingColumn && OPTIONAL_NUTRITION_COLUMNS.some((column) => text.includes(column));
}

export async function runNutritionQueryWithFallbacks<T>(
  attempts: Array<() => PromiseLike<QueryResult<T>> | QueryResult<T>>
) {
  let lastResult: QueryResult<T> | null = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const result = await attempts[index]();
    if (!result.error) {
      return result;
    }

    lastResult = result;
    if (!isMissingOptionalNutritionColumnError(result.error) || index === attempts.length - 1) {
      return result;
    }
  }

  return lastResult ?? { data: null, error: { message: "Nutrition query failed." } };
}

export function omitNutritionKeys<T extends Record<string, unknown>, K extends keyof T>(
  value: T,
  keys: readonly K[]
) {
  const clone = { ...value };
  for (const key of keys) {
    delete clone[key];
  }
  return clone as Omit<T, K>;
}

export function readNutritionNumberField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readNutritionStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}
