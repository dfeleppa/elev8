import { redirect } from "next/navigation";

import { hasRole, requireUserContext } from "@/lib/member";
import OwnerStaffClient from "./OwnerStaffClient";

export default async function OwnerStaffPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/login");
  }

  return (
    <div className="w-full max-w-none px-5 py-10 lg:px-8 lg:py-16">
      <OwnerStaffClient />
    </div>
  );
}
