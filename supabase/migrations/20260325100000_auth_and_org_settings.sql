-- Add password hash column to app_users for email/password auth
alter table app_users add column if not exists password_hash text;

-- Add organization settings columns
alter table organizations add column if not exists logo_url text;
alter table organizations add column if not exists address text;
alter table organizations add column if not exists phone text;
alter table organizations add column if not exists email text;
alter table organizations add column if not exists invitation_code text;

-- Unique index on invitation_code (partial — nulls are ignored)
create unique index if not exists organizations_invitation_code_key
  on organizations(invitation_code) where invitation_code is not null;
