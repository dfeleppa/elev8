import { supabaseAdmin } from "./supabase-admin";

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const METRICS_CACHE_TTL_MS = 30 * 60_000;

type BillingMetricsPayload = {
  mrr: number;
  arr: number;
  ltv: number;
  active_subscriptions: number;
  total_customers: number;
  churn_rate: number;
  total_revenue: number;
  timestamp: string;
};

const metricsCache = new Map<string, { value: BillingMetricsPayload; expiresAt: number }>();
const refreshInFlight = new Map<string, Promise<BillingMetricsPayload>>();

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

  if (interval === "month") return amount / intervalCount;
  if (interval === "year") return amount / (12 * intervalCount);
  if (interval === "week") return (amount * 52) / (12 * intervalCount);
  if (interval === "day") return (amount * 30) / intervalCount;

  return 0;
}

function cacheValue(cacheKey: string, value: BillingMetricsPayload) {
  metricsCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + METRICS_CACHE_TTL_MS,
  });
  return value;
}

async function loadFromWebhookCache(organizationId: string): Promise<BillingMetricsPayload | null> {
  const [cachedSubscriptionsResult, cachedTransactionsResult] = await Promise.all([
    supabaseAdmin
      .from("stripe_subscriptions")
      .select("status, amount_per_billing_cycle, stripe_customer_id")
      .eq("organization_id", organizationId),
    supabaseAdmin
      .from("stripe_transactions")
      .select("type, amount, stripe_customer_id")
      .eq("organization_id", organizationId),
  ]);

  const cachedSubscriptions = cachedSubscriptionsResult.data ?? [];
  const cachedTransactions = cachedTransactionsResult.data ?? [];

  const hasWebhookData =
    !cachedSubscriptionsResult.error &&
    !cachedTransactionsResult.error &&
    ((cachedSubscriptions?.length ?? 0) > 0 || (cachedTransactions?.length ?? 0) > 0);

  if (!hasWebhookData) {
    return null;
  }

  let mrr = 0;
  let activeSubscriptions = 0;
  const uniqueCustomers = new Set<string>();

  for (const sub of cachedSubscriptions as any[]) {
    if (sub.stripe_customer_id) uniqueCustomers.add(String(sub.stripe_customer_id));
    if (sub.status === "active" || sub.status === "trialing") {
      activeSubscriptions += 1;
      mrr += Number(sub.amount_per_billing_cycle ?? 0);
    }
  }

  let grossRevenue = 0;
  let refunded = 0;
  for (const tx of cachedTransactions as any[]) {
    if (tx.stripe_customer_id) uniqueCustomers.add(String(tx.stripe_customer_id));
    if (tx.type === "payment") grossRevenue += Number(tx.amount ?? 0);
    if (tx.type === "refund") refunded += Number(tx.amount ?? 0);
  }

  const totalRevenue = grossRevenue - refunded;
  const totalCustomers = uniqueCustomers.size;
  const ltv = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  const arr = mrr * 12;

  return {
    mrr: parseFloat(mrr.toFixed(2)),
    arr: parseFloat(arr.toFixed(2)),
    ltv: parseFloat(ltv.toFixed(2)),
    active_subscriptions: activeSubscriptions,
    total_customers: totalCustomers,
    churn_rate: 0,
    total_revenue: parseFloat(totalRevenue.toFixed(2)),
    timestamp: new Date().toISOString(),
  };
}

async function loadFromStripeApi(): Promise<BillingMetricsPayload> {
  const [subscriptions, charges] = await Promise.all([listAllSubscriptions(), listAllCharges()]);

  let mrrCents = 0;
  let activeCount = 0;
  const uniqueCustomers = new Set<string>();

  for (const sub of subscriptions as any[]) {
    if (sub.customer) uniqueCustomers.add(String(sub.customer));
    if (sub.status === "active" || sub.status === "trialing") {
      activeCount += 1;
      const items = sub.items?.data ?? [];
      for (const item of items) {
        mrrCents += monthlyAmountForPriceItem(item);
      }
    }
  }

  let grossRevenueCents = 0;
  let refundedCents = 0;
  for (const charge of charges as any[]) {
    if (charge.customer) uniqueCustomers.add(String(charge.customer));
    if (charge.paid) {
      grossRevenueCents += charge.amount ?? 0;
      refundedCents += charge.amount_refunded ?? 0;
    }
  }

  const totalRevenue = (grossRevenueCents - refundedCents) / 100;
  const totalCustomers = uniqueCustomers.size;
  const mrr = mrrCents / 100;
  const arr = mrr * 12;
  const ltv = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let churnedThisMonth = 0;
  for (const sub of subscriptions as any[]) {
    if (sub.status === "canceled" && sub.canceled_at) {
      const canceledDate = new Date(sub.canceled_at * 1000);
      if (canceledDate >= monthStart) churnedThisMonth += 1;
    }
  }

  const churnRate = totalCustomers > 0 ? (churnedThisMonth / totalCustomers) * 100 : 0;

  return {
    mrr: parseFloat(mrr.toFixed(2)),
    arr: parseFloat(arr.toFixed(2)),
    ltv: parseFloat(ltv.toFixed(2)),
    active_subscriptions: activeCount,
    total_customers: totalCustomers,
    churn_rate: parseFloat(churnRate.toFixed(2)),
    total_revenue: parseFloat(totalRevenue.toFixed(2)),
    timestamp: new Date().toISOString(),
  };
}

async function refreshMetrics(cacheKey: string, organizationId: string) {
  const webhookMetrics = await loadFromWebhookCache(organizationId);
  if (webhookMetrics) {
    return cacheValue(cacheKey, webhookMetrics);
  }

  const stripeMetrics = await loadFromStripeApi();
  return cacheValue(cacheKey, stripeMetrics);
}

export async function getOrganizationBillingMetrics(
  organizationId: string,
  options?: { forceRefresh?: boolean }
): Promise<BillingMetricsPayload> {
  const forceRefresh = options?.forceRefresh === true;
  const cacheKey = `org:${organizationId}`;
  const cached = metricsCache.get(cacheKey);

  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (!forceRefresh && cached) {
    if (!refreshInFlight.has(cacheKey)) {
      const refreshPromise = refreshMetrics(cacheKey, organizationId)
        .catch(() => cached.value)
        .finally(() => {
          refreshInFlight.delete(cacheKey);
        });
      refreshInFlight.set(cacheKey, refreshPromise);
    }
    return cached.value;
  }

  if (refreshInFlight.has(cacheKey)) {
    return refreshInFlight.get(cacheKey) as Promise<BillingMetricsPayload>;
  }

  const refreshPromise = refreshMetrics(cacheKey, organizationId).finally(() => {
    refreshInFlight.delete(cacheKey);
  });
  refreshInFlight.set(cacheKey, refreshPromise);
  return refreshPromise;
}
