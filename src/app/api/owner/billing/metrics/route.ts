import { NextRequest, NextResponse } from "next/server";
import { hasRole, requireUserContext } from "../../../../../lib/member";

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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

  try {
    const subscriptions = await listAllSubscriptions();
    const charges = await listAllCharges();

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

    return NextResponse.json({
      mrr: parseFloat(mrr.toFixed(2)),
      arr: parseFloat(arr.toFixed(2)),
      ltv: parseFloat(ltv.toFixed(2)),
      active_subscriptions: activeCount,
      total_customers: totalCustomers,
      churn_rate: parseFloat(churnRate.toFixed(2)),
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Stripe metrics error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
