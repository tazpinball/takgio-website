-- ============================================================
-- Takgio project dashboard: the pipeline board and the twice-weekly GitHub sync
-- (run once in the Supabase SQL editor, AFTER docs/supabase-schema.sql). Safe to re-run.
--
-- Ted, 11 Nov 2026: each project updates itself from its GitHub repos every Friday at 6 PM and every Monday at 1 PM
-- (New York time), and the sync moves a project's stage itself when the commits show it changed.
--   * The edge function project-sync (supabase/functions/project-sync) does the work; this file adds what it needs,
--     the five projects that were missing from the dashboard, the repo of each project, and the schedule.
--   * Deploy the function with:  supabase functions deploy project-sync --no-verify-jwt
--     Its secrets: GITHUB_TOKEN and ANTHROPIC_API_KEY (both already set for generate-project-update), plus
--     GITHUB_TOKEN_TAKGIO if GITHUB_TOKEN cannot read the takgio/* repos.
-- ============================================================

-- ---------- 1. what the sync keeps on each project ----------
alter table public.projects add column if not exists last_commit_at timestamptz;  -- newest commit seen in its repos
alter table public.projects add column if not exists last_synced_at timestamptz;  -- the sync looks for commits after this

-- ---------- 2. a record of each run (the dashboard shows the latest) ----------
create table if not exists public.project_sync_runs (
  id       bigint generated always as identity primary key,
  ran_at   timestamptz not null default now(),
  trigger  text not null check (trigger in ('schedule', 'manual')),
  checked  int not null default 0,   -- projects with a repo
  updated  int not null default 0,   -- projects that got an update
  moved    int not null default 0,   -- projects whose stage the sync changed
  report   jsonb
);
alter table public.project_sync_runs enable row level security;
drop policy if exists "signed-in users read sync runs" on public.project_sync_runs;
create policy "signed-in users read sync runs" on public.project_sync_runs for select to authenticated using (true);
revoke all on public.project_sync_runs from anon;
grant select on public.project_sync_runs to authenticated;

-- ---------- 3. the products on takgio.com that were not on the dashboard yet ----------
insert into public.projects (name, description, stage, category, industry, github_repo, created_by_name)
select v.name, v.description, v.stage, 'Product', v.industry, v.repo, 'Ted'
from (values
  ('Hoof Harted',          'Party game: find out who did it. On the Apple App Store and Google Play.',            'Live', 'Entertainment', 'takgio/hoof-harted'),
  ('True Record',          'Government documents, narrated. On the Apple App Store.',                             'Live', 'Legal',         'takgio/into-the-record'),
  ('Pinball-QR',           'Problem reporting for pinball and arcade venues. Web only.',                          'Live', 'Entertainment', 'takgio/pinball-qr'),
  ('Meta Ray-Ban Display', 'Apps for Meta Ray-Ban Display glasses. Upcoming on takgio.com.',                      'Idea', 'Wearables',     'takgio/ar-hud-hello-world'),
  ('myBuyersCoach',        'Home-buyer property due diligence; Orange County, Florida first, built with a licensed Florida Realtor. Upcoming on takgio.com.', 'Idea', 'Real Estate', 'takgio/buyercoach')
) as v(name, description, stage, industry, repo)
where not exists (select 1 from public.projects p where lower(p.name) = lower(v.name));

-- ---------- 4. each project's GitHub repo(s); a project may list several, separated by commas ----------
-- Only fills a project that has no repo yet, so a repo set by hand in the dashboard is kept.
update public.projects p set github_repo = v.repo
from (values
  ('Concrete Bid Generator',                  'tazpinball/ConcreteBidding'),
  ('Brickture',                               'tazpinball/brickture'),
  ('Takgio Website',                          'tazpinball/takgio-website'),
  ('Ann Elise AI Tutor',                      'tazpinball/ann-elise-poc, tazpinball/ann-elise-mobile'),
  ('Class Action Monitor',                    'tazpinball/class-action-monitor'),
  ('Pinball Tournament / Player Analysis',    'tazpinball/pinball-analysis'),
  ('Historical Voice Generator (Babe Ruth)',  'tazpinball/babe-ruth-ai'),
  ('Home Inspection Marketing Tool',          'tazpinball/house-inspection-marketing')
) as v(name, repo)
where lower(p.name) = lower(v.name) and coalesce(trim(p.github_repo), '') = '';

-- ---------- 5. the schedule: Friday 6 PM and Monday 1 PM, New York time ----------
-- pg_cron runs in UTC. New York is UTC-4 in summer and UTC-5 in winter, so each slot is scheduled at both UTC hours;
-- the function itself checks the New York time and skips the call that is an hour off.
--   Friday 6 PM New York = 22:00 UTC (summer) or 23:00 UTC (winter)
--   Monday 1 PM New York = 17:00 UTC (summer) or 18:00 UTC (winter)
create extension if not exists pg_cron;
create extension if not exists pg_net;
select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'project_sync_cron_secret')
  where not exists (select 1 from vault.secrets where name = 'project_sync_cron_secret');

create or replace function public.project_sync_cron_ok(s text) returns boolean language sql stable security definer set search_path = public, vault as
$$ select exists (select 1 from vault.decrypted_secrets where name = 'project_sync_cron_secret' and decrypted_secret = s) $$;
revoke all on function public.project_sync_cron_ok(text) from public, anon, authenticated;
grant execute on function public.project_sync_cron_ok(text) to service_role;

select cron.unschedule('project-sync-fri') where exists (select 1 from cron.job where jobname = 'project-sync-fri');
select cron.schedule('project-sync-fri', '0 22,23 * * 5', $job$
  select net.http_post(
    url     := 'https://pwmrbmjlgweahridxvgk.supabase.co/functions/v1/project-sync',
    headers := jsonb_build_object('content-type', 'application/json',
               'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'project_sync_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 300000);
$job$);
select cron.unschedule('project-sync-mon') where exists (select 1 from cron.job where jobname = 'project-sync-mon');
select cron.schedule('project-sync-mon', '0 17,18 * * 1', $job$
  select net.http_post(
    url     := 'https://pwmrbmjlgweahridxvgk.supabase.co/functions/v1/project-sync',
    headers := jsonb_build_object('content-type', 'application/json',
               'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'project_sync_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 300000);
$job$);

-- ---------- 6. checks (read-only) ----------
-- select name, stage, github_repo, last_commit_at, last_synced_at from public.projects order by name;
-- select jobname, schedule, active from cron.job where jobname like 'project-sync-%';
-- select ran_at, trigger, checked, updated, moved, report->'problems' from public.project_sync_runs order by ran_at desc limit 5;
