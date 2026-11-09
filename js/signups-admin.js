// ============================================================
// Takgio admin: Signups (/admin/signups, admins only). One list of people, grouped by status, with a tag for each
// thing they signed up for: Brickture Insiders and Takgio News (Kit), Jobs (Careers applications), plus contact
// messages and ConcreteIQ beta requests (Formspree). Read only. Kit and Formspree come from /api/signups
// (api/signups.js, which checks the caller is a two-step-verified admin); job applicants come straight from
// Supabase under the admin's own sign-in. Runs on js/admin-core.js.
// ============================================================
(function () {
  'use strict';
  var esc = TakgioAdmin.esc;
  var KIT_TAG = { insiders: ['brick', 'Brickture'], news: ['news', 'News'] };

  var css = document.createElement('style');
  css.textContent =
    '.su{font-size:13px;line-height:1.3}.su *{box-sizing:border-box}' +
    '.su-top{display:flex;gap:8px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;margin-bottom:8px}' +
    '.su-top h1{font-size:18px;margin:0}.su-top p{margin:1px 0 0;color:#5d6680;font-size:12px}' +
    '.su-tools{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.su-tools input[type=search]{font:inherit;padding:5px 9px;border:1px solid #e3e6ef;border-radius:8px;min-width:190px}' +
    '.su-btn{font:inherit;cursor:pointer;padding:5px 10px;border:1px solid #e3e6ef;background:#fff;border-radius:8px}' +
    '.su-chips{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px}.su-chip{font:inherit;cursor:pointer;padding:3px 10px;border-radius:99px;border:1px solid #e3e6ef;background:#fff;font-size:12.5px}' +
    '.su-chip[aria-pressed=true]{background:#4a6cf7;color:#fff;border-color:#4a6cf7}' +
    '.su-sum{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin-bottom:8px}@media(max-width:700px){.su-sum{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
    '.su-stat{background:#fff;border:1px solid #e3e6ef;border-radius:12px;padding:5px 10px;display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}.su-stat b{font-size:17px}.su-stat small{font-size:11.5px;color:#5d6680}.su-stat.al{border-color:#a3231f}.su-stat.al b{color:#a3231f}' +
    '.su-card{background:#fff;border:1px solid #e3e6ef;border-radius:12px;overflow:hidden;margin-bottom:8px}' +
    '.su-gh{display:flex;gap:8px;align-items:center;padding:6px 12px;border-bottom:1px solid #e3e6ef;flex-wrap:wrap}.su-gh h2{font-size:13.5px;margin:0}.su-gh p{margin:0;color:#5d6680;font-size:11.5px;flex-basis:100%}.su-cnt{color:#5d6680}' +
    '.su-pill{font-size:11px;font-weight:700;padding:1px 8px;border-radius:99px;white-space:nowrap}.p-ok{background:#dcf5e5;color:#14753f}.p-wait{background:#fdf0c9;color:#8a5a00}.p-bad{background:#fde0de;color:#a3231f}.p-msg{background:#e5eaef;color:#41505f}.p-jobs{background:#efe3fb;color:#6a2fb0}' +
    '.su-sc{overflow-x:auto}.su table{width:100%;border-collapse:collapse;min-width:640px}.su th{text-align:left;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#5d6680;padding:3px 12px;font-weight:600}.su td{padding:4px 12px;border-top:1px solid #e3e6ef;vertical-align:top}.su td.n{white-space:nowrap}' +
    '.su .em{font-weight:600;overflow-wrap:anywhere}.su .nt{color:#5d6680;font-size:11.5px}.su-tg{display:inline-block;font-size:11px;font-weight:700;padding:1px 7px;border-radius:99px;margin:0 3px 0 0;white-space:nowrap}' +
    '.t-brick{background:#fbe6d8;color:#b8501a}.t-news{background:#e3e9ff;color:#2c4fd0}.t-jobs{background:#efe3fb;color:#6a2fb0}.t-msg{background:#e5eaef;color:#41505f}' +
    '.su-msg{max-width:420px;white-space:pre-wrap}.su-note{color:#5d6680;font-size:11.5px;margin:6px 0}.su-err{color:#a3231f;padding:8px 12px}.su tr[hidden],.su-card[hidden]{display:none}';
  document.head.appendChild(css);

  function d(x) { var t = new Date(x); return isNaN(t) ? null : t; }
  function when(x) { var t = d(x); return t ? TakgioAdmin.MONTHS[t.getMonth()] + ' ' + t.getDate() + ', ' + t.getFullYear() : '—'; }
  function ago(x) { var t = d(x); if (!t) return 0; return (Date.now() - t.getTime()) / 864e5; }
  function waiting(x) { var n = Math.floor(ago(x)); return n < 1 ? 'today' : n + (n === 1 ? ' day' : ' days'); }
  function tag(k, label) { return '<span class="su-tg t-' + k + '">' + esc(label) + '</span>'; }
  function cell(h, rows, cols) {
    return '<div class="su-sc"><table><thead><tr>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }
  function group(pill, pcls, title, blurb, rows, cols) {
    if (!rows.length) return '';
    return '<section class="su-card" data-g><div class="su-gh"><span class="su-pill ' + pcls + '">' + pill + '</span><h2>' + esc(title) + '</h2><span class="su-cnt"></span><p>' + blurb + '</p></div>' + cell(null, rows, cols) + '</section>';
  }

  // Build one entry per email from the Kit lists
  function people(data, keep) {
    var map = {};
    data.kit.forEach(function (f) {
      var t = KIT_TAG[f.key]; if (!t || f.error) return;
      [['ok', f.active || []], ['wait', f.inactive || []]].forEach(function (pair) {
        pair[1].filter(keep).forEach(function (p) {
          var k = (p.email || '').toLowerCase();
          var e = map[k] || (map[k] = { email: p.email, signed: p.joined, source: p.source, lists: [], test: p.test });
          e.lists.push({ k: t[0], label: t[1], ok: pair[0] === 'ok', joined: p.joined });
          if (d(p.joined) && (!d(e.signed) || d(p.joined) < d(e.signed))) e.signed = p.joined;
          if (!e.source && p.source) e.source = p.source;
        });
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function render(data, apps, hideTests) {
    var keep = function (p) { return !(hideTests && p.test); };
    var ppl = people(data, keep);
    var confirmed = [], wait = [], nudge = [];
    ppl.forEach(function (e) {
      if (e.lists.some(function (l) { return l.ok; })) confirmed.push(e);
      else if (ago(e.signed) > 2) nudge.push(e); else wait.push(e);
    });
    var byNew = function (a, b) { return (d(b.signed) || 0) - (d(a.signed) || 0); };
    confirmed.sort(byNew); wait.sort(byNew); nudge.sort(byNew);
    var tags = function (e) { return e.lists.map(function (l) { return tag(l.k, l.label + (l.ok || !e.lists.some(function (x) { return x.ok; }) ? '' : ' (waiting)')); }).join(''); };
    var dt = function (e) { return e.lists.map(function (l) { return l.k; }).join(' '); };
    var waitRow = function (e) { return '<tr data-t="' + dt(e) + '"><td class="em">' + esc(e.email) + (e.test ? ' <span class="nt">(test)</span>' : '') + '</td><td>' + tags(e) + '</td><td class="n">' + when(e.signed) + '</td><td class="n">' + waiting(e.signed) + '</td><td>' + esc(e.source || 'before tracking') + '</td></tr>'; };
    var okRow = function (e) { return '<tr data-t="' + dt(e) + '"><td class="em">' + esc(e.email) + (e.test ? ' <span class="nt">(test)</span>' : '') + '</td><td>' + tags(e) + '</td><td class="n">' + when(e.signed) + '</td><td>Yes</td><td>' + esc(e.source || 'before tracking') + '</td></tr>'; };

    var jobs = (apps || []).filter(function (a) { return !(hideTests && /ted\.takvorian|ted@takgio|tazpinball|info@takgio|ipadheadphones/i.test(a.email || '')); });
    var fs = data.formspree ? data.formspree.filter(keep) : null;
    var msgs = fs ? fs.filter(function (s) { return !s.source || s.source === 'concreteiq-beta'; }) : [];
    var inKit = {}; ppl.forEach(function (e) { inKit[(e.email || '').toLowerCase()] = 1; });
    var lost = fs ? fs.filter(function (s) { return (s.source === 'brickture-waitlist' || s.source === 'newsletter') && !inKit[(s.email || '').toLowerCase()]; }) : [];

    var week = 0; ppl.forEach(function (e) { if (ago(e.signed) <= 7) week++; });
    var out = (data.notes || []).map(function (n) { return '<div class="su-card"><p class="su-note" style="margin:8px 12px">' + esc(n) + '</p></div>'; }).join('');
    (data.kit || []).forEach(function (f) { if (f.error) out += '<div class="su-card"><p class="su-err">' + esc(f.name + ': ' + f.error) + '</p></div>'; });
    out += '<div class="su-sum">' +
      '<div class="su-stat"><b>' + ppl.length + '</b><small>people on a list</small></div>' +
      '<div class="su-stat"><b>' + confirmed.length + '</b><small>confirmed</small></div>' +
      '<div class="su-stat"><b>' + wait.length + '</b><small>waiting to confirm</small></div>' +
      '<div class="su-stat' + (nudge.length ? ' al' : '') + '"><b>' + nudge.length + '</b><small>not confirmed after 2+ days</small></div>' +
      '<div class="su-stat"><b>' + week + '</b><small>new in the last 7 days</small></div></div>';

    out += group('Needs a nudge', 'p-bad', 'Not confirmed after 2+ days', 'They signed up but never clicked the confirmation email. Kit does not resend it. Check spam, or ask them to sign up again.', nudge.map(waitRow), ['Email', 'For what', 'Signed up', 'Waiting', 'From']);
    out += group('Waiting', 'p-wait', 'Waiting to confirm', 'Signed up in the last 2 days. The confirmation email has been sent.', wait.map(waitRow), ['Email', 'For what', 'Signed up', 'Waiting', 'From']);
    out += group('Confirmed', 'p-ok', 'Confirmed', 'Confirmed their email. These are the people a broadcast reaches. Someone on both lists shows once, with both tags. Kit does not report the confirmation date.', confirmed.map(okRow), ['Email', 'For what', 'Signed up', 'Confirmed', 'From']);
    out += group('Jobs', 'p-jobs', 'Job applicants', 'People who applied through the Careers page. Details and status are at <a href="/admin/careers">/admin/careers</a>.', jobs.map(function (a) {
      return '<tr data-t="jobs"><td class="em">' + esc(a.email) + '<div class="nt">' + esc((a.first_name || '') + ' ' + (a.last_name || '')) + '</div></td><td>' + tag('jobs', 'Jobs') + '</td><td class="n">' + when(a.created_at) + '</td><td>' + (a.email_confirmed_at ? 'Yes' : 'No') + '</td><td>' + esc(a.jobs && a.jobs.title ? a.jobs.title : 'General application') + '</td></tr>';
    }), ['Email', 'For what', 'Applied', 'Email confirmed', 'Role']);
    out += group('Messages', 'p-msg', 'Messages and requests', 'Contact page messages and ConcreteIQ beta requests. They are not on a mailing list. They also arrive in info@takgio.com.', msgs.map(function (s) {
      var beta = s.source === 'concreteiq-beta';
      var text = beta ? Object.keys(s).filter(function (k) { return ['email', 'name', 'source', 'joined', 'test', 'came_from'].indexOf(k) < 0 && s[k]; }).map(function (k) { return esc(k) + ': ' + esc(s[k]); }).join('<br>') : esc(s.message || '');
      return '<tr data-t="msg"><td class="em">' + esc(s.email || '—') + '<div class="nt">' + esc(s.name || '') + '</div></td><td>' + tag('msg', beta ? 'ConcreteIQ beta' : 'Contact' + (s.topic ? ' · ' + s.topic : '')) + '</td><td class="n">' + when(s.joined) + '</td><td class="su-msg">' + (text || '—') + '</td></tr>';
    }), ['Email', 'For what', 'Sent', 'Message']);
    if (lost.length) out += group('Check', 'p-bad', 'Signed up but missing from Kit', 'Safety check: in the Formspree backup copy but not in Kit. These people never got a confirmation email.', lost.map(function (s) {
      return '<tr data-t="all"><td class="em">' + esc(s.email || '') + '</td><td>' + esc(s.source === 'newsletter' ? 'Old footer box' : 'Brickture') + '</td><td class="n">' + when(s.joined) + '</td><td>' + esc(s.came_from || '—') + '</td></tr>';
    }), ['Email', 'For what', 'Signed up', 'From']);
    return out;
  }

  var A, hide = true, cache = null, apps = [], filter = 'all', q = '';
  function applyFilter() {
    var root = document.getElementById('su-body'); if (!root) return;
    root.querySelectorAll('tbody tr').forEach(function (r) {
      var okf = filter === 'all' || (' ' + r.getAttribute('data-t') + ' ').indexOf(' ' + filter + ' ') > -1;
      var oks = !q || r.textContent.toLowerCase().indexOf(q) > -1;
      r.hidden = !(okf && oks);
    });
    root.querySelectorAll('[data-g]').forEach(function (g) {
      var n = g.querySelectorAll('tbody tr:not([hidden])').length;
      g.querySelector('.su-cnt').textContent = n + (n === 1 ? ' person' : ' people');
      g.hidden = n === 0;
    });
  }
  function csv() {
    var rows = [['Email', 'For what', 'Signed up', 'Status', 'From']];
    document.querySelectorAll('#su-body [data-g]').forEach(function (g) {
      var st = g.querySelector('h2').textContent;
      g.querySelectorAll('tbody tr:not([hidden])').forEach(function (r) {
        var td = r.children; rows.push([td[0].firstChild.textContent, td[1].textContent, td[2].textContent, st, td[td.length - 1].textContent]);
      });
    });
    var text = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = 'takgio-signups.csv'; document.body.appendChild(a); a.click(); a.remove();
  }
  function draw() {
    var chips = [['all', 'Everyone'], ['brick', 'Brickture Insiders'], ['news', 'Takgio News'], ['jobs', 'Jobs'], ['msg', 'Messages']].map(function (c) {
      return '<button class="su-chip" data-f="' + c[0] + '" aria-pressed="' + (filter === c[0]) + '">' + c[1] + '</button>'; }).join('');
    A.page('signups', '<div class="su"><div class="su-top"><div><h1 class="cra-h1" style="font-size:18px;margin:0">Signups</h1><p>Everyone who has given us an email address, grouped by where they stand. One row per person.</p></div>' +
      '<div class="su-tools"><input type="search" id="su-q" placeholder="Search an email or name" value="' + esc(q) + '" aria-label="Search"><label><input type="checkbox" id="hide-tests"' + (hide ? ' checked' : '') + '> Hide my test addresses</label>' +
      '<button class="su-btn" id="reload">Refresh</button><button class="su-btn" id="su-csv">Download list (CSV)</button></div></div>' +
      '<div class="su-chips">' + chips + '</div><div id="su-body">' + (cache ? render(cache, apps, hide) : '<p class="su-note">Loading…</p>') + '</div>' +
      (cache ? '<p class="su-note">Read only. As of ' + esc(new Date(cache.asOf).toLocaleString()) + '. Kit is the record for Insiders and Takgio News; Formspree holds contact messages and requests.</p>' : '') + '</div>');
    var cb = document.getElementById('hide-tests'); if (cb) cb.addEventListener('change', function () { hide = cb.checked; draw(); });
    var rl = document.getElementById('reload'); if (rl) rl.addEventListener('click', function () { cache = null; load(); });
    var cv = document.getElementById('su-csv'); if (cv) cv.addEventListener('click', csv);
    var qi = document.getElementById('su-q'); if (qi) qi.addEventListener('input', function () { q = qi.value.trim().toLowerCase(); applyFilter(); });
    document.querySelectorAll('.su-chip').forEach(function (c) { c.addEventListener('click', function () {
      filter = c.getAttribute('data-f'); document.querySelectorAll('.su-chip').forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); }); applyFilter(); }); });
    applyFilter();
  }
  function load() {
    draw();
    A.sb.auth.getSession().then(function (s) {
      var tok = s.data.session && s.data.session.access_token;
      return Promise.all([
        fetch('/api/signups', { headers: { Authorization: 'Bearer ' + tok } }).then(function (r) {
          return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('error ' + r.status)); return j; });
        }),
        A.sb.from('job_applications').select('first_name,last_name,email,created_at,email_confirmed_at,jobs(title)').order('created_at', { ascending: false })
          .then(function (x) { return x.error ? [] : (x.data || []); })
      ]);
    }).then(function (r) { cache = r[0]; apps = r[1]; draw(); })
      .catch(function (e) { var b = document.getElementById('su-body'); if (b) b.innerHTML = '<div class="su-card"><p class="su-err">' + esc(e.message) + '</p></div>'; });
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
