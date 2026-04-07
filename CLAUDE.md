# TAKGIO Website — Project Rules

## MANDATORY: Version Bump on Every Change

**THIS IS A HARD REQUIREMENT. NO EXCEPTIONS.**

Every time you modify ANY file in this project (HTML, CSS, JS, or config), you MUST:

1. **Bump the version** in `version.json` — increment the patch number (e.g. 1.0.0 → 1.0.1) for small fixes, minor number (e.g. 1.0.1 → 1.1.0) for features, major number for breaking changes.
2. **Add a release entry** to the `releases` array in `version.json` with the new version, today's date, a summary, and a list of changes.
3. **Do this BEFORE committing.** Never commit without updating version.json.

If you forget this, Ted will be upset. Do not skip it. Do not defer it. Do it every single time.

## Versioning Format

- `version.json` at the project root contains the current version and full release history
- Version displays in the dashboard header next to "TAKGIO"
- Use semantic versioning: MAJOR.MINOR.PATCH

## Tech Stack

- Vanilla HTML/CSS/JS (no frameworks)
- Supabase (Auth, Database, RLS)
- Chart.js for data visualization
- Hosted on Vercel via GitHub (auto-deploy on push to master)
