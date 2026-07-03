import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/member", () => ({
  requireUserContext: requireUserContextMock,

  requireRequestUserContext: requireUserContextMock,
  hasRole: (_required: string, actual: string) => ["member", "coach", "admin", "owner"].includes(actual),
}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

type Database = {
  schedule_classes: Array<Record<string, unknown>>;
  programming_tracks: Array<Record<string, unknown>>;
  app_users: Array<Record<string, unknown>>;
  class_reservations: Array<Record<string, unknown>>;
};

let db: Database;

class MockQueryBuilder {
  private filters: Array<{ type: "eq" | "in"; column: string; value: unknown }> = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private action: "select" | "delete" = "select";

  constructor(private readonly table: keyof Database) {}

  select() {
    this.action = "select";
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ type: "in", column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this.execute();
  }

  maybeSingle() {
    return this.executeSingle();
  }

  insert(payload: Record<string, unknown>) {
    db[this.table].push({
      id: payload.id ?? `reservation-${db[this.table].length + 1}`,
      created_at: payload.created_at ?? "2026-04-06T11:00:00.000Z",
      ...payload,
    });

    return Promise.resolve({ data: null, error: null });
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private executeSingle() {
    return this.execute().then((result) => ({
      data: (result.data as Array<Record<string, unknown>>)[0] ?? null,
      error: result.error,
    }));
  }

  private execute() {
    const tableRows = db[this.table] as Array<Record<string, unknown>>;

    if (this.action === "delete") {
      const remainingRows: Array<Record<string, unknown>> = [];
      const deletedRows: Array<Record<string, unknown>> = [];

      for (const row of tableRows) {
        if (this.matches(row)) {
          deletedRows.push(row);
        } else {
          remainingRows.push(row);
        }
      }

      db[this.table] = remainingRows;
      return Promise.resolve({ data: deletedRows, error: null });
    }

    const rows = tableRows.filter((row) => this.matches(row));
    if (this.orderBy) {
      const orderColumn = this.orderBy.column;
      const ascending = this.orderBy.ascending;
      rows.sort((a, b) => {
        const left = String(a[orderColumn] ?? "");
        const right = String(b[orderColumn] ?? "");
        return ascending ? left.localeCompare(right) : right.localeCompare(left);
      });
    }

    return Promise.resolve({ data: rows, error: null });
  }

  private matches(row: Record<string, unknown>) {
    return this.filters.every((filter) => {
      if (filter.type === "eq") {
        return row[filter.column] === filter.value;
      }

      return Array.isArray(filter.value) && filter.value.includes(row[filter.column]);
    });
  }
}

describe("athlete schedule routes", () => {
  const buildReservationRequest = () =>
    new Request("http://localhost/api/athlete/schedule/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: "org-1",
        classId: "class-1",
        date: "2026-04-06",
      }),
    });

  beforeEach(() => {
    vi.clearAllMocks();

    db = {
      schedule_classes: [
        {
          id: "class-1",
          name: "Strength",
          class_time: "09:00:00",
          duration_minutes: 60,
          class_days: ["Mo"],
          start_date: "2026-04-01",
          end_date: null,
          track_id: "track-1",
          default_coach_user_id: "coach-1",
          size_limit: 2,
          reservation_cutoff_hours: 1,
          calendar_color: "#3B82F6",
        },
        {
          id: "class-2",
          name: "Mobility",
          class_time: "11:00:00",
          duration_minutes: 45,
          class_days: ["Tu"],
          start_date: "2026-04-01",
          end_date: null,
          track_id: null,
          default_coach_user_id: null,
          size_limit: 0,
          reservation_cutoff_hours: 0,
          calendar_color: "#10B981",
        },
      ],
      programming_tracks: [
        {
          id: "track-1",
          name: "Performance",
        },
      ],
      app_users: [
        {
          id: "member-1",
          full_name: "Alex Athlete",
          email: "alex@example.com",
        },
        {
          id: "member-2",
          full_name: "Riley Runner",
          email: "riley@example.com",
        },
        {
          id: "coach-1",
          full_name: "Coach Casey",
          email: "coach@example.com",
        },
      ],
      class_reservations: [
        {
          id: "reservation-1",
          class_id: "class-1",
          member_id: "member-2",
          class_date: "2026-04-06",
          created_at: "2026-04-05T15:00:00.000Z",
        },
      ],
    };

    fromMock.mockImplementation((table: keyof Database) => new MockQueryBuilder(table));
    requireUserContextMock.mockResolvedValue({
      error: null,
      userId: "member-1",
      role: "member",
      organizationIds: ["org-1"],
    });
  });

  it("returns only sessions for the selected date with reservation details", async () => {
    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/athlete/schedule?organizationId=org-1&date=2026-04-06");

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.date).toBe("2026-04-06");
    expect(payload.sessions).toHaveLength(1);
    expect(payload.sessions[0]).toMatchObject({
      id: "class-1",
      reservedCount: 1,
      capacityRemaining: 1,
      isReservedByCurrentUser: false,
      track: { id: "track-1", name: "Performance" },
      default_coach: { id: "coach-1", full_name: "Coach Casey" },
    });
    expect(payload.sessions[0].reservedMembers).toEqual([
      expect.objectContaining({ id: "member-2", name: "Riley Runner" }),
    ]);
  });

  it("creates and deletes a reservation while returning the updated session summary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T07:00:00.000Z"));

    const reservationsRoute = await import("./reservations/route");
    const createRequest = new Request("http://localhost/api/athlete/schedule/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: "org-1",
        classId: "class-1",
        date: "2026-04-06",
      }),
    });

    const createResponse = await reservationsRoute.POST(createRequest);
    const createPayload = await createResponse.json();

    expect(createResponse.status).toBe(200);
    expect(createPayload.session).toMatchObject({
      id: "class-1",
      reservedCount: 2,
      capacityRemaining: 0,
      isReservedByCurrentUser: true,
    });

    const deleteRequest = new Request("http://localhost/api/athlete/schedule/reservations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: "org-1",
        classId: "class-1",
        date: "2026-04-06",
      }),
    });

    const deleteResponse = await reservationsRoute.DELETE(deleteRequest);
    const deletePayload = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deletePayload.session).toMatchObject({
      id: "class-1",
      reservedCount: 1,
      capacityRemaining: 1,
      isReservedByCurrentUser: false,
    });

    vi.useRealTimers();
  });

  it("blocks duplicate, full, and closed reservations", async () => {
    vi.useFakeTimers();
    const reservationsRoute = await import("./reservations/route");

    db.class_reservations.push({
      id: "reservation-self",
      class_id: "class-1",
      member_id: "member-1",
      class_date: "2026-04-06",
      created_at: "2026-04-05T16:00:00.000Z",
    });

    const duplicateResponse = await reservationsRoute.POST(buildReservationRequest());
    expect(duplicateResponse.status).toBe(409);

    db.class_reservations = [
      {
        id: "reservation-1",
        class_id: "class-1",
        member_id: "member-2",
        class_date: "2026-04-06",
        created_at: "2026-04-05T15:00:00.000Z",
      },
      {
        id: "reservation-2",
        class_id: "class-1",
        member_id: "coach-1",
        class_date: "2026-04-06",
        created_at: "2026-04-05T15:30:00.000Z",
      },
    ];

    vi.setSystemTime(new Date("2026-04-06T07:00:00.000Z"));
    const fullResponse = await reservationsRoute.POST(buildReservationRequest());
    expect(fullResponse.status).toBe(409);

    db.class_reservations = [];
    vi.setSystemTime(new Date("2026-04-06T12:30:00.000Z"));
    const closedResponse = await reservationsRoute.POST(buildReservationRequest());
    expect(closedResponse.status).toBe(409);

    vi.useRealTimers();
  });
});
