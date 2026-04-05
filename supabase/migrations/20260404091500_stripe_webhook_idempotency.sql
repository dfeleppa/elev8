alter table if exists stripe_transactions
  add column if not exists stripe_event_id text;

create unique index if not exists stripe_transactions_event_id_uidx
  on stripe_transactions(stripe_event_id)
  where stripe_event_id is not null;
