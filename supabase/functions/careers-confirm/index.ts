// careers-confirm: the link in the applicant's email. Marks the application's email as confirmed and tells the hiring contact.
// NOT DEPLOYED YET. Deploy with --no-verify-jwt (the applicant clicks it from an email).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = Deno.env.get("SITE_URL") ?? "https://www.takgio.com";
const safe = (s: string) => s.replace(/[<>&"]/g, "");
const page = (title: string, body: string, status = 200, extra = "") => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>` +
  `<body style="font-family:system-ui;max-width:520px;margin:12vh auto;padding:0 20px;color:#1a1a2e"><h1>${title}</h1><p>${body}</p>${extra}<p><a href="${SITE}/careers.html">Back to Careers</a></p>`,
  { status, headers: { "content-type": "text/html; charset=utf-8" } });

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) return page("That link is not valid", "Please use the link from your email.", 400);
  // Opening the link only shows a button. Mail scanners (and some mail apps) open every link in a message, so confirming on a
  // plain page load would mark an address as confirmed that nobody actually clicked. Only the button (a POST) confirms.
  if (req.method === "GET") {
    return page("Confirm your email", "Press the button to confirm your email address for your takgio application.", 200,
      `<form method="post"><button type="submit" style="font:inherit;font-weight:700;padding:12px 22px;border-radius:10px;border:0;background:#4a6cf7;color:#fff;cursor:pointer">Confirm my email</button></form>`);
  }
  if (req.method !== "POST") return page("That link is not valid", "Please use the link from your email.", 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: app } = await db.from("job_applications").select("id,first_name,last_name,job_id,email_confirmed_at").eq("confirm_token", token).maybeSingle();
  if (!app) return page("That link is not valid", "It may have expired or been used already.", 404);
  if (app.email_confirmed_at) return page("Already confirmed", "Thanks, your email was already confirmed. We will be in touch if there is a fit.");
  await db.from("job_applications").update({ email_confirmed_at: new Date().toISOString() }).eq("id", app.id);

  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("MAIL_FROM");
  if (key && from) {
    let to = Deno.env.get("DEFAULT_NOTIFY_EMAIL") ?? "", title = "a general application";
    if (app.job_id) {
      const { data: job } = await db.from("jobs").select("title,notify_email").eq("id", app.job_id).maybeSingle();
      if (job) { title = job.title; if (job.notify_email) to = job.notify_email; }
    }
    if (to) await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject: `New confirmed application: ${safe(app.first_name)} ${safe(app.last_name)}`,
        html: `<p>${safe(app.first_name)} ${safe(app.last_name)} confirmed an application for ${safe(title)}.</p><p><a href="${SITE}/careers-admin.html#apps">Open the careers admin</a></p>` }),
    });
  }
  return page("Thanks, you are confirmed", "We have your application. We read every one and will be in touch if there is a fit.");
});
