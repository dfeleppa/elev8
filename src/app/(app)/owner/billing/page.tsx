import { redirect } from "next/navigation";

import OwnerBillingClient from "./OwnerBillingClient";
import { hasRole, requireUserContext } from "@/lib/member";

export default async function OwnerBillingPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 lg:py-16">
      <OwnerBillingClient />
    </div>
  );
}
