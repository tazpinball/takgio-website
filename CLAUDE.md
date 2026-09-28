# TAKGIO Website — Project Rules


## 🔴 Live state

**`HANDOFF.md` is the canonical record of where this project actually is** — what is done,
what is in flight, what is blocked. It is imported here, so it loads automatically every
session. Read it before proposing work, and rewrite it at the end of every session (the
`/handoff` skill does this). If it goes stale, sessions start forgetting again.

@HANDOFF.md

## 🔒 FIXED LINK: the Demos link is `https://demos.takgio.com`

Ted's demo site for client and investor meetings. **The link target is fixed: `href="https://demos.takgio.com"`,
character for character** (no trailing slash, no `www`, no `/demos` page, no redirect in between). It may
change **only when Ted explicitly says so**. How it looks and where it lives on the site may change freely, but every
Demos link must keep that exact href, and the site must never be left without one.

- Every Demos anchor carries the attribute `data-demos-link`. As of v2.29.0 there are 24: the top-level header item
  "Demos" on all 23 public pages (also in `docs\mockups\_generators\header_v228.html`, the header source the generators
  copy) plus the "Product demos" button in the `index.html` hero.
- Moving or restyling it: keep `data-demos-link` and the exact href on the new element, and update the counts here.
- **Before every commit**, run this check (from the project root). It must print 23 / 24 / 0, or the updated counts:

```
echo "pages: $(grep -l data-demos-link *.html | wc -l) (want 23)  links: $(grep -o data-demos-link *.html | wc -l) (want 24)  wrong href: $(grep -oh '<a [^>]*data-demos-link[^>]*>' *.html | grep -vc 'href="https://demos.takgio.com"') (want 0)"
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

Two surfaces live in one repo:

**Public marketing site** (indexed, linked from `sitemap.xml`):
- `index.html`, `about.html`, `services.html`, `products.html`, `contact.html`
- `case-studies.html` + `case-study-*.html` (5 case studies)
- `insights.html` + `insight-*.html`

**Internal project dashboard** (Supabase-auth-gated, `noindex,nofollow`):
- `login.html`, `dashboard.html`, `tasks.html`, `project.html`, `ideas.html`

**Shared assets & code:**
- `css/` — `styles.css` (site-wide), `dashboard.css` (dashboard only)
- `js/` — `supabase-config.js` (SUPABASE_URL / SUPABASE_ANON_KEY, load first), `auth.js` (login + session gating), `dashboard.js`, `my-tasks.js`, `project-detail.js`, `nav.js`, `hero.js`, `showcase.js`, `analytics.js`
- `images/` — graphics; `og-image.html` generates `og-image.png`
- `marketing/social/` — social assets
- `supabase/` — `config.toml` + `functions/generate-project-update/index.ts` (Deno/TS edge function that reads repo files from the GitHub API)
- `docs/` — `supabase-schema.sql`, `migrate-ideas.sql`, `strategy-project-dashboard.md`
- `version.json`, `robots.txt`, `sitemap.xml`

## Local Development

No build. Serve the static files from the project root, e.g.:

```
npx http-server . -p 8080 -c-1
```

`.claude/launch.json` defines two preview servers: `takgio-site` (port 8080) and `takgio-marketing` (port 8099).

## Deployment

- Push to `master` → Vercel auto-deploys within seconds. There is no `vercel.json`; Vercel serves the repo as static files.
- NOTE: `README.md` says push to `main`, but the actual deploy branch is `master`. Use `master`.

## Gotchas

- `js/supabase-config.js` must load before `auth.js` and any module that uses `window.sb`.
- Secrets live in `.env` (gitignored) and in Supabase edge-function config — never hardcode keys beyond the public anon key.
- Adding a public page? Also add it to the header/footer nav on the other public pages and to `sitemap.xml` (match the existing pattern in `version.json` release notes).
