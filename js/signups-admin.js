// ============================================================
// Takgio admin: Signups (/admin/signups, admins only). One page for every list people can join or write to:
// the Brickture Insiders and Takgio News lists (Kit), contact messages, ConcreteIQ beta requests, and the older
// footer newsletter box (Formspree). Read only. The data comes from /api/signups (api/signups.js), which checks that the
// caller is a two-step-verified admin before it returns anything; this page only draws it.
// Runs on the shared admin core (js/admin-core.js). Depends on: Supabase JS (CDN), supabase-config.js, admin-core.js.
// ============================================================
(function () {
  'use strict';
  var esc = TakgioAdmin.esc;

  function when(d) {
    if (!d) return '—';
    var t = new Date(d); if (isNaN(t)) return esc(String(d).slice(0, 10));
    return TakgioAdmin.MONTHS[t.getMonth()] + ' ' + t.getDate() + ', ' + t.getFullYear();
  }
  function days(d) { var t = new Date(d); return isNaN(t) ? 0 : (Date.now() - t.getTime()) / 864e5; }
  function stat(n, label) { return '<div class="cra-stat"><b>' + n + '</b><span>' + esc(label) + '</span></div>'; }
  function table(head, rows, empty) {
    return rows.length ? '<table class="cra-table"><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>' + rows.join('') + '</table>'
      : '<p class="cra-empty">' + esc(empty) + '</p>';
  }
  function bySource(people) {
    var c = {}; people.forEach(function (p) { var k = p.source || 'before tracking'; c[k] = (c[k] || 0) + 1; });
    var keys = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; });
    return keys.length ? keys.map(function (k) { return esc(k) + ' ' + c[k]; }).join(' · ') : '—';
  }

  // one Kit list: confirmed and unconfirmed people
  function kitCard(f, hideTests) {
    if (f.error) return '<div class="cra-card"><h2>' + esc(f.name) + '</h2><p class="cra-err">' + esc(f.error) + '</p></div>';
    var keep = function (p) { return !(hideTests && p.test); };
    var act = f.active.filter(keep), ina = f.inactive.filter(keep);
    var rows = act.map(function (p) { return { p: p, st: 'ok', label: 'Confirmed' }; })
      .concat(ina.map(function (p) { return { p: p, st: days(p.joined) > 2 ? 'wait' : 'rev', label: days(p.joined) > 2 ? 'Not confirmed (2+ days)' : 'Waiting to confirm' }; }))
      .sort(function (a, b) { return new Date(b.p.joined) - new Date(a.p.joined); })
      .map(function (r) { return '<tr><td>' + esc(r.p.email) + (r.p.test ? ' <small>(test)</small>' : '') + '</td><td><span class="st ' + r.st + '">' + r.label + '</span></td><td>' + when(r.p.joined) + '</td><td>' + esc(r.p.source || '—') + '</td></tr>'; });
    return '<div class="cra-card cra-scroll"><h2>' + esc(f.name) + '</h2>' +
      '<div class="cra-stats">' + stat(act.length, 'Confirmed') + stat(ina.length, 'Waiting to confirm') + '</div>' +
      '<p class="cra-hint" style="margin:0 12px 10px">Where they came from: ' + bySource(act.concat(ina)) + '</p>' +
      table(['Email', 'Status', 'Joined', 'From'], rows, 'Nobody yet.') + '</div>';
  }

  function fsCard(title, blurb, items, cols, rowFn, empty) {
    return '<div class="cra-card cra-scroll"><h2>' + esc(title) + ' <small style="font-weight:400">(' + items.length + ')</small></h2><p class="cra-hint" style="margin:0 12px 10px">' + blurb + '</p>' +
      table(cols, items.map(rowFn), empty) + '</div>';
  }

  // data = the /api/signups answer; hideTests = hide Ted's own test addresses
  function render(data, hideTests) {
    var out = '';
    var keep = function (p) { return !(hideTests && p.test); };
    var inKit = {};
    data.kit.forEach(function (f) { (f.active || []).concat(f.inactive || []).forEach(function (p) { inKit[(p.email || '').toLowerCase()] = 1; }); });
    out += (data.notes || []).map(function (n) { return '<div class="cra-card"><p class="cra-hint" style="margin:0">' + esc(n) + '</p></div>'; }).join('');
    out += '<div class="cra-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">' + data.kit.map(function (f) { return kitCard(f, hideTests); }).join('') + '</div>';
    if (data.formspree) {
      var fs = data.formspree.filter(keep);
      var contact = fs.filter(function (s) { return !s.source; });
      var beta = fs.filter(function (s) { return s.source === 'concreteiq-beta'; });
      var old = fs.filter(function (s) { return s.source === 'newsletter' && !inKit[(s.email || '').toLowerCase()]; });
      var lost = fs.filter(function (s) { return s.source === 'brickture-waitlist' && !inKit[(s.email || '').toLowerCase()]; });
      out += '<div class="cra-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">' +
        fsCard('Contact messages', 'From the Contact page. They are also emailed to info@takgio.com.', contact, ['From', 'Topic', 'Message', 'Date'], function (s) {
          return '<tr><td><b>' + esc(s.name || '—') + '</b><br><a href="mailto:' + esc(s.email || '') + '">' + esc(s.email || '') + '</a></td><td>' + esc(s.topic || '—') + '</td><td style="white-space:pre-wrap;max-width:420px">' + esc(s.message || '') + '</td><td>' + when(s.joined) + '</td></tr>';
        }, 'No messages yet.') +
        fsCard('ConcreteIQ beta requests', 'From the ConcreteIQ page.', beta, ['From', 'Details', 'Date'], function (s) {
          var rest = Object.keys(s).filter(function (k) { return ['email', 'name', 'source', 'joined', 'test', 'came_from'].indexOf(k) < 0 && s[k]; }).map(function (k) { return esc(k) + ': ' + esc(s[k]); }).join('<br>');
          return '<tr><td><b>' + esc(s.name || '—') + '</b><br>' + esc(s.email || '') + '</td><td>' + (rest || '—') + '</td><td>' + when(s.joined) + '</td></tr>';
        }, 'No requests yet.') + '</div>';
      out += '<div class="cra-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">' +
        fsCard('Footer newsletter box, before Takgio News', 'Signed up in the old "Stay in the loop" box (before 9 Nov) and not in the Takgio News list in Kit.', old, ['Email', 'Joined', 'From'], function (s) {
          return '<tr><td>' + esc(s.email || '') + '</td><td>' + when(s.joined) + '</td><td>' + esc(s.came_from || '—') + '</td></tr>';
        }, 'None: everyone is in Kit.') +
        fsCard('Brickture signups missing from Kit', 'Safety check: in the backup copy but not in Kit. Anyone listed here never got the confirmation email.', lost, ['Email', 'Joined', 'From'], function (s) {
          return '<tr><td>' + esc(s.email || '') + '</td><td>' + when(s.joined) + '</td><td>' + esc(s.came_from || '—') + '</td></tr>';
        }, 'None: nobody was lost.') + '</div>';
    }
    return out;
  }

  var A, hide = true, cache = null;
  function draw() {
    var head = '<div class="cra-bar"><h1 class="cra-h1">Signups</h1><div class="cra-tools"><label style="font-size:.9rem"><input type="checkbox" id="hide-tests"' + (hide ? ' checked' : '') + '> Hide my test addresses</label> <button class="cra-btn" id="reload">Refresh</button></div></div>';
    A.page('signups', head + '<div id="su-body">' + (cache ? render(cache, hide) : '<p class="cra-empty">Loading…</p>') + '</div>' +
      (cache ? '<p class="cra-hint">Read only. As of ' + esc(new Date(cache.asOf).toLocaleString()) + '. Kit is the record for Insiders and Takgio News; Formspree holds the rest.</p>' : ''));
    var cb = document.getElementById('hide-tests');
    if (cb) cb.addEventListener('change', function () { hide = cb.checked; draw(); });
    var rl = document.getElementById('reload'); if (rl) rl.addEventListener('click', function () { cache = null; load(); });
  }
  function load() {
    draw();
    A.sb.auth.getSession().then(function (s) {
      var tok = s.data.session && s.data.session.access_token;
      return fetch('/api/signups', { headers: { Authorization: 'Bearer ' + tok } });
    }).then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('error ' + r.status)); return j; });
    }).then(function (j) { cache = j; draw(); })
      .catch(function (e) { var b = document.getElementById('su-body'); if (b) b.innerHTML = '<div class="cra-card"><p class="cra-err">' + esc(e.message) + '</p></div>'; });
  }

  window.SignupsView = { render: render }; // for tests
  if (window.__SIGNUPS_TEST) return;
  TakgioAdmin.start({
    area: 'Signups',
    tabs: [['signups', 'Signups', true]],
    route: function (a) {
      A = a;
      if (!a.isAdmin()) return a.page('signups', '<div class="cra-card"><p class="cra-empty">Only admins see signups. <a href="/admin">Back to Admin</a></p></div>');
      load();
    }
  });
})();
