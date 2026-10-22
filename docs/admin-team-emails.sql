-- ============================================================
-- Takgio admin: each team member's sign-in email on the Team & access page (/admin/team).
-- Run in the Supabase SQL editor. Safe to re-run (OR REPLACE).
-- Depends on docs/careers-schema.sql (careers_editors, careers_is_admin()).
--
-- Design:
--   * Emails live in auth.users, which the browser cannot read. This function reads them on the database side and
--     answers ONLY an admin whose session is two-step verified (aal2); anyone else gets no rows.
--   * It returns the people in careers_editors and nothing else from auth.users (no other accounts, no other fields).
--   * Callable by signed-in users only (anon and public revoked); the check inside decides who gets rows.
-- ============================================================

create or replace function public.admin_team()
returns table (user_id uuid, email text, role text, display_name text, created_at timestamptz)
language sql stable security definer set search_path = public as
$$
  select e.user_id, u.email::text, e.role, e.display_name, e.created_at
  from public.careers_editors e
  join auth.users u on u.id = e.user_id
  where public.careers_is_admin()
    and coalesce(auth.jwt()->>'aal', '') = 'aal2'
  order by e.created_at
$$;

revoke all on function public.admin_team() from public, anon;
grant execute on function public.admin_team() to authenticated;
