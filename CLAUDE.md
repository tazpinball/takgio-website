# TAKGIO Website — Project Rules


## 🔴 Live state

**`HANDOFF.md` is the canonical record of where this project actually is** — what is done,
what is in flight, what is blocked. It is imported here, so it loads automatically every
session. Read it before proposing work, and rewrite it at the end of every session (the
`/handoff` skill does this). If it goes stale, sessions start forgetting again.

@HANDOFF.md

## 🔴 Always give Ted the full URL or full path

Ted, 26 Oct: "you can state a name of the company all you want, but if you don't include where I should go, it's
totally meaningless." Every company, program, tool, page or file you name in a reply comes with where to go: a full
`https://` URL for anything on the web, and a full absolute path for a file. Say when a URL could not be confirmed.
A path inside the cloud session (`/tmp/...`, `/home/user/...`) is not on Ted's laptop: give him the file as a
download card instead.

## 🔴 Merge without asking

Ted, 28 Oct: "Merge without asking for everything." A cloud session still works on its `claude/*` branch and opens a
PR (merging the PR is what deploys, like a push to `master` from the laptop), but merges it itself once the change is
done and checked: the Demos check, `version.json` bumped, and anything visible rendered and looked at. For a change
Ted will see on the site, give him the PR's Vercel preview link (or the live URL) with the report. Never merge a PR
whose checks are red or that has a merge conflict.

## 🔒 FIXED LINK: the Demos link is `https://demos.takgio.com`

Ted's demo site for client and investor meetings. **The link target is fixed: `href="https://demos.takgio.com"`,
character for character** (no trailing slash, no `www`, no `/demos` page, no redirect in between). It may
change **only when Ted explicitly says so**. How it looks and where it lives on the site may change freely, but every
Demos link must keep that exact href, and the site must never be left without one.

- Every Demos anchor carries the attribute `data-demos-link`. As of v2.53.0 there are 33: the top-level header item
  "Demos" on all 32 pages that carry the header (the 29 public pages, including `pinball-qr.html`, the ConcreteIQ customer story `case-study-construction-concreteiq-customer-story.html`, `leadership.html`, the unlisted `hoof-harted-marketing.html`, the Careers pages `careers.html` and `job.html`, and the News pages `news.html`, `ai-news.html` and `news-true-record-launch.html`; also in `docs\mockups\_generators\header_v228.html`, the header source the generators
  copy), and the "Product demos" button in the investor block of
  `contact.html` (shown when the topic is Investing, i.e. `contact.html?topic=invest`, where every "Investors" link lands).
  The `index.html` hero's "Product demos" button was removed in v2.42.0 at Ted's request (Oct 18: the header already has Demos).
- Moving or restyling it: keep `data-demos-link` and the exact href on the new element, and update the counts here.
- **Before every commit**, run this check (from the project root). It must print 32 / 33 / 0, or the updated counts:

```
echo "pages: $(grep -l data-demos-link *.html | wc -l) (want 32)  links: $(grep -o data-demos-link *.html | wc -l) (want 33)  wrong href: $(grep -oh '<a [^>]*data-demos-link[^>]*>' *.html | grep -vc 'href="https://demos.takgio.com"') (want 0)"
```

## MANDATORY: Version Bump on Every Change

**THIS IS A HARD REQUIREMENT. NO EXCEPTIONS.**

Every time you modify ANY file in this project (HTML, CSS, JS, or config), you MUST:

1. **Bump the version** in `version.json` — increment the patch number (e.g. 1.0.0 → 1.0.1) for small fixes, minor number (e.g. 1.0.1 → 1.1.0) for features, major number for breaking changes.
2. **Add a release entry** to the `releases` array in `version.json` with the new version, today's date, a summary, and a list of changes.
3. **Do this BEFORE committing.** Never commit without updating version.json.

If you forget this, Ted will be upset. Do not skip it. Do not defer it. Do it every single time.

## Versioning Format

- `version.json` at the project root holds the top-level `version` + `date` and the full `releases` array (newest first). Keep the top-level `version`/`date` in sync with the newest release entry.
- Use semantic versioning: MAJOR.MINOR.PATCH.
- `js/dashboard.js` fetches `/version.json` (cache-busted) and renders the current version into the clickable `#version-badge` next to "TAKGIO" in the dashboard header.

## Tech Stack

- Vanilla HTML/CSS/JS — no frameworks, no build step, no `package.json`.
- Supabase (Auth, Postgres, RLS) via the Supabase JS SDK loaded from CDN.
- Chart.js (CDN) for dashboard data visualization.
- Hosted on Vercel, auto-deploys on push to the `master` branch (see Deployment).

## Project Structure

Everything sits in the project root as plain `.html` files; `vercel.json` gives some of them clean URLs.

**Public marketing site** (indexed; all in `sitemap.xml` except the per-job pages):
- `index.html`, `about.html`, `leadership.html`, `industries.html` (`/services` redirects here), `products.html`, `contact.html`
- Product pages: `concreteiq.html`, `brickture.html`, `hoof-harted.html`, `true-record.html`, `ann-elise.html`, `pinball-qr.html`, `meta-ray-ban-display.html`
- `case-studies.html` + `case-study-*.html` (9), `insights.html` + `insight-*.html` (2)
- Careers: `careers.html` (`/careers`), `job.html` (`/careers/:slug`). News: `news.html`, `ai-news.html`, `news-true-record-launch.html`

**Unlisted / internal** (`noindex`):
- Admin: `admin.html` (`/admin`), `careers-admin.html` (`/admin/careers`), `news-admin.html` (`/admin/news`), `team-admin.html` (`/admin/team`); shared sign-in in `js/admin-core.js`
- Project dashboard (Supabase-auth-gated): `login.html`, `dashboard.html`, `tasks.html`, `project.html`, `ideas.html`
- `ai-news-pull.html`, `application-confirm.html`, `hoof-harted-download.html` (`/hoof`), `hoof-harted-marketing.html` (`/marketing/hoof-harted`)

**Shared assets & code:**
- `css/` — `styles.css` (site-wide), `dashboard.css` (dashboard), `careers-admin.css` (admin pages)
- `js/` — `supabase-config.js` (SUPABASE_URL / SUPABASE_ANON_KEY, load first), `auth.js` (dashboard login), `admin-core.js` + the `*-admin.js` / `admin-hub.js` pages, `careers.js`, `news-feed.js`, `nav.js`, `motion.js`, `hero-reel.js`, `hero-models.js` (the two model lattices in the hero graphic), `showcase.js`, `analytics.js`, and the dashboard's `dashboard.js`, `my-tasks.js`, `project-detail.js`
- `images/` — graphics (`brand/`, `hero/`, `marketing/`, `news/`, `products/`, `reel/`, `team/`); `og-image.html` generates `og-image.png`
- `supabase/functions/` — Deno/TS edge functions: `careers-apply`, `careers-confirm`, `ai-news-daily`, `ai-news-pull`, `generate-project-update`; offline tests in `_tests/`. Deployed with the Supabase CLI, not by git.
- `docs/` — SQL to run in the Supabase SQL editor (`supabase-schema.sql`, `careers-schema.sql`, `news-schema.sql`, `news-daily-schema.sql`, `admin-team-emails.sql`, `migrate-ideas.sql`) and `strategy-project-dashboard.md`
- `version.json`, `robots.txt`, `sitemap.xml`, `vercel.json`, `.vercelignore`

## Local Development

No build. Serve the static files from the project root, e.g.:

```
npx http-server . -p 8080 -c-1
```

`.claude/launch.json` defines one preview server, `takgio-site` (port 8080). The local server ignores `vercel.json`, so clean URLs like `/careers` only work on Vercel; open the `.html` file locally.

## Deployment

- Push to `master` → Vercel auto-deploys within seconds. Vercel serves the repo as static files; `vercel.json` holds the clean-URL rewrites and redirects.
- 🔴 **Anything committed is public at its own URL unless it is blocked.** `CLAUDE.md`, `HANDOFF.md`, `README.md`, `docs/`, `supabase/` and `.claude/` are kept off the site twice: `.vercelignore` leaves them out of the deployment, and `vercel.json` redirects their paths to the home page (v2.53.2). **A new internal file or folder goes into both.**
- Cloud sessions push a `claude/*` branch and open a PR into `master`; Vercel builds a preview for each PR, and merging deploys.

## Gotchas

- `js/supabase-config.js` must load before `auth.js` and any module that uses `window.sb`.
- Secrets live in `.env` (gitignored) and in Supabase edge-function config — never hardcode keys beyond the public anon key.
- Adding a public page? Also add it to the header/footer nav on the other public pages and to `sitemap.xml` (match the existing pattern in `version.json` release notes).
