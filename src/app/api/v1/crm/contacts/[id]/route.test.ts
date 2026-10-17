import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: vi.fn(), origin: vi.fn(), from: vi.fn(), update: vi.fn(), eq: vi.fn(), single: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/features/crm/context", () => ({ requireClientContext: mocks.context, allowsMutationOrigin: mocks.origin }));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: mocks.from } }));
import { GET, PATCH } from "./route";
import { contactETag } from "@/features/crm/contracts";

const id = "00000000-0000-4000-8000-000000000001";
const actor = "00000000-0000-4000-8000-000000000002";
const contact = { id, full_name: "Existing", email: "person@example.invalid", phone: null, source: "referral",
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", revision: 1 };
const route = (value = id) => ({ params: Promise.resolve({ id: value }) });
const request = (body: unknown = { full_name: "Edited" }, headers: Record<string, string> = {}) =>
  new Request(`https://app.test/api/v1/crm/contacts/${id}`, {
    method: "PATCH", headers: { "content-type": "application/json", "if-match": contactETag(contact), ...headers },
    body: JSON.stringify(body),
  });
const readRequest = () => new Request(`https://app.test/api/v1/crm/contacts/${id}`);

describe("contact detail and edit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.context.mockResolvedValue({ userId: actor, role: "admin", error: null });
    mocks.origin.mockReturnValue(true);
    mocks.single.mockResolvedValue({ data: contact, error: null });
    const query = { select: () => query, eq: mocks.eq, update: mocks.update, maybeSingle: mocks.single };
    mocks.eq.mockReturnValue(query); mocks.update.mockReturnValue(query); mocks.from.mockReturnValue(query);
  });

  it.each(["member", "coach", "signed-out"])("denies %s before contact lookup", async role => {
    mocks.context.mockResolvedValue({ userId: role === "signed-out" ? null : actor, role, error: null });
    for (const response of [await GET(readRequest(), route()), await PATCH(request(), route())]) {
      expect(response.status).toBe(role === "signed-out" ? 401 : 403);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns a stable detail ETag without exposing internal actor columns", async () => {
    const response = await GET(readRequest(), route());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ contact });
    expect(response.headers.get("etag")).toBe(contactETag(contact));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects foreign browser origins before reading or writing", async () => {
    mocks.origin.mockReturnValue(false);
    expect((await PATCH(request(), route())).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("requires a conditional write and rejects malformed or wildcard ETags", async () => {
    const missing = request(); missing.headers.delete("if-match");
    expect((await PATCH(missing, route())).status).toBe(428);
    for (const tag of ["*", 'W/"contact:bad:1"', contactETag(contact) + ", " + contactETag(contact), `"contact:${id}:2147483648"`]) {
      expect((await PATCH(request(undefined, { "if-match": tag }), route())).status).toBe(400);
    }
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([{}, null, [], { full_name: " " }, { email: "" }, { phone: "5551234567" }, { source: null },
    { role: "owner" }, { id: actor }, { revision: 2 }, { created_by: actor }, { updated_by: actor },
    { updated_at: contact.updated_at }, { owner_user_id: actor }, { linked_user_id: actor }])("rejects invalid/injected patch %j", async body => {
    const response = await PATCH(request(body), route());
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON, wrong media type, and oversized streamed payloads", async () => {
    const malformed = request(); Object.defineProperty(malformed, "body", { value: new Blob(["{"]).stream() });
    expect((await PATCH(malformed, route())).status).toBe(400);
    expect((await PATCH(request(undefined, { "content-type": "text/plain" }), route())).status).toBe(415);
    expect((await PATCH(request({ full_name: "x".repeat(17000) }), route())).status).toBe(413);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("normalizes changed values, preserves omitted source, and writes with the expected revision", async () => {
    mocks.single.mockResolvedValueOnce({ data: contact, error: null })
      .mockResolvedValueOnce({ data: { ...contact, full_name: "Edited", email: "updated@example.invalid", revision: 2 }, error: null });
    const response = await PATCH(request({ full_name: " Edited ", email: "UPDATED@example.invalid" }), route());
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ full_name: "Edited", email: "updated@example.invalid", updated_by: actor });
    expect(mocks.eq).toHaveBeenCalledWith("revision", 1);
    expect(response.headers.get("etag")).toBe(contactETag({ id, revision: 2 }));
  });

  it("clears a channel only when the final record retains another", async () => {
    expect((await PATCH(request({ email: null }), route())).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
    expect((await PATCH(request({ email: null, phone: "+15551234567" }), route())).status).toBe(200);
  });

  it("distinguishes malformed IDs from missing contacts", async () => {
    expect((await GET(readRequest(), route("bad"))).status).toBe(400);
    expect((await PATCH(request(), route("bad"))).status).toBe(400);
    mocks.single.mockResolvedValue({ data: null, error: null });
    expect((await GET(readRequest(), route())).status).toBe(404);
    expect((await PATCH(request(), route())).status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects stale and different-contact ETags without a write", async () => {
    for (const tag of [contactETag({ id, revision: 2 }), contactETag({ id: actor, revision: 1 })]) {
      expect((await PATCH(request(undefined, { "if-match": tag }), route())).status).toBe(412);
    }
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns a conflict when another writer wins after the read", async () => {
    mocks.single.mockResolvedValueOnce({ data: contact, error: null }).mockResolvedValueOnce({ data: null, error: null });
    expect((await PATCH(request(), route())).status).toBe(412);
  });

  it("sanitizes read and write database failures", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: "private SQL details" } });
    const read = await GET(readRequest(), route());
    expect(read.status).toBe(503); expect(await read.text()).not.toContain("private SQL");
    mocks.single.mockResolvedValueOnce({ data: contact, error: null }).mockResolvedValueOnce({ data: null, error: { message: "private SQL details" } });
    const write = await PATCH(request(), route());
    expect(write.status).toBe(503); expect(await write.text()).not.toContain("private SQL");
    expect(write.headers.get("cache-control")).toBe("private, no-store");
  });
});
