import { NextResponse } from "next/server";

import {
  getAgentConfig,
  isAuthorizedAgentBearerRequest,
  isAuthorizedAgentRequest,
} from "@/lib/agent-auth";
import {
  executeAddFood,
  executeCopyMeal,
  interpretNutritionCommand,
  isValidDate,
  resolveFoodCandidate,
  searchFoodCandidates,
} from "@/lib/nutrition-command";

export const runtime = "nodejs";

type RequestMode = "preview" | "execute";

function normalizeMode(value: unknown): RequestMode {
  return value === "execute" ? "execute" : "preview";
}

function isAuthorized(request: Request, expectedToken: string) {
  return (
    isAuthorizedAgentBearerRequest(request, expectedToken) ||
    isAuthorizedAgentRequest(request, expectedToken)
  );
}

export async function POST(request: Request) {
  const { errorResponse, token, memberId } = getAgentConfig();
  if (errorResponse) {
    return errorResponse;
  }

  if (!isAuthorized(request, token)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        command?: string;
        selectedDate?: string;
        mode?: RequestMode;
        candidateName?: string;
      }
    | null;

  const command = body?.command?.trim() ?? "";
  const selectedDate = body?.selectedDate?.trim() ?? "";
  const mode = normalizeMode(body?.mode);
  const candidateName = typeof body?.candidateName === "string" ? body.candidateName.trim() : "";

  if (!command) {
    return NextResponse.json({ error: "Command is required." }, { status: 400 });
  }

  if (!isValidDate(selectedDate)) {
    return NextResponse.json({ error: "A valid selected date is required." }, { status: 400 });
  }

  try {
    const intent = await interpretNutritionCommand(command, selectedDate);

    if (intent.intent === "copy_meal") {
      if (!isValidDate(intent.sourceDate) || !isValidDate(intent.targetDate)) {
        return NextResponse.json({ error: "The AI returned an invalid date." }, { status: 400 });
      }

      if (mode === "preview") {
        return NextResponse.json({
          mode,
          intent,
          requiresConfirmation: true,
          preview: {
            operation: "copy_meal",
            sourceDate: intent.sourceDate,
            targetDate: intent.targetDate,
            mealType: intent.mealType,
            targetMealType: intent.targetMealType,
            message: intent.summary,
          },
        });
      }

      const result = await executeCopyMeal(memberId, intent);
      return NextResponse.json({
        mode,
        intent,
        requiresConfirmation: false,
        result,
      });
    }

    if (intent.intent === "search_foods") {
      const candidates = await searchFoodCandidates(memberId, intent.searchQuery, 5);
      return NextResponse.json({
        mode,
        intent,
        requiresConfirmation: false,
        results: candidates.map((item) => ({
          source: item.source,
          ...item.candidate,
        })),
      });
    }

    if (intent.intent === "add_food") {
      if (!isValidDate(intent.targetDate)) {
        return NextResponse.json({ error: "The AI returned an invalid target date." }, { status: 400 });
      }

      if (mode === "preview") {
        const resolved = await resolveFoodCandidate(memberId, intent.foodQuery, candidateName || undefined);
        if (!resolved) {
          return NextResponse.json(
            { error: `I couldn't find a food match for "${intent.foodQuery}".` },
            { status: 404 }
          );
        }

        const matches = await searchFoodCandidates(memberId, intent.foodQuery, 5);
        return NextResponse.json({
          mode,
          intent,
          requiresConfirmation: true,
          preview: {
            operation: "add_food",
            foodName: resolved.candidate.name,
            quantity: intent.quantity,
            mealType: intent.mealType,
            targetDate: intent.targetDate,
            source: resolved.source,
            nutrition: resolved.candidate,
            message: `Ready to add ${intent.quantity} serving${intent.quantity === 1 ? "" : "s"} of ${resolved.candidate.name} to ${intent.mealType} for ${intent.targetDate}.`,
          },
          matches: matches.map((item) => ({
            source: item.source,
            ...item.candidate,
          })),
        });
      }

      const result = await executeAddFood(memberId, intent, candidateName || undefined).catch((error) => {
        if (error instanceof Error && error.message.includes(`I couldn't find a food match`)) {
          return null;
        }
        throw error;
      });

      if (!result) {
        return NextResponse.json(
          { error: `I couldn't find a reliable food match for "${intent.foodQuery}". Please pick a specific result first.` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        mode,
        intent,
        requiresConfirmation: false,
        result,
      });
    }

    return NextResponse.json({
      mode,
      intent,
      requiresConfirmation: false,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nutrition assistant failed." },
      { status: 500 }
    );
  }
}
