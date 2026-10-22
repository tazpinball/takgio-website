// ai-news-pull: takes one automatic AI news story off the site, from the "Pull this story" link in the daily email.
// Supabase rewrites any HTML a function returns to plain text, so this function never serves a page. The page Ted sees is
// ai-news-pull.html on the site; it posts here. Deploy with --no-verify-jwt (the page cannot send a login).
// The story is hidden, not deleted: an editor can restore it in the careers admin, AI news tab.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE = Deno.env.get("SITE_URL") ?? "https://www.takgio.com";
const CORS = { "Access-Control-Allow-Origin": SITE, "Access-Control-Allow-Headers": "content-type, apikey", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  // A plain link goes on to the page on the site. Opening that page pulls nothing: only its button does, because mail
  // scanners open every link in a message.
  if (req.method === "GET") {
    const t = new URL(req.url).searchParams.get("token") ?? "";
    return new Response(null, { status: 302, headers: { Location: `${SITE}/ai-news-pull.html${UUID.test(t) ? "#t=" + t : ""}` } });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let token = "";
  try { token = String((await req.json()).token ?? ""); } catch { return json({ error: "That did not look right. Please use the link from the email." }, 400); }
  if (!UUID.test(token)) return json({ error: "That link is not valid. Please use the link from the email." }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: s } = await db.from("ai_news_items").select("id,headline,hidden").eq("pull_token", token).eq("origin", "auto").maybeSingle();
  if (!s) return json({ error: "That link is not valid. The story may have been deleted." }, 404);
  if (s.hidden) return json({ ok: true, status: "already", headline: s.headline });
  const up = await db.from("ai_news_items").update({ hidden: true }).eq("id", s.id);
  if (up.error) return json({ error: "The story could not be pulled just now. Please try again." }, 500);
  return json({ ok: true, status: "pulled", headline: s.headline });
});
