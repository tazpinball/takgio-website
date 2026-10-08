// careers-apply: receives an application from the public Careers page.
// NOT DEPLOYED YET. Needs the secrets listed in README.md. Written to be deployed with --no-verify-jwt (the public form
// cannot send a user token); the bot check (Cloudflare Turnstile), a hidden trap field, size/type limits and a per-email
// rate limit stand in for it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = Deno.env.get("SITE_URL") ?? "https://www.takgio.com";
const CORS = { "Access-Control-Allow-Origin": SITE, "Access-Control-Allow-Headers": "apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });
const clean = (v: FormDataEntryValue | null, max = 2000) => String(v ?? "").trim().slice(0, max);
const safe = (s: string) => s.replace(/[<>&"]/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: "That did not look like a form." }, 400); }

  if (clean(form.get("website"))) return json({ ok: true });            // trap field: bots fill it in, people never see it

  // Without email sending nobody can ever be confirmed, so refuse up front rather than save an application that is a dead end.
  const mailKey = Deno.env.get("RESEND_API_KEY"), mailFrom = Deno.env.get("MAIL_FROM");
  if (!mailKey || !mailFrom) { console.error("careers-apply: RESEND_API_KEY or MAIL_FROM is not set"); return json({ error: "Applications are temporarily unavailable. Please try again later." }, 503); }

  const f = {
    first_name: clean(form.get("first_name"), 80), last_name: clean(form.get("last_name"), 80), email: clean(form.get("email"), 200).toLowerCase(),
    phone: clean(form.get("phone"), 40) || null, state: clean(form.get("state"), 40), link_url: clean(form.get("link_url"), 400),
    exams: clean(form.get("exams"), 300) || null, answer: clean(form.get("answer"), 3000), job_id: clean(form.get("job_id"), 60) || null,
    work_authorized: clean(form.get("work_authorized")) === "yes",
  };
  const file = form.get("resume");
  if (!f.first_name || !f.last_name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email) || !f.state || !/^https?:\/\//i.test(f.link_url) || !f.answer || !form.get("consent"))
    return json({ error: "Please fill in every required field." }, 400);
  if (!(file instanceof File) || file.size === 0) return json({ error: "Please attach your resume." }, 400);
  if (file.size > 5 * 1024 * 1024) return json({ error: "That resume is over 5 MB." }, 400);
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!["pdf", "doc", "docx"].includes(ext)) return json({ error: "Please attach a PDF or Word file." }, 400);

  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (secret) {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: new URLSearchParams({ secret, response: clean(form.get("turnstile_token"), 4000) }) });
    if (!(await r.json()).success) return json({ error: "The bot check did not pass. Please try again." }, 400);
  }

  if (f.job_id) {
    const { data: job } = await db.from("jobs").select("id,status,apply_close").eq("id", f.job_id).maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    if (!job || job.status !== "published" || (job.apply_close && job.apply_close < today)) return json({ error: "This position is no longer open." }, 400);
  }

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from("job_applications").select("id", { count: "exact", head: true }).eq("email", f.email).gte("created_at", since);
  if ((count ?? 0) >= 3) return json({ error: "Too many applications from this address. Please try again later." }, 429);

  const { data: app, error } = await db.from("job_applications").insert(f).select("id,confirm_token").single();
  if (error || !app) return json({ error: "We could not save your application. Please try again." }, 500);

  const path = `${app.id}/${crypto.randomUUID()}.${ext}`;
  const up = await db.storage.from("resumes").upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (up.error) { await db.from("job_applications").delete().eq("id", app.id); return json({ error: "We could not store your resume. Please try again." }, 500); }
  await db.from("job_applications").update({ resume_path: path }).eq("id", app.id);

  const link = `${Deno.env.get("SUPABASE_URL")}/functions/v1/careers-confirm?token=${app.confirm_token}`;
  let sent = false;
  try {
    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${mailKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: mailFrom, to: f.email, subject: "Confirm your application to takgio",
        html: `<p>Hi ${safe(f.first_name)},</p><p>Thanks for applying to takgio. Please confirm your email address so we can review your application:</p><p><a href="${link}">Confirm my email</a></p><p>If you did not apply, you can ignore this message.</p>` }),
    });
    sent = mail.ok;
    if (!sent) console.error("careers-apply: Resend refused the confirmation email", mail.status, await mail.text());
  } catch (e) { console.error("careers-apply: could not reach Resend", String(e)); }
  if (!sent) {
    // Nothing was confirmed and nobody can confirm it: remove the half-finished application so the person can simply try again.
    await db.storage.from("resumes").remove([path]);
    await db.from("job_applications").delete().eq("id", app.id);
    return json({ error: "We could not send your confirmation email. Please check the address and try again." }, 502);
  }
  return json({ ok: true });
});
