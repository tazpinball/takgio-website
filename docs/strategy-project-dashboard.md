# TAKGIO Project Dashboard — Strategy & Planning Document

**Authors:** Ted Takvorian, Claude
**Date:** April 6, 2026
**Status:** Draft

---

## 1. Purpose & Vision

### What Is TAKGIO

TAKGIO is an AI product studio that designs, builds, and deploys Claude-powered solutions for the construction and legal/compliance industries. It is a startup owned equally by three co-founders: Ted Takvorian, Ritchie Takvorian, and Steve Caggiano.

### The Problem

TAKGIO has a growing portfolio of AI product ideas and active projects, but no single place to see what's happening across all of them. Today, project status lives in Ted's head, in email threads to Ritchie, in scattered conversations. Nothing is centralized. The current Ideas page captures ideas when they're born but not their story — you can't see if something is thriving, stalling, or quietly dying. Ideas go in but progress doesn't come out.

### The Vision

A living dashboard where every TAKGIO project tells its own story: where it started, where it is, and what happened along the way. The three co-founders share a single operating view of the business — what's active, what's a priority, what needs attention, and what each person has been working on.

AI-generated progress summaries mean updates actually get written, because the friction is near zero. After a big work session, Claude summarizes what was done, the time spent, and the tools involved. The update gets published. The project's story grows over time.

### What It Replaces

- The current Ideas page (idea capture without progress tracking)
- Status emails between co-founders
- Mental tracking of what's active and what's fallen behind

### What It Is Not

This is not a document repository — project documents live elsewhere and are referenced via links. It is not a full project management tool like Jira or Asana. It is not public-facing. It is a lightweight, purpose-built status hub for a small team running a startup.

### The Long View

When progress is visible, it's easier to stay focused, prioritize, and course-correct. Over time, the accumulated history of each project becomes something more: a curated proof-of-progress that can be shared with potential investors, showing not just what TAKGIO has built, but the real work and momentum behind it.

## 2. Users & Roles

### The Team

TAKGIO is owned equally (1/3 each) by three co-founders. There is no hierarchy in access — everyone can see everything. But contribution patterns differ significantly.

| Person | Title | Primary Role on Dashboard |
|--------|-------|--------------------------|
| **Ted Takvorian** | President / Head of Design | Primary builder. Creates most projects, logs most updates. The main person Claude generates work summaries for. |
| **Ritchie Takvorian** | Legal / Accounting | Reviewer and responder. Checks project status, responds to requests from Ted, attaches documents when needed. |
| **Steve Caggiano** | Vice President / Marketing | Status consumer and occasional contributor. Wants the big picture across all projects. |

### Claude as an Actor

Claude is not a user in the traditional sense, but it is a key actor in the system. Claude generates work summaries, captures time spent and tools used, and publishes updates on behalf of users. The system should treat Claude-generated updates as first-class entries in a project's timeline.

### Role Definitions

**Builder** — Creates new ideas and projects, logs updates, assigns tasks and requests to others. Ted fills this role today. Others may step into it over time.

**Reviewer / Responder** — Sees project status, receives task requests, responds with answers or attached documents. Ritchie and Steve fill this role today.

**Observer (future)** — A read-only view for investors or advisors. Not part of v1, but the system should be designed with this role in mind so it can be added later without a rebuild.

### What Each Person Needs

- **Ted:** "What did I work on this week? What's the priority? What's falling behind?"
- **Ritchie:** "What does Ted need from me? What's the status of the things I care about?"
- **Steve:** "What's the status of everything? What's active, what shipped, what's stalled?"

To support Ritchie's and Steve's need to track specific projects, the dashboard should allow any user to **follow or favorite projects** they care about. This gives each person a personalized view without requiring them to scan every project on every visit.

### Notifications

When a task or request is assigned to someone (e.g., Ted asks Ritchie to review a contract), the assignee is notified by email and can also see it by checking the site. Both channels — push (email) and pull (dashboard) — so nothing falls through the cracks.

## 3. Project Lifecycle

### Stages

Every project moves through a simple, non-bureaucratic lifecycle. There are no rigid gates — an idea can jump straight to Active if Ted starts building it the same day. The stages reflect reality, not process.

| Stage | Meaning |
|-------|---------|
| **Idea** | Just a thought. Maybe a sentence and a category. No commitment, no active work. May include early research or a quick prototype to test viability. |
| **Active** | This is a real project. Work is happening. Updates are being logged. |
| **Paused** | Still viable, but deprioritized. Other things took precedence. Could resume at any time. |
| **Completed** | The current scope of work is finished. The project shipped what it set out to build. If it gets deployed to production, it moves to Live. |
| **Live** | Deployed and running in production. Supersedes Completed. Implies ongoing maintenance, monitoring, or iteration. A project that is both "done" and "running" is Live, not Completed. |
| **Discarded** | Evaluated and intentionally killed. Not coming back. |

### Priority as a Separate Axis

Priority is not baked into the lifecycle. It lives alongside stage as its own field:

- **High** — This is urgent or critical. Should be the focus of available time.
- **Medium** — Actively in the mix
- **Low** — Will get to it when there's bandwidth

Priority and stage interact but don't conflict. An Active + Low Priority project is real work that's happening at a relaxed pace. A Paused + High Priority project means "we had to step away, but this needs to resume soon." Priority reflects importance; stage reflects what's actually happening.

### Project Fields (Updated by a Person)

These are properties of the project record itself:

| Field | Description |
|-------|-------------|
| Project name | Short, recognizable name |
| Description | What this project is and why it matters |
| Stage | Current lifecycle stage (Idea through Discarded) |
| Priority | High / Medium / Low |
| Category | Automation, Product, Service, etc. |
| Industry | Target industry or sector |
| Client / Contact | Who this is for, if applicable |
| Tech stack | Tools and technologies used (Vercel, Supabase, LiveKit, etc.) |
| Version number | Current version, updated with each release |
| External links | Pointers to financial docs, technical docs, presentations |

### Related Activities (Separate Records, Tied to a Project)

These are not fields on the project record — they are their own entries stored in separate tables, linked back to the project:

| Activity | Description |
|----------|-------------|
| Activity updates | Manual entries or Claude-generated work summaries, each with its own timestamp, author, and metadata |
| Task assignments | Requests assigned to a team member, with description, assignee, and status |
| Task responses | Replies to tasks, with text and optional document attachments |

### Fields Updated by the System

| Field | Description |
|-------|-------------|
| Created date | When the idea was first entered |
| Created by | Who entered it |
| Last updated | Timestamp of most recent change or activity update |
| Last updated by | Who made the most recent change (including "Claude") |
| Stage transition history | Automatic log when stage changes (e.g., "Moved from Idea to Active on Apr 6, 2026 by Ted") |
| Staleness flag | Auto-flagged if an Active project has no updates in 2+ weeks |
| Update count | Total number of activity updates logged |
| Days in current stage | How long the project has been in its current stage |
| Time invested | Running total aggregated from individual update entries |

### Transitions Are Events

When a project moves from one stage to another, that transition is recorded as an event in the project's timeline. This creates a visible history: when did this go from Idea to Active? How long was it Paused? The lifecycle tells a story without anyone having to narrate it.

### Detecting "Falling Behind"

Rather than requiring estimated completion dates (which are unreliable at the Idea stage and often at every stage), the system flags silence. If a project is marked Active but hasn't had an update in 2+ weeks, it gets surfaced on the dashboard as potentially stalling. This is a nudge, not an alarm — it prompts a conscious decision to either update it, pause it, or keep going.

## 4. Core Features (v1)

### Dashboard (Main View)

The dashboard is the landing page after login. It answers: "What's happening across all projects right now?"

- **Project summary cards** — Each project displayed as a card showing name, stage badge, priority, last update date, and a staleness indicator if applicable
- **Filter and sort controls** — Filter by stage, priority, or category. Sort by last updated, priority, or name.
- **At-a-glance stats** — Total projects, how many are Active, how many are stale, how many are Live
- **Visual chart** — Projects by stage (similar to the current bar chart) plus a second view showing activity over time across the portfolio

### Project Detail Page

Clicking a project card opens the full detail view. This is where the project tells its story.

- **Project header** — Name, stage, priority, description, tech stack, current version, and external links (financial docs, technical docs, presentations)
- **Activity timeline** — Chronological feed of all updates: Claude-generated work summaries, manual entries, stage transitions, and task assignments. This is the heart of the entire system. Scroll through it and you see the full history of the project.
- **Editable fields** — Click to edit any project field inline. Changes to stage are automatically logged as transition events.
- **Task/request section** — List of open and completed requests assigned to team members, with their responses and any attached documents

### Activity Updates

Updates are how progress gets recorded. They can come from a person, from Claude, or from the system itself. The full update workflow — including how Claude-generated summaries are created and published — is detailed in Section 6.

- **Manual update entry** — Simple form: what you did, time spent, optional notes
- **Claude-generated updates** — Structured summaries published as first-class timeline entries (see Section 6)
- **Automatic events** — Stage changes, task creation, and task completion are logged by the system
- **Update metadata** — Every update records: who created it (person or Claude), when it was created, time spent, and tags for tools/technologies involved

### Task / Request System

Replaces the current workflow of emailing team members with requests. Tasks live within a project so context is always clear.

- **Create a request** — Assign to a team member, describe what's needed, attach it to a specific project
- **Respond to a request** — Reply with text, optionally attach a document (e.g., Ritchie attaching a reviewed contract)
- **Request status** — Open or Completed
- **Email notification** — The assignee receives an email when a new request is created for them

### Authentication

Replaces the current shared-password gate with proper individual accounts.

- **Individual user accounts** — Ted, Ritchie, and Steve each have their own login credentials
- **Supabase Auth** — Email/password authentication with proper session management, replacing the SHA-256 hash approach
- **Attributed actions** — Every update, edit, and task assignment is tied to the specific user who performed it

### What Is NOT in v1

The following are intentionally deferred to keep v1 focused and shippable:

- Revenue tracking per project
- Investor view or Observer role
- Automated update detection (Claude updates are triggered manually by the user)
- Due dates or timeline estimates
- Native mobile app (responsive web is sufficient)

## 5. Information Architecture

### Page Map

The password-protected section has a small, focused set of pages. The public TAKGIO site (homepage, services, case studies, contact) is completely unaffected.

| Page | Path | Purpose |
|------|------|---------|
| **Login** | `/login` | Email/password form. Clean, minimal. Replaces the current shared password gate. |
| **Dashboard** | `/dashboard` | Home after login. Project cards, filters, at-a-glance stats, and charts. The answer to "what's happening?" |
| **Project Detail** | `/project/{id}` | Full view of a single project: header, activity timeline, tasks, editable fields. Where the project's story lives. |
| **My Tasks** | `/tasks` | Personal view of everything assigned to the logged-in user across all projects. Ritchie logs in and immediately sees what Ted needs from him. |

### Key Interactions

- **Add new project** — Modal launched from the dashboard. Keeps things snappy without navigating away.
- **Edit project fields** — Inline editing on the project detail page. Click a field, change it, save.
- **Add an update** — Form within the project detail page. Supports manual entry or pasting a Claude-generated summary.
- **Create a task/request** — Form within the project detail page, in the tasks section.
- **Respond to a task** — Inline within the task on the project detail page or from the My Tasks page.

### Navigation

Minimal. A top bar or sidebar with:

- **Dashboard** — The main view
- **My Tasks** — Personal task queue
- **User menu** — Logout, account settings

No deep menus, no nested navigation. Three core destinations.

### Mobile Responsive

Not a separate design. The layout adapts: cards stack vertically, the activity timeline stays readable, forms remain usable. No native mobile app needed — responsive web handles the small team's needs.

## 6. Update Workflow

### The Core Loop

The update workflow is the engine of the whole system. If updates don't get written, the dashboard is dead. The key design principle is **low friction** — it should take less effort to log an update than to skip it.

### Claude-Generated Updates

The primary workflow:

1. Ted finishes a significant work session on a project
2. Ted opens Claude Code and says something like "summarize what I did on AI Tutor today"
3. Claude reviews the work — git commits, conversation context, what was built — and generates a structured summary
4. Ted reviews the summary, confirms or edits it
5. Claude publishes the update to the site via the Supabase API
6. The update appears as a new entry in the project's activity timeline

Every Claude-generated update follows a consistent structure:

- **What was done** — Plain-language summary of the work
- **Time spent** — How long the session took. Ted states this when prompting Claude (e.g., "I spent about 4 hours on this today"). Claude does not infer or track time automatically — it relies on the user to provide this.
- **Tools and technologies** — What was used or updated (e.g., Vercel, Supabase, LiveKit). Claude infers this from the work context (git commits, code changes, conversation).
- **Version / release notes** — If a new version was shipped, the version number and what changed

### Manual Updates

Not everything goes through Claude. Any team member can type an update directly on the site using a simple form: what happened, time spent, and optional notes. This covers situations like Ritchie reviewing a legal document, Steve having a marketing conversation, or Ted making a quick change that doesn't warrant a full Claude summary.

### Automatic Timeline Events

Some activity entries are generated by the system with no effort from anyone:

- **Stage changes** — When someone moves a project from Idea to Active, the system logs it as a timeline event
- **Task creation** — When a request is assigned, it appears in the timeline
- **Task completion** — When someone responds to and completes a request, that response shows up in the timeline with any attached documents

### Frequency

There is no required cadence. Updates happen when something meaningful happens. The staleness detection system (2+ weeks of silence on an Active project) handles the case where things have gone quiet — it's a nudge, not a mandate.

### The Habit

Over time, "finish working, tell Claude, summary gets published" becomes second nature. The friction is near zero: one sentence to Claude Code, a quick review, and the project's story grows. That's the goal.

### Future: Automation

Eventually, Claude could detect significant activity — a burst of git commits, a deployment event, a long Claude Code session — and proactively prompt Ted to confirm an update. This is not in v1 but the system should be designed to support it later.

## 7. Technical Direction

### Backend: Supabase

Supabase is already in use and handles everything the dashboard needs: database, authentication, real-time subscriptions, and file storage. No reason to switch.

**Authentication** — Upgrade from the current shared SHA-256 password gate to Supabase Auth. Email/password login with built-in session management, JWT tokens, and password reset. Each co-founder gets their own account.

**Row Level Security (RLS)** — Supabase RLS policies should be tightened so that data is only accessible through authenticated sessions. The current setup likely has permissive policies that need to be locked down.

**File Storage** — Supabase Storage for documents attached to task responses. A simple bucket with files linked to their associated task records.

**Email Notifications** — Supabase Edge Functions or a lightweight email service (e.g., Resend, SendGrid) to send notification emails when tasks are assigned to a team member.

### Data Model

The current single `ideas` table with a JSON `metadata` column needs to become a proper relational schema:

| Table | Purpose |
|-------|---------|
| `projects` | Core project record: name, description, stage, priority, category, industry, client, tech stack, version, external links |
| `updates` | Activity timeline entries: what was done, time spent, tools used, version/release notes, created by (person or Claude) |
| `tasks` | Requests assigned to team members: description, assignee, status, project reference |
| `task_responses` | Replies to tasks: text, optional file attachment, responder |
| `stage_transitions` | Automatic log of stage changes: from, to, changed by, timestamp |

### Frontend Approach

The current site is vanilla HTML/CSS/JS. The dashboard requires significantly more interactivity — inline editing, real-time updates, modals, filtering, activity timelines. A lightweight framework would help manage this complexity without overengineering.

The recommendation is to evaluate during implementation. Options range from staying vanilla with Alpine.js for reactivity, to adopting a framework like React if the complexity warrants it. The decision should favor whatever keeps the codebase simple and maintainable for a small team.

### Design Continuity

The existing design language carries forward: dark and vivid themes, the navy header, card-based layouts, the color system from `styles.css`. The dashboard evolves the current aesthetic rather than starting from scratch.

### API Access for Claude

Claude Code publishes updates by calling the Supabase API directly. Authentication can use either the user's session token (when Ted is logged in and triggers a summary) or a service-role key for direct API writes. The update is inserted into the `updates` table and immediately appears in the project's activity timeline.

### Hosting

Stays on Vercel. Static files for the public site, and the dashboard runs client-side with Supabase as the backend. No server-side rendering needed for a three-person team.

## 8. Future Roadmap

The following features are intentionally deferred from v1. They are captured here so they inform the system's design without delaying its launch.

### Near-Term (after v1 is stable)

**Activity analytics** — Charts showing work patterns over time: hours invested per project per week, which projects are getting the most attention, velocity trends. The data for this is being collected from day one via update entries, so the charts can be built whenever the team is ready.

**Richer notifications** — Slack integration, an in-app notification center, or weekly digest emails summarizing what happened across all projects. Reduces the need to actively check the dashboard.

**Mobile-optimized quick update** — A fast-entry mode for logging a brief update from a phone without navigating the full dashboard. Useful for quick notes after a meeting or a call.

### Medium-Term (as the portfolio grows)

**Automated update prompts** — Claude detects significant git activity, deployments, or long work sessions and proactively asks "want me to summarize this?" Reduces the last bit of friction in the update workflow.

**Project templates** — When creating a new project, start from a template that pre-fills category, tech stack, and standard initial tasks. Useful once enough projects have been created to see common patterns.

**Document preview** — Instead of just linking to external documents, show a preview or summary inline on the project detail page. Makes the dashboard more self-contained without becoming a document repository.

### Longer-Term (as the business matures)

**Investor view** — A curated, read-only version of the dashboard that shows project progress, milestones, and momentum. Designed to impress without exposing internal tasks, rough notes, or in-progress work.

**Observer role** — The authentication layer that makes the investor view possible. Read-only access, possibly via a shareable link rather than a full account, so a potential investor can see progress without creating credentials.

**Revenue tracking** — Per-project revenue, costs, and margins. Which projects are generating income, which are pre-revenue, and what the overall financial picture looks like. Only relevant once projects start earning.

**Live status monitoring** — For deployed projects: is the site up? Basic uptime or health checks surfaced as a green/red indicator on the dashboard. Relevant once multiple products are running in production.

## 9. Open Questions

Decisions that don't need to be made now but should be resolved before or during implementation.

1. **Frontend framework** — Vanilla JS with Alpine.js, React, or something else? Best decided by prototyping the most complex interaction (the activity timeline with inline editing) and seeing what feels right.

2. **Claude's authentication method** — How does Claude Code authenticate to publish updates? A service-role key stored in local config? The user's active session token? This has security implications worth considering carefully.

3. **Migration path** — What happens to the existing ideas in Supabase? Migrate them into the new `projects` table schema, start fresh, or keep the old data as a reference?

4. **Attachment storage limits** — Supabase's free tier has storage limits. Is that sufficient for document attachments from task responses, or will a paid plan be needed?

5. **Email service** — Supabase Edge Functions with Resend? SendGrid? What's the simplest option for low-volume notifications to 3 people?

6. **Theming** — Keep the current vivid/dark toggle? Redesign the themes? The existing dark theme is well-built and could carry forward with minimal changes.

7. **Staleness threshold** — 2 weeks was proposed. Should this be configurable per project (some projects move slowly by nature), or is a global threshold sufficient?

8. **Notification scope** — Email on new task assignments only, or also on responses, stage changes, and updates? What's the right volume of email for a 3-person team that doesn't want inbox noise?

9. **Rollout strategy** — Build the complete dashboard and switch over in one go, or incrementally evolve the existing Ideas page toward the new vision?

10. **Dashboard URL** — Keep the dashboard at `takgio.com/dashboard` alongside the public site, or put it on a subdomain like `app.takgio.com`?
