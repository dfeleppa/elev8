import { redirect } from "next/navigation";

import { hasRole, requireUserContext } from "@/lib/member";

export default async function Home() {
  const { error, role } = await requireUserContext();

  if (error) {
    redirect("/login");
  }

  if (hasRole("admin", role)) {
    redirect("/gym-dashboard");
  }

  redirect("/member/athlete-dashboard");
}
