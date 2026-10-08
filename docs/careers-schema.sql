-- ============================================================
-- takgio Careers: database setup  (STAGED -- NOT RUN)
-- Run in the Supabase SQL editor only after review. Safe to re-run: every object uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.
--
-- Design (see docs/mockups/careers/careers.html):
--   * Only people listed in careers_editors can read or change hiring data (roles: 'editor', 'admin').
--   * The dashboard's existing rules let ANY logged-in user do anything; none of these tables reuse them.
--   * Every rule on these tables also demands a two-step-verified session (aal2), per Supabase's MFA docs.
--   * The public sees published jobs through the jobs_public view only (no direct table access for anon).
--   * Applications are written by an Edge Function using the service role (bot check + email confirmation), never by anon directly.
--   * Resumes live in a private bucket; editors open them with short-lived signed links.
--   * audit_log is written only by triggers; nobody can update or delete an entry.
-- ============================================================

-- ---------- who is allowed ----------
create table if not exists public.careers_editors (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('editor', 'admin')),
  display_name text,
  created_at   timestamptz not null default now()
);

create or replace function public.careers_is_editor() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.careers_editors where user_id = auth.uid()) $$;

create or replace function public.careers_is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.careers_editors where user_id = auth.uid() and role = 'admin') $$;

-- ---------- jobs ----------
create table if not exists public.jobs (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  title          text not null,
  team           text,
  employment_type text not null check (employment_type in ('internship', 'full_time', 'part_time', 'contract')),
  schedule       text check (schedule in ('part_time', 'full_time')),
  openings       int  check (openings is null or openings > 0),
  start_date     date,
  end_date       date,
  location_type  text not null default 'remote' check (location_type in ('remote', 'onsite', 'hybrid')),
  applicant_country text not null default 'US',
  city           text,
  state          text,
  pay_min        numeric,
  pay_max        numeric,
  pay_unit       text check (pay_unit in ('hour', 'year')),
  show_pay       boolean not null default false,
  about          text,
  duties         text,
  qualifications text,
  skills         text[] not null default '{}',
  apply_open     date,
  apply_close    date,
  extra_question text,
  notify_email   text,
  status         text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  published_at   timestamptz,
  created_by     uuid default auth.uid() references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create or replace function public.careers_touch() returns trigger language plpgsql as
$$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs for each row execute function public.careers_touch();

-- the public face: published, still open, and no private columns (notify_email, created_by)
create or replace view public.jobs_public as
  select id, slug, title, team, employment_type, schedule, openings, start_date, end_date, location_type, applicant_country,
         city, state, case when show_pay then pay_min end as pay_min, case when show_pay then pay_max end as pay_max,
         case when show_pay then pay_unit end as pay_unit, about, duties, qualifications, skills, apply_open, apply_close,
         extra_question, published_at, updated_at
  from public.jobs
  where status = 'published' and (apply_close is null or apply_close >= current_date);

-- ---------- applications ----------
create table if not exists public.job_applications (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid references public.jobs(id) on delete set null,   -- null = general "send your resume"
  first_name      text not null,
  last_name       text not null,
  email           text not null,
  phone           text,
  state           text,
  link_url        text,
  resume_path     text,
  work_authorized boolean,
  exams           text,
  answer          text,
  consent_at      timestamptz not null default now(),
  confirm_token   uuid not null default gen_random_uuid(),
  email_confirmed_at timestamptz,
  status          text not null default 'new' check (status in ('new', 'reviewing', 'interview', 'not_a_fit', 'hired')),
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists job_applications_job_idx on public.job_applications (job_id, created_at desc);

-- ---------- audit log ----------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,
  actor_email text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  detail      jsonb
);

create or replace function public.careers_audit() returns trigger language plpgsql security definer set search_path = public as
$$
declare rec record; email text;
begin
  rec := case when tg_op = 'DELETE' then old else new end;
  select u.email into email from auth.users u where u.id = auth.uid();
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, detail)
  values (auth.uid(), email, lower(tg_op), tg_table_name, to_jsonb(rec)->>'id',
          jsonb_strip_nulls(jsonb_build_object('title', to_jsonb(rec)->>'title', 'status', to_jsonb(rec)->>'status')));
  return rec;
end $$;

drop trigger if exists jobs_audit on public.jobs;
create trigger jobs_audit after insert or update or delete on public.jobs for each row execute function public.careers_audit();
drop trigger if exists apps_audit on public.job_applications;
create trigger apps_audit after update or delete on public.job_applications for each row execute function public.careers_audit();

-- ---------- row-level security ----------
alter table public.careers_editors  enable row level security;
alter table public.jobs             enable row level security;
alter table public.job_applications enable row level security;
alter table public.audit_log        enable row level security;

-- people with careers access can see who else has it; only admins change it
drop policy if exists "editors read editors" on public.careers_editors;
create policy "editors read editors" on public.careers_editors for select to authenticated using (public.careers_is_editor());
drop policy if exists "admins manage editors" on public.careers_editors;
create policy "admins manage editors" on public.careers_editors for all to authenticated using (public.careers_is_admin()) with check (public.careers_is_admin());

-- jobs: editors read/create/change; admins delete. Anon has no policy, so no direct access.
drop policy if exists "editors read jobs" on public.jobs;
create policy "editors read jobs" on public.jobs for select to authenticated using (public.careers_is_editor());
drop policy if exists "editors add jobs" on public.jobs;
create policy "editors add jobs" on public.jobs for insert to authenticated with check (public.careers_is_editor());
drop policy if exists "editors change jobs" on public.jobs;
create policy "editors change jobs" on public.jobs for update to authenticated using (public.careers_is_editor()) with check (public.careers_is_editor());
drop policy if exists "admins delete jobs" on public.jobs;
create policy "admins delete jobs" on public.jobs for delete to authenticated using (public.careers_is_admin());

-- applications: editors read and update status/notes; admins delete. Inserts come from the Edge Function (service role).
drop policy if exists "editors read applications" on public.job_applications;
create policy "editors read applications" on public.job_applications for select to authenticated using (public.careers_is_editor());
drop policy if exists "editors update applications" on public.job_applications;
create policy "editors update applications" on public.job_applications for update to authenticated using (public.careers_is_editor()) with check (public.careers_is_editor());
drop policy if exists "admins delete applications" on public.job_applications;
create policy "admins delete applications" on public.job_applications for delete to authenticated using (public.careers_is_admin());

-- audit log: admins read; nobody updates or deletes (no such policies); rows arrive only through the trigger
drop policy if exists "admins read audit" on public.audit_log;
create policy "admins read audit" on public.audit_log for select to authenticated using (public.careers_is_admin());

-- every one of the rules above also needs a two-step-verified session (Supabase docs: auth.jwt()->>'aal' = 'aal2')
do $$ declare t text; begin
  foreach t in array array['careers_editors', 'jobs', 'job_applications', 'audit_log'] loop
    execute format('drop policy if exists "require two-step" on public.%I', t);
    execute format('create policy "require two-step" on public.%I as restrictive to authenticated using ((select auth.jwt()->>''aal'') = ''aal2'')', t);
  end loop;
end $$;

-- ---------- privileges: nothing for anon except the public view ----------
revoke all on public.careers_editors, public.jobs, public.job_applications, public.audit_log from anon;
grant select on public.jobs_public to anon, authenticated;
grant select, insert, update, delete on public.careers_editors, public.jobs, public.job_applications to authenticated;
grant select on public.audit_log to authenticated;

-- ---------- resumes: private bucket, editors read through signed links ----------
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false) on conflict (id) do nothing;
drop policy if exists "editors read resumes" on storage.objects;
create policy "editors read resumes" on storage.objects for select to authenticated using (bucket_id = 'resumes' and public.careers_is_editor());
-- added 2026-10-08: the admin's "Delete applicant" must remove the resume file as well as the row (admins only, two-step session).
-- Run these two statements on an existing project; a fresh install gets them with the rest of this file.
drop policy if exists "admins delete resumes" on storage.objects;
create policy "admins delete resumes" on storage.objects for delete to authenticated using (bucket_id = 'resumes' and public.careers_is_admin() and (select auth.jwt()->>'aal') = 'aal2');

-- ---------- the two people (run AFTER both have accepted their invitation, so they exist in auth.users) ----------
-- insert into public.careers_editors (user_id, role, display_name)
--   select id, 'admin',  'Ted Takvorian'    from auth.users where email = 'ted@takgio.com'     on conflict (user_id) do update set role = excluded.role;
-- insert into public.careers_editors (user_id, role, display_name)
--   select id, 'editor', 'Stephen Caggiano' from auth.users where email = 'stephen@takgio.com' on conflict (user_id) do update set role = excluded.role;
