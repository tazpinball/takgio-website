// ============================================================
// Project Detail — View, edit, activity timeline, updates
// ============================================================

(function () {
  'use strict';

  var currentUser = null;
  var project = null;
  var updates = [];
  var transitions = [];
  var tasks = [];

  var STAGE_CLASSES = {
    'Idea': 'stage-idea', 'Active': 'stage-active', 'Paused': 'stage-paused',
    'Completed': 'stage-completed', 'Live': 'stage-live', 'Discarded': 'stage-discarded'
  };
  var PRIORITY_CLASSES = {
    'High': 'priority-high', 'Medium': 'priority-medium', 'Low': 'priority-low'
  };

  // --- Init ---
  async function init() {
    currentUser = await AuthGuard.require();
    if (!currentUser) return;

    document.getElementById('user-name').textContent = AuthGuard.getDisplayName(currentUser);
    initTheme();
    bindEvents();

    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    if (!id) {
      document.getElementById('project-content').innerHTML =
        '<div class="empty-state"><p>No project specified.</p></div>';
      return;
    }

    await loadProject(id);
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
    document.getElementById('btn-cancel-edit').addEventListener('click', closeEditModal);
    document.getElementById('modal-edit-project').addEventListener('click', function (e) {
      if (e.target === this) closeEditModal();
    });
    document.getElementById('form-edit-project').addEventListener('submit', saveProject);
  }

  // --- Load Project + related data ---
  async function loadProject(id) {
    var container = document.getElementById('project-content');
    container.innerHTML = '<div class="loading">Loading project...</div>';

    var results = await Promise.all([
      sb.from('projects').select('*').eq('id', id).single(),
      sb.from('updates').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      sb.from('stage_transitions').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      sb.from('tasks').select('*, task_responses(*)').eq('project_id', id).order('created_at', { ascending: false })
    ]);

    if (results[0].error || !results[0].data) {
      container.innerHTML = '<div class="empty-state"><p>Project not found.</p></div>';
      return;
    }

    project = results[0].data;
    updates = results[1].data || [];
    transitions = results[2].data || [];
    tasks = results[3].data || [];

    document.title = 'TAKGIO — ' + project.name;
    renderProject();
  }

  // --- Render ---
  function renderProject() {
    var container = document.getElementById('project-content');
    var p = project;

    // Stage + priority badges
    var badgesHtml = '';
    if (p.stage) {
      var sc = STAGE_CLASSES[p.stage] || 'stage-idea';
      badgesHtml += '<span class="stage-badge ' + sc + '">' + esc(p.stage) + '</span>';
    }
    if (p.priority) {
      var pc = PRIORITY_CLASSES[p.priority] || '';
      badgesHtml += '<span class="priority-badge ' + pc + '">' + esc(p.priority) + ' Priority</span>';
    }

    // Detail fields
    var fields = [];
    if (p.category) fields.push({ label: 'Category', value: esc(p.category) });
    if (p.industry) fields.push({ label: 'Industry', value: esc(p.industry) });
    if (p.client) fields.push({ label: 'Client / Contact', value: esc(p.client) });
    if (p.tech_stack && p.tech_stack.length > 0) {
      fields.push({ label: 'Tech Stack', value: p.tech_stack.map(esc).join(', ') });
    }
    if (p.version) fields.push({ label: 'Version', value: esc(p.version) });
    if (p.created_by_name) {
      fields.push({
        label: 'Created',
        value: esc(p.created_by_name) + ' on ' + formatDate(p.created_at)
      });
    }

    var fieldsHtml = fields.length > 0
      ? '<div class="detail-fields-grid">' + fields.map(function (f) {
          return '<div class="detail-field"><span class="detail-field-label">' + f.label + '</span><span class="detail-field-value">' + f.value + '</span></div>';
        }).join('') + '</div>'
      : '';

    // External links
    var linksHtml = '';
    if (p.external_links && p.external_links.length > 0) {
      linksHtml = '<div class="detail-fields-grid" style="margin-top:1rem;">' +
        p.external_links.map(function (link) {
          return '<div class="detail-field"><span class="detail-field-label">' + esc(link.label || 'Link') + '</span><span class="detail-field-value"><a href="' + escAttr(link.url) + '" target="_blank" rel="noopener">' + esc(link.url) + '</a></span></div>';
        }).join('') + '</div>';
    }

    // Build the page
    container.innerHTML =
      // Project header card
      '<div class="detail-top">' +
      '  <div class="detail-title-row">' +
      '    <h2 class="detail-title">' + esc(p.name) + '</h2>' +
      '    <div class="detail-actions">' +
      '      <button class="btn-edit" id="btn-edit-project">Edit</button>' +
      '      <button class="btn-delete" id="btn-delete-project">Delete</button>' +
      '    </div>' +
      '  </div>' +
      (badgesHtml ? '  <div class="detail-badges">' + badgesHtml + '</div>' : '') +
      (p.description ? '  <div class="detail-desc">' + esc(p.description) + '</div>' : '') +
      fieldsHtml +
      linksHtml +
      '</div>' +

      // Hours stats bar
      (function () {
        var stats = calcHoursStats();
        return '<div class="project-hours-bar">' +
          '<div class="overview-stat">' +
          '  <span class="overview-number">' + formatHours(stats.total) + 'h</span>' +
          '  <span class="overview-label">Total</span>' +
          '</div>' +
          '<div class="overview-stat">' +
          '  <span class="overview-number overview-number-active">' + formatHours(stats.today) + 'h</span>' +
          '  <span class="overview-label">Today</span>' +
          '</div>' +
          '<div class="overview-stat">' +
          '  <span class="overview-number overview-number-live">' + formatHours(stats.week) + 'h</span>' +
          '  <span class="overview-label">This Week</span>' +
          '</div>' +
          '</div>';
      })() +

      // Update actions
      '<div class="update-form-section">' +
      '  <div class="update-action-buttons">' +
      '    <button type="button" class="btn-manual-update" id="btn-manual-update">&#x270F; Perform Manual Update</button>' +
      (p.github_repo ? '    <button type="button" class="btn-ai-update" id="btn-ai-update">&#x2728; Generate AI Update</button>' : '') +
      '  </div>' +
      '  <form class="update-form" id="form-add-update" style="display:none;">' +
      '    <textarea id="update-content" placeholder="What was done?" required></textarea>' +
      '    <div class="update-form-row">' +
      '      <input type="number" id="update-hours" placeholder="Hours (e.g. 2.5)" step="0.25" min="0">' +
      '      <input type="text" id="update-tools" placeholder="Tools used (comma-separated)">' +
      '    </div>' +
      '    <div class="update-form-row">' +
      '      <input type="text" id="update-version" placeholder="Version (e.g. 1.2.0)">' +
      '      <input type="text" id="update-release-notes" placeholder="Release notes">' +
      '    </div>' +
      '    <div class="update-form-actions">' +
      '      <button type="submit" class="btn-modal-primary">Post Update</button>' +
      '      <button type="button" class="btn-modal-secondary" id="btn-cancel-update">Cancel</button>' +
      '    </div>' +
      '  </form>' +
      '</div>' +

      // Tasks section
      '<div class="tasks-section">' +
      '  <h3>Tasks <button class="btn-edit" id="btn-new-task" style="font-size:0.8rem; padding:0.3rem 0.7rem;">+ New Task</button></h3>' +
      '  <div class="task-list" id="task-list">' +
      renderTasks() +
      '  </div>' +
      '</div>' +

      // Activity timeline
      '<div class="timeline-section">' +
      '  <h3>Activity Timeline</h3>' +
      '  <div class="timeline" id="timeline">' +
      renderTimeline() +
      '  </div>' +
      '</div>';

    // Bind dynamic events
    document.getElementById('btn-edit-project').addEventListener('click', openEditModal);
    document.getElementById('btn-delete-project').addEventListener('click', deleteProject);
    document.getElementById('form-add-update').addEventListener('submit', addUpdate);
    document.getElementById('btn-manual-update').addEventListener('click', function () {
      var form = document.getElementById('form-add-update');
      form.style.display = form.style.display === 'none' ? '' : 'none';
    });
    document.getElementById('btn-cancel-update').addEventListener('click', function () {
      document.getElementById('form-add-update').style.display = 'none';
    });
    document.getElementById('btn-new-task').addEventListener('click', promptNewTask);
    var btnAi = document.getElementById('btn-ai-update');
    if (btnAi) btnAi.addEventListener('click', generateAIUpdate);
  }

  // --- Hours Stats ---
  function calcHoursStats() {
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    var total = 0;
    var today = 0;
    var week = 0;

    updates.forEach(function (u) {
      var h = parseFloat(u.hours) || 0;
      if (h === 0) return;
      total += h;
      var d = new Date(u.created_at);
      if (d >= todayStart) today += h;
      if (d >= weekStart) week += h;
    });

    return { total: total, today: today, week: week };
  }

  function formatHours(n) {
    if (n === 0) return '0';
    return n % 1 === 0 ? n.toString() : n.toFixed(1);
  }

  // --- Activity Timeline ---
  function renderTimeline() {
    // Merge updates and transitions into a single chronological list
    var entries = [];

    updates.forEach(function (u) {
      entries.push({
        type: u.update_type || 'manual',
        date: new Date(u.created_at),
        data: u
      });
    });

    transitions.forEach(function (t) {
      entries.push({
        type: 'transition',
        date: new Date(t.created_at),
        data: t
      });
    });

    // Include task events in timeline
    tasks.forEach(function (t) {
      entries.push({
        type: 'task_created',
        date: new Date(t.created_at),
        data: t
      });
      if (t.completed_at) {
        entries.push({
          type: 'task_completed',
          date: new Date(t.completed_at),
          data: t
        });
      }
    });

    // Sort newest first
    entries.sort(function (a, b) { return b.date - a.date; });

    if (entries.length === 0) {
      return '<div class="empty-state"><p>No activity yet. Post an update above to get started.</p></div>';
    }

    return entries.map(renderTimelineEntry).join('');
  }

  function renderTimelineEntry(entry) {
    if (entry.type === 'transition') {
      return renderTransitionEntry(entry.data);
    }
    if (entry.type === 'task_created') {
      return renderTaskTimelineEntry(entry.data, 'created');
    }
    if (entry.type === 'task_completed') {
      return renderTaskTimelineEntry(entry.data, 'completed');
    }
    return renderUpdateEntry(entry.data);
  }

  function renderUpdateEntry(u) {
    var dotClass = u.update_type === 'claude' ? 'dot-claude' : '';
    var typeLabel = u.update_type === 'claude' ? ' (via Claude)' : '';

    var metaHtml = '';
    var metaTags = [];
    if (u.hours) metaTags.push('<span class="meta-tag">&#9202; ' + u.hours + 'h</span>');
    else if (u.time_spent) metaTags.push('<span class="meta-tag">&#9202; ' + esc(u.time_spent) + '</span>');
    if (u.tools && u.tools.length > 0) {
      u.tools.forEach(function (t) {
        metaTags.push('<span class="meta-tag">' + esc(t) + '</span>');
      });
    }
    if (u.version) metaTags.push('<span class="meta-tag">v' + esc(u.version) + '</span>');
    if (metaTags.length > 0) {
      metaHtml = '<div class="timeline-entry-meta">' + metaTags.join('') + '</div>';
    }

    var releaseHtml = '';
    if (u.release_notes) {
      releaseHtml = '<div style="margin-top:0.5rem; font-size:0.82rem; color:var(--color-text-muted);"><strong>Release notes:</strong> ' + esc(u.release_notes) + '</div>';
    }

    return (
      '<div class="timeline-entry">' +
      '  <div class="timeline-dot ' + dotClass + '"></div>' +
      '  <div class="timeline-entry-card">' +
      '    <div class="timeline-entry-header">' +
      '      <span><span class="timeline-entry-author">' + esc(u.created_by_name) + '</span>' + typeLabel + '</span>' +
      '      <span>' + formatDate(u.created_at) + '</span>' +
      '    </div>' +
      '    <div class="timeline-entry-content">' + esc(u.content) + '</div>' +
      metaHtml +
      releaseHtml +
      '  </div>' +
      '</div>'
    );
  }

  function renderTransitionEntry(t) {
    var text = t.from_stage
      ? esc(t.changed_by_name || 'System') + ' moved this project from ' + esc(t.from_stage) + ' to ' + esc(t.to_stage)
      : esc(t.changed_by_name || 'System') + ' created this project as ' + esc(t.to_stage);

    return (
      '<div class="timeline-entry">' +
      '  <div class="timeline-dot dot-system"></div>' +
      '  <div class="timeline-entry-card">' +
      '    <div class="timeline-entry-header">' +
      '      <span class="timeline-entry-system">' + text + '</span>' +
      '      <span>' + formatDate(t.created_at) + '</span>' +
      '    </div>' +
      '  </div>' +
      '</div>'
    );
  }

  function renderTaskTimelineEntry(t, action) {
    var text = action === 'created'
      ? esc(t.assigned_by_name || 'Someone') + ' assigned a task to ' + esc(t.assigned_to_name || 'someone') + ': "' + esc(t.description) + '"'
      : 'Task completed: "' + esc(t.description) + '"';

    return (
      '<div class="timeline-entry">' +
      '  <div class="timeline-dot dot-system"></div>' +
      '  <div class="timeline-entry-card">' +
      '    <div class="timeline-entry-header">' +
      '      <span class="timeline-entry-system">' + text + '</span>' +
      '      <span>' + formatDate(action === 'created' ? t.created_at : t.completed_at) + '</span>' +
      '    </div>' +
      '  </div>' +
      '</div>'
    );
  }

  // --- Tasks ---
  function renderTasks() {
    if (tasks.length === 0) {
      return '<div class="empty-state" style="padding:1.5rem;"><p>No tasks yet.</p></div>';
    }

    return tasks.map(function (t) {
      var statusClass = t.status === 'Completed' ? 'task-completed' : 'task-open';
      var responsesHtml = '';
      if (t.task_responses && t.task_responses.length > 0) {
        responsesHtml = t.task_responses.map(function (r) {
          return '<div style="margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid var(--color-border); font-size:0.85rem;">' +
            '<strong>' + esc(r.created_by_name || 'Someone') + ':</strong> ' + esc(r.content) +
            (r.file_url ? ' <a href="' + escAttr(r.file_url) + '" target="_blank" rel="noopener" style="font-size:0.8rem;">[attachment]</a>' : '') +
            '<div style="font-size:0.72rem; color:var(--color-text-muted); margin-top:0.15rem;">' + formatDate(r.created_at) + '</div>' +
            '</div>';
        }).join('');
      }

      var actionsHtml = '';
      if (t.status === 'Open') {
        actionsHtml =
          '<div style="margin-top:0.5rem; display:flex; gap:0.5rem;">' +
          '  <button class="btn-edit" style="font-size:0.78rem; padding:0.25rem 0.6rem;" onclick="ProjectDetail.respondToTask(\'' + t.id + '\')">Respond</button>' +
          '  <button class="btn-modal-secondary" style="font-size:0.78rem; padding:0.25rem 0.6rem;" onclick="ProjectDetail.completeTask(\'' + t.id + '\')">Mark Complete</button>' +
          '</div>';
      }

      return (
        '<div class="task-card">' +
        '  <div class="task-card-header">' +
        '    <span class="task-card-body">' + esc(t.description) + '</span>' +
        '    <span class="task-status-badge ' + statusClass + '">' + esc(t.status) + '</span>' +
        '  </div>' +
        '  <div class="task-card-meta">' +
        '    Assigned to ' + esc(t.assigned_to_name || 'Unassigned') +
        '    by ' + esc(t.assigned_by_name || 'Unknown') +
        '    &middot; ' + formatDate(t.created_at) +
        '  </div>' +
        responsesHtml +
        actionsHtml +
        '</div>'
      );
    }).join('');
  }

  // --- Generate AI Update ---
  async function generateAIUpdate() {
    var btn = document.getElementById('btn-ai-update');
    if (!btn || btn.disabled) return;

    btn.disabled = true;
    btn.textContent = 'Generating\u2026';
    btn.classList.add('btn-ai-loading');

    try {
      var session = await sb.auth.getSession();
      var token = session.data.session?.access_token;
      if (!token) { alert('You must be logged in.'); return; }

      var res = await fetch(SUPABASE_URL + '/functions/v1/generate-project-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ project_id: project.id })
      });

      var data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to generate update');

      await loadProject(project.id);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '\u2728 Generate AI Update';
        btn.classList.remove('btn-ai-loading');
      }
    }
  }

  // --- Add Update ---
  async function addUpdate(e) {
    e.preventDefault();

    var content = document.getElementById('update-content').value.trim();
    if (!content) return;

    var toolsInput = document.getElementById('update-tools').value.trim();
    var toolsArr = toolsInput
      ? toolsInput.split(',').map(function (t) { return t.trim(); }).filter(Boolean)
      : [];

    var hoursInput = document.getElementById('update-hours').value;
    var hours = hoursInput ? parseFloat(hoursInput) : null;
    var timeSpent = hours ? (hours === 1 ? '1 hour' : hours + ' hours') : null;

    var newUpdate = {
      project_id: project.id,
      content: content,
      time_spent: timeSpent,
      hours: hours,
      tools: toolsArr,
      version: document.getElementById('update-version').value.trim() || null,
      release_notes: document.getElementById('update-release-notes').value.trim() || null,
      update_type: 'manual',
      created_by: currentUser.id,
      created_by_name: AuthGuard.getDisplayName(currentUser)
    };

    var result = await sb.from('updates').insert([newUpdate]);
    if (result.error) {
      alert('Error adding update: ' + result.error.message);
      return;
    }

    // Touch the project's updated_at
    await sb.from('projects').update({
      updated_at: new Date().toISOString(),
      updated_by: currentUser.id
    }).eq('id', project.id);

    await loadProject(project.id);
  }

  // --- Tasks CRUD ---
  async function promptNewTask() {
    // Simple prompt-based task creation for now
    var desc = prompt('Task description:');
    if (!desc) return;

    var assigneeName = prompt('Assign to (name):');
    if (!assigneeName) return;

    // For now, store by name. When user accounts are set up, this could look up the user ID.
    var newTask = {
      project_id: project.id,
      description: desc.trim(),
      assigned_to_name: assigneeName.trim(),
      assigned_by: currentUser.id,
      assigned_by_name: AuthGuard.getDisplayName(currentUser),
      status: 'Open'
    };

    var result = await sb.from('tasks').insert([newTask]);
    if (result.error) {
      alert('Error creating task: ' + result.error.message);
      return;
    }

    await loadProject(project.id);
  }

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

    await loadProject(project.id);
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

    await loadProject(project.id);
  }

  // --- Edit Project ---
  function openEditModal() {
    var p = project;
    document.getElementById('edit-name').value = p.name || '';
    document.getElementById('edit-desc').value = p.description || '';
    document.getElementById('edit-stage').value = p.stage || 'Idea';
    document.getElementById('edit-priority').value = p.priority || '';
    document.getElementById('edit-category').value = p.category || '';
    document.getElementById('edit-industry').value = p.industry || '';
    document.getElementById('edit-client').value = p.client || '';
    document.getElementById('edit-tech').value = (p.tech_stack || []).join(', ');
    document.getElementById('edit-version').value = p.version || '';
    document.getElementById('modal-edit-project').style.display = 'flex';
    document.getElementById('edit-name').focus();
  }

  function closeEditModal() {
    document.getElementById('modal-edit-project').style.display = 'none';
  }

  async function saveProject(e) {
    e.preventDefault();

    var name = document.getElementById('edit-name').value.trim();
    if (!name) return;

    var newStage = document.getElementById('edit-stage').value;
    var oldStage = project.stage;

    var techInput = document.getElementById('edit-tech').value.trim();
    var techStack = techInput
      ? techInput.split(',').map(function (t) { return t.trim(); }).filter(Boolean)
      : [];

    var updateData = {
      name: name,
      description: document.getElementById('edit-desc').value.trim() || null,
      stage: newStage,
      priority: document.getElementById('edit-priority').value || null,
      category: document.getElementById('edit-category').value.trim() || null,
      industry: document.getElementById('edit-industry').value.trim() || null,
      client: document.getElementById('edit-client').value.trim() || null,
      tech_stack: techStack,
      version: document.getElementById('edit-version').value.trim() || null,
      updated_by: currentUser.id
    };

    var result = await sb.from('projects').update(updateData).eq('id', project.id);
    if (result.error) {
      alert('Error saving project: ' + result.error.message);
      return;
    }

    // Log stage transition if stage changed
    if (newStage !== oldStage) {
      await sb.from('stage_transitions').insert([{
        project_id: project.id,
        from_stage: oldStage,
        to_stage: newStage,
        changed_by: currentUser.id,
        changed_by_name: AuthGuard.getDisplayName(currentUser)
      }]);
    }

    closeEditModal();
    await loadProject(project.id);
  }

  // --- Delete Project ---
  async function deleteProject() {
    if (!confirm('Delete "' + project.name + '"? This cannot be undone.')) return;

    var result = await sb.from('projects').delete().eq('id', project.id);
    if (result.error) {
      alert('Error deleting project: ' + result.error.message);
      return;
    }

    window.location.href = '/dashboard.html';
  }

  // --- Utilities ---
  function esc(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escAttr(str) {
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
  window.ProjectDetail = {
    respondToTask: respondToTask,
    completeTask: completeTask
  };

  // --- Start ---
  document.addEventListener('DOMContentLoaded', init);
})();
