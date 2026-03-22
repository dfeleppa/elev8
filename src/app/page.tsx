import { redirect } from "next/navigation";

import { hasRole, requireUserContext } from "../lib/member";

export default async function Home() {
  const { error, role } = await requireUserContext();

  if (error) {
    redirect("/api/auth/signin");
  }

  if (hasRole("admin", role)) {
    redirect("/organization/gym-dashboard");
  }

  redirect("/organization/member/athlete-dashboard");
}
