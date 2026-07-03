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

    requireRequestUserContext: requireUserContextMock,
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

describe("programming results import POST authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forbids a member from importing into gym-wide programming tables", async () => {
    requireUserContextMock.mockResolvedValue({ error: null, userId: "member-1", role: "member" });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/programming/results/import", {
        method: "POST",
        body: JSON.stringify({ csvText: "Title,Date\nFran,1/2/2024" }),
      })
    );

    expect(res.status).toBe(403);
    // The role gate must run before any write to programming tables.
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("lets an admin past the role gate", async () => {
    requireUserContextMock.mockResolvedValue({ error: null, userId: "admin-1", role: "admin" });

    const { POST } = await import("./route");
    // Empty CSV trips the next validation (400) — proving the role gate passed.
    const res = await POST(
      new Request("http://localhost/api/programming/results/import", {
        method: "POST",
        body: JSON.stringify({ csvText: "" }),
      })
    );

    expect(res.status).toBe(400);
  });
});
