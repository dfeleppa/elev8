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
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "20"), 100);
    const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0");

    const customers = await stripe.customers.list({
      limit,
      expand: ["data.subscriptions"]
    });

    const formattedCustomers = customers.data.map((cust: any) => {
      const subscription = cust.subscriptions?.data?.[0];
      const subscriptionAmount = subscription?.items?.data?.[0]?.price?.unit_amount || 0;
      const subscriptionStatus = subscription?.status || "none";

      return {
        id: cust.id,
        email: cust.email || "N/A",
        name: cust.name || "Unknown",
        total_spent: (cust.balance_transactions || []).reduce((sum: number, tx: any) => sum + tx.amount, 0) / 100,
        subscription_status: subscriptionStatus,
        subscription_amount: subscriptionAmount / 100,
        created_at: new Date(cust.created * 1000).toISOString(),
      };
    });

    return NextResponse.json({
      customers: formattedCustomers,
      total_count: customers.data.length,
      has_more: customers.has_more,
    });
  } catch (err: any) {
    console.error("Stripe customers error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch customers" },
      { status: 500 }
    );
  }
}
