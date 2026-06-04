import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRequestUserContextMock = vi.fn();
const fromMock = vi.fn();

vi.mock("../../../../../lib/member", async () => {
  const roleOrder = { member: 1, coach: 2, admin: 3, owner: 4 };
  return {
    requireRequestUserContext: requireRequestUserContextMock,
    listAccessibleNutritionMemberIds: vi.fn(async () => null),
    hasRole: (required: keyof typeof roleOrder, actual: keyof typeof roleOrder) =>
      roleOrder[actual] >= roleOrder[required],
  };
});

vi.mock("../../../../../lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

describe("coach nutrition members GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    requireRequestUserContextMock.mockResolvedValue({
      error: "Unauthorized",
      userId: null,
      role: "member",
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/coach/nutrition/members"));

    expect(response.status).toBe(401);
  });

  it("returns 403 for member role", async () => {
    requireRequestUserContextMock.mockResolvedValue({
      error: null,
      userId: "member-1",
      role: "member",
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/coach/nutrition/members"));

    expect(response.status).toBe(403);
  });

  it("returns member options for coach role", async () => {
    requireRequestUserContextMock.mockResolvedValue({
      error: null,
      userId: "coach-1",
      role: "coach",
    });

    fromMock.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(async () => ({
            data: [
              { id: "member-b", full_name: null, email: "zoe@example.com" },
              { id: "member-a", full_name: "Alex Bench", email: "alex@example.com" },
            ],
            error: null,
          })),
        })),
      })),
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/coach/nutrition/members"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.members).toEqual([
      { id: "member-a", fullName: "Alex Bench", email: "alex@example.com", label: "Alex Bench" },
      { id: "member-b", fullName: null, email: "zoe@example.com", label: "zoe@example.com" },
    ]);
  });
});
