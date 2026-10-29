# HANDOFF — TAKGIO website (takgio.com)

> **This file is the current state only.** It is loaded at every session start (CLAUDE.md imports it). Rewrite it in
> place at the end of each session; do not append a per-session log. The release history lives in `version.json`
> (`releases`, newest first) and in `git log`.

*Started 2026-10-26 (it did not exist before this date); last updated 2026-10-29, after v2.59.0 went live. Built from
`version.json`, `git log` and the repo itself.
The Supabase side was checked by Ted in the dashboard on 26 Oct (below). Since 28 Oct a cloud session CAN reach
takgio.com (Ted added it to the environment), so check the live site yourself with curl after a merge. It still
cannot reach Supabase or Vercel preview links (`*.vercel.app` answers 403 from the proxy): Ted looks at previews.*

## Where the next session starts

```
LIVE     v2.59.0 (29 Oct): the Brickture promo videos, version 3 (the giraffe at 0:34). Checked live by curl:
         version.json, both video files byte-for-byte, the Watch line. Vercel deploys master on push.
GIT      master = the deployed site. Cloud sessions work on a claude/* branch and open a PR into master;
         merging the PR is what deploys. Ted (28 Oct): merge without asking (CLAUDE.md, "Merge without asking").
DEMOS    The Demos link check passes: 32 pages / 33 links / 0 wrong href (26 Oct).
NEXT     Nothing open on the site. Offered, not asked for: the Brickture case study still says "about two minutes",
         and the Brickture Proof section keeps the July 20/20 test and the 16-build stability card (both dated).
         ConcreteIQ stays BETA until Ted says it is live; then the CPN story is redone (Open / not verified).
         Investor work (deck template, fundraising targets) is below.
SUPABASE Project pwmrbmjlgweahridxvgk: everything installed and running (checked 26 Oct, see Open / verified).
```

## What the site is

- **Public marketing site**: 44 HTML pages in the project root. 13 of them are `noindex`: the admin and dashboard
  pages, `ai-news-pull`, `application-confirm`, and the unlisted Hoof Harted download and marketing pages. 30 URLs
  are in `sitemap.xml`.
- **Positioning (Oct 21–22):** Takgio is a **product company**, not a project-for-hire shop (v2.44.0). The headline
  is "We turn human expertise into AI products." (v2.46.0), and the line under it is "We pair human experts with AI"
  (v2.48.1). There are six products: ConcreteIQ, Brickture, Hoof Harted, True Record, Ann Elise and Pinball-QR, with
  Meta Ray-Ban Display shown as "Coming soon".
- **Home hero graphic (v2.55.0):** "how a Takgio product is made" in three numbered steps, plain HTML and CSS (`.hx`
  in `index.html` and `css/styles.css`; `js/hero-models.js` draws only the two model pictures): 01 Human expertise (practising experts and what they know from:
  interviews, job records, drawings and specs, field know-how; "Decades of know-how", Ted) -> 02 Dual-model AI (the general-purpose LLM and the
  Takgio expert model, "work as a pair"; the expert model is the one highlighted card) -> 03 Takgio apps (ConcreteIQ,
  Brickture, myBuyersGuide; it is "myBuyersGuide", Ted 26 Oct). A 6 s CSS loop plays the story: interview waveform and
  one source lit -> pulse into the expert model (ripple, meter) -> pulses to the apps, which show what they do; every
  line also carries a steady stream of moving dots and has a port at each end (v2.55.1, Ted: show the data flowing). The
  pictures are turning lattices in the v2.48 graphic's style (`js/hero-models.js`; Ted: the icons looked generic), told
  apart by SHAPE (v2.55.4, Ted: the combined model must look like neither, yet clearly both): the LLM a round cool
  lattice; the Takgio expert model a gold four-pointed star (the Takgio spark), lit as the pulse arrives; each app card
  shows the COMBINED model instead of its app icon (v2.55.3): ~70% cool LLM lattice with a small gold star at its heart
  (v2.55.5, Ted's proportions; the expert star alone was also made 25% smaller). The "work as a pair" link has a hub
  at its centre; one short line runs from it to where the three app lines fan out (v2.55.6, Ted: start them centred,
  from the pair link; `alignFan()` in `js/hero-models.js` sets the fan's start to the hub's height). Ted
  asked for it to feel active and not like stock art. Phones stack the steps. It replaced the v2.48 canvas graphic
  (`js/hero-xform.js`, deleted; its two licensed pictures stay in `images/hero/`, unused).
- **Home hero copy (v2.49.0):** four differentiator tiles: *A real expert
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
- **Home ticker (v2.54.0):** every line is a link. 8 Takgio lines in `index.html` (each goes to the page that backs it:
  the announcement, `#how-it-works`, the ConcreteIQ customer story and product page, the Hoof Harted and True Record
  case studies, the Meta page, `#market`), plus the 5 newest AI news stories added by `js/news-feed.js`, labelled
  AI NEWS and linked to `/ai-news.html#<slug>`. A story's ticker line is used if it has one, else its headline cut at
  90 characters. The two "first commit" lines were reworded to "... days after work began" (Ted, 26 Oct).
- **Brickture page (`brickture.html`, v2.56.0-v2.59.0, 28-29 Oct):** the Brickture project sends updates as a
  handoff in a claude.ai artifact (https://claude.ai/artifact/A9DJ4o7yaMe26vxeVYSLh9: `handoff.md`, the finished
  `brickture.html`, the videos under `media/`). Read it with the Artifact tool; Ted wants the changed page shown before
  it goes live ("Do not publish it live until I say so").
  - Hero: the wide promo `videos/brickture-promo-16x9.mp4` (1920x1080, 50 s), muted, looping, with the browser's own
    controls (Ted, 28 Oct: like the vertical video) and a "Watch with sound" button under it (not over it: the
    video's burned-in captions move around the frame). Visitors with Reduce motion get the still with controls.
  - Watch section (`#watch`): the vertical promo `videos/brickture-promo-9x16.mp4` (720x1280, not 1080x1920 as the
    first handoff said) in a phone frame, with download buttons for both cuts. The video links carry `?v=3` (bump it
    when the files change; the names stay) so browsers that cached an old cut fetch the new one.
  - Version 3 (29 Oct): the giraffe ("Your favorite animal.", Ted's own photo) replaced Betsy at 0:34.
  - Pictures: the brick octopus and the brick cruise ship with the couple are stills cut from the video
    (`images/products/brickture-{octopus,cruise}.webp`, 800 wide; `images/reel/...` 480x640 for the home reel). The
    home Brickture tile and reel show them in place of the lion and the elephant; the Brickture gallery's elephant is
    the cruise ship.
  - Campaign kit (Ted approved all recommendations, 28 Oct): the 50-word description ends "Kit ordering in beta.
    Coming Thanksgiving 2026."; claims are the octopus build (4,224 pieces, 758 steps, 33 layers), Foundation and
    Ultimate, every model on its own brick base, kit ordering in beta, Coming Thanksgiving 2026. No prices, no cost
    estimate, no "about two minutes", no XS-L sizes anywhere on the page or the home tile (all retired with the old
    app). The "no people or pets" rule is gone from the Don't list (the video shows both).
- **Routing:** `vercel.json` holds the rewrites for the clean URLs above, plus `/hoof` and `/marketing/hoof-harted`.
  `/services` permanently redirects to `/industries.html`.

## Recent work (Oct 21–29)

| Version | What |
|---|---|
| 2.56.0–2.59.0 | Brickture promo videos (hero + Watch section), octopus and cruise pictures, Campaign kit rewritten, built-in video controls, then version 3 of the videos (28–29 Oct) |
| 2.55.11 | ConcreteIQ customer story: Ted's title corrected to President & CEO, Takgio (28 Oct) |
| 2.55.7–2.55.10 | HANDOFF.md and CLAUDE.md only: the investor-deck template, the full-URL rule, the declined CPN story |
| 2.55.0–2.55.6 | Home hero graphic redrawn and animated in three steps (26 Oct; Ted approved each round on a Vercel preview) |
| 2.54.0 | Home ticker: every line a link, plus the 5 newest AI news headlines |
| 2.53.2–2.53.4 | Internal files kept off the site; HANDOFF.md started; CLAUDE.md and README.md updated; Supabase checked |
| 2.53.1 | ConcreteIQ customer story: the bid dollar totals removed |
| 2.53.0 | ConcreteIQ customer story page, linked from Case Studies and in the sitemap |
| 2.52.0 | Team & access shows each member's email; the top bar shows the signed-in email |
| 2.51.0 | One admin front door at `/admin` |
| 2.50.0–2.50.1 | AI news updates itself daily, with a one-click pull |
| 2.49.0–2.49.1 | Home hero graphic and differentiators; header simplified |
| 2.44.0–2.48.1 | Product-company repositioning and the new headline and brand line |

Full notes for each release are in `version.json`.

## Investor deck (the template for every future investor deck)

- **The template is `C:\Users\Ted\OneDrive\TAKGIO\Presentations\Takgio-Investor-Deck-DRAFT-v4.pptx`** (Ted, 26 Oct:
  "use this as a template for future decks for investors"). It lives on Ted's laptop only and is **never committed**
  (this repo is served as a website). A cloud session cannot read it: ask Ted to attach it in the chat, edit the copy
  with the pptx skill (unzip, edit `ppt/slides/slideN.xml`, re-zip; duplicate slides with `add_slide.py`), render and
  look at every changed slide, and hand it back as a file card. Name new versions `Takgio-Investor-Deck-DRAFT-vN.pptx`.
- **Its 16 slides:** 1 title, 2 how a Takgio product works, 3 problem, 4 ConcreteIQ proof, 5 the method in new markets,
  6 six products / four industries, 7 speed, 8 traction, 9 business model, 10 why now, 11 market, 12 competition
  (vs. off-the-shelf AI, plus named competitors per product), 13 team, 14 the ask, 15 vision, 16 appendix (sources).
- **Its rules:** the wording follows this site (headline "We turn human expertise into AI products.", 1,400+ statements,
  "six products, four industries", the bios on `leadership.html`); every number carries its source and date, and is
  re-checked at the source on the day a deck is sent; market figures are the source's own, never a Takgio forecast;
  no investor or expert is named; a rating is never shown without its count.
- **Still blank in v4 (Ted's):** the amount and instrument and the milestones (14), downloads, installs and revenue
  (8), Richard's background and who is full-time (13), the 24-month and 5-year vision (15), and the expert's OK on
  "30+ years" (4). The site's Hoof Harted page says 2 ratings where Apple showed 3 on 20 Oct.

## Fundraising (started 26 Oct)

- **The raise:** Ted wants $100K to $500K (more if an investor wants), at pre-seed. Friends-and-family angels have put
  in the first checks; the amounts are in Ted's tracking sheet, not here (this file is in git).
- **The tracking sheet:** `Takgio-Investor-Targets.xlsx`, built 26 Oct and downloaded by Ted (suggested home:
  `C:\Users\Ted\OneDrive\TAKGIO\Investors\`; never committed). Tabs: Targets (13 investors, priority A/B/C, each
  with its URL, check size, stage, best-fit product, contact route, status drop-down), Programs & tools, Raised so far
  (totals by formula). Ask Ted to attach it to update it.
- **A targets (contact now):** Menlo Anthology Fund https://menlovc.com/menlo-anthology-fund/ ; Brick & Mortar
  Ventures https://brickmortar.vc ; MetaProp https://www.metaprop.com/partner-with-us ; JumpStart NJ Angel Network
  https://www.jumpstartnj.com ; Nine Four Ventures https://ninefour.vc ; Newark Venture Partners
  https://newarkventurepartners.com ; Suffolk Technologies BOOST https://suffolktech.com/boost . Several URLs came from
  directories, not the firms' own sites (the sheet's "URL confirmed?" column says which).
- **NJ programs:** Angel Investor Tax Credit https://www.njeda.gov/angeltaxcredit (up to 35% refundable to NJ
  investors; investor applies within 6 months of investing; Richard to confirm Takgio qualifies). Angel Match
  https://www.njeda.gov/angelmatch is PAUSED (Innovation@njeda.gov).
- **Advice given:** lead with ConcreteIQ (the only product with hard proof); rounds this size are usually a SAFE, terms
  are Richard's; slide 8 (revenue, downloads) is still blank and investors will ask.

## Open / not verified

- **CPN customer story: declined, waiting on ConcreteIQ going live.** Anthropic's Claude Partner Network declined the
  Structural Construction of Orlando story (`case-study-construction-concreteiq-customer-story.html`) on 27 Oct 2026
  for tier credit, for one reason: "not in production (§2.3)". It met the other criteria (public, names the customer,
  names Claude, a measurable result). The email: subject "CPN customer story update: Structural Construction of
  Orlando", from partner-support@anthropic.com. **ConcreteIQ is still beta (Ted, 28 Oct); never label it live until
  Ted says so.** When he does: change every ConcreteIQ "Live beta" label site-wide, state the production use in the
  story, then Ted re-submits it in Claude Partner Hub. The wording is ready in closed PR tazpinball/takgio-website#8
  (https://github.com/tazpinball/takgio-website/pull/8; its dates assumed a 5 Oct go-live, which was wrong: use the
  real date). The §2.3 definition of "production" is in the CPN Program Guide (Claude Partner Hub > Content > Partner
  Program), which a cloud session cannot open: ask Ted for it.

- **Internal files were public on takgio.com until v2.53.2** (fixed and checked live, 26 Oct). Vercel serves the repo as static files, so `CLAUDE.md`
  (Ted confirmed it loads, 26 Oct), `README.md`, `docs/*.sql` and the Supabase function source were readable at their
  own URLs. v2.53.2 keeps them off the site two ways: `.vercelignore` leaves them out of the deployment, and
  `vercel.json` redirects their paths to the home page. Nothing secret is in them (only the public anon key is in
  code). HANDOFF.md had been kept out of git for this reason (`.gitignore`, 28 Sep); it is committed from v2.53.2.
  🔴 **Any new internal file or folder goes into BOTH `.vercelignore` and the redirects in `vercel.json`.**

- **The Supabase side is installed and running** (Ted, in the dashboard, 26 Oct). Pushing to git deploys none of it;
  SQL is run in the SQL editor and functions are deployed with the Supabase CLI.
  - SQL: the news and careers tables, the daily-news columns, run log and Vault secret, pg_cron, and `admin_team()`
    are all present.
  - Functions: all five are deployed. `ai-news-daily` and `ai-news-pull` were last updated 22 Oct; the careers pair
    on 8 Oct.
  - Daily job: `ai-news-daily` runs at `0 11 * * *` (11:00 UTC), active. Runs: 23 Oct checked 19 and added 4;
    24 Oct checked 2 and added 0; 25 and 26 Oct checked 0. All 8 sources were read on 26 Oct with no errors, so a
    "checked 0" day means nothing new was published, not a failure. A source that fails shows "could not be read"
    in the run's `report->'sources'`.
  - Dashboard: https://supabase.com/dashboard/project/pwmrbmjlgweahridxvgk (SQL editor: `/sql/new`, functions:
    `/functions`).

## Rules that bind every change (from CLAUDE.md)

- **Every change bumps `version.json`**: the top-level `version` and `date`, plus a new entry at the top of
  `releases`. Patch for a fix, minor for a feature.
- **The Demos link is fixed at `https://demos.takgio.com`.** Run the check in CLAUDE.md before every commit; it must
  print 32 / 33 / 0, or the counts updated on purpose.
- **A new public page** goes into the header and footer nav of the other public pages and into `sitemap.xml`.
- **`js/supabase-config.js` loads before `auth.js`.** Only the public anon key goes in code.

## Commands

- Serve locally: `npx http-server . -p 8080 -c-1` (launch config `takgio-site`). Plain `http-server` answers video
  range requests, so the videos seek locally.
- After a merge, wait for the deploy: `until curl -s "https://www.takgio.com/version.json?x=$RANDOM" | head -3 | grep -q <version>; do sleep 5; done`.
  Right after a deploy Vercel's edge can serve the old copy of a replaced file once: fetch it again before
  calling it wrong (seen 29 Oct with the wide video).
- Cut a still from a video: `ffmpeg -ss <seconds> -i <video> -frames:v 1 <out.png>`, then crop and save as webp.
- News function test: `deno run -A supabase/functions/_tests/news-harness.ts "<absolute project root>"`.
- Careers function test: `deno run -A supabase/functions/_tests/careers-harness.ts "<absolute project root>"`.
  Both tests run the real function code offline and should report 0 failed.
