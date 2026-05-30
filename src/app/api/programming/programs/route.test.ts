import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.fn();
const fromMock = vi.fn();

// member.ts imports "server-only" + auth.ts (which throws without Google env
// vars), so we hand-roll enforceRole here instead of importActual.
vi.mock("@/lib/member", () => {
  const order = { member: 1, coach: 2, admin: 3, owner: 4 } as const;
  return {
    requireUserContext: requireUserContextMock,
    authorizeRole: (ctx: { error: string | null; userId: string | null; role: keyof typeof order }, required: keyof typeof order) => {
      if (ctx.error || !ctx.userId) {
        return { ok: false, response: NextResponse.json({ error: ctx.error ?? "Unauthorized" }, { status: 401 }) };
      }
      if (order[ctx.role] < order[required]) {
        return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
      }
      return { ok: true, userId: ctx.userId, role: ctx.role };
    },
  };
});

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

function programsQuery() {
  return {
    select: vi.fn(() => ({
      order: vi.fn(async () => ({ data: [{ id: "p1", name: "Strength" }], error: null })),
    })),
  };
}

describe("programming programs GET authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation(() => programsQuery());
  });

  it("forbids a member from listing all programs", async () => {
    requireUserContextMock.mockResolvedValue({ error: null, userId: "member-1", role: "member" });

    const { GET } = await import("./route");
    const res = await GET();

    expect(res.status).toBe(403);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("allows an admin to list programs", async () => {
    requireUserContextMock.mockResolvedValue({ error: null, userId: "admin-1", role: "admin" });

    const { GET } = await import("./route");
    const res = await GET();
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.programs).toHaveLength(1);
  });
});
