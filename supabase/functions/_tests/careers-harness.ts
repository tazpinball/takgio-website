// Offline test for careers-apply and careers-confirm: runs the REAL function code with Supabase, Resend and Cloudflare
// replaced by in-memory stand-ins (no network, no secrets, nothing is written anywhere).
// Run from the project root (Deno 2.x; if Deno is not installed:  npm install deno  in any scratch folder):
//   deno run -A supabase/functions/_tests/careers-harness.ts "<absolute path to the project root>"
// Folders that start with an underscore are not deployed by the Supabase CLI. Expect: 38 passed, 0 failed.
// Runs the REAL careers-apply and careers-confirm code with Supabase / Resend / Turnstile replaced by in-memory stand-ins.
// Usage: deno run -A harness.ts
type Call = { method: string; url: string; body?: unknown; headers: Record<string, string> };

const calls: Call[] = [];
const state = {
  job: { id: "11111111-1111-1111-1111-111111111111", status: "published", apply_close: null as string | null, title: "Claude Certification Opportunity", notify_email: null as string | null },
  jobExists: true,
  priorCount: 0,
  uploadFails: false,
  resendStatus: 200,
  turnstileOk: true,
  app: null as null | Record<string, unknown>,
};
const APP_ID = "22222222-2222-2222-2222-222222222222";
const TOKEN = "33333333-3333-3333-3333-333333333333";

const realFetch = globalThis.fetch;
function J(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}
globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
  const req = input instanceof Request ? input : new Request(String(input), init);
  const url = new URL(req.url);
  let body: unknown = undefined;
  const ct = req.headers.get("content-type") ?? "";
  try { body = ct.includes("json") ? await req.clone().json() : ct.includes("x-www-form") ? Object.fromEntries(new URLSearchParams(await req.clone().text())) : undefined; } catch { /* ignore */ }
  const headers: Record<string, string> = {}; req.headers.forEach((v, k) => headers[k] = v);
  calls.push({ method: req.method, url: req.url, body, headers });
  const accept = req.headers.get("accept") ?? "";
  const wantsObject = accept.includes("pgrst.object");

  if (url.hostname === "challenges.cloudflare.com") return J({ success: state.turnstileOk });
  if (url.hostname === "api.resend.com") return state.resendStatus === 200 ? J({ id: "email_1" }) : J({ message: "mocked failure" }, state.resendStatus);
  if (url.hostname === "mock.supabase.test") {
    const p = url.pathname;
    if (p === "/rest/v1/jobs" && req.method === "GET") return state.jobExists ? (wantsObject ? J(state.job) : J([state.job])) : (wantsObject ? J({ message: "no rows" }, 406) : J([]));
    if (p === "/rest/v1/job_applications") {
      if (req.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": `*/${state.priorCount}` } });
      if (req.method === "POST") return J(wantsObject ? { id: APP_ID, confirm_token: TOKEN } : [{ id: APP_ID, confirm_token: TOKEN }], 201);
      if (req.method === "PATCH" || req.method === "DELETE") return new Response(null, { status: 204 });
      if (req.method === "GET") return state.app ? (wantsObject ? J(state.app) : J([state.app])) : (wantsObject ? J({ message: "no rows" }, 406) : J([]));
    }
    if (p.startsWith("/storage/v1/object/resumes") && req.method === "POST") return state.uploadFails ? J({ message: "mock upload failure", statusCode: "500", error: "x" }, 500) : J({ Key: "resumes/x", Id: "x" });
    if (p.startsWith("/storage/v1/object/resumes") && req.method === "DELETE") return J([]);
    return J({ message: "unmocked " + req.method + " " + p }, 500);
  }
  return realFetch(input as string, init);
};

// capture the handler each module registers
let handler: (r: Request) => Promise<Response> = () => Promise.reject(new Error("no handler"));
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: (r: Request) => Promise<Response>) => { handler = h; return { finished: Promise.resolve() }; };

Deno.env.set("SUPABASE_URL", "https://mock.supabase.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc-test-key");

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") { if (ok) { pass++; console.log("  ok   " + name); } else { fail++; console.log("  FAIL " + name + (detail ? "  -> " + detail : "")); } }
const reset = () => { calls.length = 0; state.jobExists = true; state.job.status = "published"; state.job.apply_close = null; state.job.notify_email = null; state.priorCount = 0; state.uploadFails = false; state.resendStatus = 200; state.turnstileOk = true; state.app = null; };
const setSecrets = (o: Record<string, string | null>) => { for (const [k, v] of Object.entries(o)) v === null ? Deno.env.delete(k) : Deno.env.set(k, v); };
const FULL = { RESEND_API_KEY: "re_test", MAIL_FROM: "takgio careers <careers@mail.takgio.com>", TURNSTILE_SECRET: "tsecret", DEFAULT_NOTIFY_EMAIL: "ted@takgio.com" };

function formReq(over: Record<string, string | null> = {}, file: { name: string; size: number } | null | "none" = { name: "cv.pdf", size: 1000 }) {
  const fd = new FormData();
  const base: Record<string, string> = { first_name: "Ada", last_name: "Lovelace", email: "Ada@Example.com", phone: "555", state: "NJ", link_url: "https://linkedin.com/in/ada", work_authorized: "yes", exams: "", answer: "I like building things.", consent: "on", job_id: state.job.id, turnstile_token: "good" };
  for (const [k, v] of Object.entries({ ...base, ...over })) if (v !== null) fd.set(k, v);
  if (file && file !== "none") fd.set("resume", new File([new Uint8Array(file.size)], file.name, { type: "application/pdf" }));
  return new Request("https://mock.supabase.test/functions/v1/careers-apply", { method: "POST", body: fd });
}
const out = async (r: Response) => { const t = await r.text(); try { return { status: r.status, json: JSON.parse(t), text: t }; } catch { return { status: r.status, json: null, text: t }; } };
const dbCalls = () => calls.filter((c) => c.url.includes("mock.supabase.test"));
const mailCalls = () => calls.filter((c) => c.url.includes("api.resend.com"));

// ===================================================== careers-apply
console.log("careers-apply");
await import("file:///" + Deno.args[0].replace(/\\/g, "/") + "/supabase/functions/careers-apply/index.ts?t=a");
const apply = handler;

reset(); setSecrets(FULL);
let r = await apply(new Request("https://x.test/", { method: "OPTIONS" }));
check("OPTIONS answers with CORS for the site", r.status === 200 && r.headers.get("access-control-allow-origin") === "https://www.takgio.com");
r = await apply(new Request("https://x.test/", { method: "GET" })); check("GET is refused (405)", r.status === 405);

reset(); r = await apply(formReq({ website: "http://spam" })); let o = await out(r);
check("trap field: pretends success, touches nothing", o.status === 200 && o.json?.ok === true && calls.length === 0, JSON.stringify(calls.length));

reset(); setSecrets({ RESEND_API_KEY: null }); o = await out(await apply(formReq()));
check("no RESEND_API_KEY: refuses with 503 and saves nothing", o.status === 503 && dbCalls().length === 0, o.status + " " + dbCalls().length);
setSecrets(FULL);

reset(); o = await out(await apply(formReq({ first_name: "" }))); check("missing first name -> 400", o.status === 400 && /required/i.test(o.json?.error));
reset(); o = await out(await apply(formReq({ email: "not-an-email" }))); check("bad email -> 400", o.status === 400);
reset(); o = await out(await apply(formReq({ link_url: "linkedin.com/in/ada" }))); check("link without http(s) -> 400", o.status === 400);
reset(); o = await out(await apply(formReq({ consent: null }))); check("no consent box -> 400", o.status === 400);
reset(); o = await out(await apply(formReq({}, "none"))); check("no resume -> 400", o.status === 400 && /resume/i.test(o.json?.error));
reset(); o = await out(await apply(formReq({}, { name: "cv.exe", size: 1000 }))); check("resume .exe -> 400", o.status === 400 && /PDF or Word/.test(o.json?.error));
reset(); o = await out(await apply(formReq({}, { name: "cv.pdf", size: 6 * 1024 * 1024 }))); check("resume over 5 MB -> 400", o.status === 400 && /5 MB/.test(o.json?.error));

reset(); state.turnstileOk = false; o = await out(await apply(formReq())); check("failed bot check -> 400, nothing saved", o.status === 400 && /bot check/i.test(o.json?.error) && dbCalls().length === 0);
reset(); o = await out(await apply(formReq()));
const ts = calls.find((c) => c.url.includes("siteverify"));
check("bot check sends the secret and the token to Cloudflare", !!ts && (ts.body as Record<string, string>)?.secret === "tsecret" && (ts.body as Record<string, string>)?.response === "good", JSON.stringify(ts?.body));

reset(); state.jobExists = false; o = await out(await apply(formReq())); check("unknown job -> 400 'no longer open'", o.status === 400 && /no longer open/.test(o.json?.error));
reset(); state.job.status = "closed"; o = await out(await apply(formReq())); check("closed job -> 400", o.status === 400);
reset(); state.job.status = "draft"; o = await out(await apply(formReq())); check("draft job -> 400 (a draft can't take applications)", o.status === 400);
reset(); state.job.apply_close = "2020-01-01"; o = await out(await apply(formReq())); check("past close date -> 400", o.status === 400);
reset(); state.priorCount = 3; o = await out(await apply(formReq())); check("3 applications this hour from one email -> 429", o.status === 429);

reset(); o = await out(await apply(formReq()));
const ins = dbCalls().find((c) => c.method === "POST" && new URL(c.url).pathname === "/rest/v1/job_applications");
console.log("  (insert request seen: " + !!ins + (ins ? ", url query: " + new URL(ins.url).search.slice(0, 60) : "") + ")");
const mails = mailCalls(); const mb = mails[0]?.body as Record<string, string> | undefined;
check("success: 200 {ok:true}", o.status === 200 && o.json?.ok === true, o.text);
check("success: row saved with lower-cased email, job id, work_authorized=true", !!ins && (ins.body as Record<string, unknown>).email === "ada@example.com" && (ins.body as Record<string, unknown>).job_id === state.job.id && (ins.body as Record<string, unknown>).work_authorized === true, JSON.stringify(ins?.body));
check("success: resume uploaded to the private 'resumes' bucket", calls.some((c) => c.method === "POST" && c.url.includes("/storage/v1/object/resumes/" + APP_ID + "/")));
check("success: resume_path written back", dbCalls().some((c) => c.method === "PATCH" && JSON.stringify(c.body).includes("resume_path")));
check("success: exactly one confirmation email, to the applicant, from MAIL_FROM", mails.length === 1 && mb?.to === "ada@example.com" && mb?.from === FULL.MAIL_FROM, JSON.stringify(mb));
check("success: email link points at careers-confirm with the token", !!mb && String(mb.html).includes("https://mock.supabase.test/functions/v1/careers-confirm?token=" + TOKEN));
check("success: Resend called with the API key", mails[0]?.headers["authorization"] === "Bearer re_test");

reset(); state.resendStatus = 422; o = await out(await apply(formReq()));
check("Resend refuses: 502 and a clear message", o.status === 502 && /confirmation email/.test(o.json?.error), o.status + " " + o.text);
check("Resend refuses: application and resume are cleaned up", dbCalls().some((c) => c.method === "DELETE" && c.url.includes("/rest/v1/job_applications")) && calls.some((c) => c.method === "DELETE" && c.url.includes("/storage/v1/object/resumes")));

reset(); state.uploadFails = true; o = await out(await apply(formReq()));
check("resume upload fails: 500, application removed, no email sent", o.status === 500 && dbCalls().some((c) => c.method === "DELETE" && c.url.includes("job_applications")) && mailCalls().length === 0, o.status + " mails=" + mailCalls().length);

reset(); o = await out(await apply(formReq({ job_id: null }))); check("general application (no job id) succeeds", o.status === 200 && o.json?.ok === true && !calls.some((c) => c.url.includes("/rest/v1/jobs")));

// ===================================================== careers-confirm
console.log("careers-confirm");
await import("file:///" + Deno.args[0].replace(/\\/g, "/") + "/supabase/functions/careers-confirm/index.ts?t=c");
const confirm = handler;
const U = (m: string, t = TOKEN) => new Request("https://mock.supabase.test/functions/v1/careers-confirm?token=" + t, { method: m });
const unconfirmed = { id: APP_ID, first_name: "Ada", last_name: "Lovelace", job_id: state.job.id, email_confirmed_at: null };

reset(); setSecrets(FULL); o = await out(await confirm(U("GET", "not-a-token"))); check("GET with a malformed token -> 400", o.status === 400);
reset(); state.app = { ...unconfirmed }; o = await out(await confirm(U("GET")));
check("GET (a scanner opening the link): shows a button, confirms NOTHING", o.status === 200 && /<form method="post">/.test(o.text) && /Confirm my email/.test(o.text) && !dbCalls().some((c) => c.method === "PATCH") && mailCalls().length === 0, o.status + " patches=" + dbCalls().filter((c) => c.method === "PATCH").length);
reset(); o = await out(await confirm(U("POST", "not-a-token"))); check("POST with a malformed token -> 400", o.status === 400);
reset(); state.app = null; o = await out(await confirm(U("POST"))); check("POST with an unknown token -> 404", o.status === 404);
reset(); state.app = { ...unconfirmed }; state.job.notify_email = null; o = await out(await confirm(U("POST")));
let mm = mailCalls()[0]?.body as Record<string, string> | undefined;
check("POST confirms: marks email_confirmed_at", o.status === 200 && /you are confirmed/i.test(o.text) && dbCalls().some((c) => c.method === "PATCH" && JSON.stringify(c.body).includes("email_confirmed_at")), o.status + " " + o.text.slice(0, 80));
check("POST confirms: notifies DEFAULT_NOTIFY_EMAIL when the job has none", mailCalls().length === 1 && mm?.to === "ted@takgio.com" && /Claude Certification Opportunity/.test(String(mm?.html)), JSON.stringify(mm));
reset(); state.app = { ...unconfirmed }; state.job.notify_email = "stephen@takgio.com"; o = await out(await confirm(U("POST"))); mm = mailCalls()[0]?.body as Record<string, string> | undefined;
check("POST confirms: the job's own notify_email wins", mm?.to === "stephen@takgio.com", JSON.stringify(mm));
reset(); state.app = { ...unconfirmed, email_confirmed_at: "2026-10-08T00:00:00Z" }; o = await out(await confirm(U("POST")));
check("already confirmed: says so, changes nothing, sends nothing", o.status === 200 && /already confirmed/i.test(o.text) && !dbCalls().some((c) => c.method === "PATCH") && mailCalls().length === 0);
reset(); o = await out(await confirm(U("PUT"))); check("PUT -> 405", o.status === 405);

console.log(`\n${pass} passed, ${fail} failed`);
Deno.exit(fail ? 1 : 0);
