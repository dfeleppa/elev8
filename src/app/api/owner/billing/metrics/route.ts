import { NextRequest, NextResponse } from "next/server";
import { hasRole, requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const METRICS_CACHE_TTL_MS = 60_000;

type CachedMetricsPayload = {
  mrr: number;
  arr: number;
  ltv: number;
  active_subscriptions: number;
  total_customers: number;
  churn_rate: number;
  total_revenue: number;
  timestamp: string;
};

const metricsCache = new Map<string, { value: CachedMetricsPayload; expiresAt: number }>();

async function listAllSubscriptions() {
  const subscriptions: any[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const page = await stripe.subscriptions.list({
      status: "all",
      limit: 100,
      starting_after: startingAfter,
    });

    subscriptions.push(...page.data);
    hasMore = page.has_more;
    startingAfter = page.data.length ? page.data[page.data.length - 1].id : undefined;
  }

  return subscriptions;
}

async function listAllCharges() {
  const charges: any[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const page = await stripe.charges.list({
      limit: 100,
      starting_after: startingAfter,
    });

    charges.push(...page.data);
    hasMore = page.has_more;
    startingAfter = page.data.length ? page.data[page.data.length - 1].id : undefined;
  }

  return charges;
}

function monthlyAmountForPriceItem(item: any) {
  const unitAmount = item?.price?.unit_amount ?? 0;
  const quantity = item?.quantity ?? 1;
  const recurring = item?.price?.recurring;
  if (!recurring) {
    return 0;
  }

  const interval = recurring.interval;
  const intervalCount = recurring.interval_count ?? 1;
  const amount = unitAmount * quantity;

  if (interval === "month") {
    return amount / intervalCount;
  }
  if (interval === "year") {
    return amount / (12 * intervalCount);
  }
  if (interval === "week") {
    return (amount * 52) / (12 * intervalCount);
  }
  if (interval === "day") {
    return (amount * 30) / intervalCount;
  }

  return 0;
}

export async function GET(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const organizationId = organizationIds[0] ?? null;
  if (!organizationId) return NextResponse.json({ error: "Organization not found" }, { status: 400 });

  const forceRefresh = request.nextUrl.searchParams.get("fresh") === "1";
  const cacheKey = `org:${organizationId}`;
  const cachedMetrics = metricsCache.get(cacheKey);

  if (!forceRefresh && cachedMetrics && cachedMetrics.expiresAt > Date.now()) {
    return NextResponse.json(cachedMetrics.value, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=30",
      },
    });
  }

  try {
    // Try reading from Supabase cache first (populated by webhooks)
    const { data: cachedSubscriptions, error: subError } = await supabaseAdmin
      .from("stripe_subscriptions")
      .select("*")
      .eq("organization_id", organizationId);

    const { data: cachedTransactions, error: txError } = await supabaseAdmin
      .from("stripe_transactions")
      .select("*")
      .eq("organization_id", organizationId);

    // If webhook data is available and recent, use it
    const hasRecentWebhookData =
      !subError && !txError && 
      (cachedSubscriptions?.length ?? 0) > 0 || (cachedTransactions?.length ?? 0) > 0;

    if (hasRecentWebhookData && !forceRefresh) {
      // Compute metrics from Supabase cache
      let mrrCents = 0;
      let activeCount = 0;
      const uniqueCustomers = new Set<string>();

      (cachedSubscriptions ?? []).forEach((sub: any) => {
        if (sub.stripe_customer_id) {
          uniqueCustomers.add(sub.stripe_customer_id);
        }
        if (sub.status === "active" || sub.status === "trialing") {
          activeCount++;
          mrrCents += ((sub.amount_per_billing_cycle ?? 0) * 100) || 0;
        }
      });

      let grossRevenueCents = 0;
      let refundedCents = 0;
      (cachedTransactions ?? []).forEach((tx: any) => {
        if (tx.stripe_customer_id) {
          uniqueCustomers.add(tx.stripe_customer_id);
        }
        if (tx.type === "payment") {
          grossRevenueCents += (tx.amount * 100) || 0;
        } else if (tx.type === "refund") {
          refundedCents += (tx.amount * 100) || 0;
        }
      });

      const totalRevenue = (grossRevenueCents - refundedCents) / 100;
      const totalCustomers = uniqueCustomers.size;
      const mrr = mrrCents / 100;
      const ltv = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
      const arr = mrr * 12;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      let churnedThisMonth = 0;
      (cachedSubscriptions ?? []).forEach((sub: any) => {
        if (sub.status === "canceled") {
          // Subscriptions in cache don't have canceled_at, so skip churn calc from cache
        }
      });

      const churnRate = totalCustomers > 0 ? (churnedThisMonth / totalCustomers) * 100 : 0;

      const payload: CachedMetricsPayload = {
        mrr: parseFloat(mrr.toFixed(2)),
        arr: parseFloat(arr.toFixed(2)),
        ltv: parseFloat(ltv.toFixed(2)),
        active_subscriptions: activeCount,
        total_customers: totalCustomers,
        churn_rate: parseFloat(churnRate.toFixed(2)),
        total_revenue: parseFloat(totalRevenue.toFixed(2)),
        timestamp: new Date().toISOString(),
      };

      metricsCache.set(cacheKey, {
        value: payload,
        expiresAt: Date.now() + METRICS_CACHE_TTL_MS,
      });

      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=30",
        },
      });
    }

    // Fallback to Stripe API if cache is empty
    const [subscriptions, charges] = await Promise.all([
      listAllSubscriptions(),
      listAllCharges(),
    ]);

    // Calculate metrics
    let mrrCents = 0;
    let activeCount = 0;
    const uniqueCustomers = new Set<string>();

    subscriptions.forEach((sub: any) => {
      if (sub.customer) {
        uniqueCustomers.add(String(sub.customer));
      }

      if (sub.status === "active" || sub.status === "trialing") {
        activeCount++;
        const items = sub.items?.data ?? [];
        items.forEach((item: any) => {
          mrrCents += monthlyAmountForPriceItem(item);
        });
      }
    });

    let grossRevenueCents = 0;
    let refundedCents = 0;
    charges.forEach((charge: any) => {
      if (charge.customer) {
        uniqueCustomers.add(String(charge.customer));
      }

      if (charge.paid) {
        grossRevenueCents += charge.amount ?? 0;
        refundedCents += charge.amount_refunded ?? 0;
      }
    });

    const totalRevenue = (grossRevenueCents - refundedCents) / 100;
    const totalCustomers = uniqueCustomers.size;
    const mrr = mrrCents / 100;
    const ltv = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
    const arr = mrr * 12; // Annual Recurring Revenue

    // Calculate churn (simplified: check canceled subscriptions this month)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let churnedThisMonth = 0;
    subscriptions.forEach((sub: any) => {
      if (sub.status === "canceled" && sub.canceled_at) {
        const canceledDate = new Date(sub.canceled_at * 1000);
        if (canceledDate >= monthStart) {
          churnedThisMonth++;
        }
      }
    });

    const churnRate = totalCustomers > 0 ? (churnedThisMonth / totalCustomers) * 100 : 0;

    const payload: CachedMetricsPayload = {
      mrr: parseFloat(mrr.toFixed(2)),
      arr: parseFloat(arr.toFixed(2)),
      ltv: parseFloat(ltv.toFixed(2)),
      active_subscriptions: activeCount,
      total_customers: totalCustomers,
      churn_rate: parseFloat(churnRate.toFixed(2)),
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      timestamp: new Date().toISOString(),
    };

    metricsCache.set(cacheKey, {
      value: payload,
      expiresAt: Date.now() + METRICS_CACHE_TTL_MS,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=30",
      },
    });
  } catch (err: any) {
    console.error("Stripe metrics error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
