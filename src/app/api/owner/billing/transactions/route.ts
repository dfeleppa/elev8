import { NextRequest, NextResponse } from "next/server";
import { hasRole, requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
const TRANSACTIONS_CACHE_TTL_MS = 30_000;

type TransactionsPayload = {
  transactions: Array<{
    id: string;
    type: "payment" | "refund";
    amount: number;
    currency: string;
    status: string;
    customer_email: string;
    customer_name: string;
    description: string;
    created_at: string;
  }>;
  total_count: number;
};

const transactionsCache = new Map<string, { value: TransactionsPayload; expiresAt: number }>();

export async function GET(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const organizationId = organizationIds[0] ?? null;
  if (!organizationId) return NextResponse.json({ error: "Organization not found" }, { status: 400 });

  const requestedLimit = parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const forceRefresh = request.nextUrl.searchParams.get("fresh") === "1";
  const cacheKey = `org:${organizationId}:limit:${limit}`;

  if (!forceRefresh) {
    const cached = transactionsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.value, {
        headers: {
          "Cache-Control": "private, max-age=20, stale-while-revalidate=20",
        },
      });
    }
  }

  try {
    const { data: cachedTransactions, error: cacheError } = await supabaseAdmin
      .from("stripe_transactions")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (cacheError) {
      throw new Error(cacheError.message);
    }

    const transactions = (cachedTransactions ?? []).map((tx: any) => ({
      id: tx.id,
      type: tx.type as "payment" | "refund",
      amount: tx.amount,
      currency: tx.currency || "usd",
      status: tx.status,
      customer_email: tx.stripe_customer_id,
      customer_name: "N/A",
      description: tx.description || (tx.type === "payment" ? "Payment" : "Refund"),
      created_at: tx.created_at,
    }));

    const payload: TransactionsPayload = {
      transactions,
      total_count: transactions.length,
    };

    transactionsCache.set(cacheKey, {
      value: payload,
      expiresAt: Date.now() + TRANSACTIONS_CACHE_TTL_MS,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=20, stale-while-revalidate=20",
      },
    });
  } catch (err: any) {
    console.error("Stripe transactions error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
