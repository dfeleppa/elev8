import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ context: vi.fn(), origin: vi.fn(), from: vi.fn(), insert: vi.fn(), gt: vi.fn(), result: { data: [] as unknown, error: null as unknown } }));
vi.mock("@/features/crm/context", () => ({ requireClientContext: mocks.context, allowsMutationOrigin: mocks.origin }));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: mocks.from } }));
import { GET, POST } from "./route";

const input = { id: "00000000-0000-4000-8000-000000000001", full_name: "Test Prospect", email: "TEST@example.com" };
const request = (body: unknown = input) => new Request("https://app.test/api/v1/crm/contacts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("CRM contacts API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.context.mockResolvedValue({ userId: "staff", role: "admin", error: null });
    mocks.origin.mockReturnValue(true);
    mocks.result = { data: [], error: null };
    const query = {
      select: () => query, order: () => query, limit: () => query,
      gt: mocks.gt.mockImplementation(() => query),
      insert: mocks.insert.mockImplementation(() => query),
      single: () => Promise.resolve(mocks.result),
      then: (resolve: (value: typeof mocks.result) => unknown) => Promise.resolve(mocks.result).then(resolve),
    };
    mocks.from.mockReturnValue(query);
  });
  it.each(["member", "coach"])("denies %s reads and writes before any database access", async role => {
    mocks.context.mockResolvedValue({ userId: "user", role, error: null });
    expect((await GET(request())).status).toBe(403);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated clients", async () => {
    mocks.context.mockResolvedValue({ userId: null, role: "member", error: "Unauthorized" });
    expect((await GET(request())).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("blocks cross-origin browser writes", async () => {
    mocks.origin.mockReturnValue(false);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([
    { ...input, full_name: " " }, { ...input, email: "" }, { ...input, phone: "5551234567" },
    { ...input, role: "owner" }, { ...input, linked_user_id: "victim" }, { ...input, created_by: "victim" },
  ])("rejects malformed data and identity injection", async body => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("creates a CRM contact without creating an app user", async () => {
    mocks.result.data = { ...input, email: "test@example.com" };
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("crm_contacts");
    expect(mocks.insert).toHaveBeenCalledWith({ ...input, email: "test@example.com", phone: null, source: "manual", created_by: "staff" });
  });
  it("returns a conflict for a repeated operation ID", async () => {
    mocks.result.error = { code: "23505" };
    expect((await POST(request())).status).toBe(409);
  });
  it("does not disclose database errors", async () => {
    mocks.result.error = { message: "sensitive database details" };
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive");
  });
  it("rejects malicious cursor expressions", async () => {
    expect((await GET(new Request("https://app.test?cursor=x,role.eq.owner"))).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("uses bounded cursor pagination and disables caching", async () => {
    mocks.result.data = Array.from({ length: 51 }, (_, i) => ({ id: `contact-${i}` }));
    const response = await GET(new Request(`https://app.test?cursor=${input.id}`));
    const body = await response.json();
    expect(body.contacts).toHaveLength(50);
    expect(body.nextCursor).toBe("contact-49");
    expect(mocks.gt).toHaveBeenCalledWith("id", input.id);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
