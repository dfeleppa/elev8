import { redirect } from "next/navigation";

import { hasRole, requireUserContext } from "@/lib/member";
import { isMemberRouteLocked } from "@/lib/feature-flags";
import MemberWorkoutClient from "./MemberWorkoutClient";

export default async function MemberWorkoutPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/login");
  }
  if (isMemberRouteLocked(role, "/member/workout")) {
    redirect("/member/nutrition");
  }

  return (
    <div className="w-full">
      <MemberWorkoutClient />
    </div>
  );
}
