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
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "50"), 100);

    // Fetch charges (payments)
    const charges = await stripe.charges.list({
      limit,
      expand: ["data.customer"]
    });

    // Fetch refunds
    const refunds = await stripe.refunds.list({
      limit: 20,
      expand: ["data.charge"]
    });

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

    return NextResponse.json({
      transactions: transactions.slice(0, limit),
      total_count: transactions.length,
    });
  } catch (err: any) {
    console.error("Stripe transactions error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
