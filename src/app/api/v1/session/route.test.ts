import { expect, it, vi } from "vitest";
import member from "../../../../../packages/contracts/fixtures/session-member.json";
import owner from "../../../../../packages/contracts/fixtures/session-owner.json";

const context = vi.hoisted(() => vi.fn());
vi.mock("@/features/crm/context", () => ({ requireClientContext: context }));
import { GET } from "./route";

it.each([member, owner])("returns the shared Swift and web fixture for $role", async fixture => {
  context.mockResolvedValue({ userId: fixture.userId, role: fixture.role, error: null });
  const response = await GET(new Request("https://app.test/api/v1/session"));
  expect(await response.json()).toEqual(fixture);
});

it("does not expose identity on authentication failure", async () => {
  context.mockResolvedValue({ userId: null, role: "member", error: "details" });
  const response = await GET(new Request("https://app.test/api/v1/session"));
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "Unauthorized" });
});
