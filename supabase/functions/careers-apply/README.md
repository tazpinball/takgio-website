# Careers: receiving applications (NOT DEPLOYED, UNTESTED)

The public form posts to `careers-apply`. Until these steps are done, the job pages show "Applications open soon" and
accept nothing (`applyUrl` in `js/careers-config.js` is empty).

## What it needs
1. **Cloudflare Turnstile** (the bot check). Create a Turnstile site for takgio.com. The *site key* is public: put it in `js/careers-config.js` (`turnstileSiteKey`). The *secret key* is private: set it as the function secret `TURNSTILE_SECRET`. If the secret is not set, the bot check is skipped (the hidden trap field and the rate limit still apply).
2. **An email service** to send the confirmation link and the "new application" notice. The code uses **Resend** (https://resend.com): create an account, verify the takgio.com domain (DNS is at GoDaddy), create an API key. Secrets: `RESEND_API_KEY`, `MAIL_FROM` (for example `takgio careers <careers@takgio.com>`), and optionally `DEFAULT_NOTIFY_EMAIL` for general applications. Without these the applicant gets no confirmation email, so nobody is ever marked confirmed.
3. **Deploy both functions** (`careers-apply` and `careers-confirm`) with JWT verification off, because a public form and an email link cannot send a login token: `supabase functions deploy careers-apply --no-verify-jwt`, and the same for `careers-confirm`. (Or create them in the Supabase dashboard under Edge Functions and paste the code.) `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions by Supabase. Optional `SITE_URL` (defaults to https://www.takgio.com).
4. Set `applyUrl` in `js/careers-config.js` to `https://pwmrbmjlgweahridxvgk.supabase.co/functions/v1/careers-apply`.

## Important: functions cannot serve web pages
Supabase rewrites any HTML a function returns to plain text (and adds a sandbox security policy), so a page can never render from
`…supabase.co/functions/v1/…`. The "confirm your email" page is therefore `application-confirm.html` on the site
(`js/application-confirm.js`); it posts the token to `careers-confirm`, which only ever returns JSON (or a redirect to that page).
`js/careers-config.js` holds both function addresses (`applyUrl`, `confirmUrl`). Offline tests for both functions are in
`supabase/functions/_tests/careers-harness.ts` (run with Deno; see the file's first lines). Deploying needs a Supabase access
token (Ted types it into `supabase login --token`; delete it afterwards): `supabase functions deploy <name> --no-verify-jwt --use-api --project-ref pwmrbmjlgweahridxvgk`.
The mail sender must be on the verified Resend domain: `MAIL_FROM` is `takgio careers <careers@mail.takgio.com>`.

## What it does
Checks the fields, the resume (PDF or Word, up to 5 MB), the bot check, that the job is still open, and a limit of 3
applications per email per hour; saves the application; stores the resume in the private `resumes` bucket; and emails the
applicant a confirmation link. When the link is clicked, `careers-confirm` marks the email confirmed and emails the job's contact.
