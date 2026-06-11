import { redirect } from "next/navigation";

import { hasRole, requireUserContext } from "@/lib/member";
import { isMemberRouteLocked } from "@/lib/feature-flags";
import MemberScheduleClient from "./MemberScheduleClient";

export default async function MemberClassSchedulePage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/member/athlete-dashboard");
  }
  if (isMemberRouteLocked(role, "/member/class-schedule")) {
    redirect("/member/nutrition");
  }

  return (
    <div className="w-full">
      <MemberScheduleClient />
    </div>
  );
}
