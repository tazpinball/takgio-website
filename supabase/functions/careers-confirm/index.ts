// careers-confirm: marks an application's email as confirmed and tells the hiring contact.
// Supabase rewrites any HTML a function returns to plain text, so this function never serves a page. The page the applicant
// sees is application-confirm.html on the site; it posts here. Deploy with --no-verify-jwt (the page cannot send a login).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = Deno.env.get("SITE_URL") ?? "https://www.takgio.com";
const CORS = { "Access-Control-Allow-Origin": SITE, "Access-Control-Allow-Headers": "content-type, apikey", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });
const safe = (s: string) => s.replace(/[<>&"]/g, "");
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // A plain link (an older email, or anything that opens the function address) is sent on to the page on the site.
  // Opening that page confirms nothing: only the button on it does. That matters because mail scanners open every link.
  if (req.method === "GET") {
    const t = new URL(req.url).searchParams.get("token") ?? "";
    return new Response(null, { status: 302, headers: { Location: `${SITE}/application-confirm.html${UUID.test(t) ? "#t=" + t : ""}` } });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let token = "";
  try { token = String((await req.json()).token ?? ""); } catch { return json({ error: "That did not look right. Please use the link from your email." }, 400); }
  if (!UUID.test(token)) return json({ error: "That link is not valid. Please use the link from your email." }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: app } = await db.from("job_applications").select("id,first_name,last_name,job_id,email_confirmed_at").eq("confirm_token", token).maybeSingle();
  if (!app) return json({ error: "That link is not valid. It may have expired or been used already." }, 404);
  if (app.email_confirmed_at) return json({ ok: true, status: "already" });
  await db.from("job_applications").update({ email_confirmed_at: new Date().toISOString() }).eq("id", app.id);

  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("MAIL_FROM");
  if (key && from) {
    let to = Deno.env.get("DEFAULT_NOTIFY_EMAIL") ?? "", title = "a general application";
    if (app.job_id) {
      const { data: job } = await db.from("jobs").select("title,notify_email").eq("id", app.job_id).maybeSingle();
      if (job) { title = job.title; if (job.notify_email) to = job.notify_email; }
    }
    if (to) {
      try {
        const mail = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({ from, to, subject: `New confirmed application: ${safe(app.first_name)} ${safe(app.last_name)}`,
            html: `<p>${safe(app.first_name)} ${safe(app.last_name)} confirmed an application for ${safe(title)}.</p><p><a href="${SITE}/careers-admin.html#apps">Open the careers admin</a></p>` }),
        });
        if (!mail.ok) console.error("careers-confirm: Resend refused the notification", mail.status, await mail.text());
      } catch (e) { console.error("careers-confirm: could not reach Resend", String(e)); }
    }
  }
  return json({ ok: true, status: "confirmed" });
});
