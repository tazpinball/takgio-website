// ============================================================
// Dashboard — Project cards, filters, stats, chart
// ============================================================

(function () {
  'use strict';

  var currentUser = null;
  var allProjects = [];

  var STAGE_ORDER = ['Idea', 'Building', 'UAT', 'Live', 'Paused', 'Discarded'];
  // Pipeline bar fills — conventional mapping (Live=green, Building=amber)
  var STAGE_COLORS = {
    'Idea': '#6b7280',
    'Building': '#b45309',
    'UAT': '#6d28d9',
    'Live': '#0b8457',
    'Paused': '#6b7280',
    'Discarded': '#c62b2b'
  };
  var STAGE_CLASSES = {
    'Idea': 'stage-idea',
    'Building': 'stage-building',
    'UAT': 'stage-uat',
    'Live': 'stage-live',
    'Paused': 'stage-paused',
    'Discarded': 'stage-discarded'
  };
  var PRIORITY_CLASSES = {
    'High': 'priority-high',
    'Medium': 'priority-medium',
    'Low': 'priority-low'
  };
  var PRIORITY_ORDER = { 'High': 0, 'Medium': 1, 'Low': 2 };
  var STAGE_SORT_ORDER = { 'Idea': 0, 'Building': 1, 'UAT': 2, 'Live': 3, 'Paused': 4, 'Discarded': 5 };
  var currentSortCol = 'stage';
  var currentSortAsc = true;
  var STALENESS_DAYS = 14;

  // The products takgio.com lists, with the status the site shows for each. Kept here, in the same repo as the site, so
  // a change to a product's status on the site is made in the same commit. `names` are the dashboard project names
  // (lower case) that are that product.
  var SITE_PRODUCTS = [
    { site: 'Meta Ray-Ban Display', badge: 'MR', status: 'Upcoming', names: ['meta ray-ban display'] },
    { site: 'myBuyersCoach', badge: 'BC', status: 'Upcoming', names: ['mybuyerscoach'] },
    { site: 'ConcreteIQ', badge: 'IQ', status: 'Live beta', names: ['concreteiq', 'concrete bid generator'] },
    { site: 'Brickture', badge: 'Br', status: 'Beta', names: ['brickture'] },
    { site: 'Ann Elise', badge: 'AE', status: 'Live', names: ['ann elise', 'ann elise ai tutor'] },
    { site: 'Hoof Harted', badge: 'HH', status: 'Live', names: ['hoof harted'] },
    { site: 'True Record', badge: 'TR', status: 'Live', names: ['true record'] },
    { site: 'Pinball-QR', badge: 'PQ', status: 'Live', names: ['pinball-qr', 'pinball qr'] }
  ];
  var SITE_STATUS_CLASS = { 'Upcoming': 'st-next', 'Live beta': 'st-live', 'Beta': 'st-beta', 'Live': 'st-live' };
  function siteInfo(project) {
    var n = (project.name || '').trim().toLowerCase();
    for (var i = 0; i < SITE_PRODUCTS.length; i++) {
      if (SITE_PRODUCTS[i].names.indexOf(n) !== -1) return SITE_PRODUCTS[i];
    }
    return null;
  }
  function siteOrder(project) {
    var info = siteInfo(project);
    return info ? SITE_PRODUCTS.indexOf(info) : 99;
  }

  // The GitHub sync (supabase/functions/project-sync): Friday 6 PM and Monday 1 PM, New York time.
  var SYNC_SLOTS = [{ day: 'Fri', hour: 18 }, { day: 'Mon', hour: 13 }];
  var SYNC_NAME = 'Claude (weekly sync)';

  // --- Init ---
  async function init() {
    currentUser = await AuthGuard.require();
    if (!currentUser) return;

    document.getElementById('user-name').textContent = AuthGuard.getDisplayName(currentUser);
    initTheme();
    bindEvents();
    loadVersion();
    await loadProjects();
  }

  // --- Version & Release Notes ---
  var versionData = null;

  async function loadVersion() {
    try {
      var resp = await fetch('/version.json?t=' + Date.now());
      versionData = await resp.json();
      var el = document.getElementById('version-badge');
      if (el) el.textContent = 'v' + versionData.version;
    } catch (e) { /* silent */ }
  }

  function openReleaseNotes() {
    if (!versionData || !versionData.releases) return;
    var container = document.getElementById('release-notes-content');
    var html = '';
    versionData.releases.forEach(function (r) {
      html += '<div class="release-entry">';
      html += '<div class="release-header">';
      html += '<strong>v' + escapeHtml(r.version) + '</strong>';
      html += '<span class="release-date">' + escapeHtml(r.date) + '</span>';
      html += '</div>';
      html += '<div class="release-summary">' + escapeHtml(r.summary) + '</div>';
      html += '<ul class="release-changes">';
      r.changes.forEach(function (c) {
        html += '<li>' + escapeHtml(c) + '</li>';
      });
      html += '</ul></div>';
    });
    container.innerHTML = html;
    document.getElementById('modal-release-notes').style.display = 'flex';
  }

  // --- Theme ---
  function getTheme() {
    return localStorage.getItem('dash_theme') || 'vivid';
  }

  function setTheme(theme) {
    localStorage.setItem('dash_theme', theme);
    document.body.setAttribute('data-theme', theme);
    document.getElementById('btn-theme').textContent = theme === 'dark' ? 'Dark' : 'Vivid';
  }

  function initTheme() {
    var theme = getTheme();
    document.body.setAttribute('data-theme', theme);
    document.getElementById('btn-theme').textContent = theme === 'dark' ? 'Dark' : 'Vivid';
  }

  // --- Events ---
  function bindEvents() {
    document.getElementById('btn-logout').addEventListener('click', function () {
      AuthGuard.logout();
    });

    document.getElementById('btn-theme').addEventListener('click', function () {
      setTheme(getTheme() === 'vivid' ? 'dark' : 'vivid');
    });

    // Version / Release Notes
    document.getElementById('version-badge').addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openReleaseNotes();
    });

    document.getElementById('btn-close-releases').addEventListener('click', function () {
      document.getElementById('modal-release-notes').style.display = 'none';
    });

    document.getElementById('modal-release-notes').addEventListener('click', function (e) {
      if (e.target === this) this.style.display = 'none';
    });

    document.getElementById('btn-new-project').addEventListener('click', function () {
      document.getElementById('modal-new-project').style.display = 'flex';
      document.getElementById('new-name').focus();
    });

    document.getElementById('btn-cancel-new').addEventListener('click', closeNewModal);

    document.getElementById('modal-new-project').addEventListener('click', function (e) {
      if (e.target === this) closeNewModal();
    });

    document.getElementById('form-new-project').addEventListener('submit', createProject);

    document.getElementById('filter-stage').addEventListener('change', renderProjects);
    document.getElementById('filter-site').addEventListener('change', renderProjects);
    document.getElementById('btn-sync').addEventListener('click', syncNow);
    document.getElementById('filter-priority').addEventListener('change', renderProjects);
    document.getElementById('filter-sort').addEventListener('change', function () {
      currentSortCol = this.value;
      currentSortAsc = true;
      renderProjects();
    });
  }

  function closeNewModal() {
    document.getElementById('modal-new-project').style.display = 'none';
    document.getElementById('form-new-project').reset();
  }

  // --- Load Projects ---
  var latestUpdates = {}; // project_id -> latest update content
  var openTaskCounts = {}; // project_id -> count of open tasks
  var allUpdates = [];     // every update, newest first (for the activity feed)
  var syncMoves = {};      // project_id -> the latest stage move made by the sync in the last 14 days
  var lastSyncRun = null;  // the newest row of project_sync_runs

  async function loadProjects() {
    var grid = document.getElementById('projects-grid');
    grid.innerHTML = '<div class="loading">Loading projects...</div>';

    var results = await Promise.all([
      sb.from('projects').select('*').order('updated_at', { ascending: false }),
      sb.from('updates').select('project_id, content, release_notes, created_at, update_type').order('created_at', { ascending: false }),
      sb.from('tasks').select('project_id, status').eq('status', 'Open'),
      sb.from('stage_transitions').select('project_id, from_stage, to_stage, created_at')
        .eq('changed_by_name', SYNC_NAME)
        .gte('created_at', new Date(Date.now() - 14 * 864e5).toISOString())
        .order('created_at', { ascending: false }),
      // missing until docs/dashboard-sync-schema.sql has been run; the page works without it
      sb.from('project_sync_runs').select('ran_at, trigger, checked, updated, moved').order('ran_at', { ascending: false }).limit(1)
    ]);

    if (results[0].error) {
      grid.innerHTML = '<div class="empty-state"><p>Error loading projects: ' + escapeHtml(results[0].error.message) + '</p></div>';
      return;
    }

    allProjects = results[0].data || [];

    // Build map of latest update per project + keep the full feed
    allUpdates = results[1].data || [];
    latestUpdates = {};
    allUpdates.forEach(function (u) {
      if (!latestUpdates[u.project_id]) {
        latestUpdates[u.project_id] = u;
      }
    });

    // Build map of open task counts per project
    openTaskCounts = {};
    (results[2].data || []).forEach(function (t) {
      openTaskCounts[t.project_id] = (openTaskCounts[t.project_id] || 0) + 1;
    });

    syncMoves = {};
    (results[3].data || []).forEach(function (t) {
      if (!syncMoves[t.project_id]) syncMoves[t.project_id] = t;
    });
    lastSyncRun = (results[4] && !results[4].error && results[4].data && results[4].data[0]) || null;

    updateSummary();
    renderWidgets();
    renderProjects();
  }

  // --- Helpers ---
  // Days since anything happened: a dashboard edit or update, or a commit the sync saw in the project's repos.
  function daysSince(project) {
    var t = Math.max(
      project.updated_at ? new Date(project.updated_at).getTime() : 0,
      project.last_commit_at ? new Date(project.last_commit_at).getTime() : 0
    );
    if (!t) return Infinity;
    return (Date.now() - t) / (1000 * 60 * 60 * 24);
  }

  // "Quiet" = an in-flight project (not Live/Paused/Discarded) untouched for 14+ days
  var ACTIVE_STAGES = { 'Idea': true, 'Building': true, 'UAT': true };
  function isStale(project) {
    return !!ACTIVE_STAGES[project.stage] && daysSince(project) > STALENESS_DAYS;
  }

  // --- Summary bar ---
  function updateSummary() {
    function count(stage) { return allProjects.filter(function (p) { return p.stage === stage; }).length; }
    var listed = allProjects.filter(siteInfo).length;

    document.getElementById('sum-total').textContent = allProjects.length;
    document.getElementById('sum-live').textContent = count('Live');
    document.getElementById('sum-uat').textContent = count('UAT');
    document.getElementById('sum-building').textContent = count('Building');
    document.getElementById('sum-idea').textContent = count('Idea');
    document.getElementById('sum-split').textContent =
      listed + ' listed on takgio.com, ' + (allProjects.length - listed) + ' internal';

    var last = document.getElementById('sum-sync-last');
    if (lastSyncRun) {
      var bits = [lastSyncRun.updated + ' updated'];
      if (lastSyncRun.moved) bits.push(lastSyncRun.moved + ' moved');
      last.textContent = 'Last run ' + nyLabel(new Date(lastSyncRun.ran_at)) + ': ' + bits.join(', ');
    } else {
      last.textContent = '';
    }
    var next = nextSyncSlot(new Date());
    document.getElementById('sum-sync-next').textContent = next ? 'Next ' + nyLabel(next) + ' ET' : '';
  }

  // New York time parts of a date
  function nyParts(d) {
    var out = {};
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).forEach(function (p) { out[p.type] = p.value; });
    return out;
  }
  function nyLabel(d) {
    var p = nyParts(d), h = Number(p.hour);
    return p.weekday + ' ' + p.day + ' ' + p.month + ', ' + ((h % 12) || 12) + ':' + p.minute + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  // The next whole hour, from now, that is a sync slot in New York time
  function nextSyncSlot(from) {
    var t = new Date(from.getTime());
    t.setUTCMinutes(0, 0, 0);
    for (var i = 1; i <= 24 * 8; i++) {
      var c = new Date(t.getTime() + i * 3600e3), p = nyParts(c);
      for (var j = 0; j < SYNC_SLOTS.length; j++) {
        if (SYNC_SLOTS[j].day === p.weekday && SYNC_SLOTS[j].hour === Number(p.hour)) return c;
      }
    }
    return null;
  }

  // --- Widgets ---
  function renderWidgets() {
    renderAttention();
    renderPipeline();
    renderActivity();
  }

  function renderAttention() {
    // Quiet projects first (by days desc), then any with the most open tasks.
    var quiet = allProjects.filter(isStale).sort(function (a, b) { return daysSince(b) - daysSince(a); });
    var quietIds = {};
    quiet.forEach(function (p) { quietIds[p.id] = true; });
    var busy = allProjects
      .filter(function (p) { return !quietIds[p.id] && (openTaskCounts[p.id] || 0) > 0; })
      .sort(function (a, b) { return (openTaskCounts[b.id] || 0) - (openTaskCounts[a.id] || 0); });

    var rows = [];
    quiet.forEach(function (p) {
      rows.push({ name: p.name, id: p.id, cls: 'crit', label: Math.floor(daysSince(p)) + 'd quiet' });
    });
    busy.forEach(function (p) {
      rows.push({ name: p.name, id: p.id, cls: 'warn', label: openTaskCounts[p.id] + ' open' });
    });
    rows = rows.slice(0, 5);

    document.getElementById('attn-count').textContent = rows.length || '';
    var html = rows.length
      ? rows.map(function (r) {
          return '<a class="dsh-item" href="/project.html?id=' + r.id + '" style="text-decoration:none;color:inherit">' +
            '<span class="nm">' + escapeHtml(r.name) + '</span>' +
            '<span class="dsh-pill ' + r.cls + '">' + escapeHtml(r.label) + '</span></a>';
        }).join('')
      : '<div class="dsh-empty">Everything’s been touched recently. Nice.</div>';
    document.getElementById('attn-list').innerHTML = html;
  }

  var BOARD_EMPTY = { 'Building': 'Nothing in build' };
  function renderPipeline() {
    document.getElementById('pipe-total').textContent = allProjects.length + ' total';
    var html = STAGE_ORDER.map(function (stage) {
      var inStage = allProjects.filter(function (p) { return p.stage === stage; });
      var listed = inStage.filter(siteInfo).sort(function (a, b) { return siteOrder(a) - siteOrder(b); });
      var internal = inStage.filter(function (p) { return !siteInfo(p); })
        .sort(function (a, b) { return daysSince(a) - daysSince(b); });
      var cards = listed.map(boardCard).concat(internal.map(boardCard)).join('');
      return '<div class="pb-col">' +
        '<div class="pb-col-h"><h3>' + stage + '</h3><span class="pb-n">' + inStage.length + '</span></div>' +
        '<div class="pb-bar" style="background:' + STAGE_COLORS[stage] + '"></div>' +
        (cards || '<div class="pb-empty">' + (BOARD_EMPTY[stage] || 'None') + '</div>') +
        '</div>';
    }).join('');
    document.getElementById('pipe-board').innerHTML = html;
  }

  function boardCard(p) {
    var info = siteInfo(p);
    var mv = syncMoves[p.id];
    var moved = mv && mv.to_stage === p.stage
      ? '<span class="pb-moved">Moved here from ' + escapeHtml(mv.from_stage || '?') + ' by the sync, ' + escapeHtml(timeAgoShort(mv.created_at)) + ' ago</span>'
      : '';
    var href = '/project.html?id=' + p.id;
    if (!info) {
      return '<a class="pb-card pb-internal" href="' + href + '"><span class="pb-name">' + escapeHtml(p.name) + '</span>' + moved + '</a>';
    }
    var own = p.name.trim().toLowerCase();
    var sub = own.indexOf(info.site.toLowerCase()) !== 0 ? '<span class="pb-sub">' + escapeHtml(p.name) + '</span>' : '';
    return '<a class="pb-card pb-listed" href="' + href + '">' +
      '<span class="pb-badge" aria-hidden="true">' + escapeHtml(info.badge) + '</span>' +
      '<span class="pb-body"><span class="pb-name">' + escapeHtml(info.site) + '</span>' + sub +
      '<span class="pb-st ' + SITE_STATUS_CLASS[info.status] + '"><span class="sr-only">On takgio.com: </span>' + escapeHtml(info.status) + '</span>' +
      moved + '</span></a>';
  }

  // --- Sync now (the same job the schedule runs, for every project) ---
  async function syncNow() {
    var btn = document.getElementById('btn-sync');
    var msg = document.getElementById('sync-msg');
    btn.disabled = true;
    btn.textContent = 'Syncing…';
    msg.textContent = 'Reading every repo; this can take a minute or two.';
    try {
      var session = await sb.auth.getSession();
      var token = session.data.session && session.data.session.access_token;
      if (!token) throw new Error('sign in again first.');
      var res = await fetch(SUPABASE_URL + '/functions/v1/project-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'apikey': SUPABASE_ANON_KEY },
        body: '{}'
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || data.message || ('the sync answered ' + res.status));
      var bits = [data.updated + ' updated'];
      if (data.moved && data.moved.length) bits.push(data.moved.length + ' moved');
      if (data.problems && data.problems.length) bits.push('problems with ' + data.problems.join(', '));
      msg.textContent = 'Done: ' + bits.join('; ') + '.';
      await loadProjects();
    } catch (err) {
      msg.textContent = 'Sync failed: ' + err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sync now';
    }
  }

  function renderActivity() {
    var names = {};
    allProjects.forEach(function (p) { names[p.id] = p.name; });
    var recent = allUpdates.slice(0, 5);
    var html = recent.length
      ? recent.map(function (u) {
          var text = (u.release_notes || u.content || '').replace(/\s+/g, ' ').trim();
          if (text.length > 60) text = text.slice(0, 60) + '…';
          var label = (names[u.project_id] || 'Project') + (text ? ' — ' + text : '');
          return '<a class="dsh-item" href="/project.html?id=' + u.project_id + '" style="text-decoration:none;color:inherit">' +
            '<span class="nm">' + escapeHtml(label) + '</span>' +
            '<span class="tm">' + escapeHtml(timeAgoShort(u.created_at)) + '</span></a>';
        }).join('')
      : '<div class="dsh-empty">No activity yet.</div>';
    document.getElementById('activity-list').innerHTML = html;
  }

  function timeAgoShort(dateStr) {
    if (!dateStr) return '';
    var diff = (new Date() - new Date(dateStr)) / 1000;
    if (diff < 3600) return Math.max(1, Math.floor(diff / 60)) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd';
    return Math.floor(diff / 604800) + 'w';
  }

  // --- Render Projects ---
  function renderProjects() {
    var grid = document.getElementById('projects-grid');
    var filtered = applyFilters(allProjects);
    var sorted = applySort(filtered);

    if (sorted.length === 0) {
      if (allProjects.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No projects yet.</p><p>Click <strong>+ New Project</strong> to create your first one.</p></div>';
      } else {
        grid.innerHTML = '<div class="empty-state"><p>No projects match the current filters.</p></div>';
      }
      return;
    }

    function arrow(col) {
      if (currentSortCol !== col) return '';
      return currentSortAsc ? ' ▲' : ' ▼';
    }

    var headerHtml = '<div class="dsh-row dsh-thead">' +
      '<span class="sortable-col" data-sort="name">Project' + arrow('name') + '</span>' +
      '<span class="sortable-col" data-sort="stage">Stage' + arrow('stage') + '</span>' +
      '<span class="dsh-col-site">On takgio.com</span>' +
      '<span class="sortable-col dsh-col-tasks" data-sort="tasks">Tasks' + arrow('tasks') + '</span>' +
      '<span class="sortable-col" data-sort="updated">Updated' + arrow('updated') + '</span>' +
      '<span class="dsh-col-snip">Last update</span>' +
      '</div>';

    grid.innerHTML = headerHtml + sorted.map(renderProjectRow).join('');

    var countEl = document.getElementById('table-count');
    if (countEl) countEl.textContent = sorted.length === allProjects.length
      ? sorted.length
      : sorted.length + ' of ' + allProjects.length;

    // Attach click handlers to column headers
    grid.querySelectorAll('.sortable-col').forEach(function (el) {
      el.addEventListener('click', function () {
        var col = el.getAttribute('data-sort');
        if (currentSortCol === col) {
          currentSortAsc = !currentSortAsc;
        } else {
          currentSortCol = col;
          currentSortAsc = true;
        }
        // Sync the dropdown
        var dropdown = document.getElementById('filter-sort');
        if (dropdown.querySelector('option[value="' + col + '"]')) {
          dropdown.value = col;
        }
        renderProjects();
      });
    });
  }

  function applyFilters(projects) {
    var stageFilter = document.getElementById('filter-stage').value;
    var priorityFilter = document.getElementById('filter-priority').value;
    var siteFilter = document.getElementById('filter-site').value;

    return projects.filter(function (p) {
      if (stageFilter && p.stage !== stageFilter) return false;
      if (siteFilter === 'site' && !siteInfo(p)) return false;
      if (siteFilter === 'internal' && siteInfo(p)) return false;
      if (priorityFilter && p.priority !== priorityFilter) return false;
      return true;
    });
  }

  function applySort(projects) {
    var sorted = projects.slice();
    var dir = currentSortAsc ? 1 : -1;

    if (currentSortCol === 'stage') {
      sorted.sort(function (a, b) {
        var sa = STAGE_SORT_ORDER[a.stage] !== undefined ? STAGE_SORT_ORDER[a.stage] : 99;
        var sb2 = STAGE_SORT_ORDER[b.stage] !== undefined ? STAGE_SORT_ORDER[b.stage] : 99;
        if (sa !== sb2) return (sa - sb2) * dir;
        return new Date(b.updated_at) - new Date(a.updated_at);
      });
    } else if (currentSortCol === 'updated') {
      sorted.sort(function (a, b) { return (new Date(b.updated_at) - new Date(a.updated_at)) * dir; });
    } else if (currentSortCol === 'priority') {
      sorted.sort(function (a, b) {
        var pa = PRIORITY_ORDER[a.priority] !== undefined ? PRIORITY_ORDER[a.priority] : 99;
        var pb = PRIORITY_ORDER[b.priority] !== undefined ? PRIORITY_ORDER[b.priority] : 99;
        return (pa - pb) * dir;
      });
    } else if (currentSortCol === 'name') {
      sorted.sort(function (a, b) { return a.name.localeCompare(b.name) * dir; });
    } else if (currentSortCol === 'tasks') {
      sorted.sort(function (a, b) {
        var ta = openTaskCounts[a.id] || 0;
        var tb = openTaskCounts[b.id] || 0;
        return (tb - ta) * dir;
      });
    } else if (currentSortCol === 'created') {
      sorted.sort(function (a, b) { return (new Date(b.created_at) - new Date(a.created_at)) * dir; });
    }

    return sorted;
  }

  function renderProjectRow(project) {
    var stageClass = STAGE_CLASSES[project.stage] || 'stage-idea';
    var stageBadgeHtml = '<span class="stage-badge ' + stageClass + '">' + escapeHtml(project.stage || 'Idea') + '</span>';

    // Sub-line: category · industry (whichever exist)
    var kindParts = [project.category, project.industry].filter(Boolean);
    var kindHtml = kindParts.length ? '<span class="dsh-kd">' + escapeHtml(kindParts.join(' · ')) + '</span>' : '';

    var taskCount = openTaskCounts[project.id] || 0;
    var taskHtml = taskCount > 0
      ? '<span class="dsh-chip">' + taskCount + '</span>'
      : '<span class="dsh-cell z">—</span>';

    var updatedStr = project.updated_at ? timeAgo(new Date(project.updated_at)) : '';
    var quietClass = isStale(project) ? ' q' : '';

    var latest = latestUpdates[project.id];
    var updateText = latest ? (latest.release_notes || latest.content) : '';
    updateText = (updateText || '').replace(/\s+/g, ' ').trim();
    var snippetText = updateText ? (updateText.length > 90 ? updateText.slice(0, 90) + '…' : updateText) : '—';

    var info = siteInfo(project);
    var siteHtml = info
      ? '<span class="pb-st ' + SITE_STATUS_CLASS[info.status] + '">' + escapeHtml(info.status) + '</span>'
      : '<span class="dsh-cell z">Internal</span>';

    return (
      '<a href="/project.html?id=' + project.id + '" class="dsh-row">' +
      '<span><span class="dsh-nm">' + escapeHtml(project.name) + '</span>' + kindHtml + '</span>' +
      '<span>' + stageBadgeHtml + '</span>' +
      '<span class="dsh-col-site">' + siteHtml + '</span>' +
      '<span class="dsh-col-tasks">' + taskHtml + '</span>' +
      '<span class="dsh-cell' + quietClass + '">' + escapeHtml(updatedStr) + '</span>' +
      '<span class="dsh-snip dsh-col-snip">' + escapeHtml(snippetText) + '</span>' +
      '</a>'
    );
  }

  // --- Create Project ---
  async function createProject(e) {
    e.preventDefault();

    var name = document.getElementById('new-name').value.trim();
    if (!name) return;

    var techInput = document.getElementById('new-tech').value.trim();
    var techStack = techInput
      ? techInput.split(',').map(function (t) { return t.trim(); }).filter(Boolean)
      : [];

    var newProject = {
      name: name,
      description: document.getElementById('new-desc').value.trim() || null,
      stage: document.getElementById('new-stage').value,
      priority: document.getElementById('new-priority').value || null,
      category: document.getElementById('new-category').value.trim() || null,
      industry: document.getElementById('new-industry').value.trim() || null,
      client: document.getElementById('new-client').value.trim() || null,
      tech_stack: techStack,
      created_by: currentUser.id,
      created_by_name: AuthGuard.getDisplayName(currentUser),
      updated_by: currentUser.id
    };

    var result = await sb.from('projects').insert([newProject]).select();

    if (result.error) {
      alert('Error creating project: ' + result.error.message);
      return;
    }

    // Log initial stage transition
    if (result.data && result.data[0]) {
      await sb.from('stage_transitions').insert([{
        project_id: result.data[0].id,
        from_stage: null,
        to_stage: newProject.stage,
        changed_by: currentUser.id,
        changed_by_name: AuthGuard.getDisplayName(currentUser)
      }]);
    }

    closeNewModal();
    await loadProjects();
  }

  // --- Utilities ---
  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function timeAgo(date) {
    var seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    if (days < 7) return days + 'd ago';
    if (days < 30) return Math.floor(days / 7) + 'w ago';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // --- Start ---
  document.addEventListener('DOMContentLoaded', init);
})();
