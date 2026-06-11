import { redirect } from "next/navigation";

export default function ManagementGanttPage() {
  redirect("/management?view=gantt");
}
