import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ManagementTasksPage() {
  redirect("/management?view=list");
}
