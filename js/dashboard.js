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

  async function loadProjects() {
    var grid = document.getElementById('projects-grid');
    grid.innerHTML = '<div class="loading">Loading projects...</div>';

    var results = await Promise.all([
      sb.from('projects').select('*').order('updated_at', { ascending: false }),
      sb.from('updates').select('project_id, content, release_notes, created_at, update_type').order('created_at', { ascending: false }),
      sb.from('tasks').select('project_id, status').eq('status', 'Open')
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

    updateSummary();
    renderWidgets();
    renderProjects();
  }

  // --- Helpers ---
  function daysSince(project) {
    if (!project.updated_at) return Infinity;
    return (new Date() - new Date(project.updated_at)) / (1000 * 60 * 60 * 24);
  }

  // "Quiet" = an in-flight project (not Live/Paused/Discarded) untouched for 14+ days
  var ACTIVE_STAGES = { 'Idea': true, 'Building': true, 'UAT': true };
  function isStale(project) {
    return !!ACTIVE_STAGES[project.stage] && daysSince(project) > STALENESS_DAYS;
  }

  // --- Summary bar ---
  function updateSummary() {
    var total = allProjects.length;
    var live = allProjects.filter(function (p) { return p.stage === 'Live'; }).length;
    var building = allProjects.filter(function (p) { return p.stage === 'Building'; }).length;
    var quiet = allProjects.filter(isStale).length;
    var openTasks = Object.keys(openTaskCounts).reduce(function (sum, id) { return sum + openTaskCounts[id]; }, 0);

    var verticals = {};
    allProjects.forEach(function (p) { if (p.industry) verticals[p.industry] = true; });
    var vNames = Object.keys(verticals);

    document.getElementById('sum-total').textContent = total;
    document.getElementById('sum-live').textContent = live;
    document.getElementById('sum-building').textContent = building;
    document.getElementById('sum-tasks').textContent = openTasks;
    document.getElementById('sum-quiet').textContent = quiet;

    var vEl = document.getElementById('sum-verticals');
    vEl.textContent = vNames.length
      ? 'across ' + listPhrase(vNames.map(function (v) { return v.toLowerCase(); }))
      : ' ';
  }

  function listPhrase(items) {
    if (items.length <= 1) return items.join('');
    if (items.length === 2) return items[0] + ' and ' + items[1];
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
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

  function renderPipeline() {
    var counts = {};
    STAGE_ORDER.forEach(function (s) { counts[s] = 0; });
    allProjects.forEach(function (p) { if (counts[p.stage] !== undefined) counts[p.stage]++; });

    // Always show the core flow; append Paused/Discarded only when non-zero
    var shown = ['Idea', 'Building', 'UAT', 'Live'];
    ['Paused', 'Discarded'].forEach(function (s) { if (counts[s] > 0) shown.push(s); });

    var max = Math.max(1, allProjects.length);
    document.getElementById('pipe-total').textContent = allProjects.length + ' total';
    document.getElementById('pipe-bars').innerHTML = shown.map(function (s) {
      var pct = Math.round((counts[s] / max) * 100);
      return '<div class="dsh-bl"><span class="lb">' + s + '</span>' +
        '<span class="dsh-track"><i style="width:' + pct + '%;background:' + STAGE_COLORS[s] + '"></i></span>' +
        '<span class="vv">' + counts[s] + '</span></div>';
    }).join('');
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

    return projects.filter(function (p) {
      if (stageFilter && p.stage !== stageFilter) return false;
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

    return (
      '<a href="/project.html?id=' + project.id + '" class="dsh-row">' +
      '<span><span class="dsh-nm">' + escapeHtml(project.name) + '</span>' + kindHtml + '</span>' +
      '<span>' + stageBadgeHtml + '</span>' +
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
