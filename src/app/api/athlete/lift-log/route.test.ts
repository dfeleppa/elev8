import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, from } = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/member", () => ({ requireRequestUserContext: auth }));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from } }));
import { GET, POST } from "./route";

function query(result: unknown) {
  const chain = {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: (
      resolve: (value: unknown) => unknown,
      reject: (error: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of [
    chain.select,
    chain.insert,
    chain.delete,
    chain.eq,
    chain.order,
    chain.single,
    chain.maybeSingle,
  ])
    method.mockReturnValue(chain);
  return chain;
}
const input = {
  movementId: "deadlift-id",
  dayDate: "2026-09-17",
  sets: [{ reps: 5, weight: 225 }],
  notes: "Training",
};
const request = (body: unknown) =>
  new Request("http://localhost/api/athlete/lift-log", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("personal lift entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ userId: "member-a", error: null });
  });
  it("authenticates before reading or writing", async () => {
    auth.mockResolvedValue({ userId: null, error: "Unauthorized" });
    expect((await POST(request(input))).status).toBe(401);
    expect(
      (
        await GET(
          new Request(
            "http://localhost/api/athlete/lift-log?dayDate=2026-09-17",
          ),
        )
      ).status,
    ).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it.each([
    { ...input, dayDate: "2026-02-30" },
    { ...input, sets: [] },
    { ...input, sets: [{ reps: 2.5, weight: 225 }] },
    {
      ...input,
      sets: [
        { reps: 5, weight: 225 },
        { reps: 5, weight: 0 },
      ],
    },
    { ...input, sets: [{ reps: "5", weight: "225" }] },
  ])(
    "rejects incomplete/invalid submissions without any writes",
    async (body) => {
      expect((await POST(request(body))).status).toBe(400);
      expect(from).not.toHaveBeenCalled();
    },
  );
  it("saves a deadlift for today without any track or programming block", async () => {
    const movement = query({ data: { id: "deadlift-id" }, error: null });
    const log = query({ data: { id: "log-id" }, error: null });
    const sets = query({ error: null });
    from
      .mockReturnValueOnce(movement)
      .mockReturnValueOnce(log)
      .mockReturnValueOnce(sets);
    const response = await POST(
      request({ ...input, memberId: "other-member" }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "log-id" });
    expect(log.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        member_id: "member-a",
        movement_id: "deadlift-id",
        day_date: "2026-09-17",
      }),
    );
    expect(sets.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        log_id: "log-id",
        set_order: 1,
        reps: 5,
        weight: 225,
      }),
    ]);
    expect(from.mock.calls.map((call) => call[0])).toEqual([
      "movement_library",
      "athlete_lift_logs",
      "athlete_lift_log_sets",
    ]);
  });
  it("removes a newly created incomplete log if its sets fail", async () => {
    const cleanup = query({ error: null });
    from
      .mockReturnValueOnce(query({ data: { id: "deadlift-id" }, error: null }))
      .mockReturnValueOnce(query({ data: { id: "log-id" }, error: null }))
      .mockReturnValueOnce(query({ error: { message: "insert failed" } }))
      .mockReturnValueOnce(cleanup);
    expect((await POST(request(input))).status).toBe(500);
    expect(cleanup.delete).toHaveBeenCalled();
    expect(cleanup.eq).toHaveBeenCalledWith("id", "log-id");
    expect(cleanup.eq).toHaveBeenCalledWith("member_id", "member-a");
  });
  it("reads only the authenticated member's selected date and orders sets", async () => {
    const logs = query({
      data: [
        {
          id: "log-id",
          day_date: input.dayDate,
          notes: "Training",
          movement_library: { name: "Deadlift" },
          athlete_lift_log_sets: [
            { set_order: 2, reps: 3, weight: 275 },
            { set_order: 1, reps: 5, weight: 225 },
          ],
        },
      ],
      error: null,
    });
    from.mockReturnValueOnce(logs);
    const response = await GET(
      new Request(
        `http://localhost/api/athlete/lift-log?dayDate=${input.dayDate}&memberId=other-member`,
      ),
    );
    expect(response.status).toBe(200);
    expect(logs.eq).toHaveBeenCalledWith("member_id", "member-a");
    expect(logs.eq).toHaveBeenCalledWith("day_date", input.dayDate);
    expect((await response.json()).logs[0]).toMatchObject({
      movementName: "Deadlift",
      sets: [
        { set_order: 1, reps: 5, weight: 225 },
        { set_order: 2, reps: 3, weight: 275 },
      ],
    });
  });
  it("reports read failures rather than an empty day", async () => {
    from.mockReturnValueOnce(
      query({ data: null, error: { message: "offline" } }),
    );
    expect(
      (
        await GET(
          new Request(
            `http://localhost/api/athlete/lift-log?dayDate=${input.dayDate}`,
          ),
        )
      ).status,
    ).toBe(500);
  });
});
