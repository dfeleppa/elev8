import { requireRequestUserContext } from "@/lib/member";
import { scheduleGET } from "@/features/member/schedule-handlers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return scheduleGET(request, await requireRequestUserContext(request));
}
