// ============================================================
// Takgio admin: News (/admin/news: the AI news weeks and stories, including the daily job's stories).
// Runs on the shared admin core (js/admin-core.js): sign-in, two-step code, access check and the page frame live there.
// Who may do what is enforced by the DATABASE (docs/careers-schema.sql), not by this page.
// Depends on: Supabase JS (CDN), supabase-config.js, admin-core.js.
// ============================================================
(function () {
  'use strict';

  // bound to the shared core when it first routes (js/admin-core.js)
  var A, sb, state, esc = TakgioAdmin.esc, fmt = TakgioAdmin.fmt, MONTHS = TakgioAdmin.MONTHS, toast, isAdmin, page, route;
  function bind(a) { A = a; sb = a.sb; state = a.state; toast = a.toast; isAdmin = a.isAdmin; page = a.page; route = a.route; }
  var opt = TakgioAdmin.opt;

  // ------------------------------------------------------------ AI news (weekly recap; docs/news-schema.sql)
  var TOPICS = ['Claude', 'Smart glasses', 'Models', 'Voice', 'App stores', 'Industry'];
  function monday(d) { var x = new Date(d + 'T12:00:00Z'); return x.getUTCDay() === 1; }
  function weekLabel(ws) {
    var a = new Date(ws + 'T12:00:00Z'), b = new Date(a.getTime() + 6 * 864e5);
    return MONTHS[a.getUTCMonth()] + ' ' + a.getUTCDate() + ' – ' + (a.getUTCMonth() === b.getUTCMonth() ? '' : MONTHS[b.getUTCMonth()] + ' ') + b.getUTCDate() + ', ' + b.getUTCFullYear();
  }
  function thisMonday() { var d = new Date(); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7) - 7); return d.toISOString().slice(0, 10); }

  function viewNews() {
    page('news', '<p class="cra-empty">Loading…</p>');
    Promise.all([sb.from('ai_news_weeks').select('*').order('week_start', { ascending: false }), sb.from('ai_news_items').select('week_start')]).then(function (r) {
      if (r[0].error) { page('news', '<p class="cra-err">' + esc(r[0].error.message) + '</p>'); return; }
      var weeks = r[0].data || [], n = {};
      (r[1].data || []).forEach(function (i) { n[i.week_start] = (n[i.week_start] || 0) + 1; });
      var rows = weeks.map(function (w) {
        var pub = w.status === 'published';
        return '<tr><td><b>' + esc(weekLabel(w.week_start)) + '</b><br><small style="color:var(--color-text-secondary)">' + esc(w.brief) + '</small></td>' +
          '<td><span class="st ' + (pub ? 'pub' : 'draft') + '">' + (pub ? 'Published' : 'Draft') + '</span></td><td>' + (n[w.week_start] || 0) + '</td><td>' + fmt(w.published_at) + '</td>' +
          '<td class="cra-act"><a href="#week/' + w.week_start + '">Edit</a>' + (pub ? '<a href="/ai-news.html#w-' + w.week_start + '" target="_blank" rel="noopener">View live</a>' : '') + '</td></tr>';
      }).join('');
      page('news', '<div class="cra-bar"><h1 class="cra-h1">AI news</h1><div class="cra-pub"><button class="cra-btn" id="n-import">Import a week</button><button class="cra-btn pri" id="n-new">+ New week</button></div></div>' +
        '<div class="cra-card cra-scroll">' + (weeks.length ? '<table class="cra-table"><tr><th>Week</th><th>Status</th><th>Stories</th><th>Published</th><th>Actions</th></tr>' + rows + '</table>'
          : '<p class="cra-empty">No weeks yet.</p>') + '</div>' +
        '<div class="cra-card"><h2>How a week goes live</h2><p style="margin:0;font-size:.9rem">Each week starts as a <b>draft</b>: nothing shows on the site. Check every story (open its source link), then press <b>Publish week</b>. The newest stories marked for the ticker appear on the home page by themselves.</p></div>' +
        '<div class="cra-card" id="n-imp" hidden><h2>Import a week</h2><p class="cra-hint" style="margin:0 0 8px">Paste the week file you were sent (it starts with <code>{"week_start"</code>). It is added as a draft for you to check.</p>' +
        '<div class="cra-f"><textarea id="n-json" style="min-height:220px;font-family:ui-monospace,Consolas,monospace;font-size:.82rem"></textarea></div><button class="cra-btn pri" id="n-go">Add as a draft</button><p class="cra-err" id="n-err"></p></div>');
      document.getElementById('n-new').addEventListener('click', function () {
        var ws = prompt('Week starting (a Monday, YYYY-MM-DD):', thisMonday()); if (!ws) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ws) || !monday(ws)) { toast('That date is not a Monday', true); return; }
        sb.from('ai_news_weeks').insert({ week_start: ws, brief: 'One sentence that sums up the week.' }).then(function (x) {
          if (x.error) toast(x.error.code === '23505' ? 'That week already exists' : x.error.message, true); else location.hash = '#week/' + ws;
        });
      });
      document.getElementById('n-import').addEventListener('click', function () { document.getElementById('n-imp').hidden = false; document.getElementById('n-json').focus(); });
      document.getElementById('n-go').addEventListener('click', function () {
        var err = document.getElementById('n-err'); err.textContent = '';
        var d; try { d = JSON.parse(document.getElementById('n-json').value); } catch (e) { err.textContent = 'That is not a valid week file: ' + e.message; return; }
        var problem = validateWeek(d); if (problem) { err.textContent = problem; return; }
        sb.from('ai_news_weeks').insert({ week_start: d.week_start, brief: d.brief }).then(function (x) {
          if (x.error) { err.textContent = x.error.code === '23505' ? 'That week already exists. Open it and edit it instead.' : x.error.message; return; }
          var items = d.items.map(function (i) { return { slug: i.slug, week_start: d.week_start, topic: i.topic, source: i.source, source_url: i.source_url, source_date: i.source_date, headline: i.headline, summary: i.summary, why: i.why, ticker: i.ticker || null }; });
          sb.from('ai_news_items').insert(items).then(function (y) {
            if (y.error) { err.textContent = 'The week was added, but its stories were not: ' + y.error.message; return; }
            toast('Added as a draft'); location.hash = '#week/' + d.week_start;
          });
        });
      });
    });
  }
  function validateWeek(d) {
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d.week_start || '') || !monday(d.week_start)) return 'week_start must be a Monday (YYYY-MM-DD).';
    if (!d.brief) return 'The week needs its one-sentence summary (brief).';
    if (!Array.isArray(d.items) || !d.items.length) return 'The week has no stories.';
    for (var k = 0; k < d.items.length; k++) { var p = storyProblem(d.items[k]); if (p) return 'Story ' + (k + 1) + ': ' + p; }
    return '';
  }
  function storyProblem(i) {
    if (!/^[a-z0-9-]+$/.test(i.slug || '')) return 'the short name may only use a–z, 0–9 and dashes';
    if (TOPICS.indexOf(i.topic) < 0) return 'the topic must be one of: ' + TOPICS.join(', ');
    if (!i.source) return 'the source is missing';
    if (!/^https:\/\//.test(i.source_url || '')) return 'the source link must start with https://';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(i.source_date || '')) return 'the date must be YYYY-MM-DD';
    if (!i.headline || !i.summary || !i.why) return 'the headline, summary and “why it matters” are all needed';
    return '';
  }

  function viewWeek(ws) {
    page('news', '<p class="cra-empty">Loading…</p>');
    Promise.all([sb.from('ai_news_weeks').select('*').eq('week_start', ws).maybeSingle(), sb.from('ai_news_items').select('*').eq('week_start', ws).order('source_date', { ascending: false })]).then(function (r) {
      if (r[0].error || !r[0].data) { page('news', '<p class="cra-err">' + esc((r[0].error && r[0].error.message) || 'That week was not found.') + '</p>'); return; }
      var w = r[0].data, items = r[1].data || [], pub = w.status === 'published';
      var cards = items.map(function (i) {
        var flag = (i.origin === 'auto' ? '<span class="st draft" style="margin-right:6px">Added by the daily job</span>' : '') + (i.hidden ? '<span class="st" style="background:#fee2e2;color:#991b1b">Pulled: not on the site</span>' : '');
        return '<div class="cra-card" data-id="' + i.id + '" data-hidden="' + (i.hidden ? '1' : '') + '">' + (flag ? '<p style="margin:0 0 10px">' + flag + '</p>' : '') +
          '<div class="cra-r3"><div class="cra-f"><label>Source</label><input type="text" data-k="source" value="' + esc(i.source) + '"></div>' +
          '<div class="cra-f"><label>Date on the source</label><input type="date" data-k="source_date" value="' + esc(i.source_date) + '"></div>' +
          '<div class="cra-f"><label>Topic</label><select data-k="topic">' + TOPICS.map(function (t) { return opt(t, t, i.topic); }).join('') + '</select></div></div>' +
          '<div class="cra-f"><label>Headline (exactly as the source publishes it)</label><input type="text" data-k="headline" value="' + esc(i.headline) + '"></div>' +
          '<div class="cra-f"><label>Source link</label><input type="text" data-k="source_url" value="' + esc(i.source_url) + '"><p class="hint"><a href="' + esc(i.source_url) + '" target="_blank" rel="noopener noreferrer">Open the source</a> and check the date and every fact before publishing.</p></div>' +
          '<div class="cra-f"><label>Summary (our words)</label><textarea data-k="summary" style="min-height:70px">' + esc(i.summary) + '</textarea></div>' +
          '<div class="cra-f"><label>Why it matters to us</label><textarea data-k="why" style="min-height:60px">' + esc(i.why) + '</textarea></div>' +
          '<div class="cra-r2"><div class="cra-f"><label>Home-page ticker line (optional)</label><input type="text" data-k="ticker" maxlength="90" value="' + esc(i.ticker || '') + '"></div>' +
          '<div class="cra-f"><label>Short name (used in links)</label><input type="text" data-k="slug" value="' + esc(i.slug) + '"></div></div>' +
          '<div class="cra-pub"><button class="cra-btn pri" data-save>Save story</button><button class="cra-btn" data-hide>' + (i.hidden ? 'Restore to the site' : 'Pull from the site') + '</button><button class="cra-btn dng" data-del>Delete story</button></div></div>';
      }).join('');
      page('news', '<div class="cra-bar"><div><div style="font-size:.9rem"><a href="#news" style="font-weight:700;text-decoration:none">&larr; AI news</a></div><h1 class="cra-h1">' + esc(weekLabel(ws)) +
        ' <span class="st ' + (pub ? 'pub' : 'draft') + '">' + (pub ? 'Published' : 'Draft') + '</span></h1></div><div class="cra-pub">' +
        (pub ? '<a class="cra-btn" href="/ai-news.html#w-' + ws + '" target="_blank" rel="noopener">View live</a><button class="cra-btn" id="w-unpub">Unpublish</button>' : '<button class="cra-btn pri" id="w-pub">Publish week</button>') +
        (isAdmin() ? '<button class="cra-btn dng" id="w-del">Delete week</button>' : '') + '</div></div>' +
        '<div class="cra-card"><h2>The week in one sentence</h2><div class="cra-f"><textarea id="w-brief" style="min-height:70px">' + esc(w.brief) + '</textarea></div><button class="cra-btn" id="w-save">Save</button></div>' +
        '<h2 style="font-size:1.1rem;margin:22px 0 12px">Stories (' + items.length + ')</h2>' + (cards || '<div class="cra-card"><p class="cra-empty">No stories yet.</p></div>') +
        '<button class="cra-btn" id="w-add">+ Add a story</button>');
      var setWeek = function (patch, msg) { sb.from('ai_news_weeks').update(patch).eq('week_start', ws).then(function (x) { if (x.error) toast(x.error.message, true); else { toast(msg); viewWeek(ws); } }); };
      document.getElementById('w-save').addEventListener('click', function () { setWeek({ brief: document.getElementById('w-brief').value.trim() }, 'Saved'); });
      var bp = document.getElementById('w-pub');
      if (bp) bp.addEventListener('click', function () {
        var bad = items.map(storyProblem).filter(Boolean);
        if (!items.length) { toast('Add at least one story first', true); return; }
        if (bad.length) { toast('Fix this first: ' + bad[0], true); return; }
        if (confirm('Publish this week? Its ' + items.length + ' stories appear on takgio.com right away.')) setWeek({ status: 'published', published_at: w.published_at || new Date().toISOString() }, 'Published');
      });
      var bu = document.getElementById('w-unpub');
      if (bu) bu.addEventListener('click', function () { if (confirm('Take this week off the site?')) setWeek({ status: 'draft' }, 'Unpublished'); });
      var bd = document.getElementById('w-del');
      if (bd) bd.addEventListener('click', function () {
        if (!confirm('Delete this week and all its stories for good?')) return;
        sb.from('ai_news_weeks').delete().eq('week_start', ws).select().then(function (x) {
          if (x.error) toast(x.error.message, true); else if (!x.data || !x.data.length) toast('Not deleted (only admins can delete a week)', true); else { toast('Deleted'); location.hash = '#news'; }
        });
      });
      document.getElementById('w-add').addEventListener('click', function () {
        var slug = 'story-' + Date.now().toString(36);
        sb.from('ai_news_items').insert({ slug: slug, week_start: ws, topic: 'Claude', source: 'Source name', source_url: 'https://', source_date: ws, headline: 'Headline', summary: 'Summary', why: 'Why it matters to us' })
          .then(function (x) { if (x.error) toast(x.error.message, true); else viewWeek(ws); });
      });
      document.querySelectorAll('[data-id]').forEach(function (card) {
        var id = card.getAttribute('data-id');
        card.querySelector('[data-save]').addEventListener('click', function () {
          var d = {}; card.querySelectorAll('[data-k]').forEach(function (f) { d[f.getAttribute('data-k')] = f.value.trim(); });
          d.ticker = d.ticker || null;
          var p = storyProblem(d); if (p) { toast('Fix this first: ' + p, true); return; }
          sb.from('ai_news_items').update(d).eq('id', id).then(function (x) { if (x.error) toast(x.error.code === '23505' ? 'That short name is used by another story' : x.error.message, true); else toast('Saved'); });
        });
        card.querySelector('[data-hide]').addEventListener('click', function () {
          var hide = !card.getAttribute('data-hidden');
          sb.from('ai_news_items').update({ hidden: hide }).eq('id', id).then(function (x) { if (x.error) toast(x.error.message, true); else { toast(hide ? 'Pulled from the site' : 'Restored to the site'); viewWeek(ws); } });
        });
        card.querySelector('[data-del]').addEventListener('click', function () {
          if (!confirm('Delete this story?')) return;
          sb.from('ai_news_items').delete().eq('id', id).then(function (x) { if (x.error) toast(x.error.message, true); else viewWeek(ws); });
        });
      });
    });
  }

  TakgioAdmin.start({
    area: 'News',
    tabs: [['news', 'AI news']],
    route: function (a, view, parts) {
      bind(a);
      if (view === 'week' && parts[1]) return viewWeek(parts[1]);
      return viewNews();
    }
  });
  window.__adminTest = { esc: esc, fmt: fmt, weekLabel: weekLabel, validateWeek: validateWeek, monday: monday };
})();
