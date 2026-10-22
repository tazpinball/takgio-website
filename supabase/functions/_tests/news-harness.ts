// Offline test for ai-news-daily and ai-news-pull: runs the REAL function code with Supabase (an in-memory PostgREST
// stand-in), Claude, Resend and the news sources replaced by fixtures (no network, no secrets, nothing written anywhere).
// Run from the project root (Deno 2.x; if Deno is not installed:  npm install deno  in any scratch folder):
//   deno run -A supabase/functions/_tests/news-harness.ts "<absolute path to the project root>"
// Folders that start with an underscore are not deployed by the Supabase CLI. Expect: 0 failed.
type Row = Record<string, unknown>;
const T = (n: number) => new Date(Date.now() - n * 864e5);
const day = (n: number) => T(n).toISOString().slice(0, 10);
const rfc = (n: number) => T(n).toUTCString();
function monday(iso: string) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }

// ---------------- in-memory database ----------------
const db: Record<string, Row[]> = { ai_news_weeks: [], ai_news_items: [], ai_news_seen: [], ai_news_runs: [] };
const KEY: Record<string, string> = { ai_news_weeks: "week_start", ai_news_items: "id", ai_news_seen: "url", ai_news_runs: "id" };
let ids = 0;
function filters(sp: URLSearchParams) {
  const fs: ((r: Row) => boolean)[] = [];
  for (const [k, v] of sp) {
    if (["select", "on_conflict", "order", "limit", "columns"].includes(k)) continue;
    const [op, ...rest] = v.split("."); const val = rest.join(".");
    if (op === "eq") fs.push((r) => String(r[k]) === val);
    else if (op === "in") { const set = new Set(val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, ""))); fs.push((r) => set.has(String(r[k]))); }
    else if (op === "like") { const re = new RegExp("^" + val.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/%/g, ".*") + "$"); fs.push((r) => re.test(String(r[k]))); }
    else throw new Error("unmocked filter " + k + "=" + v);
  }
  return (r: Row) => fs.every((f) => f(r));
}
function insertRow(t: string, r: Row): Row {
  const row: Row = { ...r };
  if (t === "ai_news_items") { row.id ??= crypto.randomUUID(); row.pull_token ??= crypto.randomUUID(); row.hidden ??= false; row.origin ??= "editor"; }
  if (t === "ai_news_runs") row.id = ++ids;
  if (t === "ai_news_weeks") { row.status ??= "draft"; row.brief_auto ??= false; }
  if (t === "ai_news_items" && db.ai_news_items.some((x) => x.slug === row.slug)) throw new Error("23505 duplicate slug");
  db[t].push(row); return row;
}

// ---------------- Claude stand-in: answers by which step is asking ----------------
const claude = { calls: [] as string[], pickFails: false, failCheckFor: "Gemini 9 adds nothing", irrelevantFor: "Webinar recap" };
function answer(system: string, user: string): unknown {
  if (system.startsWith("You choose")) {
    claude.calls.push("pick");
    if (claude.pickFails) throw new Error("overloaded");
    const lines = user.split("\n").filter((l) => /^\d+\. /.test(l));
    return { picks: lines.filter((l) => !/Hiring/.test(l)).map((l) => ({ n: +l.split(".")[0], why: "news" })) };
  }
  if (system.startsWith("You write one short news item")) {
    claude.calls.push("write");
    const title = (user.match(/^Title: (.*)$/m) ?? [])[1] ?? "";
    return { relevant: !title.includes(claude.irrelevantFor), reason: title.includes(claude.irrelevantFor) ? "an event recap" : "a model launch", topic: "Models", summary: `Summary of ${title}.`, why: "It changes what we can build.", ticker: title.includes("Claude") ? "Anthropic ships a new Claude model" : null };
  }
  if (system.startsWith("You are a strict fact-checker")) {
    claude.calls.push("check");
    const bad = user.includes(claude.failCheckFor);
    return { supported: !bad, problems: bad ? ["the price is not in the source"] : [] };
  }
  if (system.startsWith("Write one plain sentence")) { claude.calls.push("brief"); return { brief: "Anthropic shipped a new Claude model this week." }; }
  throw new Error("unknown Claude step");
}

// ---------------- the news sources ----------------
const FEED = `<?xml version="1.0"?><rss><channel>
<item><title>Introducing Claude 9</title><link>https://news.test/claude-9</link><pubDate>${rfc(0)}</pubDate><description>A new model.</description></item>
<item><title>Gemini 9 adds nothing</title><link>https://news.test/gemini-9</link><pubDate>${rfc(1)}</pubDate><description>Model news.</description></item>
<item><title>Webinar recap: patients</title><link>https://news.test/webinar</link><pubDate>${rfc(0)}</pubDate><description>A recap.</description></item>
<item><title>We are Hiring engineers</title><link>https://news.test/hiring</link><pubDate>${rfc(0)}</pubDate><description>Jobs.</description></item>
<item><title>Old news from last month</title><link>https://news.test/old</link><pubDate>${rfc(20)}</pubDate><description>Old.</description></item>
<item><title>A refused post</title><link>https://news.test/refused</link><pubDate>${rfc(0)}</pubDate><description>Refused.</description></item>
<item><title>A thin post</title><link>https://news.test/thin</link><pubDate>${rfc(0)}</pubDate><description>Thin.</description></item>
</channel></rss>`;
const LISTING = `<html><body><a href="/news/listed-post">Listed</a><a href="/about">About</a></body></html>`; // relative links, as on the real page
const article = (title: string, words: number, date = day(0)) => `<html><head><title>${title} | Vendor</title><meta property="article:published_time" content="${date}T10:00:00Z"></head><body><nav>menu</nav><article><h1>${title}</h1><p>${"word ".repeat(words)}</p></article></body></html>`;

const mail: { to: string; subject: string; html: string }[] = [];
const realFetch = globalThis.fetch;
function J(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }
globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
  const req = input instanceof Request ? input : new Request(String(input), init);
  const url = new URL(req.url);
  if (url.hostname === "api.resend.com") { mail.push(await req.json()); return J({ id: "email_1" }); }
  if (url.hostname === "api.anthropic.com") {
    const b = await req.json();
    const system = typeof b.system === "string" ? b.system : b.system.map((s: { text: string }) => s.text).join("");
    const user = typeof b.messages[0].content === "string" ? b.messages[0].content : b.messages[0].content.map((c: { text: string }) => c.text).join("");
    try {
      const out = answer(system, user);
      return J({ id: "msg_1", type: "message", role: "assistant", model: b.model, content: [{ type: "text", text: JSON.stringify(out) }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } });
    } catch (e) { return J({ type: "error", error: { type: "invalid_request_error", message: String(e) } }, 400); }
  }
  if (url.hostname === "news.test") {
    if (url.pathname === "/claude-9") return new Response(article("Introducing Claude 9", 400));
    if (url.pathname === "/gemini-9") return new Response(article("Gemini 9 adds nothing", 400, day(1)));
    if (url.pathname === "/webinar") return new Response(article("Webinar recap: patients", 400));
    if (url.pathname === "/thin") return new Response(article("A thin post", 40));
    if (url.pathname === "/refused") return new Response("Forbidden", { status: 403 });
    return new Response("nope", { status: 404 });
  }
  if (url.hostname === "blog.google") return new Response(FEED, { headers: { "content-type": "application/rss+xml" } });
  if (url.hostname === "www.anthropic.com") return url.pathname === "/news/listed-post" ? new Response(article("Webinar recap: listed", 300)) : new Response(LISTING);
  if (url.hostname === "mock.supabase.test") {
    if (url.pathname === "/rest/v1/rpc/ai_news_cron_ok") return J((await req.json()).s === "cron-secret");
    const t = url.pathname.replace("/rest/v1/", ""); if (!db[t]) return J({ message: "unmocked table " + t }, 500);
    const one = (req.headers.get("accept") ?? "").includes("pgrst.object"), prefer = req.headers.get("prefer") ?? "";
    const want = (rows: Row[]) => one ? (rows.length === 1 ? J(rows[0]) : rows.length ? J({ message: "many" }, 406) : J({ message: "no rows", code: "PGRST116" }, 406)) : J(rows);
    const f = filters(url.searchParams);
    if (req.method === "GET") return want(db[t].filter(f));
    if (req.method === "POST") {
      const body = await req.json(); const list: Row[] = Array.isArray(body) ? body : [body]; const out: Row[] = [];
      try {
        for (const r of list) {
          const k = KEY[t], ex = prefer.includes("merge-duplicates") ? db[t].find((x) => x[k] === r[k]) : undefined;
          if (ex) { Object.assign(ex, r); out.push(ex); } else out.push(insertRow(t, r));
        }
      } catch (e) { return J({ message: String(e), code: "23505" }, 409); }
      return prefer.includes("return=representation") ? want(out) : new Response(null, { status: 201 });
    }
    if (req.method === "PATCH") { const body = await req.json(); const rows = db[t].filter(f); rows.forEach((r) => Object.assign(r, body)); return prefer.includes("return=representation") ? want(rows) : new Response(null, { status: 204 }); }
    return J({ message: "unmocked " + req.method }, 500);
  }
  // every other official source "cannot be read" in this test
  if (["cloudblog.withgoogle.com", "developer.apple.com", "about.fb.com", "developers.meta.com", "elevenlabs.io", "adsknews.autodesk.com"].includes(url.hostname)) return new Response("down", { status: 503 });
  return realFetch(input as string, init);
};

Deno.env.set("SUPABASE_URL", "https://mock.supabase.test"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service"); Deno.env.set("ANTHROPIC_API_KEY", "sk-test");
Deno.env.set("RESEND_API_KEY", "re_test"); Deno.env.set("MAIL_FROM", "news@takgio.test"); Deno.env.set("AI_NEWS_EMAIL_TO", "ted@takgio.test");

let handler: (r: Request) => Promise<Response> = () => Promise.reject(new Error("no handler"));
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: (r: Request) => Promise<Response>) => { handler = h; return { finished: Promise.resolve() }; };
let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") { if (ok) { pass++; console.log("  ok   " + name); } else { fail++; console.log("  FAIL " + name + (detail ? "  -> " + detail : "")); } }
const run = (body: unknown, secret = "cron-secret") => handler(new Request("https://fn.test/ai-news-daily", { method: "POST", headers: { "content-type": "application/json", "x-cron-secret": secret }, body: JSON.stringify(body) }));

const root = "file:///" + Deno.args[0].replace(/\\/g, "/") + "/supabase/functions/";
await import(root + "ai-news-daily/index.ts?t=d");
const daily = handler;

console.log("ai-news-daily");
check("refuses a call without the cron secret", (await run({}, "wrong")).status === 401);

let r = await (await run({ dry: true })).json();
check("dry run: would add only the story that passed every step", r.would_add?.length === 1 && r.would_add[0].headline === "Introducing Claude 9", JSON.stringify(r.would_add));
check("dry run: writes nothing and sends nothing", db.ai_news_items.length === 0 && db.ai_news_seen.length === 0 && mail.length === 0);
check("dry run: reports the sources that could not be read", String(r.sources?.["Apple Developer"]).startsWith("could not"), JSON.stringify(r.sources));

claude.calls.length = 0; mail.length = 0;
r = await (await run({})).json();
const items = db.ai_news_items, wk = monday(day(0));
check("run: one story added, from the article's own title", items.length === 1 && items[0].headline === "Introducing Claude 9" && items[0].origin === "auto", JSON.stringify(items));
check("run: story stores the source link, date, topic and ticker", items[0]?.source_url === "https://news.test/claude-9" && items[0]?.source_date === day(0) && items[0]?.topic === "Models" && items[0]?.ticker === "Anthropic ships a new Claude model");
check("run: the week is created, published, and summarised by the job", db.ai_news_weeks.some((w) => w.week_start === wk && w.status === "published" && w.brief_auto === true && w.brief === "Anthropic shipped a new Claude model this week."), JSON.stringify(db.ai_news_weeks));
const seen = Object.fromEntries(db.ai_news_seen.map((s) => [s.url, s.decision]));
check("run: a story that failed the fact check is not published, and is remembered", seen["https://news.test/gemini-9"] === "failed check" && !items.some((i) => i.source_url === "https://news.test/gemini-9"));
check("run: an article judged not relevant on reading is remembered", seen["https://news.test/webinar"] === "not relevant");
check("run: a post the picker skipped is remembered", seen["https://news.test/hiring"] === "not relevant");
check("run: a post older than the window is remembered as too old", seen["https://news.test/old"] === "too old");
check("run: an article with too little text is not written up", seen["https://news.test/thin"] === "too little text");
check("run: an article page that refuses servers is a final decision, not retried", seen["https://news.test/refused"] === "too little text");
check("run: the listing source is read through its articles", seen["https://www.anthropic.com/news/listed-post"] === "not relevant" && !("https://www.anthropic.com/about" in seen), JSON.stringify(seen));
check("run: one email, to the right person", mail.length === 1 && mail[0].to === "ted@takgio.test");
check("run: the email has a pull link with this story's secret token", mail[0]?.html.includes(`/ai-news-pull.html#t=${items[0]?.pull_token}`));
check("run: the email names the sources that could not be read", mail[0]?.html.includes("could not be read"));
check("run: a run record is kept", db.ai_news_runs.length === 1 && db.ai_news_runs[0].added === 1);

claude.calls.length = 0; mail.length = 0;
r = await (await run({})).json();
check("second run: nothing seen before is looked at again", !claude.calls.includes("write") && db.ai_news_items.length === 1, claude.calls.join(","));

// a failed pick marks nothing as seen, so the posts are tried again tomorrow
db.ai_news_seen.length = 0; db.ai_news_items.length = 0; db.ai_news_weeks.length = 0; claude.pickFails = true;
r = await (await run({})).json();
check("pick failure: nothing is marked seen (retried tomorrow)", db.ai_news_seen.every((s) => s.decision === "too old") && !!r.pick_error, JSON.stringify(db.ai_news_seen.map((s) => s.decision)));
claude.pickFails = false;

// an editor's draft week with an editor's story is not published by the job
db.ai_news_seen.length = 0; db.ai_news_items.length = 0; db.ai_news_weeks.length = 0; mail.length = 0;
db.ai_news_weeks.push({ week_start: wk, brief: "Editor's draft", status: "draft", brief_auto: false });
db.ai_news_items.push({ id: crypto.randomUUID(), slug: "editor-story", week_start: wk, origin: "editor", hidden: false, source_url: "https://x.test/e", headline: "E", summary: "S", source: "X" });
r = await (await run({})).json();
const w2 = db.ai_news_weeks.find((w) => w.week_start === wk)!;
check("draft week: the job's story is added but the editor's draft stays a draft", w2.status === "draft" && db.ai_news_items.length === 2 && (r.held ?? []).includes(wk), JSON.stringify(w2));
check("draft week: the job never rewrites an editor's summary", w2.brief === "Editor's draft");
check("draft week: the email says the week is waiting for an editor", mail[0]?.html.includes("editor&rsquo;s draft"));

console.log("ai-news-pull");
await import(root + "ai-news-pull/index.ts?t=p");
const pull = handler;
const auto = db.ai_news_items.find((i) => i.origin === "auto")!;
const post = (b: unknown) => pull(new Request("https://fn.test/ai-news-pull", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }));
let p = await post({ token: auto.pull_token }); let pb = await p.json();
check("pull: the story is hidden, not deleted", p.status === 200 && pb.status === "pulled" && auto.hidden === true && db.ai_news_items.includes(auto));
pb = await (await post({ token: auto.pull_token })).json();
check("pull: a second press says it is already pulled", pb.status === "already");
check("pull: a malformed token is refused", (await post({ token: "x" })).status === 400);
check("pull: an unknown token is refused", (await post({ token: crypto.randomUUID() })).status === 404);
const ed = db.ai_news_items.find((i) => i.origin === "editor")!; ed.pull_token = crypto.randomUUID();
check("pull: an editor's story cannot be pulled by link", (await post({ token: ed.pull_token })).status === 404 && ed.hidden === false);
const g = await pull(new Request(`https://fn.test/ai-news-pull?token=${auto.pull_token}`));
check("pull: opening the link sends you to the page, it pulls nothing", g.status === 302 && (g.headers.get("location") ?? "").includes("/ai-news-pull.html#t="));
void daily;

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) Deno.exit(1);
