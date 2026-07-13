-- Stripe has been retired. Remove all webhook caches and Stripe identifiers
-- from the deployed database, including the historical payment data.
drop table if exists public.stripe_webhook_events;
drop table if exists public.stripe_transactions;
drop table if exists public.stripe_subscriptions;
drop table if exists public.stripe_customers;
