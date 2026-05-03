import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Elev8 Nutrition Agent API",
      version: "1.0.0",
      description:
        "Natural-language nutrition commands for the Elev8 app. Use preview mode before execute for write actions.",
    },
    servers: [
      {
        url: origin,
      },
    ],
    components: {
      securitySchemes: {
        AgentToken: {
          type: "http",
          scheme: "bearer",
          description: "Set this bearer token to your AGENT_NUTRITION_TOKEN value.",
        },
      },
      schemas: {
        NutritionCommandRequest: {
          type: "object",
          additionalProperties: false,
          required: ["command", "selectedDate"],
          properties: {
            command: {
              type: "string",
              description:
                "Natural-language command like 'copy my dinner from yesterday to today' or 'search for chicken tenders'.",
            },
            selectedDate: {
              type: "string",
              format: "date",
              description: "Reference date in YYYY-MM-DD format.",
            },
            mode: {
              type: "string",
              enum: ["preview", "execute"],
              default: "preview",
              description: "Use preview first for write actions. Only use execute after user confirmation.",
            },
            candidateName: {
              type: "string",
              description:
                "Optional exact food name chosen by the user when confirming a food search result.",
            },
          },
        },
        NutritionSearchMatch: {
          type: "object",
          additionalProperties: false,
          required: [
            "source",
            "name",
            "calories",
            "protein",
            "carbs",
            "fat",
            "fiber",
            "sugar",
            "saturated_fat",
          ],
          properties: {
            source: { type: "string", enum: ["local", "usda"] },
            name: { type: "string" },
            calories: { type: ["number", "null"] },
            protein: { type: ["number", "null"] },
            carbs: { type: ["number", "null"] },
            fat: { type: ["number", "null"] },
            fiber: { type: ["number", "null"] },
            sugar: { type: ["number", "null"] },
            saturated_fat: { type: ["number", "null"] },
          },
        },
        NutritionCommandResponse: {
          type: "object",
          additionalProperties: true,
          properties: {
            mode: { type: "string", enum: ["preview", "execute"] },
            requiresConfirmation: { type: "boolean" },
            intent: {
              type: "object",
              additionalProperties: true,
              properties: {
                intent: { type: "string" },
                summary: { type: "string" },
              },
            },
            preview: {
              type: "object",
              additionalProperties: true,
              properties: {
                operation: { type: "string" },
                message: { type: "string" },
                sourceDate: { type: "string" },
                targetDate: { type: "string" },
                mealType: { type: "string" },
                targetMealType: { type: "string" },
                foodName: { type: "string" },
                quantity: { type: "number" },
                source: { type: "string" },
                nutrition: {
                  type: "object",
                  additionalProperties: true,
                },
              },
            },
            result: {
              type: "object",
              additionalProperties: true,
              properties: {
                message: { type: "string" },
              },
            },
            results: {
              type: "array",
              items: { $ref: "#/components/schemas/NutritionSearchMatch" },
            },
            matches: {
              type: "array",
              items: { $ref: "#/components/schemas/NutritionSearchMatch" },
            },
            error: { type: "string" },
          },
        },
        ErrorResponse: {
          type: "object",
          additionalProperties: false,
          required: ["error"],
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
    security: [{ AgentToken: [] }],
    paths: {
      "/api/agent/nutrition-ai": {
        post: {
          operationId: "runNutritionCommand",
          summary: "Run a natural-language nutrition command",
          description:
            "Interpret a natural-language nutrition command. Use preview first for copy/add actions, then call again with mode=execute after the user confirms.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NutritionCommandRequest" },
                examples: {
                  copyMealPreview: {
                    summary: "Preview copying yesterday's dinner",
                    value: {
                      command: "copy my dinner from yesterday to today",
                      selectedDate: "2026-05-03",
                      mode: "preview",
                    },
                  },
                  searchFoods: {
                    summary: "Search foods",
                    value: {
                      command: "search for chicken tenders",
                      selectedDate: "2026-05-03",
                      mode: "preview",
                    },
                  },
                  addFoodExecute: {
                    summary: "Add a chosen meal after user confirmation",
                    value: {
                      command: "add example meal to dinner",
                      selectedDate: "2026-05-03",
                      mode: "execute",
                      candidateName: "Example Meal",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Command handled successfully.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/NutritionCommandResponse" },
                },
              },
            },
            "400": {
              description: "Invalid request payload.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Missing or invalid bearer token.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "No matching food was found.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "500": {
              description: "Server error.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
    },
  });
}
