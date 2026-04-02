import { NextRequest, NextResponse } from "next/server";
import { hasRole, requireUserContext } from "../../../../lib/member";

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

export async function GET(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const organizationId = organizationIds[0] ?? null;
  if (!organizationId) return NextResponse.json({ error: "Organization not found" }, { status: 400 });

  try {
    // Fetch all active and paused subscriptions
    const subscriptions = await stripe.subscriptions.list({
      status: "all",
      limit: 100
    });

    // Calculate metrics
    let mrr = 0; // Monthly Recurring Revenue
    let activeCount = 0;
    let totalCustomers = 0;
    let totalRecurringAmount = 0;

    subscriptions.data.forEach((sub: any) => {
      if (sub.status === "active") {
        activeCount++;
        const items = sub.items.data;
        items.forEach((item: any) => {
          const amount = item.price.recurring?.interval === "month" ? item.price.unit_amount || 0 : 0;
          mrr += amount / 100; // Convert cents to dollars
          totalRecurringAmount += amount;
        });
      }
      totalCustomers++;
    });

    // Fetch all charges to calculate LTV
    const charges = await stripe.charges.list({
      limit: 100
    });

    let totalRevenue = 0;
    charges.data.forEach((charge: any) => {
      if (charge.paid) {
        totalRevenue += charge.amount / 100; // Convert cents to dollars
      }
    });

    const ltv = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
    const arr = mrr * 12; // Annual Recurring Revenue

    // Calculate churn (simplified: check canceled subscriptions this month)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let churnedThisMonth = 0;
    subscriptions.data.forEach((sub: any) => {
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
