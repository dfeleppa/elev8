import { getChatGPTUser } from '../../chatgpt-auth';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const scanSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    serving: { type: 'string' },
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
    saturatedFat: { type: 'number' },
    sugar: { type: 'number' },
    fiber: { type: 'number' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    source: { type: 'string', enum: ['nutrition_label', 'food_estimate'] },
    notes: { type: 'string' },
  },
  required: ['name', 'serving', 'calories', 'protein', 'carbs', 'fat', 'saturatedFat', 'sugar', 'fiber', 'confidence', 'source', 'notes'],
} as const;

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      if (typeof (part as { text?: unknown }).text === 'string') return (part as { text: string }).text;
    }
  }
  return null;
}

function safeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value * 10) / 10) : 0;
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: 'Image scanning is not configured.' }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const image = form?.get('image');
  if (!(image instanceof File)) return Response.json({ error: 'Choose a food or nutrition-label image.' }, { status: 400 });
  if (!ALLOWED_TYPES.has(image.type)) return Response.json({ error: 'Use a JPG, PNG, or WebP image.' }, { status: 400 });
  if (image.size > MAX_IMAGE_BYTES) return Response.json({ error: 'Image must be 8 MB or smaller.' }, { status: 400 });

  const imageUrl = `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString('base64')}`;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_FOOD_IMAGE_MODEL ?? 'gpt-4.1-mini',
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: 'Analyze this image for a nutrition log. If it is a readable Nutrition Facts label, transcribe values per serving and use source nutrition_label. Otherwise identify the visible food or meal, estimate one realistic serving and its nutrients, and use source food_estimate. Never claim precision for a visual estimate. Use the notes field to flag uncertainty, hidden ingredients, portion assumptions, or unreadable label details. Return all nutrient values as nonnegative numbers and all macros in grams.' },
          { type: 'input_image', image_url: imageUrl, detail: 'high' },
        ],
      }],
      text: { format: { type: 'json_schema', name: 'fuelwise_food_scan', strict: true, schema: scanSchema } },
    }),
  });

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !payload) {
    const message = payload?.error && typeof payload.error === 'object' && typeof (payload.error as { message?: unknown }).message === 'string'
      ? (payload.error as { message: string }).message
      : 'The image could not be analyzed.';
    return Response.json({ error: message }, { status: response.status || 502 });
  }

  const text = outputText(payload);
  if (!text) return Response.json({ error: 'No nutrition result was returned.' }, { status: 502 });

  try {
    const result = JSON.parse(text) as Record<string, unknown>;
    return Response.json({
      result: {
        name: String(result.name ?? 'Scanned food').slice(0, 120),
        serving: String(result.serving ?? 'Estimated serving').slice(0, 160),
        calories: safeNumber(result.calories),
        protein: safeNumber(result.protein),
        carbs: safeNumber(result.carbs),
        fat: safeNumber(result.fat),
        saturatedFat: safeNumber(result.saturatedFat),
        sugar: safeNumber(result.sugar),
        fiber: safeNumber(result.fiber),
        confidence: ['low', 'medium', 'high'].includes(String(result.confidence)) ? result.confidence : 'low',
        source: result.source === 'nutrition_label' ? 'nutrition_label' : 'food_estimate',
        notes: String(result.notes ?? '').slice(0, 500),
      },
    });
  } catch {
    return Response.json({ error: 'The scan returned an invalid nutrition result.' }, { status: 502 });
  }
}
