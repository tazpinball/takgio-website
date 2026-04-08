// ============================================================
// My Tasks — Personal task queue across all projects
// ============================================================

(function () {
  'use strict';

  var currentUser = null;
  var allTasks = [];

  // --- Init ---
  async function init() {
    currentUser = await AuthGuard.require();
    if (!currentUser) return;

    document.getElementById('user-name').textContent = AuthGuard.getDisplayName(currentUser);
    initTheme();
    bindEvents();
    await loadTasks();
  }

  // --- Theme ---
  function getTheme() { return localStorage.getItem('dash_theme') || 'vivid'; }

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
    document.getElementById('filter-task-status').addEventListener('change', renderTasks);
    document.getElementById('filter-task-assignee').addEventListener('change', renderTasks);
  }

  // --- Load Tasks ---
  async function loadTasks() {
    var container = document.getElementById('tasks-content');
    container.innerHTML = '<div class="loading">Loading tasks...</div>';

    var result = await sb
      .from('tasks')
      .select('*, projects(id, name, stage), task_responses(*)')
      .order('created_at', { ascending: false });

    if (result.error) {
      container.innerHTML = '<div class="empty-state"><p>Error loading tasks: ' + escapeHtml(result.error.message) + '</p></div>';
      return;
    }

    allTasks = result.data || [];

    // Populate assignee filter dropdown
    var names = {};
    allTasks.forEach(function (t) { if (t.assigned_to_name) names[t.assigned_to_name] = true; });
    var select = document.getElementById('filter-task-assignee');
    var currentFilter = select.value;
    select.innerHTML = '<option value="">All Team Members</option>';
    Object.keys(names).sort().forEach(function (name) {
      select.innerHTML += '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
    });
    select.value = currentFilter;

    renderTasks();
  }

  // --- Render ---
  function renderTasks() {
    var container = document.getElementById('tasks-content');
    var statusFilter = document.getElementById('filter-task-status').value;
    var assigneeFilter = document.getElementById('filter-task-assignee').value;

    var filtered = allTasks;
    if (statusFilter) {
      filtered = filtered.filter(function (t) { return t.status === statusFilter; });
    }
    if (assigneeFilter) {
      filtered = filtered.filter(function (t) { return t.assigned_to_name === assigneeFilter; });
    }

    if (filtered.length === 0) {
      var msg = allTasks.length === 0
        ? 'No tasks yet.'
        : 'No tasks match the current filters.';
      container.innerHTML = '<div class="empty-state"><p>' + msg + '</p></div>';
      return;
    }

    container.innerHTML = '<div class="task-list">' + filtered.map(renderTaskCard).join('') + '</div>';
  }

  function renderTaskCard(t) {
    var statusClass = t.status === 'Completed' ? 'task-completed' : 'task-open';
    var projectName = t.projects ? t.projects.name : 'Unknown Project';
    var projectId = t.projects ? t.projects.id : '';

    return (
      '<div class="task-row">' +
      '  <span class="task-row-assignee">' + escapeHtml(t.assigned_to_name || 'Unassigned') + '</span>' +
      '  <span class="task-row-desc">' + escapeHtml(t.description) + '</span>' +
      '  <span class="task-row-project"><a href="/project.html?id=' + escapeAttr(projectId) + '" style="color:var(--color-accent); text-decoration:none;">' + escapeHtml(projectName) + '</a></span>' +
      '  <span class="task-row-date">' + formatDate(t.created_at) + '</span>' +
      '  <span class="task-row-status"><span class="task-status-badge ' + statusClass + '">' + escapeHtml(t.status) + '</span></span>' +
      (t.status === 'Open'
        ? '  <span class="task-row-actions">' +
          '<button class="btn-edit" style="font-size:0.75rem; padding:0.2rem 0.5rem;" onclick="MyTasks.respond(\'' + t.id + '\')">Respond</button>' +
          '<button class="btn-modal-secondary" style="font-size:0.75rem; padding:0.2rem 0.5rem;" onclick="MyTasks.complete(\'' + t.id + '\')">Complete</button>' +
          '</span>'
        : '  <span class="task-row-actions"></span>') +
      '</div>'
    );
  }

  // --- Actions ---
  async function respondToTask(taskId) {
    var response = prompt('Your response:');
    if (!response) return;

    var result = await sb.from('task_responses').insert([{
      task_id: taskId,
      content: response.trim(),
      created_by: currentUser.id,
      created_by_name: AuthGuard.getDisplayName(currentUser)
    }]);

    if (result.error) {
      alert('Error posting response: ' + result.error.message);
      return;
    }

    await loadTasks();
  }

  async function completeTask(taskId) {
    var result = await sb.from('tasks').update({
      status: 'Completed',
      completed_at: new Date().toISOString()
    }).eq('id', taskId);

    if (result.error) {
      alert('Error completing task: ' + result.error.message);
      return;
    }

    await loadTasks();
  }

  // --- Utilities ---
  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  // --- Expose for inline handlers ---
  window.MyTasks = {
    respond: respondToTask,
    complete: completeTask
  };

  // --- Start ---
  document.addEventListener('DOMContentLoaded', init);
})();
