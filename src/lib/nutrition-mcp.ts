import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import {
  executeAddFood,
  executeCopyMeal,
  interpretNutritionCommand,
  isValidDate,
  resolveFoodCandidate,
  searchFoodCandidates,
  type MealKey,
} from "@/lib/nutrition-command";
import { runNutritionQueryWithFallbacks } from "@/lib/nutrition-schema";
import { supabaseAdmin } from "@/lib/supabase-admin";

type NutritionDayEntry = {
  id: string;
  meal_type: MealKey;
  entry_name: string;
  quantity: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  saturated_fat: number | null;
  created_at: string;
};

function roundNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function formatMacro(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "unknown";
  }
  return `${roundNumber(value)}g`;
}

function toQuantity(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0.01, roundNumber(value));
}

export async function loadNutritionDaySnapshot(memberId: string, date: string, mealType?: MealKey | null) {
  const { data: day, error: dayError } = await supabaseAdmin
    .from("nutrition_days")
    .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
    .eq("member_id", memberId)
    .eq("day_date", date)
    .maybeSingle();

  if (dayError) {
    throw new Error("Failed to load nutrition day.");
  }

  if (!day?.id) {
    return {
      date,
      entries: [] as NutritionDayEntry[],
      totals: null,
      targets: null,
      summary: `No nutrition entries found for ${date}.`,
    };
  }

  const entryColumns =
    "id, meal_type, entry_name, quantity, calories, protein, carbs, fat, fiber, sugar, saturated_fat, created_at";
  const fallbackColumnsA = "id, meal_type, entry_name, quantity, calories, protein, carbs, fat, fiber, created_at";
  const fallbackColumnsB = "id, meal_type, entry_name, quantity, calories, protein, carbs, fat, created_at";

  const { data: entries, error: entriesError } = await runNutritionQueryWithFallbacks<Record<string, unknown>[]>([
    () => {
      let query = supabaseAdmin
        .from("nutrition_entries")
        .select(entryColumns)
        .eq("member_id", memberId)
        .eq("day_id", day.id)
        .order("created_at", { ascending: true });
      if (mealType) {
        query = query.eq("meal_type", mealType);
      }
      return query;
    },
    () => {
      let query = supabaseAdmin
        .from("nutrition_entries")
        .select(fallbackColumnsA)
        .eq("member_id", memberId)
        .eq("day_id", day.id)
        .order("created_at", { ascending: true });
      if (mealType) {
        query = query.eq("meal_type", mealType);
      }
      return query;
    },
    () => {
      let query = supabaseAdmin
        .from("nutrition_entries")
        .select(fallbackColumnsB)
        .eq("member_id", memberId)
        .eq("day_id", day.id)
        .order("created_at", { ascending: true });
      if (mealType) {
        query = query.eq("meal_type", mealType);
      }
      return query;
    },
  ]);

  if (entriesError) {
    throw new Error("Failed to load nutrition entries.");
  }

  const rows = (entries ?? []).map((entry) => ({
    id: String(entry.id ?? ""),
    meal_type: entry.meal_type as MealKey,
    entry_name: String(entry.entry_name ?? ""),
    quantity: typeof entry.quantity === "number" ? entry.quantity : null,
    calories: typeof entry.calories === "number" ? entry.calories : null,
    protein: typeof entry.protein === "number" ? entry.protein : null,
    carbs: typeof entry.carbs === "number" ? entry.carbs : null,
    fat: typeof entry.fat === "number" ? entry.fat : null,
    fiber: typeof entry.fiber === "number" ? entry.fiber : null,
    sugar: typeof entry.sugar === "number" ? entry.sugar : null,
    saturated_fat: typeof entry.saturated_fat === "number" ? entry.saturated_fat : null,
    created_at: String(entry.created_at ?? ""),
  })) as NutritionDayEntry[];
  const totals = rows.reduce(
    (acc, entry) => {
      const quantity = toQuantity(entry.quantity);
      acc.calories += (entry.calories ?? 0) * quantity;
      acc.protein += (entry.protein ?? 0) * quantity;
      acc.carbs += (entry.carbs ?? 0) * quantity;
      acc.fat += (entry.fat ?? 0) * quantity;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const roundedTotals = {
    calories: roundNumber(totals.calories),
    protein: roundNumber(totals.protein),
    carbs: roundNumber(totals.carbs),
    fat: roundNumber(totals.fat),
  };

  const targets = {
    calories: typeof day.calorie_target === "number" ? day.calorie_target : null,
    protein: typeof day.protein_target === "number" ? day.protein_target : null,
    carbs: typeof day.carbs_target === "number" ? day.carbs_target : null,
    fat: typeof day.fat_target === "number" ? day.fat_target : null,
  };

  const summaryParts = [
    `${roundedTotals.calories} calories`,
    `${roundedTotals.protein}g protein`,
    `${roundedTotals.carbs}g carbs`,
    `${roundedTotals.fat}g fat`,
  ];

  if (targets.calories || targets.protein || targets.carbs || targets.fat) {
    summaryParts.push(
      `Targets: ${targets.calories ?? "?"} cal, ${formatMacro(targets.protein)}, ${formatMacro(
        targets.carbs
      )}, ${formatMacro(targets.fat)}`
    );
  }

  return {
    date,
    entries: rows,
    totals: roundedTotals,
    targets,
    summary: summaryParts.join(" • "),
  };
}

export function createNutritionMcpServer(memberId: string) {
  const server = new McpServer({
    name: "elev8-nutrition",
    version: "1.0.0",
  });

  server.registerTool(
    "get_daily_nutrition",
    {
      title: "Get Daily Nutrition",
      description: "Get nutrition entries, totals, and targets for a day in the Elev8 app.",
      inputSchema: {
        date: z.string().describe("Date in YYYY-MM-DD format."),
        mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
      },
      outputSchema: {
        date: z.string(),
        summary: z.string(),
        totals: z
          .object({
            calories: z.number(),
            protein: z.number(),
            carbs: z.number(),
            fat: z.number(),
          })
          .nullable(),
        targets: z
          .object({
            calories: z.number().nullable(),
            protein: z.number().nullable(),
            carbs: z.number().nullable(),
            fat: z.number().nullable(),
          })
          .nullable(),
        entries: z.array(
          z.object({
            id: z.string(),
            meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
            entry_name: z.string(),
            quantity: z.number().nullable(),
            calories: z.number().nullable(),
            protein: z.number().nullable(),
            carbs: z.number().nullable(),
            fat: z.number().nullable(),
            created_at: z.string(),
          })
        ),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ date, mealType }) => {
      if (!isValidDate(date)) {
        throw new Error("date must use YYYY-MM-DD format.");
      }

      const snapshot = await loadNutritionDaySnapshot(memberId, date, mealType ?? null);
      const structuredContent = {
        date: snapshot.date,
        summary: snapshot.summary,
        totals: snapshot.totals,
        targets: snapshot.targets,
        entries: snapshot.entries.map((entry) => ({
          id: entry.id,
          meal_type: entry.meal_type,
          entry_name: entry.entry_name,
          quantity: entry.quantity,
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          created_at: entry.created_at,
        })),
      };

      return {
        content: [{ type: "text", text: structuredContent.summary }],
        structuredContent,
      };
    }
  );

  server.registerTool(
    "search_nutrition_foods",
    {
      title: "Search Nutrition Foods",
      description:
        "Search the member's saved foods, recent foods, and USDA matches to find nutrition information before logging a meal.",
      inputSchema: {
        query: z.string().describe("Food or meal name to search for."),
      },
      outputSchema: {
        query: z.string(),
        results: z.array(
          z.object({
            source: z.enum(["local", "usda"]),
            name: z.string(),
            calories: z.number().nullable(),
            protein: z.number().nullable(),
            carbs: z.number().nullable(),
            fat: z.number().nullable(),
            fiber: z.number().nullable(),
            sugar: z.number().nullable(),
            saturated_fat: z.number().nullable(),
          })
        ),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ query }) => {
      const results = await searchFoodCandidates(memberId, query, 5);
      const structuredContent = {
        query,
        results: results.map((item) => ({
          source: item.source,
          ...item.candidate,
        })),
      };

      const summary =
        structuredContent.results.length > 0
          ? structuredContent.results
              .map(
                (item, index) =>
                  `${index + 1}. ${item.name}: ${item.calories ?? "?"} cal, ${item.protein ?? "?"}p, ${
                    item.carbs ?? "?"
                  }c, ${item.fat ?? "?"}f`
              )
              .join("\n")
          : `No food matches found for "${query}".`;

      return {
        content: [{ type: "text", text: summary }],
        structuredContent,
      };
    }
  );

  server.registerTool(
    "manage_nutrition",
    {
      title: "Manage Nutrition",
      description:
        "Interpret a natural-language nutrition command. Use preview first for write actions, then execute only after the user confirms.",
      inputSchema: {
        command: z.string().describe("Natural-language command such as 'copy my dinner from yesterday to today'."),
        selectedDate: z.string().describe("Reference date in YYYY-MM-DD format."),
        mode: z.enum(["preview", "execute"]).default("preview"),
        candidateName: z
          .string()
          .optional()
          .describe("Optional exact food name to execute when the user confirms a chosen search result."),
      },
      outputSchema: {
        mode: z.enum(["preview", "execute"]),
        requiresConfirmation: z.boolean(),
        intent: z.object({
          intent: z.string(),
          summary: z.string(),
        }),
        preview: z
          .object({
            operation: z.string(),
            message: z.string(),
            sourceDate: z.string().optional(),
            targetDate: z.string().optional(),
            mealType: z.string().optional(),
            targetMealType: z.string().optional(),
            foodName: z.string().optional(),
            quantity: z.number().optional(),
            source: z.string().optional(),
            nutrition: z
              .object({
                calories: z.number().nullable(),
                protein: z.number().nullable(),
                carbs: z.number().nullable(),
                fat: z.number().nullable(),
                fiber: z.number().nullable(),
                sugar: z.number().nullable(),
                saturated_fat: z.number().nullable(),
              })
              .optional(),
          })
          .optional(),
        result: z
          .object({
            message: z.string(),
            targetDate: z.string().optional(),
            mealType: z.string().optional(),
            copiedCount: z.number().optional(),
            quantity: z.number().optional(),
            foodName: z.string().optional(),
            source: z.string().optional(),
          })
          .optional(),
        matches: z
          .array(
            z.object({
              source: z.enum(["local", "usda"]),
              name: z.string(),
              calories: z.number().nullable(),
              protein: z.number().nullable(),
              carbs: z.number().nullable(),
              fat: z.number().nullable(),
              fiber: z.number().nullable(),
              sugar: z.number().nullable(),
              saturated_fat: z.number().nullable(),
            })
          )
          .optional(),
      },
      annotations: {
        readOnlyHint: false,
      },
    },
    async ({ command, selectedDate, mode, candidateName }) => {
      if (!isValidDate(selectedDate)) {
        throw new Error("selectedDate must use YYYY-MM-DD format.");
      }

      const intent = await interpretNutritionCommand(command, selectedDate);

      if (intent.intent === "copy_meal") {
        if (!isValidDate(intent.sourceDate) || !isValidDate(intent.targetDate)) {
          throw new Error("The interpreted command returned an invalid date.");
        }

        if (mode === "preview") {
          const structuredContent = {
            mode,
            requiresConfirmation: true,
            intent: { intent: intent.intent, summary: intent.summary },
            preview: {
              operation: "copy_meal",
              sourceDate: intent.sourceDate,
              targetDate: intent.targetDate,
              mealType: intent.mealType,
              targetMealType: intent.targetMealType,
              message: intent.summary,
            },
          };

          return {
            content: [{ type: "text", text: intent.summary }],
            structuredContent,
          };
        }

        const result = await executeCopyMeal(memberId, intent);
        const structuredContent = {
          mode,
          requiresConfirmation: false,
          intent: { intent: intent.intent, summary: intent.summary },
          result,
        };

        return {
          content: [{ type: "text", text: result.message }],
          structuredContent,
        };
      }

      if (intent.intent === "search_foods") {
        const matches = await searchFoodCandidates(memberId, intent.searchQuery, 5);
        const structuredContent = {
          mode,
          requiresConfirmation: false,
          intent: { intent: intent.intent, summary: intent.summary },
          matches: matches.map((item) => ({
            source: item.source,
            ...item.candidate,
          })),
        };

        const summary =
          structuredContent.matches.length > 0
            ? structuredContent.matches
                .map(
                  (item, index) =>
                    `${index + 1}. ${item.name}: ${item.calories ?? "?"} cal, ${item.protein ?? "?"}p, ${
                      item.carbs ?? "?"
                    }c, ${item.fat ?? "?"}f`
                )
                .join("\n")
            : `No food matches found for "${intent.searchQuery}".`;

        return {
          content: [{ type: "text", text: summary }],
          structuredContent,
        };
      }

      if (intent.intent === "add_food") {
        if (!isValidDate(intent.targetDate)) {
          throw new Error("The interpreted command returned an invalid target date.");
        }

        if (mode === "preview") {
          const resolved = await resolveFoodCandidate(memberId, intent.foodQuery, candidateName);
          if (!resolved) {
            throw new Error(`I couldn't find a food match for "${intent.foodQuery}".`);
          }

          const matches = await searchFoodCandidates(memberId, intent.foodQuery, 5);
          const message = `Ready to add ${intent.quantity} serving${intent.quantity === 1 ? "" : "s"} of ${
            resolved.candidate.name
          } to ${intent.mealType} for ${intent.targetDate}.`;
          const structuredContent = {
            mode,
            requiresConfirmation: true,
            intent: { intent: intent.intent, summary: intent.summary },
            preview: {
              operation: "add_food",
              foodName: resolved.candidate.name,
              quantity: intent.quantity,
              mealType: intent.mealType,
              targetDate: intent.targetDate,
              source: resolved.source,
              nutrition: resolved.candidate,
              message,
            },
            matches: matches.map((item) => ({
              source: item.source,
              ...item.candidate,
            })),
          };

          return {
            content: [{ type: "text", text: message }],
            structuredContent,
          };
        }

        const result = await executeAddFood(memberId, intent, candidateName);
        const structuredContent = {
          mode,
          requiresConfirmation: false,
          intent: { intent: intent.intent, summary: intent.summary },
          result: {
            message: result.message,
            targetDate: result.targetDate,
            mealType: result.mealType,
            quantity: result.quantity,
            foodName: result.foodName,
            source: result.source,
          },
        };

        return {
          content: [{ type: "text", text: result.message }],
          structuredContent,
        };
      }

      const structuredContent = {
        mode,
        requiresConfirmation: false,
        intent: {
          intent: intent.intent,
          summary: intent.summary,
        },
      };

      return {
        content: [{ type: "text", text: intent.summary }],
        structuredContent,
      };
    }
  );

  return server;
}
