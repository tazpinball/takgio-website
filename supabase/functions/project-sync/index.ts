// project-sync: keeps the project dashboard current on its own. Twice a week (Friday 6 PM and Monday 1 PM, New York time;
// pg_cron, docs/dashboard-sync-schema.sql) it reads each dashboard project's GitHub repos. For every project with new
// commits since its last sync, Claude reads the commits and the project's own status file (HANDOFF.md, else SUMMARY.md,
// CLAUDE.md or README.md), writes a short update, and sets the stage (Ted, 11 Nov 2026: "Move it automatically").
// A project with no new commits is left alone.
//
// Deploy with --no-verify-jwt. Two kinds of caller:
//   * the scheduler, with the x-cron-secret header (checked by the database, project_sync_cron_ok). Cron runs in UTC, so the
//     schedule fires at both UTC hours a slot can fall on (summer and winter time); the call outside the slot is skipped.
//   * a signed-in dashboard user (Authorization: Bearer <login token>): the "Sync now" button. Runs at once.
// POST body: {} = a normal run; {"project_id": "<uuid>"} = only that project; {"dry": true} = do everything, write nothing.
// Secrets: GITHUB_TOKEN (read access to the repos), optionally GITHUB_TOKEN_<OWNER> for repos of another owner
// (e.g. GITHUB_TOKEN_TAKGIO for takgio/*), and ANTHROPIC_API_KEY.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { client, summarize, type Commit } from "./claude.ts";

export const SLOTS = [{ day: "Fri", hour: 18 }, { day: "Mon", hour: 13 }]; // New York time
const FIRST_LOOK_DAYS = 30;  // a project that was never synced: look this far back
const MAX_COMMITS = 150;     // per project, newest first, sent to Claude
const DOC_CHARS = 6000;      // how much of the status file Claude reads (the start, where the current state is)
const PARALLEL = 4;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const DOCS = ["HANDOFF.md", "SUMMARY.md", "CLAUDE.md", "README.md"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b, null, 2), { status, headers: { ...cors, "content-type": "application/json" } });

// Is `d` inside a slot, in New York time?
export function inSlot(d: Date): boolean {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", hourCycle: "h23" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return SLOTS.some((s) => s.day === p.weekday && s.hour === Number(p.hour));
}

export function reposOf(field: string | null | undefined): { ok: string[]; bad: string[] } {
  const all = (field ?? "").split(/[\s,]+/).map((s) => s.trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "")).filter(Boolean);
  return { ok: [...new Set(all.filter((r) => REPO_RE.test(r)))], bad: all.filter((r) => !REPO_RE.test(r)) };
}

function tokenFor(repo: string): string {
  const owner = repo.split("/")[0].toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return Deno.env.get(`GITHUB_TOKEN_${owner}`) ?? Deno.env.get("GITHUB_TOKEN") ?? "";
}
async function gh(repo: string, path: string, accept = "application/vnd.github+json"): Promise<Response> {
  const t = tokenFor(repo);
  return await fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: { Accept: accept, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "takgio-project-sync", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  });
}

// Commits on the default branch since `since`. Throws a readable reason when the repo can't be read.
async function commitsOf(repo: string, since: string): Promise<Commit[]> {
  const out: Commit[] = [];
  for (let page = 1; page <= 3 && out.length < MAX_COMMITS; page++) {
    const r = await gh(repo, `/commits?since=${encodeURIComponent(since)}&per_page=100&page=${page}`);
    if (r.status === 409) return out; // an empty repository
    if (!r.ok) {
      throw new Error(r.status === 404 ? "not found, or the GitHub token has no access to it" : r.status === 401 ? "the GitHub token was refused" : `GitHub answered ${r.status}`);
    }
    const list = await r.json() as { commit: { message: string; author?: { date?: string }; committer?: { date?: string } } }[];
    for (const c of list) {
      const lines = c.commit.message.split("\n").map((l) => l.trim()).filter(Boolean);
      // a merge commit says little on its first line; the PR title is on the next
      const text = (/^Merge (pull request|branch)/.test(lines[0] ?? "") && lines[1] ? lines[1] : lines[0] ?? "").slice(0, 200);
      out.push({ repo, date: c.commit.committer?.date ?? c.commit.author?.date ?? "", text });
    }
    if (list.length < 100) break;
  }
  return out;
}

async function statusDoc(repo: string): Promise<{ name: string; text: string } | null> {
  for (const name of DOCS) {
    const r = await gh(repo, `/contents/${name}`, "application/vnd.github.raw+json");
    if (r.ok) return { name, text: (await r.text()).slice(0, DOC_CHARS) };
    await r.body?.cancel();
  }
  return null;
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const queue = items.slice();
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => { while (queue.length) await fn(queue.shift()!); }));
}

type Project = { id: string; name: string; stage: string; description: string | null; github_repo: string | null; last_synced_at: string | null; last_commit_at: string | null };
type Result = { project: string; result: string; repos?: Record<string, string>; from?: string; to?: string; update?: string };

async function syncOne(db: SupabaseClient, ai: ReturnType<typeof client>, p: Project, now: Date, dry: boolean): Promise<Result> {
  const { ok: repos, bad } = reposOf(p.github_repo);
  const res: Result = { project: p.name, result: "", repos: {} };
  bad.forEach((b) => res.repos![b] = "not a GitHub repo name (owner/repo)");
  if (!repos.length) { res.result = "no valid GitHub repo"; return res; }

  const since = p.last_synced_at ?? new Date(now.getTime() - FIRST_LOOK_DAYS * 864e5).toISOString();
  const commits: Commit[] = [];
  let allRead = true;
  for (const repo of repos) {
    try { const c = await commitsOf(repo, since); commits.push(...c); res.repos![repo] = `${c.length} new commit${c.length === 1 ? "" : "s"}`; }
    catch (e) { allRead = false; res.repos![repo] = `could not be read: ${(e as Error).message}`; }
  }
  commits.sort((a, b) => b.date.localeCompare(a.date));
  const lastCommit = commits[0]?.date ?? null;

  if (!commits.length) {
    res.result = allRead ? "no new commits" : "no repo could be read";
    // move the "since" mark on only when every repo was read, so nothing is missed once access is fixed
    if (allRead && !dry) await db.from("projects").update({ last_synced_at: now.toISOString() }).eq("id", p.id);
    return res;
  }

  let doc: { name: string; text: string } | null = null;
  for (const repo of repos) { doc = await statusDoc(repo).catch(() => null); if (doc) { doc.name = `${repo}/${doc.name}`; break; } }

  let out;
  try { out = await summarize(ai, p, commits.slice(0, MAX_COMMITS), commits.length, since, doc); }
  catch (e) { res.result = `Claude could not write the update: ${(e as Error).message.slice(0, 160)}`; return res; }

  const moved = out.stage !== p.stage;
  const content = out.summary + (moved ? `\n\nStage moved from ${p.stage} to ${out.stage}: ${out.stage_reason}` : "");
  res.update = content;
  res.result = moved ? "update written, stage moved" : "update written";
  if (moved) { res.from = p.stage; res.to = out.stage; }
  if (dry) return res;

  const ins = await db.from("updates").insert([{
    project_id: p.id, content, version: out.version, update_type: "claude", created_by: null, created_by_name: "Claude (weekly sync)",
  }]);
  if (ins.error) { res.result = `could not save the update: ${ins.error.message}`; return res; }
  // the mark moves on even if one of several repos could not be read, so the same commits are never written up twice
  const patch: Record<string, unknown> = { updated_at: now.toISOString(), last_synced_at: now.toISOString(), last_commit_at: lastCommit };
  if (moved) patch.stage = out.stage;
  if (out.version) patch.version = out.version;
  const up = await db.from("projects").update(patch).eq("id", p.id);
  if (up.error) { res.result = `update saved, but the project could not be changed: ${up.error.message}`; return res; }
  if (moved) await db.from("stage_transitions").insert([{ project_id: p.id, from_stage: p.stage, to_stage: out.stage, changed_by: null, changed_by_name: "Claude (weekly sync)" }]);
  return res;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // who is calling: the scheduler, or a signed-in dashboard user
  let trigger: "schedule" | "manual" = "manual";
  const given = req.headers.get("x-cron-secret") ?? "";
  if (given) {
    const ok = await db.rpc("project_sync_cron_ok", { s: given });
    if (ok.data !== true) return json({ error: "Not allowed" }, 401);
    trigger = "schedule";
  } else {
    const auth = req.headers.get("Authorization") ?? "";
    const userDb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data, error } = await userDb.auth.getUser();
    if (error || !data?.user) return json({ error: "Sign in first" }, 401);
  }

  let body: { dry?: boolean; project_id?: string; at?: string } = {};
  try { body = await req.json(); } catch { /* an empty body is a normal run */ }
  const dry = !!body.dry;
  // `at` lets a test pretend it is another time; only the scheduler's calls are checked against the slots
  const now = trigger === "schedule" && body.at ? new Date(body.at) : new Date();
  if (trigger === "schedule" && !inSlot(now)) return json({ skipped: "outside the Friday 6 PM / Monday 1 PM New York slots" });

  let q = db.from("projects").select("id, name, stage, description, github_repo, last_synced_at, last_commit_at");
  if (body.project_id) q = q.eq("id", body.project_id);
  const { data: rows, error } = await q;
  if (error) return json({ error: "Could not read the projects: " + error.message }, 500);
  const projects = (rows ?? []) as Project[];
  const withRepo = projects.filter((p) => (p.github_repo ?? "").trim());

  const ai = client(Deno.env.get("ANTHROPIC_API_KEY")!);
  const results: Result[] = [];
  await pool(withRepo, PARALLEL, async (p) => { results.push(await syncOne(db, ai, p, now, dry)); });
  results.sort((a, b) => a.project.localeCompare(b.project));

  const report = {
    trigger, dry, ran_at: now.toISOString(),
    checked: withRepo.length,
    updated: results.filter((r) => r.result.startsWith("update written")).length,
    moved: results.filter((r) => r.to).map((r) => ({ project: r.project, from: r.from, to: r.to })),
    problems: results.filter((r) => Object.values(r.repos ?? {}).some((v) => v.startsWith("could not") || v.startsWith("not a")) || /^(Claude|could not|no valid|no repo)/.test(r.result))
      .map((r) => r.project),
    no_repo: projects.filter((p) => !(p.github_repo ?? "").trim()).map((p) => p.name).sort(),
    projects: results,
  };
  if (!dry) await db.from("project_sync_runs").insert([{ trigger, checked: report.checked, updated: report.updated, moved: report.moved.length, report }]);
  return json(report);
});
