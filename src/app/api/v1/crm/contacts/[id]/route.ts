import { NextResponse } from "next/server";
import { z } from "zod";
import { allowsMutationOrigin, requireClientContext } from "@/features/crm/context";
import { capabilitiesForRole, contactETag, contactPatch, parseContactETag, type ContactFieldErrors } from "@/features/crm/contracts";
import { editContact, readContact, readPatchBody } from "@/features/crm/contact-detail";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store" };
const fail = (status: number, code: string, error: string, fieldErrors?: ContactFieldErrors) =>
  NextResponse.json({ error, code, ...(fieldErrors ? { fieldErrors } : {}) }, { status, headers });
const unavailable = () => fail(503, "unavailable", "Contact details are unavailable. Please try again later.");
const conflict = () => fail(412, "revision_conflict", "This contact changed. Load the latest details before saving again.");

async function gate(request: Request) {
  const ctx = await requireClientContext(request);
  if (ctx.error || !ctx.userId) return fail(401, "unauthorized", "Unauthorized");
  if (!capabilitiesForRole(ctx.role).crm) return fail(403, "forbidden", "Forbidden");
  return ctx;
}

export async function GET(request: Request, context: RouteContext) {
  const ctx = await gate(request);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return fail(400, "invalid_id", "Invalid contact ID.");
  const { contact, error } = await readContact(id);
  if (error) return unavailable();
  if (!contact) return fail(404, "not_found", "Contact not found.");
  return NextResponse.json({ contact }, { headers: { ...headers, ETag: contactETag(contact) } });
}

export async function PATCH(request: Request, context: RouteContext) {
  const ctx = await gate(request);
  if (ctx instanceof NextResponse) return ctx;
  if (!allowsMutationOrigin(request)) return fail(403, "invalid_origin", "Invalid request origin.");
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return fail(400, "invalid_id", "Invalid contact ID.");
  const condition = request.headers.get("if-match");
  if (condition === null) return fail(428, "precondition_required", "Load the contact before saving changes.");
  const expected = parseContactETag(condition);
  if (!expected) return fail(400, "invalid_precondition", "Supply one contact ETag in If-Match.");
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return fail(415, "unsupported_media_type", "Send changes as application/json.");
  }
  const payload = await readPatchBody(request);
  if (payload.tooLarge) return fail(413, "payload_too_large", "Contact changes must be at most 16 KiB.");
  const parsed = contactPatch.safeParse(payload.body);
  if (!parsed.success) {
    const messages: Required<ContactFieldErrors> = {
      full_name: "Enter a name between 1 and 160 characters.",
      email: "Enter a valid email address or clear the field.",
      phone: "Use an international number, such as +15551234567.",
      source: "Choose a supported source.",
    };
    const fieldErrors: ContactFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ContactFieldErrors;
      if (Object.hasOwn(messages, key)) fieldErrors[key] = messages[key];
    }
    return fail(400, "invalid_patch", "Supply only valid contact fields and at least one change.", fieldErrors);
  }
  const current = await readContact(id);
  if (current.error) return unavailable();
  if (!current.contact) return fail(404, "not_found", "Contact not found.");
  if (expected.id !== current.contact.id || expected.revision !== current.contact.revision) return conflict();
  const merged = { ...current.contact, ...parsed.data };
  if (!merged.email && !merged.phone) {
    return fail(400, "channel_required", "Keep an email address or phone number.", {
      email: "Keep an email address or phone number.", phone: "Keep an email address or phone number.",
    });
  }
  const saved = await editContact(id, expected.revision, parsed.data, ctx.userId!);
  if (saved.error) return unavailable();
  if (!saved.contact) return conflict();
  return NextResponse.json({ contact: saved.contact }, { headers: { ...headers, ETag: contactETag(saved.contact) } });
}
