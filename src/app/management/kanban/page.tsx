import { redirect } from "next/navigation";

export default function ManagementKanbanPage() {
  redirect("/management?view=kanban");
}
