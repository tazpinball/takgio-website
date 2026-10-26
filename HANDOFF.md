# HANDOFF — TAKGIO website (takgio.com)

> **This file is the current state only.** It is loaded at every session start (CLAUDE.md imports it). Rewrite it in
> place at the end of each session; do not append a per-session log. The release history lives in `version.json`
> (`releases`, newest first) and in `git log`.

*Started 2026-10-26 (it did not exist before this date). Built from `version.json`, `git log` and the repo itself.
Supabase was not looked at from here, so nothing in this file says what is installed or running there.*

## Where the next session starts

```
LIVE     v2.53.2 (26 Oct): the internal files blocked from the site, this file committed. Ted confirmed
         takgio.com/CLAUDE.md now lands on the home page. v2.53.3 (CLAUDE.md and README.md brought up to date) goes
         through a PR. Vercel deploys master on push.
GIT      master = the deployed site. Cloud sessions work on a claude/* branch and open a draft PR into master;
         merging the PR is what deploys.
DEMOS    The Demos link check passes: 32 pages / 33 links / 0 wrong href (26 Oct).
NEXT     Nothing in progress after v2.53.3. Ted chooses the next piece of work.
```

## What the site is

- **Public marketing site**: 44 HTML pages in the project root. 13 of them are `noindex`: the admin and dashboard
  pages, `ai-news-pull`, `application-confirm`, and the unlisted Hoof Harted download and marketing pages. 30 URLs
  are in `sitemap.xml`.
- **Positioning (Oct 21–22):** Takgio is a **product company**, not a project-for-hire shop (v2.44.0). The headline
  is "We turn human expertise into AI products." (v2.46.0), and the line under it is "We pair human experts with AI"
  (v2.48.1). There are six products: ConcreteIQ, Brickture, Hoof Harted, True Record, Ann Elise and Pinball-QR, with
  Meta Ray-Ban Display shown as "Coming soon".
- **Home hero (v2.49.0):** a three-panel graphic (`js/hero-xform.js`) and four differentiator tiles: *A real expert
  first*, *In their own words* (1,400+ statements for ConcreteIQ), *Tested on real work*, and *$144,219*. The old
  stats are gone everywhere (products shipped, commits, ratings); About and Contact use the same four tiles
  (v2.49.1).
- **Admin (v2.51.0+):** one front door at `/admin`, with `/admin/careers`, `/admin/news` and `/admin/team`. All of
  them share `js/admin-core.js`, which handles sign-in with a two-step code. `/admin/team` shows each member's email
  through the `admin_team()` database function (`docs/admin-team-emails.sql`). If that function is missing, the page
  falls back and says so.
- **Careers:** `/careers` and `/careers/:slug` (`job.html`), with the Supabase functions `careers-apply` and
  `careers-confirm`.
- **News:** `/news`, `/ai-news` and `/news/true-record-launch`. AI news updates itself daily (v2.50.0):
  - The Supabase function `ai-news-daily` runs from pg_cron, reads official sources, writes fact-checked stories and
    sends a daily email.
  - That email's "Pull this story" link goes to `ai-news-pull.html` (function `ai-news-pull`).
  - OpenAI is not read directly (v2.50.1).
- **Internal project dashboard:** `login.html`, `dashboard.html`, `tasks.html`, `project.html` and `ideas.html`, plus
  the `generate-project-update` function.
- **Routing:** `vercel.json` holds the rewrites for the clean URLs above, plus `/hoof` and `/marketing/hoof-harted`.
  `/services` permanently redirects to `/industries.html`.

## Recent work (Oct 21–23)

| Version | What |
|---|---|
| 2.53.1 | ConcreteIQ customer story: the bid dollar totals removed |
| 2.53.0 | ConcreteIQ customer story page, linked from Case Studies and in the sitemap |
| 2.52.0 | Team & access shows each member's email; the top bar shows the signed-in email |
| 2.51.0 | One admin front door at `/admin` |
| 2.50.0–2.50.1 | AI news updates itself daily, with a one-click pull |
| 2.49.0–2.49.1 | Home hero graphic and differentiators; header simplified |
| 2.44.0–2.48.1 | Product-company repositioning and the new headline and brand line |

Full notes for each release are in `version.json`.

## Open / not verified

- **Internal files were public on takgio.com until v2.53.2** (fixed and checked live, 26 Oct). Vercel serves the repo as static files, so `CLAUDE.md`
  (Ted confirmed it loads, 26 Oct), `README.md`, `docs/*.sql` and the Supabase function source were readable at their
  own URLs. v2.53.2 keeps them off the site two ways: `.vercelignore` leaves them out of the deployment, and
  `vercel.json` redirects their paths to the home page. Nothing secret is in them (only the public anon key is in
  code). HANDOFF.md had been kept out of git for this reason (`.gitignore`, 28 Sep); it is committed from v2.53.2.
  🔴 **Any new internal file or folder goes into BOTH `.vercelignore` and the redirects in `vercel.json`.**

- **The Supabase side of v2.50–2.52 has not been checked from this repo.** `docs/news-daily-schema.sql` (the schedule,
  the job's tables and a Vault secret) and `docs/admin-team-emails.sql` have to be run in the Supabase SQL editor, and
  the functions have to be deployed to Supabase. Pushing to git deploys neither. Whether either has happened is not
  recorded. Ask Ted, or check in the Supabase dashboard.

## Rules that bind every change (from CLAUDE.md)

- **Every change bumps `version.json`**: the top-level `version` and `date`, plus a new entry at the top of
  `releases`. Patch for a fix, minor for a feature.
- **The Demos link is fixed at `https://demos.takgio.com`.** Run the check in CLAUDE.md before every commit; it must
  print 32 / 33 / 0, or the counts updated on purpose.
- **A new public page** goes into the header and footer nav of the other public pages and into `sitemap.xml`.
- **`js/supabase-config.js` loads before `auth.js`.** Only the public anon key goes in code.

## Commands

- Serve locally: `npx http-server . -p 8080 -c-1` (launch config `takgio-site`).
- News function test: `deno run -A supabase/functions/_tests/news-harness.ts "<absolute project root>"`.
- Careers function test: `deno run -A supabase/functions/_tests/careers-harness.ts "<absolute project root>"`.
  Both tests run the real function code offline and should report 0 failed.
