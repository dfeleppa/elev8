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
