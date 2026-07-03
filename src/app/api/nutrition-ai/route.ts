import { NextResponse } from "next/server";

import { requireRequestUserContext } from "@/lib/member";
import { executeAddFood, executeCopyMeal, interpretNutritionCommand, isValidDate } from "@/lib/nutrition-command";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { error: userError, userId } = await requireRequestUserContext(request);
  if (userError || !userId) {
    return NextResponse.json({ error: userError ?? "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        command?: string;
        selectedDate?: string;
      }
    | null;

  const command = body?.command?.trim() ?? "";
  const selectedDate = body?.selectedDate?.trim() ?? "";

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

      const result = await executeCopyMeal(userId, intent);
      return NextResponse.json({ intent, result });
    }

    if (intent.intent === "search_foods") {
      return NextResponse.json({ intent });
    }

    if (intent.intent === "add_food") {
      if (!isValidDate(intent.targetDate)) {
        return NextResponse.json({ error: "The AI returned an invalid target date." }, { status: 400 });
      }

      const result = await executeAddFood(userId, intent);
      return NextResponse.json({ intent, result });
    }

    return NextResponse.json({ intent });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nutrition assistant failed." },
      { status: 500 }
    );
  }
}
