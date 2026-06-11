import { redirect } from "next/navigation";

import { hasRole, requireUserContext } from "@/lib/member";
import OwnerScheduleClient from "./OwnerScheduleClient";

export default async function OwnerSchedulePage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/login");
  }

  return (
    <div className="w-full max-w-none px-5 py-10 lg:px-8 lg:py-16">
      <OwnerScheduleClient />
    </div>
  );
}
