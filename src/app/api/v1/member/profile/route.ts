import { memberRequest } from "@/features/member/client-adapter";
import { profileGET, profilePUT } from "@/features/member/profile-handlers";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return memberRequest(request, profileGET); }
export function PUT(request: Request) { return memberRequest(request, profilePUT); }
