-- ============================================================
-- Takgio AI news: the DAILY automatic update  (STAGED -- run once in the Supabase SQL editor, AFTER docs/news-schema.sql)
-- Safe to re-run: IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS throughout.
--
-- Design (Ted, Oct 22, 2026: "Publish automatically every day, with the safety checks and a daily email so I can pull a story"):
--   * The edge function ai-news-daily runs once a day (pg_cron, section 4). It reads a fixed list of official sources, keeps
--     only posts it has never seen, writes each story from the article's own text, checks every claim against that text,
--     and adds the stories that pass to the current week, which it publishes.
--   * Each automatic story carries a secret pull_token. The daily email links to /ai-news-pull.html#t=<token>; that page
--     calls the function ai-news-pull, which hides the story (hidden = true). Hidden stories leave the public view at once.
--     Editors can see and restore pulled stories in the admin.
--   * Nothing here weakens the existing rules: the public still reads only ai_news_public; the job writes with the
--     service-role key, server-side only.
-- ============================================================

-- ---------- 1. stories: where they came from, and whether they were pulled ----------
alter table public.ai_news_items add column if not exists origin     text not null default 'editor' check (origin in ('editor', 'auto'));
alter table public.ai_news_items add column if not exists hidden     boolean not null default false;
alter table public.ai_news_items add column if not exists pull_token uuid unique default gen_random_uuid();

-- weeks the job created: it may rewrite their one-sentence summary as stories arrive; it never touches an editor's summary
alter table public.ai_news_weeks add column if not exists brief_auto boolean not null default false;

-- the public face: published weeks, stories that have not been pulled
create or replace view public.ai_news_public as
  select i.slug, i.week_start, w.brief, i.topic, i.source, i.source_url, i.source_date, i.headline, i.summary, i.why, i.ticker
  from public.ai_news_items i join public.ai_news_weeks w on w.week_start = i.week_start
  where w.status = 'published' and not i.hidden;
grant select on public.ai_news_public to anon, authenticated;

-- ---------- 2. what the job has already looked at, and what it did each day ----------
create table if not exists public.ai_news_seen (
  url       text primary key,
  source    text not null,
  title     text,
  seen_at   timestamptz not null default now(),
  decision  text not null check (decision in ('added', 'not relevant', 'failed check', 'too little text', 'too old', 'error')),
  reason    text
);
create table if not exists public.ai_news_runs (
  id        bigint generated always as identity primary key,
  ran_at    timestamptz not null default now(),
  checked   int not null default 0,   -- new posts looked at
  added     int not null default 0,
  report    jsonb                     -- per-source counts and any source that could not be read
);
alter table public.ai_news_seen enable row level security;
alter table public.ai_news_runs enable row level security;
-- editors may read both (the admin can show the job's history); only the service-role job writes
drop policy if exists "editors read seen" on public.ai_news_seen;
create policy "editors read seen" on public.ai_news_seen for select to authenticated using (public.careers_is_editor());
drop policy if exists "editors read runs" on public.ai_news_runs;
create policy "editors read runs" on public.ai_news_runs for select to authenticated using (public.careers_is_editor());
revoke all on public.ai_news_seen, public.ai_news_runs from anon;
grant select on public.ai_news_seen, public.ai_news_runs to authenticated;

-- ---------- 3. the activity log names the job instead of "Someone" ----------
create or replace function public.careers_audit() returns trigger language plpgsql security definer set search_path = public as
$$
declare rec record; email text;
begin
  rec := case when tg_op = 'DELETE' then old else new end;
  select u.email into email from auth.users u where u.id = auth.uid();
  if email is null and auth.role() = 'service_role' then email := 'Daily AI news job'; end if;
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, detail)
  values (auth.uid(), email, lower(tg_op), tg_table_name, to_jsonb(rec)->>'id',
          jsonb_strip_nulls(jsonb_build_object('title', to_jsonb(rec)->>'title', 'status', to_jsonb(rec)->>'status')));
  return rec;
end $$;

-- ---------- 4. the daily schedule ----------
-- Needs the pg_cron and pg_net extensions. The scheduler proves itself with a secret that the database makes here and keeps
-- in Supabase Vault (encrypted); nobody ever sees or types it. The function asks the database whether a caller's secret
-- matches (ai_news_cron_ok below), so the secret is not stored anywhere else.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'ai_news_cron_secret')
  where not exists (select 1 from vault.secrets where name = 'ai_news_cron_secret');

create or replace function public.ai_news_cron_ok(s text) returns boolean language sql stable security definer set search_path = public, vault as
$$ select exists (select 1 from vault.decrypted_secrets where name = 'ai_news_cron_secret' and decrypted_secret = s) $$;
revoke all on function public.ai_news_cron_ok(text) from public, anon, authenticated;
grant execute on function public.ai_news_cron_ok(text) to service_role;

-- every day at 11:00 UTC (7 am New York in summer, 6 am in winter)
select cron.unschedule('ai-news-daily') where exists (select 1 from cron.job where jobname = 'ai-news-daily');
select cron.schedule('ai-news-daily', '0 11 * * *', $job$
  select net.http_post(
    url     := 'https://pwmrbmjlgweahridxvgk.supabase.co/functions/v1/ai-news-daily',
    headers := jsonb_build_object('content-type', 'application/json',
               'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ai_news_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 300000);
$job$);

-- ---------- 5. a dry run (writes nothing, sends nothing): run this, wait a minute, then the second query shows the result ----------
-- select net.http_post(url := 'https://pwmrbmjlgweahridxvgk.supabase.co/functions/v1/ai-news-daily',
--   headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ai_news_cron_secret')),
--   body := '{"dry": true}'::jsonb, timeout_milliseconds := 300000);
-- select status_code, content::jsonb from net._http_response order by created desc limit 1;

-- ---------- 6. checks (read-only) ----------
-- select jobname, schedule, active from cron.job where jobname = 'ai-news-daily';
-- select * from public.ai_news_runs order by ran_at desc limit 5;
-- select status_code, created from net._http_response order by created desc limit 5;
