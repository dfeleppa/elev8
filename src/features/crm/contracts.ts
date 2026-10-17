import { z } from "zod";

export const capabilitiesForRole = (role: string) => ({
  member: ["member", "coach", "admin", "owner"].includes(role),
  coaching: ["coach", "admin", "owner"].includes(role),
  crm: ["admin", "owner"].includes(role),
});

export const contactInput = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(160),
  email: z.union([z.string().trim().email().max(254).transform(v => v.toLowerCase()), z.literal("")]).optional(),
  phone: z.union([z.string().regex(/^\+[1-9]\d{6,14}$/), z.literal("")]).optional(),
  source: z.enum(["manual", "referral", "website", "import"]).default("manual"),
}).strict().refine(v => Boolean(v.email || v.phone), "Add an email address or phone number.");

export type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string;
  created_at: string;
};
export type ContactPage = { contacts: Contact[]; nextCursor: string | null };

// PATCH has no defaults: omitted fields must never change stored values.
export const contactPatch = z.object({
  full_name: z.string().trim().min(1).max(160).optional(),
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()).nullable().optional(),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable().optional(),
  source: z.enum(["manual", "referral", "website", "import"]).optional(),
}).strict().refine(v => Object.keys(v).length > 0, "Supply at least one editable field.");

export type ContactPatch = z.infer<typeof contactPatch>;
export type ContactDetail = Contact & { revision: number; updated_at: string };
export type ContactDetailResult = { contact: ContactDetail };
export type ContactFieldErrors = Partial<Record<keyof ContactPatch, string>>;

export const contactETag = (contact: Pick<ContactDetail, "id" | "revision">) =>
  `"contact:${contact.id}:${contact.revision}"`;

export function parseContactETag(value: string) {
  const match = /^"contact:([0-9a-f-]{36}):([1-9][0-9]*)"$/.exec(value);
  if (!match || !z.string().uuid().safeParse(match[1]).success) return null;
  const revision = Number(match[2]);
  return Number.isInteger(revision) && revision <= 2147483647 ? { id: match[1], revision } : null;
}
