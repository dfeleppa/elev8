alter table app_users
  add column if not exists coaching_payrate numeric(10,2),
  add column if not exists office_payrate   numeric(10,2);
