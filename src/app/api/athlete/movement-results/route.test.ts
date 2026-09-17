import { beforeEach, expect, it, vi } from "vitest";
const { auth, from } = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/member", () => ({ requireRequestUserContext: auth }));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from } }));
import { GET } from "./route";
function query(result: unknown) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  return chain;
}
beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ userId: "member-a", error: null });
});
it("includes a movement with only personal lift logs in history search", async () => {
  const workouts = query({ data: [], error: null });
  const manual = query({
    data: [
      {
        movement_id: "deadlift",
        movement_library: { id: "deadlift", name: "Deadlift" },
      },
    ],
    error: null,
  });
  from.mockReturnValueOnce(workouts).mockReturnValueOnce(manual);
  const response = await GET(
    new Request("http://localhost/api/athlete/movement-results"),
  );
  expect(await response.json()).toEqual({
    movements: [{ id: "deadlift", name: "Deadlift" }],
  });
  expect(manual.eq).toHaveBeenCalledWith("member_id", "member-a");
});
it("does not silently hide a failed manual-history query", async () => {
  from
    .mockReturnValueOnce(query({ data: [], error: null }))
    .mockReturnValueOnce(query({ data: null, error: { message: "failed" } }));
  expect(
    (
      await GET(
        new Request(
          "http://localhost/api/athlete/movement-results?movementId=deadlift",
        ),
      )
    ).status,
  ).toBe(500);
});
