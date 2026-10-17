import { redirect } from "next/navigation";
import { requireUserContext } from "@/lib/member";
import { capabilitiesForRole } from "@/features/crm/contracts";
import ContactsWorkspace from "@/features/crm/ContactsWorkspace";

export default async function CRMPage() {
  const ctx = await requireUserContext();
  if (ctx.error || !ctx.userId) redirect("/login");
  if (!capabilitiesForRole(ctx.role).crm) redirect("/member");
  return <ContactsWorkspace />;
}
