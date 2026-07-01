import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ManagementKanbanPage() {
  redirect("/management?view=kanban");
}
