import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.fn();
const fromMock = vi.fn();
const uploadMock = vi.fn();
const getPublicUrlMock = vi.fn();

vi.mock("@/lib/member", () => ({
  requireUserContext: requireUserContextMock,

  requireRequestUserContext: requireUserContextMock,
}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: fromMock,
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      })),
    },
  },
}));

type TableName = "chat_threads" | "chat_messages";

type MockState = {
  threads: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
  inserted: Record<string, unknown> | null;
};

let state: MockState;

class QueryBuilder {
  private filters: Array<{ column: string; value: unknown; op: "eq" | "is" }> = [];
  private insertPayload: Record<string, unknown> | null = null;
  private orderBy: { column: string; ascending: boolean } | null = null;
  private rowLimit: number | null = null;

  constructor(private readonly table: TableName) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value, op: "eq" });
    return this;
  }

  is(column: string, value: unknown) {
    if (value !== null) {
      this.filters.push({ column, value, op: "is" });
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  insert(payload: Record<string, unknown>) {
    this.insertPayload = payload;
    state.inserted = payload;
    return this;
  }

  maybeSingle() {
    const rows = this.rows();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  single() {
    if (this.insertPayload) {
      return Promise.resolve({
        data: {
          id: "message-new",
          body: this.insertPayload.body,
          image_url: this.insertPayload.image_url,
          image_storage_path: this.insertPayload.image_storage_path,
          created_at: "2026-05-27T12:00:00.000Z",
          updated_at: "2026-05-27T12:00:00.000Z",
          author: {
            id: "member-1",
            full_name: "Alex Athlete",
            email: "alex@example.com",
            role: "member",
          },
        },
        error: null,
      });
    }
    return Promise.resolve({ data: this.rows()[0] ?? null, error: null });
  }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve({ data: this.rows(), error: null }).then(onfulfilled, onrejected);
  }

  private rows() {
    const source = this.table === "chat_threads" ? state.threads : state.messages;
    let rows = source.filter((row) =>
      this.filters.every((filter) =>
        filter.op === "is" ? row[filter.column] === filter.value : row[filter.column] === filter.value
      )
    );

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows = [...rows].sort((a, b) => {
        const left = String(a[column] ?? "");
        const right = String(b[column] ?? "");
        return ascending ? left.localeCompare(right) : right.localeCompare(left);
      });
    }

    return this.rowLimit ? rows.slice(0, this.rowLimit) : rows;
  }
}

describe("chat messages API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      threads: [{ id: "thread-main", slug: "main", name: "Main" }],
      messages: [
        {
          id: "message-2",
          thread_id: "thread-main",
          body: "Second",
          image_url: null,
          image_storage_path: null,
          deleted_at: null,
          created_at: "2026-05-27T12:05:00.000Z",
          updated_at: "2026-05-27T12:05:00.000Z",
          author: { id: "member-1", full_name: "Alex Athlete", email: "alex@example.com", role: "member" },
        },
        {
          id: "message-1",
          thread_id: "thread-main",
          body: "First https://example.com",
          image_url: null,
          image_storage_path: null,
          deleted_at: null,
          created_at: "2026-05-27T12:00:00.000Z",
          updated_at: "2026-05-27T12:00:00.000Z",
          author: { id: "coach-1", full_name: "Coach Casey", email: "coach@example.com", role: "coach" },
        },
      ],
      inserted: null,
    };
    fromMock.mockImplementation((table: TableName) => new QueryBuilder(table));
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: "https://storage.example/chat/image.jpg" } });
    requireUserContextMock.mockResolvedValue({ error: null, userId: "member-1", role: "member" });
  });

  it("requires authentication", async () => {
    requireUserContextMock.mockResolvedValue({ error: "Unauthorized", userId: null, role: "member" });
    const { GET } = await import("./route");

    const response = await GET(new NextRequest("http://localhost/api/chat/messages?thread=main"));

    expect(response.status).toBe(401);
  });

  it("returns recent messages oldest-first for rendering", async () => {
    const { GET } = await import("./route");

    const response = await GET(new NextRequest("http://localhost/api/chat/messages?thread=main"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.messages.map((message: { body: string }) => message.body)).toEqual([
      "First https://example.com",
      "Second",
    ]);
    expect(payload.messages[0].author.name).toBe("Coach Casey");
  });

  it("creates a text message for the authenticated user", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread: "main", body: "Hello team" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(state.inserted).toMatchObject({
      thread_id: "thread-main",
      author_user_id: "member-1",
      body: "Hello team",
    });
    expect(payload.message.body).toBe("Hello team");
  });

  it("rejects invalid threads and empty messages", async () => {
    const { POST } = await import("./route");
    const invalidThread = await POST(
      new NextRequest("http://localhost/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread: "random", body: "Nope" }),
      })
    );
    expect(invalidThread.status).toBe(400);

    const empty = await POST(
      new NextRequest("http://localhost/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread: "main", body: "   " }),
      })
    );
    expect(empty.status).toBe(400);
  });

  it("rejects unsupported image uploads before storage", async () => {
    const { POST } = await import("./route");
    const formData = new FormData();
    formData.set("thread", "main");
    formData.set("image", new File(["not an image"], "note.txt", { type: "text/plain" }));

    const response = await POST(
      new NextRequest("http://localhost/api/chat/messages", {
        method: "POST",
        body: formData,
      })
    );

    expect(response.status).toBe(400);
    expect(uploadMock).not.toHaveBeenCalled();
  });
});
