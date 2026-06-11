import { redirect } from "next/navigation";

export default function ManagementTasksPage() {
  redirect("/management?view=list");
}
