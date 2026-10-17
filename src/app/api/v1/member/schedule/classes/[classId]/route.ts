import { getOccurrence } from "@/features/member-schedule/handlers";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ classId: string }> }) {
  return getOccurrence(request, (await context.params).classId);
}
