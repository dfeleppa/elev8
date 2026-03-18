import { redirect } from "next/navigation";

export default function ManagementCalendarPage() {
  redirect("/management?view=calendar");
}
