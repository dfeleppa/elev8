import { memberRequest } from "@/features/member/client-adapter";
import { scheduleGET } from "@/features/member/schedule-handlers";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return memberRequest(request, scheduleGET, "schedule"); }
