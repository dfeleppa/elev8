import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ context: vi.fn(), origin: vi.fn(), from: vi.fn() }));
vi.mock("@/features/crm/context", () => ({ requireClientContext: mocks.context, allowsMutationOrigin: mocks.origin }));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: mocks.from } }));
// A legacy resolver must never run in the new adapters.
vi.mock("@/lib/member", () => ({ hasRole: () => true, requireRequestUserContext: () => { throw new Error("Legacy identity resolver used"); } }));
import { GET as profileGET, PUT } from "@/app/api/v1/member/profile/route";

const member = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
let rows: Record<string, Record<string, unknown>[]>;
let writes: Array<{ table: string; action: string; values?: unknown; filters: Record<string, unknown> }>;

function query(table: string) {
  const filters: Record<string, unknown> = {};
  let action = "read";
  let values: Record<string, unknown> = {};
  const result = () => {
    const matches = (row: Record<string, unknown>) => Object.entries(filters).every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value);
    const selected = (rows[table] ?? []).filter(matches);
    if (action !== "read") {
      writes.push({ table, action, values, filters: { ...filters } });
      if (action === "update") selected.forEach(row => Object.assign(row, values));
      if (action === "insert") rows[table].push(values);
      if (action === "delete") rows[table] = rows[table].filter(row => !matches(row));
    }
    return { data: selected, error: null };
  };
  const builder = {
    select: () => builder,
    eq: (key: string, value: unknown) => { filters[key] = value; return builder; },
    in: (key: string, value: unknown[]) => { filters[key] = value; return builder; },
    order: () => builder,
    update: (payload: Record<string, unknown>) => { action = "update"; values = payload; return builder; },
    insert: (payload: Record<string, unknown>) => { action = "insert"; values = payload; return builder; },
    delete: () => { action = "delete"; return builder; },
    maybeSingle: async () => { const value = result(); return { ...value, data: value.data[0] ?? null }; },
    then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return builder;
}
function request(path: string, method = "GET", body?: unknown) {
  return new Request(`https://stage.invalid/api/v1/member/${path}`, { method, headers: { Authorization: "Bearer test", "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ userId: member, role: "member", error: null });
  mocks.origin.mockReturnValue(true);
  mocks.from.mockImplementation(query);
  rows = {
    app_users: [{ id: member, full_name: "Self", email: "self@example.invalid" }, { id: other, full_name: "Private peer", email: "private@example.invalid" }],

  };
  writes = [];
});

describe("canonical member adapters", () => {
  it.each([profileGET, PUT])("denies unlinked/unauthenticated identities before querying member data", async handler => {
    mocks.context.mockResolvedValue({ userId: null, role: "member", error: "Unauthorized" });
    expect((await handler(request("profile"))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("reads and updates only the canonical self profile; rejects forged identity and role fields", async () => {
    expect(await (await profileGET(request(`profile?memberId=${other}`))).json()).toMatchObject({ fullName: "Self" });
    expect((await PUT(request("profile", "PUT", { fullName: "Changed", userId: other, role: "owner" }))).status).toBe(400);
    expect((await PUT(request("profile", "PUT", { fullName: "Changed" }))).status).toBe(200);
    expect(writes).toEqual([expect.objectContaining({ table: "app_users", action: "update", filters: { id: member } })]);
    expect(rows.app_users[1].full_name).toBe("Private peer");
  });

  it("checks browser origin and rejects invalid profile payloads", async () => {
    mocks.origin.mockReturnValue(false);
    expect((await PUT(request("profile", "PUT", { fullName: "Changed" }))).status).toBe(403);
    mocks.origin.mockReturnValue(true);
    for (const body of [null, {}, { fullName: " " }, { fullName: "x".repeat(151) }, { email: "new@example.invalid" }]) {
      expect((await PUT(request("profile", "PUT", body))).status).toBe(400);
    }
    expect(writes).toEqual([]);
  });

});
