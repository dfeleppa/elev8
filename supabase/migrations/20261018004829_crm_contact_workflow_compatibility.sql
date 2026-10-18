-- Preserve the revision API's protected identity/creation metadata while allowing
-- the separate workflow API to change assignment. Safe after either migration order.
revoke update on public.crm_contacts from public, anon, authenticated, service_role;
grant update (full_name, email, phone, source, updated_by, owner_id) on public.crm_contacts to service_role;
