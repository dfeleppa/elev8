import { redirect } from "next/navigation";
import { requireWebClientContext } from "@/features/crm/context";
import { capabilitiesForRole } from "@/features/crm/contracts";
import ContactsWorkspace from "@/features/crm/ContactsWorkspace";

export default async function CRMPage() {
  const ctx = await requireWebClientContext();
  if (ctx.error || !ctx.userId) redirect("/login?error=crm_identity&callbackUrl=/admin/crm");
  if (!capabilitiesForRole(ctx.role).crm) redirect("/member");
  return <ContactsWorkspace />;
}
