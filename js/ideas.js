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
  var allIdeas = [];       // cached for client-side sorting
  var sortState = 'none';  // 'none' | 'asc' | 'desc'

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

  // --- Theme toggle ---

  function getTheme() {
    return localStorage.getItem('ideas_theme') || 'vivid';
  }

  function setTheme(theme) {
    localStorage.setItem('ideas_theme', theme);
    document.body.setAttribute('data-theme', theme);
    var btn = document.getElementById('btn-theme');
    if (btn) {
      btn.textContent = theme === 'dark' ? 'Dark' : 'Vivid';
    }
    // Rebuild chart for theme-appropriate label colors
    if (stageChart) {
      var isDark = theme === 'dark';
      stageChart.options.scales.x.ticks.color = isDark ? '#aaa' : '#aaa';
      stageChart.options.scales.x.title.color = isDark ? '#999' : '#888';
      stageChart.options.scales.y.ticks.color = isDark ? '#ccc' : '#555';
      stageChart.options.scales.x.grid.color = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
      stageChart.update();
    }
  }

  function toggleTheme() {
    var current = getTheme();
    setTheme(current === 'vivid' ? 'dark' : 'vivid');
  }

  function initTheme() {
    var theme = getTheme();
    document.body.setAttribute('data-theme', theme);
    var btn = document.getElementById('btn-theme');
    if (btn) {
      btn.textContent = theme === 'dark' ? 'Dark' : 'Vivid';
    }
  }

  // --- Collapsible Add Form ---

  function toggleAddForm() {
    var panel = document.getElementById('add-idea-panel');
    var btn = document.getElementById('toggle-add-form');
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
      btn.classList.add('active');
      btn.textContent = '— Hide Form';
      document.getElementById('idea-name').focus();
    } else {
      panel.style.display = 'none';
      btn.classList.remove('active');
      btn.textContent = '+ Add Idea';
    }
  }

  function cancelAdd() {
    var panel = document.getElementById('add-idea-panel');
    var btn = document.getElementById('toggle-add-form');
    panel.style.display = 'none';
    btn.classList.remove('active');
    btn.textContent = '+ Add Idea';
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

  // Custom Chart.js plugin: 3D shadow + depth effect
  var shadow3DPlugin = {
    id: 'shadow3D',
    beforeDatasetsDraw: function (chart) {
      var ctx = chart.ctx;
      ctx.save();
      var meta = chart.getDatasetMeta(0);
      var dataset = chart.data.datasets[0];
      var depthX = 6;
      var depthY = 6;

      meta.data.forEach(function (bar, i) {
        var props = bar.getProps(['x', 'y', 'base', 'height', 'width']);
        var barX = props.base;
        var barY = props.y - props.height / 2;
        var barW = props.x - props.base;
        var barH = props.height;

        if (barW <= 0) return;

        // Shadow layer (offset, darker)
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.roundRect(barX + depthX, barY + depthY, barW, barH, 4);
        ctx.fill();

        // Depth side (right face)
        var baseColor = dataset.backgroundColor[i] || '#6c757d';
        ctx.fillStyle = darkenColor(baseColor, 0.3);
        ctx.beginPath();
        ctx.moveTo(barX + barW, barY);
        ctx.lineTo(barX + barW + depthX, barY + depthY);
        ctx.lineTo(barX + barW + depthX, barY + barH + depthY);
        ctx.lineTo(barX + barW, barY + barH);
        ctx.closePath();
        ctx.fill();

        // Depth bottom face
        ctx.fillStyle = darkenColor(baseColor, 0.2);
        ctx.beginPath();
        ctx.moveTo(barX, barY + barH);
        ctx.lineTo(barX + depthX, barY + barH + depthY);
        ctx.lineTo(barX + barW + depthX, barY + barH + depthY);
        ctx.lineTo(barX + barW, barY + barH);
        ctx.closePath();
        ctx.fill();
      });
      ctx.restore();
    },
    afterDatasetsDraw: function (chart) {
      // Gradient highlight on top of each bar for glossy effect
      var ctx = chart.ctx;
      ctx.save();
      var meta = chart.getDatasetMeta(0);

      meta.data.forEach(function (bar) {
        var props = bar.getProps(['x', 'y', 'base', 'height', 'width']);
        var barX = props.base;
        var barY = props.y - props.height / 2;
        var barW = props.x - props.base;
        var barH = props.height;

        if (barW <= 0) return;

        var grad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
        grad.addColorStop(0, 'rgba(255,255,255,0.35)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
        grad.addColorStop(1, 'rgba(0,0,0,0.05)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 4);
        ctx.fill();
      });
      ctx.restore();
    }
  };

  // Data labels plugin: show count at end of each bar
  var dataLabelsPlugin = {
    id: 'barDataLabels',
    afterDatasetsDraw: function (chart) {
      var ctx = chart.ctx;
      var meta = chart.getDatasetMeta(0);
      var dataset = chart.data.datasets[0];

      ctx.save();
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      meta.data.forEach(function (bar, i) {
        var val = dataset.data[i];
        if (val === 0) return;
        var props = bar.getProps(['x', 'y']);
        ctx.fillStyle = getTheme() === 'dark' ? '#ddd' : '#444';
        ctx.fillText(val, props.x + 10, props.y);
      });
      ctx.restore();
    }
  };

  function darkenColor(hex, amount) {
    hex = hex.replace('#', '');
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    r = Math.round(r * (1 - amount));
    g = Math.round(g * (1 - amount));
    b = Math.round(b * (1 - amount));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

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
          label: 'Ideas',
          data: data,
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 24
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { right: 40, top: 8, bottom: 8 }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(26,26,46,0.9)',
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 6,
            displayColors: true,
            boxWidth: 10,
            boxHeight: 10,
            boxPadding: 4,
            callbacks: {
              title: function (items) {
                return items[0].label;
              },
              label: function (ctx) {
                return ' ' + ctx.parsed.x + (ctx.parsed.x === 1 ? ' idea' : ' ideas');
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Ideas',
              font: { size: 12, weight: '600' },
              color: '#888',
              padding: { top: 8 }
            },
            ticks: {
              stepSize: 1,
              precision: 0,
              font: { size: 11 },
              color: '#aaa'
            },
            grid: {
              color: 'rgba(0,0,0,0.04)',
              drawTicks: false
            },
            border: { display: false }
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { size: 13, weight: '500' },
              color: '#555',
              padding: 8
            },
            border: { display: false }
          }
        },
        animation: {
          duration: 600,
          easing: 'easeOutQuart'
        }
      },
      plugins: [shadow3DPlugin, dataLabelsPlugin]
    });
  }

  // --- Sorting ---

  function getStageIndex(idea) {
    var stage = (idea.metadata && idea.metadata.stage) || 'Draft';
    var idx = STAGE_ORDER.indexOf(stage);
    return idx >= 0 ? idx : 999;
  }

  function sortIdeas(ideas) {
    var sorted = ideas.slice(); // copy
    if (sortState === 'asc') {
      sorted.sort(function (a, b) { return getStageIndex(a) - getStageIndex(b); });
    } else if (sortState === 'desc') {
      sorted.sort(function (a, b) { return getStageIndex(b) - getStageIndex(a); });
    }
    // 'none' keeps original DB order (newest first)
    return sorted;
  }

  function cycleSortState() {
    if (sortState === 'none') sortState = 'asc';
    else if (sortState === 'asc') sortState = 'desc';
    else sortState = 'none';
    renderTable();
  }

  function getSortIndicator() {
    if (sortState === 'asc') return ' ▲';
    if (sortState === 'desc') return ' ▼';
    return ' ⇅';
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

    allIdeas = result.data || [];

    // Update chart
    updateChart(allIdeas);

    // Update count badge
    var countEl = document.getElementById('ideas-count');
    if (countEl) {
      countEl.textContent = allIdeas.length;
      countEl.style.display = allIdeas.length > 0 ? 'inline-block' : 'none';
    }

    renderTable();
  }

  function renderTable() {
    var listEl = document.getElementById('ideas-list');

    if (!allIdeas || allIdeas.length === 0) {
      listEl.innerHTML =
        '<div class="ideas-empty">No ideas yet. Add one above!</div>';
      return;
    }

    var sorted = sortIdeas(allIdeas);

    var tableHtml =
      '<table class="ideas-table">' +
      '<thead><tr>' +
      '<th class="th-sortable" onclick="IdeasApp.cycleSortState()">Stage' +
      '<span class="sort-indicator">' + getSortIndicator() + '</span></th>' +
      '<th>Idea</th>' +
      '<th>Industry</th>' +
      '<th>Client / Contact</th>' +
      '<th>Link</th>' +
      '<th>Added</th>' +
      '</tr></thead>' +
      '<tbody>' +
      sorted.map(renderIdeaRow).join('') +
      '</tbody></table>';

    listEl.innerHTML = tableHtml;
  }

  function renderIdeaRow(idea) {
    var meta = idea.metadata || {};
    var stage = meta.stage || '';
    var stageColor = STAGE_COLORS[stage] || '#6c757d';
    var industry = meta.industry || '';
    var client = meta.client || '';
    var link = meta.link || '';
    var dateStr = idea.created_at
      ? new Date(idea.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

    // Truncate link display to 25 chars
    var linkHtml = '';
    if (link) {
      var displayLink = link.length > 25 ? link.substring(0, 25) + '...' : link;
      linkHtml = '<a href="' + escapeAttr(link) + '" target="_blank" rel="noopener" class="idea-row-link" onclick="event.stopPropagation()" title="' + escapeAttr(link) + '">' + escapeHtml(displayLink) + '</a>';
    } else {
      linkHtml = '<span class="text-muted">—</span>';
    }

    // Subtle row tint based on stage color (10% opacity)
    var rowStyle = stage
      ? 'border-left: 4px solid ' + stageColor + '; background: ' + stageColor + '0a;'
      : 'border-left: 4px solid transparent;';

    return (
      '<tr class="idea-row" style="' + rowStyle + '" onclick="IdeasApp.viewIdea(\'' + idea.id + '\')">' +
      '<td>' +
      (stage
        ? '<span class="badge" style="background:' + stageColor + '">' + escapeHtml(stage) + '</span>'
        : '<span class="text-muted">—</span>') +
      '</td>' +
      '<td class="idea-row-name">' + escapeHtml(idea.name) + '</td>' +
      '<td>' + (industry ? escapeHtml(industry) : '<span class="text-muted">—</span>') + '</td>' +
      '<td>' + (client ? escapeHtml(client) : '<span class="text-muted">—</span>') + '</td>' +
      '<td>' + linkHtml + '</td>' +
      '<td class="idea-row-date">' + escapeHtml(dateStr) + '</td>' +
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
    cancelAdd(); // collapse the form after adding
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
    document.getElementById('toggle-add-form').addEventListener('click', toggleAddForm);
    document.getElementById('btn-cancel-add').addEventListener('click', cancelAdd);
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);
    initTheme();

    if (isAuthenticated()) {
      showApp();
    } else {
      document.getElementById('password-input').focus();
    }
  });

  // Expose functions needed by inline onclick handlers
  window.IdeasApp = {
    viewIdea: viewIdea,
    cycleSortState: cycleSortState,
  };
})();
