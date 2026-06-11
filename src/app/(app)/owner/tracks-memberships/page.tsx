import { redirect } from "next/navigation";

import { hasRole, requireUserContext } from "@/lib/member";
import OwnerTracksMembershipsClient from "./OwnerTracksMembershipsClient";

export default async function OwnerTracksMembershipsPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/owner");
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <OwnerTracksMembershipsClient />
    </div>
  );
}
