import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireWebClientContext } from "@/features/crm/context";
import { capabilitiesForRole } from "@/features/crm/contracts";
import ContactDetailWorkspace from "@/features/crm/ContactDetailWorkspace";

export const dynamic = "force-dynamic";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWebClientContext();
  if (ctx.error || !ctx.userId) redirect("/login?error=crm_identity&callbackUrl=/admin/crm");
  if (!capabilitiesForRole(ctx.role).crm) redirect("/member");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  return <ContactDetailWorkspace key={id} id={id} />;
}
