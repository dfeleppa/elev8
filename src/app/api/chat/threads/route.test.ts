import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/member", () => ({
  requireUserContext: requireUserContextMock,

  requireRequestUserContext: requireUserContextMock,
}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

class QueryBuilder {
  private orderBy: { column: string; ascending: boolean } | null = null;

  constructor(private readonly table: string) {}

  select() {
    return this;
  }

  in() {
    return this;
  }

  is() {
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit() {
    return this;
  }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    let data: unknown[] =
      this.table === "chat_threads"
        ? [
            { id: "thread-main", slug: "main", name: "Main", description: "General", sort_order: 10 },
            { id: "thread-nutrition", slug: "nutrition", name: "Nutrition", description: "Food", sort_order: 20 },
          ]
        : [
            {
              id: "message-1",
              thread_id: "thread-main",
              body: "Latest",
              image_url: null,
              created_at: "2026-05-27T12:00:00.000Z",
            },
          ];

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      data = [...data].sort((a, b) => {
        const left = String((a as Record<string, unknown>)[column] ?? "");
        const right = String((b as Record<string, unknown>)[column] ?? "");
        return ascending ? left.localeCompare(right) : right.localeCompare(left);
      });
    }

    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
  }
}

describe("chat threads API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserContextMock.mockResolvedValue({ error: null, userId: "member-1", role: "member" });
    fromMock.mockImplementation((table: string) => new QueryBuilder(table));
  });

  it("requires authentication", async () => {
    requireUserContextMock.mockResolvedValue({ error: "Unauthorized", userId: null, role: "member" });
    const { GET } = await import("./route");

    const response = await GET(new Request('http://localhost/test'));

    expect(response.status).toBe(401);
  });

  it("returns chat threads with metadata", async () => {
    const { GET } = await import("./route");

    const response = await GET(new Request('http://localhost/test'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.threads).toHaveLength(2);
    expect(payload.threads[0]).toMatchObject({
      slug: "main",
      name: "Main",
      messageCount: 1,
    });
    expect(payload.threads[0].latestMessage.body).toBe("Latest");
  });
});
