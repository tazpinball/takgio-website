// ============================================================
// Ideas App — Password gate + Supabase CRUD
// ============================================================
// Depends on: supabase-config.js (loaded first)
//             Supabase JS CDN (loaded in ideas.html)
// ============================================================

(function () {
  'use strict';

  // --- Supabase client ---
  let supabase = null;

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
    const data = new TextEncoder().encode(pw);
    const buf = await crypto.subtle.digest('SHA-256', data);
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

  // --- Display name ---

  function getDisplayName() {
    return localStorage.getItem('ideas_display_name') || '';
  }

  function setDisplayName(name) {
    localStorage.setItem('ideas_display_name', name);
  }

  function promptForName() {
    var overlay = document.getElementById('name-prompt-overlay');
    overlay.style.display = 'flex';
    var input = document.getElementById('name-input');
    input.focus();

    document.getElementById('name-form').onsubmit = function (e) {
      e.preventDefault();
      var name = input.value.trim();
      if (name) {
        setDisplayName(name);
        overlay.style.display = 'none';
        document.getElementById('current-user').textContent = name;
        loadIdeas();
      }
    };
  }

  // --- App entry ---

  function showApp() {
    document.getElementById('password-gate').style.display = 'none';
    document.getElementById('ideas-app').style.display = 'block';

    if (!initSupabase()) {
      document.getElementById('ideas-list').innerHTML =
        '<div class="ideas-empty">' +
        '<p><strong>Supabase not configured yet.</strong></p>' +
        '<p>Open <code>js/supabase-config.js</code> and add your Supabase URL and anon key.</p>' +
        '</div>';
      return;
    }

    var name = getDisplayName();
    if (!name) {
      promptForName();
    } else {
      document.getElementById('current-user').textContent = name;
      loadIdeas();
    }
  }

  // --- CRUD operations ---

  async function loadIdeas() {
    var listEl = document.getElementById('ideas-list');
    listEl.innerHTML = '<div class="loading-spinner">Loading ideas...</div>';

    var result = await supabase
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false });

    if (result.error) {
      listEl.innerHTML =
        '<div class="ideas-empty">Error loading ideas: ' +
        escapeHtml(result.error.message) +
        '</div>';
      return;
    }

    var ideas = result.data;
    if (!ideas || ideas.length === 0) {
      listEl.innerHTML =
        '<div class="ideas-empty">No ideas yet. Add one above!</div>';
      return;
    }

    listEl.innerHTML = ideas.map(renderIdeaCard).join('');
  }

  function renderBadges(meta) {
    if (!meta) return '';
    var html = '';
    if (meta.stage) {
      var sc = STAGE_COLORS[meta.stage] || '#6c757d';
      html += '<span class="badge" style="background:' + sc + '">' + escapeHtml(meta.stage) + '</span>';
    }
    if (meta.priority) {
      var pc = PRIORITY_COLORS[meta.priority] || '#6c757d';
      html += '<span class="badge" style="background:' + pc + '">' + escapeHtml(meta.priority) + '</span>';
    }
    if (meta.category) {
      html += '<span class="badge badge-outline">' + escapeHtml(meta.category) + '</span>';
    }
    if (meta.effort) {
      html += '<span class="badge badge-outline">Effort: ' + escapeHtml(meta.effort) + '</span>';
    }
    if (meta.impact) {
      html += '<span class="badge badge-outline">Impact: ' + escapeHtml(meta.impact) + '</span>';
    }
    return html ? '<div class="idea-card-badges">' + html + '</div>' : '';
  }

  function renderMetadataDetails(meta) {
    if (!meta) return '';
    var html = '';
    // Only render the text/date fields as detail rows (badges handle the rest)
    var detailKeys = ['client','industry','relationship','problem','solution','time_savings','expected_outcome','target_date','link'];
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
        html +=
          '<div class="meta-field">' +
          '<span class="meta-label">' + escapeHtml(f.label) + ':</span> ' +
          '<span class="meta-value">' + displayVal + '</span>' +
          '</div>';
      }
    });
    return html ? '<div class="idea-card-details">' + html + '</div>' : '';
  }

  function renderIdeaCard(idea) {
    var date = new Date(idea.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      '<div class="idea-card" data-id="' + idea.id + '"' +
      ' data-metadata=\'' + escapeAttr(JSON.stringify(idea.metadata || {})) + '\'>' +
      '  <div class="idea-card-header">' +
      '    <h3>' + escapeHtml(idea.name) + '</h3>' +
      '    <div class="idea-card-actions">' +
      '      <button class="btn-edit" onclick="IdeasApp.editIdea(\'' + idea.id + '\')">Edit</button>' +
      '      <button class="btn-delete" onclick="IdeasApp.deleteIdea(\'' + idea.id + '\')">Delete</button>' +
      '    </div>' +
      '  </div>' +
      renderBadges(idea.metadata) +
      (idea.description
        ? '  <p>' + escapeHtml(idea.description) + '</p>'
        : '') +
      renderMetadataDetails(idea.metadata) +
      '  <div class="idea-card-meta">Added by ' +
      escapeHtml(idea.created_by || 'Unknown') +
      ' on ' + date +
      '</div>' +
      '</div>'
    );
  }

  // --- Metadata field definitions ---
  // type: 'text' = free text input, 'select' = dropdown, 'date' = date picker
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

  // Badge color mappings
  var STAGE_COLORS = {
    'Draft': '#6c757d', 'Submitted': '#0d6efd', 'Under Review': '#6f42c1',
    'Approved': '#198754', 'In Progress': '#fd7e14', 'Testing / Pilot': '#20c997',
    'Completed': '#198754', 'On Hold': '#ffc107', 'Discarded': '#dc3545'
  };
  var PRIORITY_COLORS = {
    'Low': '#6c757d', 'Medium': '#0d6efd', 'High': '#fd7e14', 'Critical': '#dc3545'
  };

  function collectMetadata() {
    var meta = {};
    METADATA_FIELDS.forEach(function (f) {
      var el = document.getElementById('idea-' + f.key.replace(/_/g, '-'));
      if (el) {
        var val = el.value.trim();
        if (val) meta[f.key] = val;
      }
    });
    return meta;
  }

  function clearMetadataFields() {
    METADATA_FIELDS.forEach(function (f) {
      var el = document.getElementById('idea-' + f.key.replace(/_/g, '-'));
      if (el) {
        if (f.key === 'stage') {
          el.value = 'Draft';
        } else {
          el.value = '';
        }
      }
    });
  }

  async function addIdea(e) {
    e.preventDefault();
    var nameInput = document.getElementById('idea-name');
    var descInput = document.getElementById('idea-description');
    var name = nameInput.value.trim();
    var description = descInput.value.trim();

    if (!name) return;

    var result = await supabase.from('ideas').insert([
      {
        name: name,
        description: description,
        created_by: getDisplayName(),
        metadata: collectMetadata(),
      },
    ]);

    if (result.error) {
      alert('Error adding idea: ' + result.error.message);
      return;
    }

    nameInput.value = '';
    descInput.value = '';
    clearMetadataFields();
    nameInput.focus();
    loadIdeas();
  }

  async function deleteIdea(id) {
    if (!confirm('Delete this idea?')) return;

    var result = await supabase.from('ideas').delete().eq('id', id);
    if (result.error) {
      alert('Error deleting idea: ' + result.error.message);
      return;
    }
    loadIdeas();
  }

  function editIdea(id) {
    var card = document.querySelector('.idea-card[data-id="' + id + '"]');
    if (!card || card.classList.contains('editing')) return;

    var nameEl = card.querySelector('h3');
    var descEl = card.querySelector('p');
    var currentName = nameEl ? nameEl.textContent : '';
    var currentDesc = descEl ? descEl.textContent : '';
    var currentMeta = {};
    try { currentMeta = JSON.parse(card.getAttribute('data-metadata') || '{}'); } catch (e) {}

    card.classList.add('editing');

    var metaFieldsHtml = '';
    METADATA_FIELDS.forEach(function (f) {
      var curVal = currentMeta[f.key] || '';
      if (f.type === 'select') {
        var opts = '<option value="">' + escapeHtml(f.label) + '...</option>';
        f.options.forEach(function (opt) {
          opts += '<option value="' + escapeAttr(opt) + '"' +
            (curVal === opt ? ' selected' : '') + '>' + escapeHtml(opt) + '</option>';
        });
        metaFieldsHtml += '<select class="edit-meta-' + f.key + '">' + opts + '</select>';
      } else if (f.type === 'date') {
        metaFieldsHtml +=
          '<input type="date" class="edit-meta-' + f.key + '"' +
          ' value="' + escapeAttr(curVal) + '" title="' + escapeAttr(f.label) + '">';
      } else if (f.type === 'url') {
        metaFieldsHtml +=
          '<input type="url" class="edit-meta-' + f.key + '"' +
          ' placeholder="' + escapeAttr(f.placeholder || f.label) + '"' +
          ' value="' + escapeAttr(curVal) + '">';
      } else {
        metaFieldsHtml +=
          '<input type="text" class="edit-meta-' + f.key + '"' +
          ' placeholder="' + escapeAttr(f.placeholder || f.label) + '"' +
          ' value="' + escapeAttr(curVal) + '">';
      }
    });

    var editFormHtml =
      '<div class="edit-form">' +
      '  <input type="text" class="edit-name" value="' + escapeAttr(currentName) + '">' +
      '  <textarea class="edit-desc">' + escapeHtml(currentDesc) + '</textarea>' +
      metaFieldsHtml +
      '  <div class="form-actions">' +
      '    <button class="btn-primary" onclick="IdeasApp.saveEdit(\'' + id + '\')">Save</button>' +
      '    <button class="btn-secondary" onclick="IdeasApp.cancelEdit(\'' + id + '\')">Cancel</button>' +
      '  </div>' +
      '</div>';

    card.insertAdjacentHTML('beforeend', editFormHtml);
    card.querySelector('.edit-name').focus();
  }

  async function saveEdit(id) {
    var card = document.querySelector('.idea-card[data-id="' + id + '"]');
    var nameVal = card.querySelector('.edit-name').value.trim();
    var descVal = card.querySelector('.edit-desc').value.trim();

    if (!nameVal) return;

    var meta = {};
    METADATA_FIELDS.forEach(function (f) {
      var el = card.querySelector('.edit-meta-' + f.key);
      if (el) {
        var val = el.value.trim();
        if (val) meta[f.key] = val;
      }
    });

    var result = await supabase
      .from('ideas')
      .update({ name: nameVal, description: descVal, metadata: meta })
      .eq('id', id);

    if (result.error) {
      alert('Error updating idea: ' + result.error.message);
      return;
    }
    loadIdeas();
  }

  function cancelEdit(id) {
    var card = document.querySelector('.idea-card[data-id="' + id + '"]');
    card.classList.remove('editing');
    var form = card.querySelector('.edit-form');
    if (form) form.remove();
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
    document.getElementById('add-idea-form').addEventListener('submit', addIdea);
    document.getElementById('btn-logout').addEventListener('click', logout);

    if (isAuthenticated()) {
      showApp();
    } else {
      document.getElementById('password-input').focus();
    }
  });

  // Expose functions needed by inline onclick handlers
  window.IdeasApp = {
    editIdea: editIdea,
    deleteIdea: deleteIdea,
    saveEdit: saveEdit,
    cancelEdit: cancelEdit,
  };
})();
