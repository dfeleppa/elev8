import { NextRequest, NextResponse } from "next/server";
import { hasRole, requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    // Try Supabase cache first (populated by webhooks)
    const { data: cachedTransactions, error: cacheError } = await supabaseAdmin
      .from("stripe_transactions")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    // If cache has data and we're not forcing refresh, use it
    if (!cacheError && cachedTransactions && cachedTransactions.length > 0 && !forceRefresh) {
      const formattedTransactions = cachedTransactions.map((tx: any) => ({
        id: tx.id,
        type: tx.type as "payment" | "refund",
        amount: tx.amount,
        currency: tx.currency || "usd",
        status: tx.status,
        customer_email: tx.stripe_customer_id, // Limited info in cache
        customer_name: "N/A",
        description: tx.description || (tx.type === "payment" ? "Payment" : "Refund"),
        created_at: tx.created_at,
      }));

      const payload: TransactionsPayload = {
        transactions: formattedTransactions,
        total_count: formattedTransactions.length,
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
    }

    // Fallback to Stripe API
    const [charges, refunds] = await Promise.all([
      stripe.charges.list({
        limit,
        expand: ["data.customer"]
      }),
      stripe.refunds.list({
        limit: 20,
        expand: ["data.charge"]
      }),
    ]);

    // Combine and sort by date
    const transactions = [
      ...charges.data.map((charge: any) => ({
        id: charge.id,
        type: "payment",
        amount: charge.amount / 100,
        currency: charge.currency.toUpperCase(),
        status: charge.status,
        customer_email: charge.customer?.email || "Unknown",
        customer_name: charge.customer?.name || "Unknown",
        description: charge.description || "Payment",
        created_at: new Date(charge.created * 1000).toISOString(),
      })),
      ...refunds.data.map((refund: any) => ({
        id: refund.id,
        type: "refund",
        amount: refund.amount / 100,
        currency: refund.currency?.toUpperCase() || "USD",
        status: refund.status,
        customer_email: refund.charge?.customer?.email || "Unknown",
        customer_name: refund.charge?.customer?.name || "Unknown",
        description: `Refund: ${refund.reason || "N/A"}`,
        created_at: new Date(refund.created * 1000).toISOString(),
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const payload: TransactionsPayload = {
      transactions: transactions.slice(0, limit),
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
