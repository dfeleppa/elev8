-- Read only. Contains contact details: keep output in private operator notes.
-- Passwords, password hashes, tokens and provider secrets are never selected.
-- An email match is a review candidate, never authorization to create a link.
select a.id as app_user_id, a.full_name, a.email as contact_email, a.role,
       a.supabase_auth_uid, u.email as auth_email,
       nullif(a.password_hash, '') is not null as has_legacy_password,
       u.email_confirmed_at is not null as auth_email_confirmed,
       nullif(u.encrypted_password, '') is not null as auth_has_password,
       u.banned_until,
       case when a.supabase_auth_uid is null then 'unlinked'
            when u.id is null then 'orphan_link'
            when nullif(u.encrypted_password, '') is null then 'needs_password'
            else 'linked_password_present_ownership_review_required' end as access_state,
       (select jsonb_agg(i.provider order by i.provider) from auth.identities i where i.user_id = u.id) as providers,
       (select jsonb_agg(jsonb_build_object('auth_uid', candidate.id, 'email_confirmed', candidate.email_confirmed_at is not null,
                                          'has_password', nullif(candidate.encrypted_password, '') is not null))
          from auth.users candidate
         where a.supabase_auth_uid is null and lower(candidate.email) = lower(a.email)) as same_email_review_candidates
  from public.app_users a
  left join auth.users u on u.id = a.supabase_auth_uid
 order by a.role, a.full_name, a.id;
