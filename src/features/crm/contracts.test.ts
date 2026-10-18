import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchesContract } from "../../../tests/crm/contract-validator";
import { contactETag, contactPatch, parseContactETag } from "./contracts";

const fixture = (name: string) => JSON.parse(readFileSync("packages/contracts/fixtures/" + name + ".json", "utf8"));
describe("CRM contact edit wire contract", () => {
  it.each([["contact-detail", "ContactDetailResult"], ["contact-patch", "ContactPatch"], ["contact-conflict", "ContactEditError"],
    ["contacts-page", "ContactPage"], ["session-owner", "ClientSession"], ["session-member", "ClientSession"]])("validates fixture %s", (file, schema) => {
    expect(matchesContract(schema, fixture(file))).toBe(true);
  });
  it("validates the patch fixture with the runtime schema too", () => {
    expect(contactPatch.safeParse(fixture("contact-patch")).success).toBe(true);
  });
  it.each([{}, { email: "" }, { full_name: " " }, { phone: "555-1234" }, { source: "invalid" }, { updated_by: "caller" }])("rejects invalid patches in both schemas", patch => {
    expect(matchesContract("ContactPatch", patch)).toBe(false);
    expect(contactPatch.safeParse(patch).success).toBe(false);
  });
  it("preserves missing fields and normalizes only supplied channels", () => {
    expect(contactPatch.parse({ email: " PERSON@example.invalid " })).toEqual({ email: "person@example.invalid" });
    expect(contactPatch.parse({ phone: null })).toEqual({ phone: null });
  });
  it("round trips a strong ETag from the detail fixture", () => {
    const { contact } = fixture("contact-detail");
    expect(parseContactETag(contactETag(contact))).toEqual({ id: contact.id, revision: contact.revision });
    expect(parseContactETag('W/' + contactETag(contact))).toBeNull();
    expect(parseContactETag("*")).toBeNull();
  });
});
