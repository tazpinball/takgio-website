-- ============================================================
-- Takgio AI news: database setup  (STAGED -- run once in the Supabase SQL editor)
-- Safe to re-run: every object uses IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS, and the seed skips rows that exist.
-- Depends on docs/careers-schema.sql (careers_editors, careers_is_editor(), careers_is_admin(), careers_touch(), careers_audit()).
--
-- Design (Ted, Oct 19, 2026: "a weekly recap - each week - of all the news we are monitoring", with a history):
--   * One row per week (Monday start) with a one-sentence summary; stories belong to a week.
--   * A week is a draft until an editor publishes it; the public sees published weeks only, through ai_news_public.
--   * The same people who manage Careers (careers_editors) manage AI news, with a two-step-verified session (aal2).
--   * Editors add, edit, publish and delete stories; only admins delete a whole week.
--   * Every change is written to audit_log by trigger, like jobs.
-- ============================================================

create table if not exists public.ai_news_weeks (
  week_start   date primary key check (extract(isodow from week_start) = 1),
  brief        text not null,
  status       text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by   uuid default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.ai_news_items (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),
  week_start   date not null references public.ai_news_weeks(week_start) on update cascade on delete cascade,
  topic        text not null check (topic in ('Claude', 'Smart glasses', 'Models', 'Voice', 'App stores', 'Industry')),
  source       text not null,
  source_url   text not null check (source_url ~ '^https://'),
  source_date  date not null,
  headline     text not null,
  summary      text not null,
  why          text not null,
  ticker       text,              -- a short line for the home-page ticker; null = not in the ticker
  created_by   uuid default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists ai_news_items_week_idx on public.ai_news_items (week_start, source_date desc);

drop trigger if exists ai_news_weeks_touch on public.ai_news_weeks;
create trigger ai_news_weeks_touch before update on public.ai_news_weeks for each row execute function public.careers_touch();
drop trigger if exists ai_news_items_touch on public.ai_news_items;
create trigger ai_news_items_touch before update on public.ai_news_items for each row execute function public.careers_touch();
drop trigger if exists ai_news_weeks_audit on public.ai_news_weeks;
create trigger ai_news_weeks_audit after insert or update or delete on public.ai_news_weeks for each row execute function public.careers_audit();
drop trigger if exists ai_news_items_audit on public.ai_news_items;
create trigger ai_news_items_audit after insert or update or delete on public.ai_news_items for each row execute function public.careers_audit();

-- the public face: stories in published weeks only, no private columns
create or replace view public.ai_news_public as
  select i.slug, i.week_start, w.brief, i.topic, i.source, i.source_url, i.source_date, i.headline, i.summary, i.why, i.ticker
  from public.ai_news_items i join public.ai_news_weeks w on w.week_start = i.week_start
  where w.status = 'published';

alter table public.ai_news_weeks enable row level security;
alter table public.ai_news_items enable row level security;

do $$ declare t text; begin
  foreach t in array array['ai_news_weeks', 'ai_news_items'] loop
    execute format('drop policy if exists "editors read" on public.%I', t);
    execute format('create policy "editors read" on public.%I for select to authenticated using (public.careers_is_editor())', t);
    execute format('drop policy if exists "editors add" on public.%I', t);
    execute format('create policy "editors add" on public.%I for insert to authenticated with check (public.careers_is_editor())', t);
    execute format('drop policy if exists "editors change" on public.%I', t);
    execute format('create policy "editors change" on public.%I for update to authenticated using (public.careers_is_editor()) with check (public.careers_is_editor())', t);
    execute format('drop policy if exists "editors delete" on public.%I', t);
    -- editors may delete a story; deleting a whole week (and its stories) is for admins
    execute format('create policy "editors delete" on public.%I for delete to authenticated using (%s)', t,
                   case when t = 'ai_news_weeks' then 'public.careers_is_admin()' else 'public.careers_is_editor()' end);
    execute format('drop policy if exists "require two-step" on public.%I', t);
    execute format('create policy "require two-step" on public.%I as restrictive to authenticated using ((select auth.jwt()->>''aal'') = ''aal2'')', t);
  end loop;
end $$;

revoke all on public.ai_news_weeks, public.ai_news_items from anon;
grant select, insert, update, delete on public.ai_news_weeks, public.ai_news_items to authenticated;
grant select on public.ai_news_public to anon, authenticated;

-- ---------- seed: the first five weeks (Sept 14 to Oct 18, 2026), each story checked on its primary source Oct 19, 2026 ----------
insert into public.ai_news_weeks (week_start, brief, status, published_at) values
  ('2026-10-12', 'Google released a new frontier model, and Apple spelled out what it now expects from apps that generate content with AI.', 'published', now()),
  ('2026-10-05', 'Anthropic launched a much cheaper small model and published its 2026 usage policy, and OpenAI put GPT-6 in front of every ChatGPT user.', 'published', now()),
  ('2026-09-28', 'ElevenLabs shipped a new speech model, and OpenAI''s developer day added an agents API and a way to build apps inside ChatGPT.', 'published', now()),
  ('2026-09-21', 'Anthropic released Claude Opus 5.5, and at Connect, Meta opened Ray-Ban Display wider to developers and to more countries.', 'published', now()),
  ('2026-09-14', 'Autodesk previewed agentic AI across its industry clouds, and a federal appeals court proposed a human-review rule for AI-drafted filings.', 'published', now())
on conflict (week_start) do nothing;

insert into public.ai_news_items (slug, week_start, topic, source, source_url, source_date, headline, summary, why, ticker) values
  ('apple-review-guidelines-oct-2026', '2026-10-12', 'App stores', 'Apple Developer', 'https://developer.apple.com/news/', '2026-10-16', 'Updated App Review Guidelines are now available', 'Apple''s guideline 1.2 now spells out that content-moderation duties cover AI content creation apps, and new rules 2.5.19 and 2.3.14 address hidden features and unverifiable claims in creative assets.', 'Every app we ship goes through App Review, and apps that generate content from people''s photos now carry explicit moderation duties.', 'Apple updates its App Review Guidelines for AI content apps'),
  ('gemini-4-argon', '2026-10-12', 'Models', 'Google', 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-argon/', '2026-10-13', 'Gemini 4 Argon: Built to solve your hardest problems', 'Google''s new frontier model is available through the Gemini API, Antigravity, the Gemini app and AI Mode, at an introductory $2 per million input tokens and $10 per million output tokens.', 'We pick the right model for each job, so a strong new model at that price is one we will test against our own workloads.', null),
  ('anthropic-usage-policy-2026', '2026-10-05', 'Claude', 'Anthropic', 'https://www.anthropic.com/news/2026-usage-policy-update', '2026-10-08', '2026 Usage Policy update', 'Anthropic''s annual Usage Policy revision takes effect November 12, adding a section on deceptive campaigns, restating the high-risk use-case rules more directly, and setting requirements for Claude controlling hardware.', 'We build on Claude, and products in legal and financial settings follow these rules on human review.', null),
  ('claude-haiku-5-5', '2026-10-05', 'Claude', 'Anthropic', 'https://www.anthropic.com/news/claude-haiku-5-5', '2026-10-07', 'Introducing Claude Haiku 5.5', 'Anthropic''s new small model costs, on average, around 75% less to run than Haiku 4.5; the same announcement lowers Sonnet 5.5 cache-read prices and adds monthly API credits for Max and Team plans.', 'Fast, low-cost calls make AI features practical at app scale, where every request counts.', 'Anthropic launches Claude Haiku 5.5'),
  ('gpt-6-intelligent-ui', '2026-10-05', 'Models', 'OpenAI', 'https://openai.com/index/gpt-6-for-everyone/', '2026-10-07', 'GPT-6 and Intelligent UI for everyone', 'GPT-6 in ChatGPT can answer with interactive components; it reached paid tiers on launch day and Free and Go tiers from the next day.', 'People will expect AI products to answer with interfaces, not just text. That raises the bar for every app.', null),
  ('openai-devday-2026', '2026-09-28', 'Models', 'OpenAI', 'https://openai.com/index/devday-2026-recap/', '2026-09-29', 'DevDay 2026 Recap', 'OpenAI lists more than 20 announcements, including the GPT-6.1 Sol model, an Agents API with computer use, and plugin extensions for building experiences inside ChatGPT.', 'Chat assistants are becoming a place to distribute apps, a new route to customers alongside the app stores.', null),
  ('eleven-v4', '2026-09-28', 'Voice', 'ElevenLabs', 'https://elevenlabs.io/blog/eleven-v4', '2026-09-28', 'Introducing Eleven v4, our most emotive model', 'ElevenLabs launched the Eleven v4 text-to-speech model and a faster Eleven v4 Turbo, both supporting more than 90 languages, with Turbo''s median latency around 100 ms.', 'Voice is part of how people use our products, and better speech models change what an app can sound like.', null),
  ('meta-wearables-toolkit-1', '2026-09-21', 'Smart glasses', 'Meta for Developers', 'https://developers.meta.com/blog/meta-connect-recap-ai-glasses/', '2026-09-24', 'Meta Connect Recap: How To Build For AI Glasses And Reach an Audience', 'Meta released Wearables Device Access Toolkit 1.0 after a year in developer preview, expanded web apps on Ray-Ban Display, added a UI Toolkit with a browser simulator, and announced discovery surfaces coming soon.', 'We are building our first apps for Meta Ray-Ban Display, so a stable toolkit and a way to reach users matter directly.', 'Meta releases Wearables Device Access Toolkit 1.0'),
  ('meta-ray-ban-display-features', '2026-09-21', 'Smart glasses', 'Meta', 'https://about.fb.com/news/2026/09/new-features-for-meta-ray-ban-display-navigation-hologram/', '2026-09-23', 'New Features for Meta Ray-Ban Display', 'At Connect, Meta announced cycling and transit navigation, voice-driven Hologram for WhatsApp calls and an on-glasses Explore app, and expanded sales to Canada and the UK, with France, Italy and Germany to follow.', 'More countries and an app-discovery surface on the glasses mean a bigger audience for Display apps.', null),
  ('claude-opus-5-5', '2026-09-21', 'Claude', 'Anthropic', 'https://www.anthropic.com/news/claude-opus-5-5', '2026-09-22', 'Introducing Claude Opus 5.5', 'Anthropic''s new Opus model is priced at $4 per million input tokens and $20 per million output tokens, which the announcement says is 20% less than Opus 5.', 'We build with Claude every day, and more capability per dollar reaches every product we work on.', null),
  ('tenth-circuit-ai-rule', '2026-09-14', 'Industry', 'U.S. Court of Appeals, Tenth Circuit', 'https://www.ca10.uscourts.gov/clerk/news/public-comment-period-open-revisions-2027-tenth-circuit-rules', '2026-09-18', 'Public Comment Period Open for Revisions to the 2027 Tenth Circuit Rules', 'A proposed change to Rule 46.5 would have filers certify that a person has checked any document prepared with generative AI, including cited authorities, quotations and legal analysis. The revised rules are to take effect January 1, 2027.', 'Courts are writing human review of AI work into their rules, which is how we build legal tools: a person checks the output.', null),
  ('autodesk-agentic-ai', '2026-09-14', 'Industry', 'Autodesk', 'https://adsknews.autodesk.com/en/pressrelease/autodesk-advances-agentic-ai-in-its-three-industry-clouds/', '2026-09-15', 'Autodesk Advances Agentic AI in Its Three Industry Clouds', 'At Autodesk University 2026, Autodesk previewed a next-generation, agentic Autodesk Assistant across its Forma, Fusion and Flow industry clouds, with availability to be announced in 2027.', 'The largest construction software vendor is moving AI into project work, the same ground ConcreteIQ works in for concrete contractors.', null)
on conflict (slug) do nothing;
