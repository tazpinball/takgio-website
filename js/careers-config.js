// ============================================================
// Careers configuration (public values only; never put a secret here)
// ============================================================
// applyUrl:       the address of the "careers-apply" Edge Function. While it is empty the job pages show the
//                 application form as "opening soon" and accept nothing.
// turnstileSiteKey: the PUBLIC site key from Cloudflare Turnstile (the bot check). Empty = no bot check yet.
// See supabase/functions/careers-apply/README.md for the setup steps.
// ============================================================
window.CAREERS_CONFIG = {
  applyUrl: '',
  turnstileSiteKey: ''
};
