// ============================================================
// Idea Detail — View / Edit / Delete a single idea
// ============================================================
// Depends on: supabase-config.js (loaded first)
//             Supabase JS CDN (loaded in idea-detail.html)
// ============================================================

(function () {
  'use strict';

  var supabase = null;
  var currentIdea = null;
  var isEditing = false;

  // --- Metadata field definitions (shared with ideas.js) ---
  var METADATA_FIELDS = [
    { key: 'stage',            label: 'Stage',              type: 'select',
      options: ['Draft','Submitted','Under Review','Approved','In Progress','Testing / Pilot','Completed','On Hold','Discarded'] },
    { key: 'priority',         label: 'Priority',           type: 'select',
      options: ['Low','Medium','High','Critical'] },
    { key: 'category',         label: 'Category',           type: 'select',
      options: ['Automation','Product','Service','Process Improvement','Other'] },
    { key: 'effort',           label: 'Effort',             type: 'select',
      options: ['S','M','L','XL'] },
    { key: 'impact',           label: 'Impact',             type: 'select',
      options: ['Low','Medium','High'] },
    { key: 'client',           label: 'Client / Contact',   type: 'text', placeholder: 'Client / Contact' },
    { key: 'industry',         label: 'Industry',           type: 'text', placeholder: 'Industry' },
    { key: 'relationship',     label: 'Relationship',       type: 'text', placeholder: 'Relationship (e.g. friend)' },
    { key: 'problem',          label: 'Problem',            type: 'text', placeholder: 'Problem being solved' },
    { key: 'solution',         label: 'Solution',           type: 'text', placeholder: 'Proposed solution' },
    { key: 'time_savings',     label: 'Time Savings',       type: 'text', placeholder: 'Time savings (e.g. 10 days)' },
    { key: 'expected_outcome', label: 'Expected Outcome',   type: 'text', placeholder: 'Expected outcome' },
    { key: 'target_date',      label: 'Target Date',        type: 'date' },
    { key: 'link',             label: 'Link',               type: 'url',  placeholder: 'URL (e.g. https://...)' },
  ];

  var STAGE_COLORS = {
    'Draft': '#6c757d', 'Submitted': '#0d6efd', 'Under Review': '#6f42c1',
    'Approved': '#198754', 'In Progress': '#fd7e14', 'Testing / Pilot': '#20c997',
    'Completed': '#198754', 'On Hold': '#ffc107', 'Discarded': '#dc3545'
  };

  var PRIORITY_COLORS = {
    'Low': '#6c757d', 'Medium': '#0d6efd', 'High': '#fd7e14', 'Critical': '#dc3545'
  };

  // --- Supabase ---

  function initSupabase() {
    if (
      SUPABASE_URL === 'https://YOUR_PROJECT_ID.supabase.co' ||
      SUPABASE_ANON_KEY === 'YOUR_ANON_KEY_HERE'
    ) {
      return false;
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  }

  // --- Password gate ---

  async function hashPassword(pw) {
    var data = new TextEncoder().encode(pw);
    var buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  function isAuthenticated() {
    return sessionStorage.getItem('ideas_auth') === 'true';
  }

  function setAuthenticated() {
    sessionStorage.setItem('ideas_auth', 'true');
  }

  function logout() {
    sessionStorage.removeItem('ideas_auth');
    location.reload();
  }

  async function handleLogin(e) {
    e.preventDefault();
    var input = document.getElementById('password-input');
    var errorEl = document.getElementById('password-error');
    var hash = await hashPassword(input.value);

    if (hash === PASSWORD_HASH) {
      setAuthenticated();
      showApp();
    } else {
      errorEl.textContent = 'Incorrect password.';
      input.value = '';
      input.focus();
    }
  }

  function getDisplayName() {
    return localStorage.getItem('ideas_display_name') || '';
  }

  // --- App entry ---

  function showApp() {
    document.getElementById('password-gate').style.display = 'none';
    document.getElementById('ideas-app').style.display = 'block';

    var name = getDisplayName();
    document.getElementById('current-user').textContent = name || '';

    if (!initSupabase()) {
      document.getElementById('detail-content').innerHTML =
        '<div class="ideas-empty"><p><strong>Supabase not configured.</strong></p></div>';
      return;
    }

    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    if (!id) {
      document.getElementById('detail-content').innerHTML =
        '<div class="ideas-empty"><p>No idea specified.</p></div>';
      return;
    }

    loadIdea(id);
  }

  // --- Load & Render ---

  async function loadIdea(id) {
    var container = document.getElementById('detail-content');
    container.innerHTML = '<div class="ideas-empty">Loading...</div>';

    var result = await supabase
      .from('ideas')
      .select('*')
      .eq('id', id)
      .single();

    if (result.error || !result.data) {
      container.innerHTML =
        '<div class="ideas-empty">Idea not found.</div>';
      return;
    }

    currentIdea = result.data;
    renderDetail();
  }

  function renderDetail() {
    var idea = currentIdea;
    var meta = idea.metadata || {};
    var container = document.getElementById('detail-content');

    var date = new Date(idea.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });

    // Badges
    var badgesHtml = '';
    if (meta.stage) {
      var sc = STAGE_COLORS[meta.stage] || '#6c757d';
      badgesHtml += '<span class="badge" style="background:' + sc + '">' + escapeHtml(meta.stage) + '</span>';
    }
    if (meta.priority) {
      var pc = PRIORITY_COLORS[meta.priority] || '#6c757d';
      badgesHtml += '<span class="badge" style="background:' + pc + '">' + escapeHtml(meta.priority) + '</span>';
    }
    if (meta.category) {
      badgesHtml += '<span class="badge badge-outline">' + escapeHtml(meta.category) + '</span>';
    }
    if (meta.effort) {
      badgesHtml += '<span class="badge badge-outline">Effort: ' + escapeHtml(meta.effort) + '</span>';
    }
    if (meta.impact) {
      badgesHtml += '<span class="badge badge-outline">Impact: ' + escapeHtml(meta.impact) + '</span>';
    }

    // Detail fields
    var detailKeys = ['client','industry','relationship','problem','solution','time_savings','expected_outcome','target_date','link'];
    var fieldsHtml = '';
    METADATA_FIELDS.forEach(function (f) {
      if (detailKeys.indexOf(f.key) !== -1 && meta[f.key]) {
        var val = meta[f.key];
        var displayVal;
        if (f.key === 'target_date') {
          displayVal = escapeHtml(new Date(val + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
        } else if (f.type === 'url') {
          displayVal = '<a href="' + escapeAttr(val) + '" target="_blank" rel="noopener">' + escapeHtml(val) + '</a>';
        } else {
          displayVal = escapeHtml(val);
        }
        fieldsHtml +=
          '<div class="detail-field">' +
          '<span class="detail-label">' + escapeHtml(f.label) + '</span>' +
          '<span class="detail-value">' + displayVal + '</span>' +
          '</div>';
      }
    });

    container.innerHTML =
      '<div class="detail-card">' +
      '  <div class="detail-header">' +
      '    <h2>' + escapeHtml(idea.name) + '</h2>' +
      '    <div class="detail-actions">' +
      '      <button class="btn-primary" onclick="IdeaDetail.startEdit()">Edit</button>' +
      '      <button class="btn-delete-detail" onclick="IdeaDetail.deleteIdea()">Delete</button>' +
      '    </div>' +
      '  </div>' +
      (badgesHtml ? '<div class="idea-card-badges">' + badgesHtml + '</div>' : '') +
      (idea.description
        ? '<div class="detail-description">' + escapeHtml(idea.description) + '</div>'
        : '') +
      (fieldsHtml ? '<div class="detail-fields">' + fieldsHtml + '</div>' : '') +
      '  <div class="detail-meta">Added by ' +
      escapeHtml(idea.created_by || 'Unknown') +
      ' on ' + date +
      '</div>' +
      '</div>';
  }

  // --- Edit mode ---

  function startEdit() {
    if (isEditing) return;
    isEditing = true;

    var idea = currentIdea;
    var meta = idea.metadata || {};
    var container = document.getElementById('detail-content');

    var metaFieldsHtml = '';
    METADATA_FIELDS.forEach(function (f) {
      var curVal = meta[f.key] || '';
      var fieldHtml = '<div class="edit-field-group"><label>' + escapeHtml(f.label) + '</label>';

      if (f.type === 'select') {
        var opts = '<option value="">' + escapeHtml(f.label) + '...</option>';
        f.options.forEach(function (opt) {
          opts += '<option value="' + escapeAttr(opt) + '"' +
            (curVal === opt ? ' selected' : '') + '>' + escapeHtml(opt) + '</option>';
        });
        fieldHtml += '<select class="edit-meta-' + f.key + '">' + opts + '</select>';
      } else if (f.type === 'date') {
        fieldHtml +=
          '<input type="date" class="edit-meta-' + f.key + '"' +
          ' value="' + escapeAttr(curVal) + '">';
      } else if (f.type === 'url') {
        fieldHtml +=
          '<input type="url" class="edit-meta-' + f.key + '"' +
          ' placeholder="' + escapeAttr(f.placeholder || f.label) + '"' +
          ' value="' + escapeAttr(curVal) + '">';
      } else {
        fieldHtml +=
          '<input type="text" class="edit-meta-' + f.key + '"' +
          ' placeholder="' + escapeAttr(f.placeholder || f.label) + '"' +
          ' value="' + escapeAttr(curVal) + '">';
      }

      fieldHtml += '</div>';
      metaFieldsHtml += fieldHtml;
    });

    container.innerHTML =
      '<div class="detail-card">' +
      '  <div class="edit-form-detail">' +
      '    <div class="edit-field-group">' +
      '      <label>Idea Name</label>' +
      '      <input type="text" id="edit-name" value="' + escapeAttr(idea.name) + '">' +
      '    </div>' +
      '    <div class="edit-field-group">' +
      '      <label>Description</label>' +
      '      <textarea id="edit-desc">' + escapeHtml(idea.description || '') + '</textarea>' +
      '    </div>' +
      '    <div class="edit-fields-grid">' + metaFieldsHtml + '</div>' +
      '    <div class="form-actions">' +
      '      <button class="btn-primary" onclick="IdeaDetail.saveEdit()">Save</button>' +
      '      <button class="btn-secondary" onclick="IdeaDetail.cancelEdit()">Cancel</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    document.getElementById('edit-name').focus();
  }

  async function saveEdit() {
    var nameVal = document.getElementById('edit-name').value.trim();
    var descVal = document.getElementById('edit-desc').value.trim();

    if (!nameVal) return;

    var meta = {};
    var container = document.getElementById('detail-content');
    METADATA_FIELDS.forEach(function (f) {
      var el = container.querySelector('.edit-meta-' + f.key);
      if (el) {
        var val = el.value.trim();
        if (val) meta[f.key] = val;
      }
    });

    var result = await supabase
      .from('ideas')
      .update({ name: nameVal, description: descVal, metadata: meta })
      .eq('id', currentIdea.id);

    if (result.error) {
      alert('Error updating idea: ' + result.error.message);
      return;
    }

    isEditing = false;
    // Reload the idea to show updated data
    loadIdea(currentIdea.id);
  }

  function cancelEdit() {
    isEditing = false;
    renderDetail();
  }

  // --- Delete ---

  async function deleteIdea() {
    if (!confirm('Delete this idea? This cannot be undone.')) return;

    var result = await supabase
      .from('ideas')
      .delete()
      .eq('id', currentIdea.id);

    if (result.error) {
      alert('Error deleting idea: ' + result.error.message);
      return;
    }

    window.location.href = 'ideas.html';
  }

  // --- Utilities ---

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // --- Init ---

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('password-form').addEventListener('submit', handleLogin);
    document.getElementById('btn-logout').addEventListener('click', logout);

    if (isAuthenticated()) {
      showApp();
    } else {
      document.getElementById('password-input').focus();
    }
  });

  window.IdeaDetail = {
    startEdit: startEdit,
    saveEdit: saveEdit,
    cancelEdit: cancelEdit,
    deleteIdea: deleteIdea,
  };
})();
