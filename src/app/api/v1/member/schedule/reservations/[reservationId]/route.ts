import { cancel } from "@/features/member-schedule/handlers";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function DELETE(request: Request, context: { params: Promise<{ reservationId: string }> }) {
  return cancel(request, (await context.params).reservationId);
}
