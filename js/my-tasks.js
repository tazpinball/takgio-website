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
  }

  // --- Load Tasks ---
  async function loadTasks() {
    var container = document.getElementById('tasks-content');
    container.innerHTML = '<div class="loading">Loading tasks...</div>';

    // Load tasks assigned to the current user, plus the associated project name
    // We match on both assigned_to (UUID) and assigned_to_name (display name)
    // to handle tasks created before user IDs were linked
    var displayName = AuthGuard.getDisplayName(currentUser);

    var result = await sb
      .from('tasks')
      .select('*, projects(id, name, stage), task_responses(*)')
      .order('created_at', { ascending: false });

    if (result.error) {
      container.innerHTML = '<div class="empty-state"><p>Error loading tasks: ' + escapeHtml(result.error.message) + '</p></div>';
      return;
    }

    // Filter to tasks assigned to the current user (by UUID or name)
    allTasks = (result.data || []).filter(function (t) {
      return t.assigned_to === currentUser.id ||
        (t.assigned_to_name && t.assigned_to_name.toLowerCase() === displayName.toLowerCase());
    });

    renderTasks();
  }

  // --- Render ---
  function renderTasks() {
    var container = document.getElementById('tasks-content');
    var statusFilter = document.getElementById('filter-task-status').value;

    var filtered = allTasks;
    if (statusFilter) {
      filtered = allTasks.filter(function (t) { return t.status === statusFilter; });
    }

    if (filtered.length === 0) {
      var msg = allTasks.length === 0
        ? 'No tasks assigned to you.'
        : 'No tasks match the current filter.';
      container.innerHTML = '<div class="empty-state"><p>' + msg + '</p></div>';
      return;
    }

    container.innerHTML = '<div class="task-list">' + filtered.map(renderTaskCard).join('') + '</div>';
  }

  function renderTaskCard(t) {
    var statusClass = t.status === 'Completed' ? 'task-completed' : 'task-open';
    var projectName = t.projects ? t.projects.name : 'Unknown Project';
    var projectId = t.projects ? t.projects.id : '';

    var responsesHtml = '';
    if (t.task_responses && t.task_responses.length > 0) {
      responsesHtml = t.task_responses.map(function (r) {
        return '<div style="margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid var(--color-border); font-size:0.85rem;">' +
          '<strong>' + escapeHtml(r.created_by_name || 'Someone') + ':</strong> ' + escapeHtml(r.content) +
          (r.file_url ? ' <a href="' + escapeAttr(r.file_url) + '" target="_blank" rel="noopener" style="font-size:0.8rem;">[attachment]</a>' : '') +
          '<div style="font-size:0.72rem; color:var(--color-text-muted); margin-top:0.15rem;">' + formatDate(r.created_at) + '</div>' +
          '</div>';
      }).join('');
    }

    var actionsHtml = '';
    if (t.status === 'Open') {
      actionsHtml =
        '<div style="margin-top:0.75rem; display:flex; gap:0.5rem;">' +
        '  <button class="btn-edit" style="font-size:0.78rem; padding:0.25rem 0.6rem;" onclick="MyTasks.respond(\'' + t.id + '\')">Respond</button>' +
        '  <button class="btn-modal-secondary" style="font-size:0.78rem; padding:0.25rem 0.6rem;" onclick="MyTasks.complete(\'' + t.id + '\')">Mark Complete</button>' +
        '</div>';
    }

    return (
      '<div class="task-card">' +
      '  <div class="task-card-header">' +
      '    <div>' +
      '      <div class="task-card-body">' + escapeHtml(t.description) + '</div>' +
      '      <div class="task-card-meta" style="margin-top:0.35rem;">' +
      '        <a href="/project.html?id=' + escapeAttr(projectId) + '" style="color:var(--color-accent); text-decoration:none; font-weight:500;">' + escapeHtml(projectName) + '</a>' +
      '        &middot; From ' + escapeHtml(t.assigned_by_name || 'Unknown') +
      '        &middot; ' + formatDate(t.created_at) +
      '      </div>' +
      '    </div>' +
      '    <span class="task-status-badge ' + statusClass + '">' + escapeHtml(t.status) + '</span>' +
      '  </div>' +
      responsesHtml +
      actionsHtml +
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
