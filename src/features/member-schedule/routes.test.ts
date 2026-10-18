import { randomUUID } from "node:crypto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { context, origin, rpc } = vi.hoisted(() => ({ context: vi.fn(), origin: vi.fn(), rpc: vi.fn() }));
vi.mock("@/features/crm/context", () => ({ requireClientContext: context, allowsMutationOrigin: origin }));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { rpc } }));
import { GET as day } from "@/app/api/v1/member/schedule/route";
import { GET as detail } from "@/app/api/v1/member/schedule/classes/[classId]/route";
import { POST as book } from "@/app/api/v1/member/schedule/reservations/route";
import { DELETE as cancel } from "@/app/api/v1/member/schedule/reservations/[reservationId]/route";
const member = randomUUID(), classId = randomUUID(), operationId = randomUUID(), reservationId = randomUUID();
const input = { classId, date: "2099-06-01", operationId };
const request = (body: unknown, method = "POST") => new Request("https://stage.invalid/api/v1/member/schedule/reservations", {
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MEMBER_SCHEDULE_ENABLED", "true"); vi.stubEnv("MEMBER_SCHEDULE_ENVIRONMENT", "test");
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:55321"); vi.stubEnv("VERCEL_ENV", "");
  context.mockResolvedValue({ userId: member, role: "member", error: null });
  origin.mockReturnValue(true);
  rpc.mockResolvedValue({ data: { status: 201, code: "booked", session: null, replayed: false }, error: null });
});
afterEach(() => vi.unstubAllEnvs());
it("authenticates every endpoint and returns uncached JSON before calling booking RPCs", async () => {
  context.mockResolvedValue({ userId: null, role: "member", error: "Unauthorized" });
  const responses = [
    await day(new Request("https://stage.invalid/api/v1/member/schedule")),
    await detail(new Request("https://stage.invalid/?date=2099-06-01"), { params: Promise.resolve({ classId }) }),
    await book(request(input)),
    await cancel(request({ operationId }, "DELETE"), { params: Promise.resolve({ reservationId }) }),
  ];
  for (const response of responses) {
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect((await response.json()).code).toBe("unauthorized");
  }
  expect(rpc).not.toHaveBeenCalled();
});
it.each(["member","coach","admin","owner"])("%s bookings use only the verified canonical app ID", async role => {
  context.mockResolvedValue({ userId: member, role, error: null });
  expect((await book(request(input))).status).toBe(201);
  expect(rpc).toHaveBeenCalledWith("member_schedule_mutate", expect.objectContaining({ p_member_id: member, p_class_id: classId, p_operation_id: operationId }));
});
it("blocks the disabled feature and invalid browser origins without any RPC", async () => {
  vi.stubEnv("MEMBER_SCHEDULE_ENABLED", "");
  expect((await book(request(input))).status).toBe(403);
  vi.stubEnv("MEMBER_SCHEDULE_ENABLED", "true");
  origin.mockReturnValue(false);
  expect((await book(request(input))).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});
it.each([
  { ...input, memberId: randomUUID() }, { ...input, email: "owner@example.invalid" },
  { ...input, role: "owner" }, { ...input, date: "2099-02-30" }, { ...input, classId: "bad" },
  { ...input, operationId: null }, null, [],
])("rejects forged or malformed booking fields", async body => {
  expect((await book(request(body))).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it("passes cancellation ID with canonical ownership and rejects forged cancel fields", async () => {
  rpc.mockResolvedValue({ data: { status: 200, code: "cancelled", session: null }, error: null });
  const params = { params: Promise.resolve({ reservationId }) };
  expect((await cancel(request({ operationId }, "DELETE"), params)).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("member_schedule_mutate", expect.objectContaining({ p_member_id: member, p_reservation_id: reservationId, p_class_id: null, p_date: null }));
  expect((await cancel(request({ operationId, memberId: member }, "DELETE"), params)).status).toBe(400);
});
it("validates read inputs and does not accept a caller-selected user", async () => {
  for (const query of ["date=2026-02-30", "date=2026-03-01&memberId=" + member, "date=2026-03-01&date=2026-03-02"]) {
    expect((await day(new Request("https://stage.invalid/?" + query))).status).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});
it("maps domain conflicts and does not expose database errors", async () => {
  rpc.mockResolvedValueOnce({ data: { status: 409, code: "full" }, error: null });
  expect(await (await book(request(input))).json()).toEqual({ error: "This class is already full.", code: "full" });
  rpc.mockResolvedValueOnce({ data: null, error: { message: "private database detail" } });
  const response = await book(request(input));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private database detail");
});
it("returns 200 on replay so clients reconcile without a new write", async () => {
  rpc.mockResolvedValueOnce({ data: { status: 201, code: "booked", replayed: true, session: { reservationId: null } }, error: null });
  const response = await book(request(input));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ replayed: true, session: { reservationId: null } });
});
