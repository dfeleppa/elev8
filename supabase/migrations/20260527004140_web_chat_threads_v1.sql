create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_threads_slug_check check (slug ~ '^[a-z0-9-]+$')
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  author_user_id uuid not null references public.app_users(id) on delete cascade,
  body text not null default '',
  image_url text,
  image_storage_path text,
  deleted_at timestamptz,
  deleted_by_user_id uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_messages_content_check check (
    length(trim(body)) > 0 or image_url is not null
  )
);

create index if not exists chat_threads_sort_order_idx
  on public.chat_threads (sort_order);

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages (thread_id, created_at desc);

create index if not exists chat_messages_author_idx
  on public.chat_messages (author_user_id, created_at desc);

insert into public.chat_threads (slug, name, description, sort_order)
values
  ('main', 'Main', 'General gym announcements, questions, and daily conversation.', 10),
  ('nutrition', 'Nutrition', 'Food, macros, meal ideas, and nutrition coaching discussion.', 20),
  ('competition', 'Competition', 'Competition prep, events, strategy, and leaderboard talk.', 30)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into storage.buckets (id, name, public)
select 'chat-uploads', 'chat-uploads', true
where not exists (select 1 from storage.buckets where id = 'chat-uploads');

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists chat_threads_authenticated_read on public.chat_threads;
create policy chat_threads_authenticated_read
  on public.chat_threads
  for select to authenticated
  using (true);

drop policy if exists chat_messages_authenticated_read on public.chat_messages;
create policy chat_messages_authenticated_read
  on public.chat_messages
  for select to authenticated
  using (deleted_at is null);

drop policy if exists chat_messages_authenticated_insert on public.chat_messages;
create policy chat_messages_authenticated_insert
  on public.chat_messages
  for insert to authenticated
  with check (
    author_user_id = public.mobile_app_user_id()
    and deleted_at is null
    and deleted_by_user_id is null
  );

grant select on public.chat_threads to authenticated, service_role;
grant select, insert on public.chat_messages to authenticated, service_role;
