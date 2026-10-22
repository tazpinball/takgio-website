// The official sources the daily AI news job reads, and how to turn a post into plain text.
// Every source is the company's own newsroom, blog or developer news. No news sites, no social media.
// Checked from a server on Oct 22, 2026: all of these answer; OpenAI's articles refuse servers (only the feed's title and
// one line come through), so OpenAI posts are skipped as "too little text" unless a partner's page carries the story.

export type Source = { name: string; kind: "rss" | "listing"; url: string; link?: RegExp };
export type Post = { source: string; url: string; title: string; date: string | null; blurb: string };
export type Article = { title: string; date: string | null; text: string; words: number };

export const SOURCES: Source[] = [
  { name: "Anthropic", kind: "listing", url: "https://www.anthropic.com/news", link: /^https:\/\/www\.anthropic\.com\/news\/[a-z0-9-]+$/ },
  { name: "OpenAI", kind: "rss", url: "https://openai.com/news/rss.xml" },
  { name: "Google", kind: "rss", url: "https://blog.google/technology/ai/rss/" },
  { name: "Google Cloud", kind: "rss", url: "https://cloudblog.withgoogle.com/products/ai-machine-learning/rss/" },
  { name: "Apple Developer", kind: "rss", url: "https://developer.apple.com/news/rss/news.rss" },
  { name: "Meta", kind: "rss", url: "https://about.fb.com/feed/" },
  { name: "Meta for Developers", kind: "listing", url: "https://developers.meta.com/blog/", link: /^https:\/\/developers\.meta\.com\/blog\/[a-z0-9-]+\/?$/ },
  { name: "ElevenLabs", kind: "rss", url: "https://elevenlabs.io/blog/rss.xml" },
  { name: "Autodesk", kind: "listing", url: "https://adsknews.autodesk.com/en/news/", link: /^https:\/\/adsknews\.autodesk\.com\/en\/(news|pressrelease)\/[a-z0-9-]+\/?$/ },
];

const UA = "Mozilla/5.0 (compatible; TakgioNewsBot/1.0; +https://www.takgio.com)";
const LISTING_MAX = 8; // newest links taken from a listing page per run (the job looks up their dates on the article)

export async function get(url: string, ms = 20000): Promise<string> {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.text();
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…" };
export function decode(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
export function toText(html: string): string {
  return decode(html.replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

/** "Thu, 22 Oct 2026 06:00:00 GMT" or an ISO date -> "2026-10-22" (UTC), or null. */
export function isoDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s.trim());
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]).trim() : null;
}

export function parseFeed(xml: string, source: string): Post[] {
  const out: Post[] = [];
  for (const m of xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const b = m[0];
    let link = tag(b, "link") ?? "";
    if (!/^https:\/\//.test(link)) link = (b.match(/<link[^>]*href="(https:[^"]+)"/i) ?? [])[1] ?? "";
    const title = tag(b, "title") ?? "";
    if (!link || !title) continue;
    const blurb = toText(tag(b, "content:encoded") ?? tag(b, "description") ?? tag(b, "summary") ?? "");
    out.push({ source, url: link.trim(), title: toText(title), date: isoDate(tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated")), blurb: blurb.slice(0, 600) });
  }
  return out;
}

export function listingLinks(html: string, base: string, pattern: RegExp): string[] {
  const seen = new Set<string>(), out: string[] = [];
  for (const m of html.matchAll(/href="([^"#?]+)"/g)) {
    let u: string;
    try { u = new URL(decode(m[1]), base).toString(); } catch { continue; }
    if (pattern.test(u) && u !== base && !seen.has(u)) { seen.add(u); out.push(u); }
  }
  return out.slice(0, LISTING_MAX);
}

/** The article's own title, publication date and body text. */
export function parseArticle(html: string): Article {
  const meta = (p: string) => (html.match(new RegExp(`<meta[^>]+(?:property|name)="${p}"[^>]+content="([^"]*)"`, "i")) ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${p}"`, "i")) ?? [])[1] ?? null;
  const ld = (html.match(/"datePublished"\s*:\s*"([^"]+)"/) ?? [])[1] ?? null;
  // <time datetime="..."> where the page has it; otherwise the first <time>'s own text (Meta for Developers: <time>Sep 24, 2026</time>)
  const time = (html.match(/<time[^>]+datetime="([^"]+)"/i) ?? html.match(/<time[^>]*>([^<]{6,40})<\/time>/i) ?? [])[1] ?? null;
  const title = decode(meta("og:title") ?? tag(html, "title") ?? "").replace(/\s+[|–-]\s+[^|–-]+$/, "").trim();
  const date = isoDate(meta("article:published_time") ?? ld ?? time);
  const body = (html.match(/<article\b[\s\S]*?<\/article>/i) ?? html.match(/<main\b[\s\S]*?<\/main>/i) ?? [html])[0]
    .replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ");
  const text = toText(body).slice(0, 24000);
  return { title, date, text, words: text.split(/\s+/).filter(Boolean).length };
}

/** New candidate posts from one source: feed items as they are; listing links with title and date read from the article. */
export async function readSource(s: Source): Promise<Post[]> {
  const page = await get(s.url);
  if (s.kind === "rss") return parseFeed(page, s.name);
  const posts: Post[] = [];
  for (const url of listingLinks(page, s.url, s.link!)) {
    try {
      const a = parseArticle(await get(url));
      posts.push({ source: s.name, url, title: a.title, date: a.date, blurb: a.text.slice(0, 600) });
    } catch { /* one unreadable article does not stop the rest */ }
  }
  return posts;
}
