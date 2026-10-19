/* AI news feed (v2.43). Reads the published weekly recap from Supabase's public view ai_news_public
   (tables in docs/news-schema.sql; editors manage weeks in /careers-admin.html, "AI news" tab) and fills:
     - #ai-news-root   on ai-news.html: week chips, the selected week's stories, past weeks, topics
     - #ai-week-card   on news.html: the latest week's headlines
     - .h-ticker       on index.html: adds the newest stories that have a ticker line, linked to their story
   Needs js/supabase-config.js first (SUPABASE_URL, SUPABASE_ANON_KEY: the public key, read-only by design).
   If the request fails, the AI news page says so and the other two places simply stay as they are. */
(function () {
  'use strict';
  var root = document.getElementById('ai-news-root'), card = document.getElementById('ai-week-card'), ticker = document.querySelector('.h-ticker-track');
  if (!root && !card && !ticker) return;
  if (typeof SUPABASE_URL === 'undefined') return;

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var TOPICS = ['Claude', 'Smart glasses', 'Models', 'Voice', 'App stores', 'Industry'];
  var SRC_COLOUR = { 'Anthropic': '#c15f3c', 'Google': '#1a73e8', 'OpenAI': '#202124', 'Meta': '#0866ff', 'Meta for Developers': '#0866ff',
    'ElevenLabs': '#111111', 'Apple Developer': '#555555', 'Autodesk': '#0696d7' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function d(iso) { var p = iso.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)); }
  function short(iso) { var x = d(iso); return MONTHS[x.getUTCMonth()] + ' ' + x.getUTCDate() + ', ' + x.getUTCFullYear(); }
  function range(ws, long) {
    var a = d(ws), b = new Date(a.getTime() + 6 * 864e5), M = long ? LONG : MONTHS, same = a.getUTCMonth() === b.getUTCMonth();
    return M[a.getUTCMonth()] + ' ' + a.getUTCDate() + '–' + (same ? '' : M[b.getUTCMonth()] + ' ') + b.getUTCDate() + (long ? ', ' + b.getUTCFullYear() : '');
  }
  function safeUrl(u) { return /^https:\/\//.test(u || '') ? u : '#'; }

  fetch(SUPABASE_URL + '/rest/v1/ai_news_public?select=*&order=source_date.desc', { headers: { apikey: SUPABASE_ANON_KEY } })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (rows) {
      var weeks = [], by = {};
      rows.forEach(function (s) { if (!by[s.week_start]) { by[s.week_start] = { ws: s.week_start, brief: s.brief, items: [] }; weeks.push(by[s.week_start]); } by[s.week_start].items.push(s); });
      weeks.sort(function (a, b) { return a.ws < b.ws ? 1 : -1; });
      if (root) page(weeks);
      if (card) sidebar(weeks);
      if (ticker) addToTicker(rows);
    })
    .catch(function () {
      if (root) root.innerHTML = '<p class="g-note">AI news could not be loaded just now. Please try again in a moment.</p>';
    });

  // ---------------------------------------------------------------- ai-news.html
  function page(weeks) {
    if (!weeks.length) { root.innerHTML = '<p class="g-note">The first weekly recap is on its way.</p>'; return; }
    var chips = document.getElementById('ai-week-chips'), past = document.getElementById('ai-past'), topics = document.getElementById('ai-topics');
    chips.innerHTML = weeks.map(function (w) { return '<a class="g-chip" href="#w-' + w.ws + '" data-w="' + w.ws + '">' + range(w.ws) + '</a>'; }).join('');
    past.innerHTML = weeks.map(function (w) { return '<li><a href="#w-' + w.ws + '" data-w="' + w.ws + '">' + range(w.ws) + '<span>' + w.items.length + (w.items.length === 1 ? ' story' : ' stories') + '</span></a></li>'; }).join('');
    var tc = {}; weeks.forEach(function (w) { w.items.forEach(function (s) { tc[s.topic] = (tc[s.topic] || 0) + 1; }); });
    topics.innerHTML = TOPICS.filter(function (t) { return tc[t]; }).map(function (t) { return '<li><div class="g-li">' + esc(t) + '<span>' + tc[t] + (tc[t] === 1 ? ' story' : ' stories') + '</span></div></li>'; }).join('');
    root.innerHTML = weeks.map(function (w, i) {
      var rows = w.items.map(function (s) {
        return '<article class="g-row" id="' + esc(s.slug) + '"><div>' +
          '<div class="g-src"><span class="g-dot" style="--c:' + (SRC_COLOUR[s.source] || '#5f6368') + '">' + esc(s.source.charAt(0)) + '</span><b>' + esc(s.source) + '</b><span>&middot;</span><span>' + short(s.source_date) + '</span><span class="g-tag">' + esc(s.topic) + '</span></div>' +
          '<h3><a href="' + esc(safeUrl(s.source_url)) + '" target="_blank" rel="noopener">' + esc(s.headline) + '</a></h3>' +
          '<p>' + esc(s.summary) + '</p><p class="g-why"><b>Why it matters to us:</b> ' + esc(s.why) + '</p></div></article>';
      }).join('');
      var newer = i ? '<a href="#w-' + weeks[i - 1].ws + '">&larr; Newer: ' + range(weeks[i - 1].ws) + '</a>' : '<span class="off">Latest week</span>';
      var older = i + 1 < weeks.length ? '<a href="#w-' + weeks[i + 1].ws + '">Older: ' + range(weeks[i + 1].ws) + ' &rarr;</a>' : '<span class="off">First week</span>';
      return '<div class="g-week" id="w-' + w.ws + '"><div class="g-brief"><small>' + (i ? 'Week of' : 'This week') + ' &middot; ' + range(w.ws, true) + ' &middot; ' + w.items.length + (w.items.length === 1 ? ' story' : ' stories') +
        '</small><p>' + esc(w.brief) + '</p></div><div class="g-surface">' + rows + '</div><div class="g-pager">' + newer + older + '</div></div>';
    }).join('');
    var all = [].slice.call(document.querySelectorAll('.g-week')), links = [].slice.call(document.querySelectorAll('[data-w]'));
    function show(h, scroll) {
      var k = null, el = h && document.getElementById(h);
      if (el && el.classList.contains('g-week')) k = h.slice(2);
      else if (el && el.closest && el.closest('.g-week')) k = el.closest('.g-week').id.slice(2);
      if (!k) k = weeks[0].ws;
      all.forEach(function (w) { w.classList.toggle('on', w.id === 'w-' + k); });
      links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-w') === k); });
      if (el && el.classList.contains('g-row')) setTimeout(function () { el.scrollIntoView({ block: 'center' }); }, 60);
      else if (scroll) { var top = root.getBoundingClientRect().top + window.pageYOffset - 90; window.scrollTo(0, Math.max(0, top)); }
    }
    window.addEventListener('hashchange', function () { show(location.hash.slice(1), true); });
    show(location.hash.slice(1), false);
  }

  // ---------------------------------------------------------------- news.html sidebar
  function sidebar(weeks) {
    if (!weeks.length) return;
    var list = card.querySelector('ul');
    list.innerHTML = weeks[0].items.map(function (s) { return '<li><a href="/ai-news.html#' + esc(s.slug) + '">' + esc(s.headline) + '<span>' + esc(s.source) + '</span></a></li>'; }).join('');
    card.hidden = false;
  }

  // ---------------------------------------------------------------- index.html ticker
  function addToTicker(rows) {
    var news = rows.filter(function (s) { return s.ticker; }).slice(0, 3);
    if (!news.length) return;
    var first = [].slice.call(ticker.children).filter(function (e) { return e.getAttribute('aria-hidden') !== 'true'; });
    var made = news.map(function (s) {
      var a = document.createElement('a'); a.href = '/ai-news.html#' + s.slug;
      a.innerHTML = '<span class="tk tk-ai">AI NEWS</span>' + esc(s.ticker); return a;
    });
    // after the company NEWS item, interleave: one AI story, then one of the existing lines
    var seq = [], k = 0;
    first.forEach(function (el, i) { seq.push(el); if (i > 0 && k < made.length) seq.push(made[k++]); });
    while (k < made.length) seq.push(made[k++]);
    ticker.innerHTML = '';
    seq.forEach(function (el) { ticker.appendChild(el); });
    seq.forEach(function (el) {
      var c = el.cloneNode(true); c.setAttribute('aria-hidden', 'true'); if (c.tagName === 'A') c.setAttribute('tabindex', '-1'); ticker.appendChild(c);
    });
  }
})();
