import { redirect } from "next/navigation";

import { hasRole, requireUserContext } from "@/lib/member";
import ProgrammingClient from "./ProgrammingClient";

export default async function AdminProgrammingPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("admin", role)) {
    redirect("/login");
  }

  return (
    <div className="w-full px-4 py-4 lg:px-6 lg:py-6">
      <ProgrammingClient />
    </div>
  );
}
