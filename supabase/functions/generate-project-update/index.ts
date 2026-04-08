import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Fetch a file from GitHub, returning decoded text or null on 404
async function fetchGitHubFile(
  repo: string,
  path: string,
  token: string
): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.content) return null;
  return atob(data.content.replace(/\n/g, ""));
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // --- Auth: verify caller is logged in ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const githubToken = Deno.env.get("GITHUB_TOKEN")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    // Verify the user's JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Service-role client for DB operations
    const sb = createClient(supabaseUrl, serviceKey);

    // --- Parse request ---
    const { project_id } = await req.json();
    if (!project_id) {
      return jsonResponse({ error: "project_id is required" }, 400);
    }

    // --- Fetch project ---
    const { data: project, error: projErr } = await sb
      .from("projects")
      .select("id, name, github_repo, tech_stack, version, description")
      .eq("id", project_id)
      .single();

    if (projErr || !project) {
      return jsonResponse({ error: "Project not found" }, 404);
    }
    if (!project.github_repo) {
      return jsonResponse(
        { error: "No GitHub repo configured for this project" },
        400
      );
    }

    // --- Get last update date ---
    const { data: lastUpdateArr } = await sb
      .from("updates")
      .select("created_at")
      .eq("project_id", project_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const sinceDate =
      lastUpdateArr && lastUpdateArr.length > 0
        ? lastUpdateArr[0].created_at
        : new Date(Date.now() - 30 * 86400000).toISOString(); // default: 30 days ago

    // --- Fetch GitHub data in parallel ---
    const repo = project.github_repo;

    const [commitsRes, packageJson, summaryMd, claudeMd, readmeMd] =
      await Promise.all([
        // Recent commits since last update
        fetch(
          `https://api.github.com/repos/${repo}/commits?since=${sinceDate}&per_page=50`,
          {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github.v3+json",
            },
          }
        ),
        fetchGitHubFile(repo, "package.json", githubToken),
        fetchGitHubFile(repo, "SUMMARY.md", githubToken),
        fetchGitHubFile(repo, "CLAUDE.md", githubToken),
        fetchGitHubFile(repo, "README.md", githubToken),
      ]);

    // Process commits
    let commitLog = "No commits found in this period.";
    if (commitsRes.ok) {
      const commits = await commitsRes.json();
      if (Array.isArray(commits) && commits.length > 0) {
        commitLog = commits
          .map(
            (c: { sha: string; commit: { message: string; author: { date: string } } }) =>
              `${c.commit.author.date.slice(0, 16)} - ${c.commit.message.split("\n")[0]}`
          )
          .join("\n");
      } else {
        return jsonResponse(
          { error: "No new commits since the last update." },
          400
        );
      }
    } else {
      const ghErr = await commitsRes.text();
      return jsonResponse(
        { error: `GitHub API error: ${commitsRes.status} — ${ghErr.slice(0, 200)}` },
        502
      );
    }

    // Pick best docs file (SUMMARY.md > CLAUDE.md > README.md)
    let docsContent = summaryMd || claudeMd || readmeMd || "";
    // Truncate to last 8000 chars (most recent entries)
    if (docsContent.length > 8000) {
      docsContent = docsContent.slice(-8000);
    }

    // Parse version from package.json
    let pkgVersion: string | null = null;
    let dependencies = "";
    if (packageJson) {
      try {
        const pkg = JSON.parse(packageJson);
        pkgVersion = pkg.version || null;
        const deps = Object.keys(pkg.dependencies || {});
        const devDeps = Object.keys(pkg.devDependencies || {});
        dependencies = [...deps, ...devDeps].join(", ");
      } catch { /* ignore parse errors */ }
    }

    // --- Build Anthropic prompt ---
    const prompt = `You are generating a project status update for "${project.name}".

Here are the recent git commits since the last update (${sinceDate.slice(0, 10)}):
${commitLog}

${packageJson ? `Here is package.json:\n${packageJson}\n` : ""}
${docsContent ? `Here is a recent excerpt from the project documentation:\n${docsContent}\n` : ""}
${project.tech_stack?.length ? `Known tech stack: ${project.tech_stack.join(", ")}` : ""}
${project.version ? `Current dashboard version: ${project.version}` : ""}
${pkgVersion ? `Current repo version: ${pkgVersion}` : ""}

Based on this information, produce a JSON object with exactly these fields:

{
  "content": "A 2-4 sentence summary of what was accomplished. Focus on features built, bugs fixed, and meaningful progress. Write in past tense. Be specific about what changed.",
  "hours": <number — estimate total development hours based on commit timestamps and volume. Look at the time span between first and last commit plus commit complexity. Round to nearest 0.5.>,
  "tools": ["tool1", "tool2"],
  "version": "x.y.z or null",
  "release_notes": "A 1-2 sentence summary of what changed from a user perspective."
}

For "tools": list the 3-5 most significant frameworks/libraries used (from dependencies and commit context). Skip generic ones like "Node.js" or "npm".
For "version": use the repo's package.json version if available, otherwise null.

Return ONLY the raw JSON object. No markdown fences, no explanation.`;

    // --- Call Anthropic API ---
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return jsonResponse(
        { error: `Anthropic API error: ${anthropicRes.status} — ${errText.slice(0, 200)}` },
        502
      );
    }

    const anthropicData = await anthropicRes.json();
    const rawText =
      anthropicData.content?.[0]?.text || anthropicData.content?.[0]?.value || "";

    // Parse the JSON response
    let parsed: {
      content: string;
      hours: number;
      tools: string[];
      version: string | null;
      release_notes: string | null;
    };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return jsonResponse(
        { error: "AI generated an invalid response. Please try again." },
        502
      );
    }

    if (!parsed.content) {
      return jsonResponse({ error: "AI response missing content field." }, 502);
    }

    // --- Insert update ---
    const hours = parsed.hours ? Math.round(parsed.hours * 4) / 4 : null; // round to 0.25
    const timeSpent = hours
      ? hours === 1
        ? "1 hour"
        : hours + " hours"
      : null;

    const updateRow = {
      project_id,
      content: parsed.content,
      hours,
      time_spent: timeSpent,
      tools: parsed.tools || [],
      version: parsed.version || null,
      release_notes: parsed.release_notes || null,
      update_type: "claude",
      created_by: null,
      created_by_name: "Claude",
    };

    const { error: insertErr } = await sb.from("updates").insert([updateRow]);
    if (insertErr) {
      return jsonResponse(
        { error: "Failed to insert update: " + insertErr.message },
        500
      );
    }

    // Touch project's updated_at
    await sb
      .from("projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", project_id);

    return jsonResponse({ success: true, update: updateRow });
  } catch (err) {
    return jsonResponse(
      { error: "Unexpected error: " + (err as Error).message },
      500
    );
  }
});
