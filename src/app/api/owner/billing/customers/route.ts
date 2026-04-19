import { NextRequest, NextResponse } from "next/server";
import { hasRole, requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";
const CUSTOMERS_CACHE_TTL_MS = 60_000;

type CustomersPayload = {
  customers: Array<{
    id: string;
    email: string;
    name: string;
    total_spent: number;
    subscription_status: string;
    subscription_amount: number;
    created_at: string;
  }>;
  total_count: number;
  has_more: boolean;
};

const customersCache = new Map<string, { value: CustomersPayload; expiresAt: number }>();

export async function GET(request: NextRequest) {
  const { error, role } = await requireUserContext();
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requestedLimit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20;
  const forceRefresh = request.nextUrl.searchParams.get("fresh") === "1";
  const cacheKey = `limit:${limit}`;

  if (!forceRefresh) {
    const cached = customersCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.value, {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=30",
        },
      });
    }
  }

  try {
    const { data: cachedCustomers, error: cacheError } = await supabaseAdmin
      .from("stripe_customers")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (cacheError) {
      throw new Error(cacheError.message);
    }

    const formattedCustomers = (cachedCustomers ?? []).map((cust: any) => ({
      id: cust.stripe_customer_id,
      email: cust.email || "N/A",
      name: cust.name || "Unknown",
      total_spent: cust.total_spent || 0,
      subscription_status: cust.subscription_status || "none",
      subscription_amount: 0,
      created_at: cust.created_at,
    }));

    const payload: CustomersPayload = {
      customers: formattedCustomers,
      total_count: formattedCustomers.length,
      has_more: false,
    };

    customersCache.set(cacheKey, {
      value: payload,
      expiresAt: Date.now() + CUSTOMERS_CACHE_TTL_MS,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=30",
      },
    });
  } catch (err: any) {
    console.error("Stripe customers error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch customers" },
      { status: 500 }
    );
  }
}
