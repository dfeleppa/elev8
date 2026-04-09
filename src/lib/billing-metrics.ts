import { supabaseAdmin } from "./supabase-admin";

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

async function refreshMetrics(cacheKey: string, organizationId: string) {
  const webhookMetrics = await loadFromWebhookCache(organizationId);
  if (webhookMetrics) {
    return cacheValue(cacheKey, webhookMetrics);
  }

  return cacheValue(cacheKey, {
    mrr: 0,
    arr: 0,
    ltv: 0,
    active_subscriptions: 0,
    total_customers: 0,
    churn_rate: 0,
    total_revenue: 0,
    timestamp: new Date().toISOString(),
  });
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
