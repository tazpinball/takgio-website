// ai-news-daily: once a day (pg_cron, docs/news-daily-schema.sql) read the official sources, write up to MAX_STORIES new
// stories from the articles' own text, fact-check each one, publish the ones that pass, and email Ted a list with a
// one-click "pull" link per story.
// Deploy with --no-verify-jwt: the scheduler calls it with the x-cron-secret header, not a login.
// POST {"dry": true} runs every step, including Claude, but writes nothing and sends no email; it returns what it would add.
// Secrets: ANTHROPIC_API_KEY, RESEND_API_KEY, MAIL_FROM, AI_NEWS_EMAIL_TO (or DEFAULT_NOTIFY_EMAIL). The caller's x-cron-secret
// is checked by the database (ai_news_cron_ok, docs/news-daily-schema.sql) against the secret it keeps in Vault.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SOURCES, readSource, get, parseArticle, type Post } from "./sources.ts";
import { client, pick, write, verify, brief } from "./claude.ts";

const SITE = Deno.env.get("SITE_URL") ?? "https://www.takgio.com";
const MAX_STORIES = 4;     // at most this many new stories a day
const MAX_CANDIDATES = 40; // new posts shown to the picker per run (newest first)
const WINDOW_DAYS = 3;     // posts older than this are noted as seen and left alone
const MIN_WORDS = 150;     // an article needs at least this much text to check a story against

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b, null, 2), { status, headers: { "content-type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const today = () => new Date().toISOString().slice(0, 10);
function monday(iso: string) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
function slugify(s: string) { return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).replace(/-$/, "") || "story"; }

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const given = req.headers.get("x-cron-secret") ?? "";
  const ok = given ? await db.rpc("ai_news_cron_ok", { s: given }) : { data: false };
  if (ok.data !== true) return json({ error: "Not allowed" }, 401);
  let dry = false;
  try { dry = !!(await req.json()).dry; } catch { /* an empty body is a normal run */ }

  const ai = client(Deno.env.get("ANTHROPIC_API_KEY")!);
  const report: Record<string, unknown> = { dry, sources: {} as Record<string, string> };
  const seenRows: { url: string; source: string; title: string; decision: string; reason?: string }[] = [];
  const note = (p: Post, decision: string, reason?: string) => seenRows.push({ url: p.url, source: p.source, title: p.title.slice(0, 300), decision, reason });

  // ---- 1. read every source; a source that fails is reported, the rest carry on ----
  const all: Post[] = [];
  await Promise.all(SOURCES.map(async (s) => {
    try { const posts = await readSource(s); all.push(...posts); (report.sources as Record<string, string>)[s.name] = `${posts.length} posts`; }
    catch (e) { (report.sources as Record<string, string>)[s.name] = `could not be read: ${String(e).slice(0, 120)}`; }
  }));

  // ---- 2. keep posts nobody has looked at, inside the window ----
  const urls = [...new Set(all.map((p) => p.url))];
  const known = new Set<string>();
  for (let i = 0; i < urls.length; i += 200) {
    const chunk = urls.slice(i, i + 200);
    const [a, b] = await Promise.all([db.from("ai_news_seen").select("url").in("url", chunk), db.from("ai_news_items").select("source_url").in("source_url", chunk)]);
    (a.data ?? []).forEach((r) => known.add(r.url)); (b.data ?? []).forEach((r) => known.add(r.source_url));
  }
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString().slice(0, 10);
  const fresh: Post[] = [];
  for (const p of all) {
    if (known.has(p.url)) continue;
    known.add(p.url);
    if (!p.date || p.date < cutoff || p.date > today()) { note(p, "too old", p.date ? `published ${p.date}` : "no publication date"); continue; }
    fresh.push(p);
  }
  fresh.sort((x, y) => (y.date ?? "").localeCompare(x.date ?? ""));
  const candidates = fresh.slice(0, MAX_CANDIDATES);
  report.new_posts = fresh.length;

  // ---- 3. pick, then write and check the picked ones in parallel ----
  let picks: { n: number; why: string }[] = [], picked_ok = true;
  try { picks = await pick(ai, candidates, MAX_STORIES + 2); } catch (e) { report.pick_error = String(e); picked_ok = false; }
  const picked = new Set(picks.map((x) => x.n));
  // if the pick itself failed, nothing is marked seen, so tomorrow's run looks at these posts again
  if (picked_ok) candidates.forEach((p, i) => { if (!picked.has(i)) note(p, "not relevant", "not picked from the day's titles"); });

  type Ready = { post: Post; title: string; row: Record<string, unknown> };
  const ready: Ready[] = [];
  await Promise.all(picks.map(async ({ n }) => {
    const p = candidates[n];
    try {
      const a = parseArticle(await get(p.url));
      if (a.words < MIN_WORDS) { note(p, "too little text", `${a.words} words could be read`); return; }
      const title = a.title || p.title;
      const s = await write(ai, p, title, a.text);
      if (!s.relevant) { note(p, "not relevant", s.reason.slice(0, 300)); return; }
      const item = { headline: title, summary: s.summary, why: s.why, ticker: s.ticker };
      const v = await verify(ai, a.text, item);
      if (!v.supported) { note(p, "failed check", v.problems.join(" | ").slice(0, 500)); return; }
      ready.push({ post: p, title, row: { topic: s.topic, source: p.source, source_url: p.url, source_date: p.date, headline: title, summary: s.summary, why: s.why, ticker: s.ticker && s.ticker.length <= 90 ? s.ticker : null } });
    } catch (e) {
      // a page that refuses servers or is gone (HTTP 4xx) will not change tomorrow: that is a decision, not a retry
      const m = String(e).match(/HTTP (4\d\d)/);
      if (m) note(p, "too little text", `the article page refused the request (HTTP ${m[1]})`); else note(p, "error", String(e).slice(0, 300));
    }
  }));
  ready.sort((x, y) => (y.post.date ?? "").localeCompare(x.post.date ?? ""));
  const keep = ready.slice(0, MAX_STORIES);
  ready.slice(MAX_STORIES).forEach((r) => note(r.post, "not relevant", "over the daily limit"));

  if (dry) {
    report.would_add = keep.map((k) => k.row);
    report.decisions = seenRows;
    return json(report);
  }

  // ---- 4. add the stories, each to the week it was published in; publish weeks the job owns ----
  const added: { headline: string; source: string; url: string; token: string; week: string }[] = [];
  const weeks = new Set<string>(), held: string[] = [];
  for (const k of keep) {
    const ws = monday(k.post.date!);
    const { data: w } = await db.from("ai_news_weeks").select("week_start,status,brief_auto").eq("week_start", ws).maybeSingle();
    if (!w) {
      const ins = await db.from("ai_news_weeks").insert({ week_start: ws, brief: k.title, status: "published", published_at: new Date().toISOString(), brief_auto: true });
      if (ins.error) { note(k.post, "error", "week: " + ins.error.message); continue; }
    }
    let slug = slugify(k.title);
    const clash = await db.from("ai_news_items").select("slug").eq("slug", slug).maybeSingle();
    if (clash.data) slug = `${slug.slice(0, 54)}-${crypto.randomUUID().slice(0, 5)}`;
    const ins = await db.from("ai_news_items").insert({ ...k.row, slug, week_start: ws, origin: "auto" }).select("pull_token").single();
    if (ins.error) { note(k.post, "error", "story: " + ins.error.message); continue; }
    note(k.post, "added");
    added.push({ headline: k.title, source: k.post.source, url: k.post.url, token: ins.data.pull_token, week: ws });
    weeks.add(ws);
  }
  for (const ws of weeks) {
    const { data: w } = await db.from("ai_news_weeks").select("status,brief_auto").eq("week_start", ws).single();
    const { data: items } = await db.from("ai_news_items").select("source,headline,summary,origin,hidden").eq("week_start", ws);
    const live = (items ?? []).filter((i) => !i.hidden);
    if (w?.status === "draft") {
      // an editor's draft week: publish it only if every story in it came from the job, so nobody's unfinished work goes live
      if (live.every((i) => i.origin === "auto")) await db.from("ai_news_weeks").update({ status: "published", published_at: new Date().toISOString() }).eq("week_start", ws);
      else held.push(ws);
    }
    if (w?.brief_auto && live.length) {
      try {
        const b = await brief(ai, live);
        const src = live.map((s) => `${s.source}: ${s.headline}. ${s.summary}`).join("\n");
        if ((await verify(ai, src, { brief: b })).supported) await db.from("ai_news_weeks").update({ brief: b }).eq("week_start", ws);
      } catch (e) { report.brief_error = String(e); }
    }
  }
  // remember real decisions only; a post that hit an error is tried again tomorrow while it is inside the window
  const decided = seenRows.filter((r) => r.decision !== "error");
  report.errors = seenRows.filter((r) => r.decision === "error");
  if (decided.length) {
    const up = await db.from("ai_news_seen").upsert(decided, { onConflict: "url" });
    if (up.error) report.seen_error = up.error.message;
  }
  await db.from("ai_news_runs").insert({ checked: candidates.length, added: added.length, report });

  // ---- 5. the email: what went live, with a pull link each; and any source that could not be read ----
  const failed = Object.entries(report.sources as Record<string, string>).filter(([, v]) => v.startsWith("could not"));
  const to = Deno.env.get("AI_NEWS_EMAIL_TO") ?? Deno.env.get("DEFAULT_NOTIFY_EMAIL"), key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("MAIL_FROM");
  if ((added.length || failed.length || held.length) && to && key && from) {
    const list = added.map((a) => `<li style="margin:0 0 14px"><b>${esc(a.headline)}</b><br><span style="color:#555">${esc(a.source)}</span> &middot; <a href="${esc(a.url)}">source</a> &middot; <a href="${SITE}/ai-news-pull.html#t=${a.token}">Pull this story</a></li>`).join("");
    const html = `<p>${added.length ? `The daily AI news job published ${added.length} ${added.length === 1 ? "story" : "stories"} on <a href="${SITE}/ai-news.html">takgio.com/ai-news</a>. Each was written from the source's own text and checked against it.` : "The daily AI news job added no stories today."}</p>` +
      (list ? `<ul style="padding-left:18px">${list}</ul><p style="color:#555">&ldquo;Pull this story&rdquo; takes it off the site at once. You can restore it in the <a href="${SITE}/admin/news">News admin</a>.</p>` : "") +
      (held.length ? `<p>Not published because the week is an editor&rsquo;s draft: ${held.map(esc).join(", ")}. Open the <a href="${SITE}/admin/news">News admin</a> to publish it.</p>` : "") +
      (failed.length ? `<p>These sources could not be read today: ${failed.map(([n, v]) => `${esc(n)} (${esc(v)})`).join("; ")}.</p>` : "");
    try {
      const m = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to, subject: added.length ? `AI news: ${added.length} new on takgio.com` : "AI news: a source needs a look", html }) });
      if (!m.ok) report.email_error = `${m.status} ${await m.text()}`;
    } catch (e) { report.email_error = String(e); }
  }
  return json({ ...report, added: added.map((a) => a.headline), held });
});
