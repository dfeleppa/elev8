import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.fn();
const isOrgMemberMock = vi.fn();
const hasOrgRoleMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/member", () => ({
  requireUserContext: requireUserContextMock,

  requireRequestUserContext: requireUserContextMock,
}));

vi.mock("@/lib/programming-access", () => ({
  isOrgMember: isOrgMemberMock,
  hasOrgRole: hasOrgRoleMock,
}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

function prQuery() {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: { best_weight: 200, estimated_one_rep_max: 225 },
            error: null,
          })),
        })),
      })),
    })),
  };
}

describe("programming prescription GET authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isOrgMemberMock.mockResolvedValue(true);
    fromMock.mockImplementation(() => prQuery());
  });

  it("blocks a member from reading another member's baseline (IDOR)", async () => {
    requireUserContextMock.mockResolvedValue({ error: null, userId: "member-1", role: "member" });
    hasOrgRoleMock.mockResolvedValue(false);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/programming/prescription?movementId=squat&percent=80&memberId=victim-2")
    );

    expect(res.status).toBe(403);
    // Must not have queried the victim's PR table.
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("allows a member to read their own baseline", async () => {
    requireUserContextMock.mockResolvedValue({ error: null, userId: "member-1", role: "member" });
    hasOrgRoleMock.mockResolvedValue(false);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/programming/prescription?movementId=squat&percent=80")
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.baseline).toBe(225);
    // Own request never needs the elevated-role check.
    expect(hasOrgRoleMock).not.toHaveBeenCalled();
  });

  it("allows a coach to read another member's baseline", async () => {
    requireUserContextMock.mockResolvedValue({ error: null, userId: "coach-1", role: "coach" });
    hasOrgRoleMock.mockResolvedValue(true);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/programming/prescription?movementId=squat&percent=80&memberId=member-2")
    );

    expect(res.status).toBe(200);
    expect(hasOrgRoleMock).toHaveBeenCalledWith("coach-1", "", "coach");
  });
});
