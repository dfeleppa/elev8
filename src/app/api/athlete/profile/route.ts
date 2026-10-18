import { requireRequestUserContext } from "@/lib/member";
import { profileGET, profilePUT } from "@/features/member/profile-handlers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return profileGET(request, await requireRequestUserContext(request));
}
export async function PUT(request: Request) {
  return profilePUT(request, await requireRequestUserContext(request));
}
