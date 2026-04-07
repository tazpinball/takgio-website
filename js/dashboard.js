// ============================================================
// Dashboard — Project cards, filters, stats, chart
// ============================================================

(function () {
  'use strict';

  var currentUser = null;
  var allProjects = [];
  var stageChart = null;

  var STAGE_ORDER = ['Idea', 'Active', 'Paused', 'Completed', 'Live', 'Discarded'];
  var STAGE_COLORS = {
    'Idea': '#6c757d',
    'Active': '#198754',
    'Paused': '#ffc107',
    'Completed': '#0d6efd',
    'Live': '#20c997',
    'Discarded': '#dc3545'
  };
  var STAGE_CLASSES = {
    'Idea': 'stage-idea',
    'Active': 'stage-active',
    'Paused': 'stage-paused',
    'Completed': 'stage-completed',
    'Live': 'stage-live',
    'Discarded': 'stage-discarded'
  };
  var PRIORITY_CLASSES = {
    'High': 'priority-high',
    'Medium': 'priority-medium',
    'Low': 'priority-low'
  };
  var PRIORITY_ORDER = { 'High': 0, 'Medium': 1, 'Low': 2 };
  var STAGE_SORT_ORDER = { 'Active': 0, 'Idea': 1, 'Paused': 2, 'Completed': 3, 'Live': 4, 'Discarded': 5 };
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

  // --- Version ---
  async function loadVersion() {
    try {
      var resp = await fetch('/version.json?t=' + Date.now());
      var data = await resp.json();
      var el = document.getElementById('version-badge');
      if (el) el.textContent = 'v' + data.version;
    } catch (e) { /* silent */ }
  }

  // --- Theme ---
  function getTheme() {
    return localStorage.getItem('dash_theme') || 'vivid';
  }

  function setTheme(theme) {
    localStorage.setItem('dash_theme', theme);
    document.body.setAttribute('data-theme', theme);
    document.getElementById('btn-theme').textContent = theme === 'dark' ? 'Dark' : 'Vivid';
    if (stageChart) {
      var isDark = theme === 'dark';
      stageChart.options.scales.x.ticks.color = isDark ? '#aaa' : '#aaa';
      stageChart.options.scales.y.ticks.color = isDark ? '#ccc' : '#555';
      stageChart.options.scales.x.grid.color = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
      stageChart.update();
    }
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
  async function loadProjects() {
    var grid = document.getElementById('projects-grid');
    grid.innerHTML = '<div class="loading">Loading projects...</div>';

    var result = await sb.from('projects').select('*').order('updated_at', { ascending: false });

    if (result.error) {
      grid.innerHTML = '<div class="empty-state"><p>Error loading projects: ' + escapeHtml(result.error.message) + '</p></div>';
      return;
    }

    allProjects = result.data || [];
    updateStats();
    updateChart();
    renderProjects();
  }

  // --- Stats ---
  function updateStats() {
    var total = allProjects.length;
    var active = allProjects.filter(function (p) { return p.stage === 'Active'; }).length;
    var live = allProjects.filter(function (p) { return p.stage === 'Live'; }).length;
    var stale = allProjects.filter(function (p) { return isStale(p); }).length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-active').textContent = active;
    document.getElementById('stat-live').textContent = live;
    document.getElementById('stat-stale').textContent = stale;
  }

  function isStale(project) {
    if (project.stage !== 'Active') return false;
    if (!project.updated_at) return false;
    var updated = new Date(project.updated_at);
    var now = new Date();
    var diffDays = (now - updated) / (1000 * 60 * 60 * 24);
    return diffDays > STALENESS_DAYS;
  }

  // --- Chart ---
  function updateChart() {
    var counts = {};
    STAGE_ORDER.forEach(function (s) { counts[s] = 0; });
    allProjects.forEach(function (p) {
      if (counts[p.stage] !== undefined) counts[p.stage]++;
    });

    var labels = STAGE_ORDER;
    var data = labels.map(function (s) { return counts[s]; });
    var colors = labels.map(function (s) { return STAGE_COLORS[s]; });

    var ctx = document.getElementById('stage-chart');
    if (!ctx) return;

    if (stageChart) {
      stageChart.data.datasets[0].data = data;
      stageChart.update();
      return;
    }

    // Filter out stages with 0 count for cleaner display
    var filteredLabels = [];
    var filteredData = [];
    var filteredColors = [];
    for (var i = 0; i < labels.length; i++) {
      if (data[i] > 0) {
        filteredLabels.push(labels[i]);
        filteredData.push(data[i]);
        filteredColors.push(colors[i]);
      }
    }

    stageChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: filteredLabels,
        datasets: [{
          data: filteredData,
          backgroundColor: filteredColors,
          borderWidth: 2,
          borderColor: getTheme() === 'dark' ? '#16162a' : '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        layout: { padding: 4 },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              padding: 6,
              font: { size: 10 },
              color: getTheme() === 'dark' ? '#aaa' : '#555',
              generateLabels: function (chart) {
                var dataset = chart.data.datasets[0];
                return chart.data.labels.map(function (label, i) {
                  return {
                    text: label + ' (' + dataset.data[i] + ')',
                    fillStyle: dataset.backgroundColor[i],
                    strokeStyle: 'transparent',
                    lineWidth: 0,
                    index: i
                  };
                });
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(26,26,46,0.9)',
            cornerRadius: 6,
            padding: 8,
            bodyFont: { size: 11 },
            callbacks: {
              label: function (ctx) {
                return ' ' + ctx.label + ': ' + ctx.parsed + (ctx.parsed === 1 ? ' project' : ' projects');
              }
            }
          }
        },
        animation: { duration: 400, easing: 'easeOutQuart' }
      }
    });
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

    var headerHtml = '<div class="project-row project-row-header">' +
      '<span class="project-row-name sortable-col" data-sort="name">Project' + arrow('name') + '</span>' +
      '<span class="project-row-col project-row-stage sortable-col" data-sort="stage">Stage' + arrow('stage') + '</span>' +
      '<span class="project-row-col project-row-priority sortable-col" data-sort="priority">Priority' + arrow('priority') + '</span>' +
      '<span class="project-row-col project-row-updated sortable-col" data-sort="updated">Updated' + arrow('updated') + '</span>' +
      '</div>';

    grid.innerHTML = headerHtml + sorted.map(renderProjectRow).join('');

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
    } else if (currentSortCol === 'created') {
      sorted.sort(function (a, b) { return (new Date(b.created_at) - new Date(a.created_at)) * dir; });
    }

    return sorted;
  }

  function renderProjectRow(project) {
    var staleHtml = '';
    if (isStale(project)) {
      var days = Math.floor((new Date() - new Date(project.updated_at)) / (1000 * 60 * 60 * 24));
      staleHtml = '<span class="stale-indicator">&#9679; ' + days + 'd</span>';
    }

    var stageClass = STAGE_CLASSES[project.stage] || 'stage-idea';
    var priorityHtml = '';
    if (project.priority) {
      var prioClass = PRIORITY_CLASSES[project.priority] || '';
      priorityHtml = '<span class="priority-badge ' + prioClass + '">' + escapeHtml(project.priority) + '</span>';
    }

    var updatedStr = project.updated_at
      ? timeAgo(new Date(project.updated_at))
      : '';

    var stageBadgeHtml = '<span class="stage-badge ' + stageClass + '">' + escapeHtml(project.stage || 'Idea') + '</span>';

    return (
      '<a href="/project.html?id=' + project.id + '" class="project-row">' +
      '  <span class="project-row-name">' + escapeHtml(project.name) + '</span>' +
      '  <span class="project-row-col project-row-stage">' + stageBadgeHtml + '</span>' +
      '  <span class="project-row-col project-row-priority">' + (priorityHtml || '<span class="priority-badge priority-none">—</span>') + '</span>' +
      '  <span class="project-row-col project-row-updated">' + (updatedStr || '') + (staleHtml ? ' ' + staleHtml : '') + '</span>' +
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
