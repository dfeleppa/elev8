import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.fn();
const normalizeInvitationCodeMock = vi.fn((value: unknown) => (typeof value === "string" ? value.trim().toUpperCase() : ""));
const normalizeEmailMock = vi.fn((value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : ""));

const organizationsMaybeSingleMock = vi.fn();
const usersMaybeSingleMock = vi.fn();
const organizationMembersUpsertMock = vi.fn();
const organizationMembershipsUpsertMock = vi.fn();
const fromMock = vi.fn((table: string) => {
  if (table === "organizations") {
    return {
      select: vi.fn(() => ({
        ilike: vi.fn(() => ({
          maybeSingle: organizationsMaybeSingleMock,
        })),
      })),
    };
  }

  if (table === "app_users") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: usersMaybeSingleMock,
        })),
      })),
    };
  }

  if (table === "organization_members") {
    return {
      upsert: organizationMembersUpsertMock,
    };
  }

  if (table === "organization_memberships") {
    return {
      upsert: organizationMembershipsUpsertMock,
    };
  }

  throw new Error(`Unexpected table ${table}`);
});

vi.mock("../../../../lib/member", () => ({
  requireUserContext: requireUserContextMock,
}));

vi.mock("../../../../lib/invitation-code", () => ({
  normalizeInvitationCode: normalizeInvitationCodeMock,
}));

vi.mock("../../../../lib/organization-member-email", () => ({
  normalizeEmail: normalizeEmailMock,
}));

vi.mock("../../../../lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

describe("join organization route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireUserContextMock.mockResolvedValue({
      userId: "user-1",
      error: null,
    });

    organizationsMaybeSingleMock.mockResolvedValue({
      data: { id: "org-1", name: "Elev8 HQ" },
      error: null,
    });

    usersMaybeSingleMock.mockResolvedValue({
      data: { email: "Alex@Example.com", full_name: "Alex Athlete" },
      error: null,
    });

    organizationMembersUpsertMock.mockResolvedValue({ error: null });
    organizationMembershipsUpsertMock.mockResolvedValue({ error: null });
  });

  it("attaches the app user to organization_members before creating the membership", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/auth/join-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationCode: " elev8 " }),
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      organizationId: "org-1",
      organizationName: "Elev8 HQ",
    });

    expect(organizationMembersUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        member_id: "user-1",
        email: "alex@example.com",
        first_name: "Alex",
        last_name: "Athlete",
        role: "member",
      }),
      { onConflict: "organization_id,email" }
    );

    expect(organizationMembershipsUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        user_id: "user-1",
        role: "member",
      }),
      { onConflict: "organization_id,user_id" }
    );
  });

  it("returns a conflict when a stale global email uniqueness rule blocks the member attach", async () => {
    organizationMembersUpsertMock.mockResolvedValue({
      error: {
        code: "23505",
        message: "duplicate key value violates unique constraint organization_members_email_key",
      },
    });

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/auth/join-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationCode: "elev8" }),
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({
      error: "This email is already attached to another organization member record.",
    });
  });
});
