// ============================================================
// Ideas App — Password gate + Supabase CRUD + Stage Chart
// ============================================================
// Depends on: supabase-config.js (loaded first)
//             Supabase JS CDN (loaded in ideas.html)
//             Chart.js CDN (loaded in ideas.html)
// ============================================================

(function () {
  'use strict';

  // --- Supabase client ---
  let supabase = null;
  let stageChart = null;

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

  // --- Stage Chart ---

  var STAGE_ORDER = [
    'Draft', 'Submitted', 'Under Review', 'Approved',
    'In Progress', 'Testing / Pilot', 'Completed', 'On Hold', 'Discarded'
  ];

  var STAGE_COLORS = {
    'Draft': '#6c757d', 'Submitted': '#0d6efd', 'Under Review': '#6f42c1',
    'Approved': '#198754', 'In Progress': '#fd7e14', 'Testing / Pilot': '#20c997',
    'Completed': '#198754', 'On Hold': '#ffc107', 'Discarded': '#dc3545'
  };

  var PRIORITY_COLORS = {
    'Low': '#6c757d', 'Medium': '#0d6efd', 'High': '#fd7e14', 'Critical': '#dc3545'
  };

  function updateChart(ideas) {
    var counts = {};
    STAGE_ORDER.forEach(function (s) { counts[s] = 0; });

    ideas.forEach(function (idea) {
      var stage = (idea.metadata && idea.metadata.stage) || 'Draft';
      if (counts[stage] !== undefined) {
        counts[stage]++;
      } else {
        counts[stage] = 1;
      }
    });

    var labels = STAGE_ORDER;
    var data = labels.map(function (s) { return counts[s]; });
    var colors = labels.map(function (s) { return STAGE_COLORS[s] || '#6c757d'; });

    var ctx = document.getElementById('stage-chart');
    if (!ctx) return;

    if (stageChart) {
      stageChart.data.datasets[0].data = data;
      stageChart.update();
      return;
    }

    stageChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderRadius: 4,
          barThickness: 22
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.parsed.x + (ctx.parsed.x === 1 ? ' idea' : ' ideas');
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { stepSize: 1, precision: 0 },
            grid: { color: 'rgba(0,0,0,0.06)' }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 13 } }
          }
        }
      }
    });
  }

  // --- CRUD operations ---

  async function loadIdeas() {
    var listEl = document.getElementById('ideas-list');
    listEl.innerHTML = '<div class="ideas-empty">Loading...</div>';

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

    // Update chart
    updateChart(ideas || []);

    if (!ideas || ideas.length === 0) {
      listEl.innerHTML =
        '<div class="ideas-empty">No ideas yet. Add one above!</div>';
      return;
    }

    var tableHtml =
      '<table class="ideas-table">' +
      '<thead><tr>' +
      '<th>Stage</th>' +
      '<th>Idea</th>' +
      '<th>Industry</th>' +
      '<th>Client / Contact</th>' +
      '</tr></thead>' +
      '<tbody>' +
      ideas.map(renderIdeaRow).join('') +
      '</tbody></table>';

    listEl.innerHTML = tableHtml;
  }

  function renderIdeaRow(idea) {
    var meta = idea.metadata || {};
    var stage = meta.stage || '';
    var stageColor = STAGE_COLORS[stage] || '#6c757d';
    var industry = meta.industry || '';
    var client = meta.client || '';

    return (
      '<tr class="idea-row" onclick="IdeasApp.viewIdea(\'' + idea.id + '\')">' +
      '<td>' +
      (stage
        ? '<span class="badge" style="background:' + stageColor + '">' + escapeHtml(stage) + '</span>'
        : '<span class="text-muted">—</span>') +
      '</td>' +
      '<td class="idea-row-name">' + escapeHtml(idea.name) + '</td>' +
      '<td>' + (industry ? escapeHtml(industry) : '<span class="text-muted">—</span>') + '</td>' +
      '<td>' + (client ? escapeHtml(client) : '<span class="text-muted">—</span>') + '</td>' +
      '</tr>'
    );
  }

  function viewIdea(id) {
    window.location.href = 'idea-detail.html?id=' + encodeURIComponent(id);
  }

  // --- Metadata field definitions ---
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
    viewIdea: viewIdea,
  };
})();
