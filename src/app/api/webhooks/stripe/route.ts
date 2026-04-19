import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

type StripeCustomer = {
  id: string;
  email?: string | null;
  name?: string | null;
  metadata?: Record<string, string | undefined>;
  deleted?: boolean;
};

type StripeSubscription = {
  id: string;
  customer: string | { id: string };
  status: string;
  current_period_start?: number | null;
  current_period_end?: number | null;
  billing_cycle_anchor?: number | null;
  items?: {
    data?: Array<{
      quantity?: number | null;
      price?: {
        unit_amount?: number | null;
      };
    }>;
  };
};

type StripeCharge = {
  id: string;
  customer?: string | { id: string; email?: string | null; name?: string | null } | null;
  invoice?: string | null;
  amount: number;
  amount_refunded?: number | null;
  currency?: string;
  status: string;
  paid?: boolean;
  description?: string | null;
  created: number;
  billing_details?: {
    email?: string | null;
    name?: string | null;
  };
};

type StripeRefund = {
  id: string;
  charge?: string | null;
  amount: number;
  currency?: string;
  status?: string;
  reason?: string | null;
  created: number;
};

function getCustomerId(customer: string | { id: string } | null | undefined) {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function computeSubscriptionAmount(subscription: StripeSubscription) {
  const items = subscription.items?.data ?? [];
  const totalCents = items.reduce((sum, item) => {
    const quantity = item.quantity ?? 1;
    const unitAmount = item.price?.unit_amount ?? 0;
    return sum + quantity * unitAmount;
  }, 0);

  return totalCents / 100;
}



async function upsertCustomer(
  customer: StripeCustomer,
  options?: { subscriptionStatus?: string | null; totalSpentDelta?: number }
) {
  const currentTotalDelta = options?.totalSpentDelta ?? 0;
  let totalSpent = 0;

  const { data: existingCustomer } = await supabaseAdmin
    .from("stripe_customers")
    .select("total_spent")
    .eq("stripe_customer_id", customer.id)
    .maybeSingle();

  const existingTotal = Number(existingCustomer?.total_spent ?? 0);
  totalSpent = Math.max(0, existingTotal + currentTotalDelta);

  const { error } = await supabaseAdmin
    .from("stripe_customers")
    .upsert(
      {
        stripe_customer_id: customer.id,
        email: customer.email?.trim().toLowerCase() || "unknown@stripe.local",
        name: customer.name ?? null,
        total_spent: totalSpent,
        subscription_status: options?.subscriptionStatus ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_customer_id" }
    );

  if (error) {
    throw new Error(`customer_upsert_failed: ${error.message}`);
  }
}

async function upsertSubscription(subscription: StripeSubscription) {
  const stripeCustomerId = getCustomerId(subscription.customer);
  if (!stripeCustomerId) {
    throw new Error("subscription_missing_customer");
  }

  const amountPerBillingCycle = computeSubscriptionAmount(subscription);

  const { error } = await supabaseAdmin
    .from("stripe_subscriptions")
    .upsert(
      {
        stripe_subscription_id: subscription.id,
        stripe_customer_id: stripeCustomerId,
        status: subscription.status,
        current_period_start: subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null,
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        amount_per_billing_cycle: amountPerBillingCycle,
        billing_cycle_anchor: subscription.billing_cycle_anchor
          ? new Date(subscription.billing_cycle_anchor * 1000).toISOString().slice(0, 10)
          : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" }
    );

  if (error) {
    throw new Error(`subscription_upsert_failed: ${error.message}`);
  }
}

async function recordTransaction(input: {
  stripeCustomerId: string;
  stripeChargeId?: string | null;
  stripeInvoiceId?: string | null;
  amount: number;
  currency?: string;
  type: "payment" | "refund";
  status: string;
  description?: string | null;
  createdAt: string;
  eventId: string;
}) {
  const { error } = await supabaseAdmin.from("stripe_transactions").upsert(
    {
      stripe_customer_id: input.stripeCustomerId,
      stripe_charge_id: input.stripeChargeId ?? null,
      stripe_invoice_id: input.stripeInvoiceId ?? null,
      amount: input.amount,
      currency: input.currency?.toLowerCase() || "usd",
      type: input.type,
      status: input.status,
      description: input.description ?? null,
      created_at: input.createdAt,
      stripe_event_id: input.eventId,
    },
    { onConflict: "stripe_event_id" }
  );

  if (error) {
    throw new Error(`transaction_upsert_failed: ${error.message}`);
  }
}

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.created":
      case "customer.updated": {
        const customer = event.data.object as StripeCustomer;
        if (customer.deleted) break;

        await upsertCustomer(customer);
        break;
      }

      case "customer.deleted": {
        const customer = event.data.object as StripeCustomer;
        const { error } = await supabaseAdmin
          .from("stripe_customers")
          .delete()
          .eq("stripe_customer_id", customer.id);

        if (error) {
          throw new Error(`customer_delete_failed: ${error.message}`);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as StripeSubscription;
        const stripeCustomerId = getCustomerId(subscription.customer);
        await upsertSubscription(subscription);

        try {
          if (stripeCustomerId) {
            const remoteCustomer = await stripe.customers.retrieve(stripeCustomerId);
            if (remoteCustomer && !remoteCustomer.deleted) {
              await upsertCustomer(remoteCustomer as StripeCustomer, {
                subscriptionStatus: subscription.status,
              });
            }
          }
        } catch {
          // Keep processing resilient even if this refresh call fails.
        }
        break;
      }

      case "charge.succeeded":
      case "charge.failed": {
        const charge = event.data.object as StripeCharge;
        const stripeCustomerId = getCustomerId(charge.customer);
        if (!stripeCustomerId) {
          console.warn("Stripe webhook: unable to resolve customer for charge", charge.id);
          break;
        }

        await recordTransaction({
          stripeCustomerId,
          stripeChargeId: charge.id,
          stripeInvoiceId: charge.invoice ?? null,
          amount: charge.amount / 100,
          currency: charge.currency,
          type: "payment",
          status: charge.status,
          description: charge.description || "Payment",
          createdAt: new Date(charge.created * 1000).toISOString(),
          eventId: event.id,
        });

        const expandedCustomer =
          charge.customer && typeof charge.customer === "object" ? charge.customer : null;

        const customerForUpdate: StripeCustomer = {
          id: stripeCustomerId,
          email: expandedCustomer?.email ?? charge.billing_details?.email ?? null,
          name: expandedCustomer?.name ?? charge.billing_details?.name ?? null,
        };

        await upsertCustomer(customerForUpdate, {
          totalSpentDelta: charge.paid && charge.status === "succeeded" ? charge.amount / 100 : 0,
        });
        break;
      }

      case "refund.created": {
        const refund = event.data.object as StripeRefund;
        if (!refund.charge) {
          break;
        }

        const charge = (await stripe.charges.retrieve(refund.charge, {
          expand: ["customer"],
        })) as StripeCharge;

        const stripeCustomerId = getCustomerId(charge.customer);
        if (!stripeCustomerId) {
          console.warn("Stripe webhook: unable to resolve customer for refund", refund.id);
          break;
        }

        await recordTransaction({
          stripeCustomerId,
          stripeChargeId: charge.id,
          stripeInvoiceId: charge.invoice ?? null,
          amount: refund.amount / 100,
          currency: refund.currency,
          type: "refund",
          status: refund.status || "succeeded",
          description: `Refund: ${refund.reason || "N/A"}`,
          createdAt: new Date(refund.created * 1000).toISOString(),
          eventId: event.id,
        });

        const expandedCustomer =
          charge.customer && typeof charge.customer === "object" ? charge.customer : null;

        const customerForUpdate: StripeCustomer = {
          id: stripeCustomerId,
          email: expandedCustomer?.email ?? charge.billing_details?.email ?? null,
          name: expandedCustomer?.name ?? charge.billing_details?.name ?? null,
        };

        await upsertCustomer(customerForUpdate, {
          totalSpentDelta: -(refund.amount / 100),
        });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as StripeCharge;
        const stripeCustomerId = getCustomerId(charge.customer);
        if (!stripeCustomerId) {
          console.warn("Stripe webhook: unable to resolve customer for charge.refunded", charge.id);
          break;
        }

        if (charge.amount_refunded && charge.amount_refunded > 0) {
          await recordTransaction({
            stripeCustomerId,
            stripeChargeId: charge.id,
            stripeInvoiceId: charge.invoice ?? null,
            amount: charge.amount_refunded / 100,
            currency: charge.currency,
            type: "refund",
            status: "succeeded",
            description: "Refund",
            createdAt: new Date(charge.created * 1000).toISOString(),
            eventId: event.id,
          });

          const expandedCustomer =
            charge.customer && typeof charge.customer === "object" ? charge.customer : null;

          const customerForUpdate: StripeCustomer = {
            id: stripeCustomerId,
            email: expandedCustomer?.email ?? charge.billing_details?.email ?? null,
            name: expandedCustomer?.name ?? charge.billing_details?.name ?? null,
          };

          await upsertCustomer(customerForUpdate, {
            totalSpentDelta: -(charge.amount_refunded / 100),
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as {
          id: string;
          customer: string | { id: string; email?: string | null; name?: string | null } | null;
          amount_paid?: number;
          currency?: string;
          subscription?: string;
          created: number;
          billing_details?: { email?: string; name?: string };
        };

        const stripeCustomerId = getCustomerId(invoice.customer);
        if (!stripeCustomerId) {
          console.warn("Stripe webhook: unable to resolve customer for invoice.paid", invoice.id);
          break;
        }

        if (invoice.amount_paid && invoice.amount_paid > 0) {
          await recordTransaction({
            stripeCustomerId,
            stripeInvoiceId: invoice.id,
            amount: invoice.amount_paid / 100,
            currency: invoice.currency,
            type: "payment",
            status: "succeeded",
            description: `Invoice: ${invoice.id}`,
            createdAt: new Date(invoice.created * 1000).toISOString(),
            eventId: event.id,
          });

          const expandedInvoiceCustomer =
            invoice.customer && typeof invoice.customer === "object" ? invoice.customer : null;

          const customerForUpdate: StripeCustomer = {
            id: stripeCustomerId,
            email: expandedInvoiceCustomer?.email ?? invoice.billing_details?.email ?? null,
            name: expandedInvoiceCustomer?.name ?? invoice.billing_details?.name ?? null,
          };

          await upsertCustomer(customerForUpdate, {
            totalSpentDelta: invoice.amount_paid / 100,
          });
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as {
          id: string;
          customer?: string | { id: string } | null;
          subscription?: string;
        };

        const stripeCustomerId = getCustomerId(session.customer);
        if (!stripeCustomerId) {
          break;
        }

        if (session.subscription) {
          try {
            const remoteSubscription = await stripe.subscriptions.retrieve(session.subscription);
            await upsertSubscription(remoteSubscription as StripeSubscription);
          } catch {
            // Keep processing resilient even if subscription retrieval fails.
          }
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
