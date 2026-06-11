import { redirect } from "next/navigation";

import { hasRole, requireUserContext } from "@/lib/member";
import OwnerPayrollClient from "./OwnerPayrollClient";

export default async function OwnerPayrollPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    redirect("/owner");
  }

  return (
    <div className="w-full max-w-none px-5 py-10 lg:px-8 lg:py-16">
      <OwnerPayrollClient />
    </div>
  );
}
