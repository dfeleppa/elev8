-- Stripe webhook idempotency log.
--
-- The existing stripe_transactions(stripe_event_id) unique index protects the
-- transaction row from being inserted twice, but not the side-effects (e.g.
-- the read-modify-write of stripe_customers.total_spent). Duplicate webhook
-- deliveries — Stripe retries on any non-2xx and on slow responses — were
-- therefore double-counting revenue.
--
-- This table acts as a global idempotency log: the webhook handler INSERTs
-- here at the top, and bails out on the unique-violation path.
create table if not exists stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);
