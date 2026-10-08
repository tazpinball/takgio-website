// ============================================================
// Careers admin: sign-in with a two-step code, manage jobs, post/edit a job, review applications, team & access.
// Depends on: Supabase JS (CDN), supabase-config.js.
// Who may do what is enforced by the DATABASE (see docs/careers-schema.sql), not by this page: every table needs a
// two-step-verified session and a row in careers_editors. This page only shows or hides buttons to match.
// ============================================================
(function () {
  'use strict';

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  var root = document.getElementById('ad-root');
  var state = { user: null, role: null, name: '', jobs: [], apps: [], selApp: null };

  var TYPE = { internship: 'Internship', full_time: 'Full time', part_time: 'Part time', contract: 'Contract' };
  var STATUS = { new: 'New', reviewing: 'Reviewing', interview: 'Interview', not_a_fit: 'Not a fit', hired: 'Hired' };
  var STATUS_CLASS = { new: 'new', reviewing: 'rev', interview: 'rev', not_a_fit: 'draft', hired: 'ok' };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(d) {
    if (!d) return '—';
    var s = String(d), p = s.slice(0, 10).split('-');
    return MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
  }
  function toast(msg, isErr) {
    var t = document.createElement('div'); t.className = 'ad-toast' + (isErr ? ' err' : ''); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, isErr ? 6000 : 2800);
  }
  function slugify(s) {
    return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
  }
  var isAdmin = function () { return state.role === 'admin'; };

  // ------------------------------------------------------------ sign-in screens
  function shell(inner) {
    root.innerHTML = '<div class="ad-login"><div style="width:100%;display:grid;gap:22px;justify-items:center">' +
      '<div style="text-align:center"><div class="ad-brand" style="color:#11142a;font-size:1.6rem">takgio</div><div style="color:var(--color-text-secondary);font-weight:600">Careers admin</div></div>' +
      '<div class="ad-lcard" style="max-width:420px;width:100%">' + inner + '</div></div></div>';
  }
  function showLogin(msg) {
    shell('<div class="tag">Step 1 of 2</div><h2>Sign in</h2><p style="margin:0 0 14px;font-size:.9rem">Access is by invitation only.</p>' +
      '<form id="f-login"><div class="ad-f"><label for="e">Email</label><input type="email" id="e" autocomplete="email" required placeholder="you@takgio.com"></div>' +
      '<div class="ad-f"><label for="p">Password</label><input type="password" id="p" autocomplete="current-password" required></div>' +
      '<button class="ad-btn pri" style="width:100%" type="submit">Continue</button><p class="ad-err" id="err">' + esc(msg || '') + '</p></form>' +
      '<p class="ad-hint" style="margin-top:10px"><a href="#" id="forgot">Forgot your password?</a></p>');
    document.getElementById('f-login').addEventListener('submit', function (e) {
      e.preventDefault();
      var err = document.getElementById('err'); err.textContent = '';
      sb.auth.signInWithPassword({ email: document.getElementById('e').value.trim(), password: document.getElementById('p').value }).then(function (r) {
        if (r.error) { err.textContent = r.error.message; return; }
        afterAuth();
      });
    });
    document.getElementById('forgot').addEventListener('click', function (ev) {
      ev.preventDefault();
      var email = document.getElementById('e').value.trim(), err = document.getElementById('err');
      if (!email) { err.textContent = 'Type your email above first.'; return; }
      // No redirectTo: the project's Site URL is /login.html, the only allowed redirect, and that page already handles reset links
      sb.auth.resetPasswordForEmail(email).then(function (r) {
        err.textContent = r.error ? r.error.message : 'If that address has access, a reset link is on its way.';
      });
    });
  }
  function showCode(factorId) {
    shell('<div class="tag">Step 2 of 2</div><h2>Enter your code</h2><p style="margin:0 0 10px;font-size:.9rem">Open your authenticator app and enter the 6-digit code for takgio.</p>' +
      '<form id="f-code"><div class="ad-f"><input class="ad-code-in" id="c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required></div>' +
      '<button class="ad-btn pri" style="width:100%" type="submit">Verify and sign in</button><p class="ad-err" id="err"></p></form>' +
      '<p class="ad-hint"><a href="#" id="out">Use a different account</a></p>');
    document.getElementById('f-code').addEventListener('submit', function (e) {
      e.preventDefault();
      sb.auth.mfa.challengeAndVerify({ factorId: factorId, code: document.getElementById('c').value.trim() }).then(function (r) {
        if (r.error) { document.getElementById('err').textContent = r.error.message; return; }
        afterAuth();
      });
    });
    document.getElementById('out').addEventListener('click', function (ev) { ev.preventDefault(); signOut(); });
  }
  function showEnroll() {
    shell('<div class="tag">First sign-in</div><h2>Link your authenticator app</h2><p style="margin:0 0 6px;font-size:.9rem">Scan this code with an authenticator app (Google Authenticator, 1Password, Authy), then enter the 6-digit code it shows.</p><div id="enroll">Preparing…</div>');
    sb.auth.mfa.listFactors().then(function (lf) {
      var stale = ((lf.data && lf.data.all) || []).filter(function (f) { return f.factor_type === 'totp' && f.status === 'unverified'; });
      return Promise.all(stale.map(function (f) { return sb.auth.mfa.unenroll({ factorId: f.id }); }));
    }).then(function () {
      return sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'takgio careers ' + new Date().toISOString().slice(0, 10) });
    }).then(function (r) {
      if (r.error) { document.getElementById('enroll').innerHTML = '<p class="ad-err">' + esc(r.error.message) + '</p>'; return; }
      var d = r.data;
      document.getElementById('enroll').innerHTML = '<img class="ad-qr" alt="QR code for your authenticator app" src="' + esc(d.totp.qr_code) + '">' +
        '<p class="ad-hint">Can’t scan? Enter this key instead:</p><div class="ad-secret">' + esc(d.totp.secret) + '</div>' +
        '<form id="f-enroll" style="margin-top:14px"><div class="ad-f"><input class="ad-code-in" id="c" inputmode="numeric" maxlength="6" placeholder="000000" required></div>' +
        '<button class="ad-btn pri" style="width:100%" type="submit">Link app and sign in</button><p class="ad-err" id="err"></p></form>';
      document.getElementById('f-enroll').addEventListener('submit', function (e) {
        e.preventDefault();
        sb.auth.mfa.challengeAndVerify({ factorId: d.id, code: document.getElementById('c').value.trim() }).then(function (v) {
          if (v.error) { document.getElementById('err').textContent = v.error.message; return; }
          afterAuth();
        });
      });
    });
  }
  function showNoAccess() {
    shell('<h2>No careers access yet</h2><p style="margin:0 0 14px">You’re signed in, but this account hasn’t been given access to careers. Ask an admin to add you.</p><button class="ad-btn" id="out">Sign out</button>');
    document.getElementById('out').addEventListener('click', signOut);
  }
  function signOut() { sb.auth.signOut().then(function () { state = { user: null, role: null, name: '', jobs: [], apps: [], selApp: null }; showLogin(); }); }

  function afterAuth() {
    sb.auth.mfa.getAuthenticatorAssuranceLevel().then(function (a) {
      if (a.error) return showLogin(a.error.message);
      if (a.data.currentLevel !== 'aal2') {
        return sb.auth.mfa.listFactors().then(function (f) {
          var ok = ((f.data && f.data.totp) || []).filter(function (x) { return x.status === 'verified'; });
          if (ok.length) showCode(ok[0].id); else showEnroll();
        });
      }
      return sb.auth.getUser().then(function (u) {
        state.user = u.data.user;
        return sb.from('careers_editors').select('role,display_name').eq('user_id', state.user.id).maybeSingle();
      }).then(function (r) {
        if (!r.data) return showNoAccess();
        state.role = r.data.role; state.name = r.data.display_name || state.user.email;
        route();
      });
    });
  }

  // ------------------------------------------------------------ app shell + routing
  function topbar(active) {
    var a = function (k, label, extra) { return '<a href="#' + k + '" class="' + (k === active ? 'on' : '') + '">' + label + (extra || '') + '</a>'; };
    return '<div class="ad-top"><div class="in"><div class="ad-brand">takgio<small>Careers admin</small></div><nav class="ad-nav">' +
      a('jobs', 'Jobs') + a('apps', 'Applications') + (isAdmin() ? a('team', 'Team &amp; access', '<span class="pill">Admin</span>') : '') + '</nav>' +
      '<div class="ad-user"><span>Signed in as <b>' + esc(state.name) + '</b> &middot; ' + (isAdmin() ? 'Admin' : 'Editor') + '</span><a href="#" id="signout">Sign out</a></div></div></div>';
  }
  function page(active, html) {
    root.innerHTML = topbar(active) + '<div class="ad-wrap">' + html + '</div>';
    document.getElementById('signout').addEventListener('click', function (e) { e.preventDefault(); signOut(); });
  }
  function route() {
    if (!state.role) return;
    var h = (location.hash || '#jobs').slice(1).split('/');
    var view = h[0] || 'jobs';
    if (view === 'edit') return viewEdit(h[1] || null);
    if (view === 'apps') return viewApps(h[1] || null);
    if (view === 'team' && isAdmin()) return viewTeam();
    return viewJobs();
  }
  window.addEventListener('hashchange', route);

  // ------------------------------------------------------------ jobs list
  function viewJobs() {
    page('jobs', '<p class="ad-empty">Loading…</p>');
    Promise.all([sb.from('jobs').select('*').order('updated_at', { ascending: false }), sb.from('job_applications').select('id,job_id,status')]).then(function (r) {
      if (r[0].error) { page('jobs', '<p class="ad-err">' + esc(r[0].error.message) + '</p>'); return; }
      var jobs = r[0].data || [], apps = (r[1].data || []);
      var by = {}; apps.forEach(function (a) { var k = a.job_id || 'general'; by[k] = by[k] || { n: 0, fresh: 0 }; by[k].n++; if (a.status === 'new') by[k].fresh++; });
      var count = function (s) { return jobs.filter(function (j) { return j.status === s; }).length; };
      var newTotal = apps.filter(function (a) { return a.status === 'new'; }).length;
      var rows = jobs.map(function (j) {
        var c = by[j.id] || { n: 0, fresh: 0 };
        var pub = j.status === 'published', draft = j.status === 'draft';
        return '<tr><td><b>' + esc(j.title) + '</b><br><small style="color:var(--color-text-secondary)">' + esc(j.team || '') + (j.openings ? ' &middot; ' + j.openings + ' opening' + (j.openings > 1 ? 's' : '') : '') + '</small></td>' +
          '<td><span class="st ' + (pub ? 'pub' : 'draft') + '">' + (pub ? 'Published' : draft ? 'Draft' : 'Closed') + '</span></td>' +
          '<td>' + esc(TYPE[j.employment_type] || '') + ' &middot; ' + (j.location_type === 'remote' ? 'Remote (' + esc(j.applicant_country) + ')' : esc(j.location_type)) + '</td>' +
          '<td>' + fmt(j.published_at) + '</td><td>' + fmt(j.apply_close) + '</td>' +
          '<td><b>' + c.n + '</b> ' + (c.fresh ? '<span class="st new">' + c.fresh + ' new</span>' : '') + '</td>' +
          '<td class="ad-act"><a href="#edit/' + j.id + '">Edit</a><a href="#apps/' + j.id + '">Applications</a>' +
          (pub ? '<a href="/careers/' + encodeURIComponent(j.slug) + '" target="_blank" rel="noopener">View live page</a><a href="#" data-act="unpublish" data-id="' + j.id + '" style="color:#b45309">Unpublish</a>' : '') +
          (!pub ? '<a href="#" data-act="publish" data-id="' + j.id + '" style="color:#166534">Publish</a>' : '') +
          (isAdmin() ? '<a href="#" data-act="delete" data-id="' + j.id + '" style="color:#b91c1c">Delete</a>' : '') + '</td></tr>';
      }).join('');
      page('jobs', '<div class="ad-bar"><h1 class="ad-h1">Jobs</h1><a class="ad-btn pri" href="#edit">+ Post a job</a></div>' +
        '<div class="ad-stats"><div class="ad-stat"><b>' + count('published') + '</b><span>Published</span></div><div class="ad-stat"><b>' + count('draft') + '</b><span>Drafts</span></div>' +
        '<div class="ad-stat"><b>' + count('closed') + '</b><span>Closed</span></div><div class="ad-stat"><b>' + newTotal + '</b><span>New applications</span></div></div>' +
        '<div class="ad-card ad-scroll">' + (jobs.length ? '<table class="ad-table"><tr><th>Job</th><th>Status</th><th>Type &middot; Location</th><th>Posted</th><th>Closes</th><th>Applicants</th><th>Actions</th></tr>' + rows + '</table>' :
          '<p class="ad-empty">No jobs yet. Press “+ Post a job” to add the first one.</p>') + '</div>');
      document.querySelector('.ad-wrap').addEventListener('click', function (e) {
        var a = e.target.closest('[data-act]'); if (!a) return; e.preventDefault();
        var id = a.getAttribute('data-id'), act = a.getAttribute('data-act');
        if (act === 'delete') { if (!confirm('Delete this job for good? Its applications stay but lose the link to the job.')) return; sb.from('jobs').delete().eq('id', id).then(done); }
        if (act === 'publish') setStatus(id, 'published');
        if (act === 'unpublish') { if (confirm('Take this job down? The public page closes right away.')) setStatus(id, 'draft'); }
        function done(r) { if (r.error) toast(r.error.message, true); else { toast('Done'); viewJobs(); } }
      });
    });
  }
  function setStatus(id, status) {
    var patch = { status: status };
    if (status === 'published') patch.published_at = new Date().toISOString();
    sb.from('jobs').update(patch).eq('id', id).then(function (r) { if (r.error) toast(r.error.message, true); else { toast(status === 'published' ? 'Published' : 'Updated'); route(); } });
  }

  // ------------------------------------------------------------ post / edit
  var BLANK = { title: '', slug: '', team: 'AI & Engineering', employment_type: 'internship', schedule: 'part_time', openings: '', start_date: '', end_date: '', location_type: 'remote',
    applicant_country: 'US', city: '', state: '', pay_min: '', pay_max: '', pay_unit: 'hour', show_pay: true, about: '', duties: '', qualifications: '', skills: [],
    apply_open: '', apply_close: '', extra_question: '', notify_email: '', status: 'draft' };
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }

  function viewEdit(id) {
    page('jobs', '<p class="ad-empty">Loading…</p>');
    var load = id ? sb.from('jobs').select('*').eq('id', id).maybeSingle() : Promise.resolve({ data: Object.assign({}, BLANK) });
    load.then(function (r) {
      if (r.error || !r.data) { page('jobs', '<p class="ad-err">' + esc((r.error && r.error.message) || 'That job was not found.') + '</p>'); return; }
      var j = r.data, pub = j.status === 'published';
      var v = function (k) { return esc(j[k] == null ? '' : j[k]); };
      var team = ['AI & Engineering', 'Product', 'Marketing', 'Operations'];
      page('jobs',
        '<div class="ad-bar"><div><div style="font-size:.9rem"><a href="#jobs" style="font-weight:700;text-decoration:none">&larr; Jobs</a></div><h1 class="ad-h1">' + (id ? 'Edit job' : 'Post a job') + ' <span class="st ' + (pub ? 'pub' : 'draft') + '">' + (pub ? 'Published' : j.status === 'closed' ? 'Closed' : 'Draft') + '</span></h1></div>' +
        '<div class="ad-pub">' + (pub ? '<a class="ad-btn" href="/careers/' + encodeURIComponent(j.slug) + '" target="_blank" rel="noopener">View live page</a>' : '') +
        '<button class="ad-btn" id="b-save">' + (pub ? 'Save changes' : 'Save draft') + '</button>' + (!pub ? '<button class="ad-btn pri" id="b-pub">Publish</button>' : '') + '</div></div>' +
        '<div class="ad-grid"><div>' +
        '<div class="ad-card"><h2>The basics</h2><div class="ad-f"><label>Job title *</label><input type="text" id="f-title" value="' + v('title') + '"></div>' +
        '<div class="ad-f"><label>Web address ending</label><input type="text" id="f-slug" value="' + v('slug') + '"><p class="hint">takgio.com/careers/<span id="slug-show">' + v('slug') + '</span></p></div>' +
        '<div class="ad-r3"><div class="ad-f"><label>Team *</label><select id="f-team">' + team.map(function (t) { return opt(t, t, j.team); }).join('') + '</select></div>' +
        '<div class="ad-f"><label>Type *</label><select id="f-type">' + Object.keys(TYPE).map(function (k) { return opt(k, TYPE[k], j.employment_type); }).join('') + '</select></div>' +
        '<div class="ad-f"><label>Schedule</label><select id="f-sched">' + opt('part_time', 'Part time', j.schedule) + opt('full_time', 'Full time', j.schedule) + '</select></div></div>' +
        '<div class="ad-r3"><div class="ad-f"><label>Number of openings</label><input type="number" min="1" id="f-open" value="' + v('openings') + '"></div>' +
        '<div class="ad-f"><label>Start date</label><input type="date" id="f-start" value="' + v('start_date') + '"></div>' +
        '<div class="ad-f"><label>End date (temporary roles)</label><input type="date" id="f-end" value="' + v('end_date') + '"></div></div></div>' +
        '<div class="ad-card"><h2>Where it’s done</h2><div class="ad-r2"><div class="ad-f"><label>Location type *</label><select id="f-loc">' +
        opt('remote', 'Remote', j.location_type) + opt('onsite', 'On-site', j.location_type) + opt('hybrid', 'Hybrid', j.location_type) + '</select></div>' +
        '<div class="ad-f"><label>Candidates must be based in *</label><select id="f-country">' + opt('US', 'United States', j.applicant_country) + '</select><p class="hint">Remote jobs must say who can apply, so Google shows them to the right people.</p></div></div>' +
        '<div class="ad-r2" id="f-where"><div class="ad-f"><label>City (on-site or hybrid)</label><input type="text" id="f-city" value="' + v('city') + '"></div><div class="ad-f"><label>State</label><input type="text" id="f-state" value="' + v('state') + '"></div></div></div>' +
        '<div class="ad-card"><h2>Pay</h2><div class="ad-r3"><div class="ad-f"><label>From</label><input type="number" step="0.01" min="0" id="f-pmin" placeholder="$" value="' + v('pay_min') + '"></div>' +
        '<div class="ad-f"><label>To</label><input type="number" step="0.01" min="0" id="f-pmax" placeholder="$" value="' + v('pay_max') + '"></div>' +
        '<div class="ad-f"><label>Per</label><select id="f-punit">' + opt('hour', 'Hour', j.pay_unit) + opt('year', 'Year', j.pay_unit) + '</select></div></div>' +
        '<div class="ad-f"><label><input type="checkbox" id="f-showpay"' + (j.show_pay ? ' checked' : '') + '> Show pay on the posting</label><p class="hint">Internships at takgio are paid. The checklist warns before you publish an internship without pay.</p></div></div>' +
        '<div class="ad-card"><h2>Description</h2><p class="ad-hint">Plain text. Leave a blank line between paragraphs, and start a line with “- ” for a bullet.</p>' +
        '<div class="ad-f"><label>About this opportunity *</label><textarea id="f-about">' + v('about') + '</textarea></div>' +
        '<div class="ad-f"><label>What you’ll do *</label><textarea id="f-duties">' + v('duties') + '</textarea></div>' +
        '<div class="ad-f"><label>Who should apply *</label><textarea id="f-qual">' + v('qualifications') + '</textarea></div>' +
        '<div class="ad-f"><label>Skills (separate with commas)</label><input type="text" id="f-skills" value="' + esc((j.skills || []).join(', ')) + '"></div></div>' +
        '<div class="ad-card"><h2>Applying</h2><div class="ad-r2"><div class="ad-f"><label>Applications open</label><input type="date" id="f-aopen" value="' + v('apply_open') + '"></div>' +
        '<div class="ad-f"><label>Applications close</label><input type="date" id="f-aclose" value="' + v('apply_close') + '"></div></div>' +
        '<div class="ad-f"><label>Extra question for this job (optional)</label><input type="text" id="f-extra" placeholder="Tell us about something you built or learned with AI" value="' + v('extra_question') + '"></div>' +
        '<div class="ad-f"><label>Send new applications to</label><input type="email" id="f-notify" value="' + v('notify_email') + '"></div></div>' +
        '</div><div><div class="ad-card"><h2>Before you publish</h2><ul class="ad-check" id="checks"></ul></div>' +
        '<div class="ad-card"><h2>What publishing does</h2><p style="margin:0 0 8px;font-size:.9rem">Creates the job page on takgio.com, adds it to the Careers list, and adds the markup Google Jobs reads, so it can appear in Google search.</p><p style="margin:0;font-size:.9rem">When the closing date passes, the job drops off the Careers page by itself.</p></div>' +
        '<div class="ad-card"><h2>Who can do what</h2><p style="margin:0;font-size:.9rem"><b>Editors</b> create, edit and publish jobs and review applicants. <b>Admins</b> can also delete and manage access. Every change is logged with who and when.</p></div></div></div>');

      function read() {
        var g = function (i) { return document.getElementById(i).value.trim(); }, num = function (i) { var x = g(i); return x === '' ? null : Number(x); };
        return { title: g('f-title'), slug: g('f-slug') || slugify(g('f-title')), team: g('f-team'), employment_type: g('f-type'), schedule: g('f-sched') || null,
          openings: num('f-open'), start_date: g('f-start') || null, end_date: g('f-end') || null, location_type: g('f-loc'), applicant_country: g('f-country'),
          city: g('f-city') || null, state: g('f-state') || null, pay_min: num('f-pmin'), pay_max: num('f-pmax'), pay_unit: g('f-punit'),
          show_pay: document.getElementById('f-showpay').checked, about: g('f-about') || null, duties: g('f-duties') || null, qualifications: g('f-qual') || null,
          skills: g('f-skills').split(',').map(function (s) { return s.trim(); }).filter(Boolean), apply_open: g('f-aopen') || null, apply_close: g('f-aclose') || null,
          extra_question: g('f-extra') || null, notify_email: g('f-notify') || null };
      }
      function checks(d) {
        var today = new Date().toISOString().slice(0, 10), out = [];
        out.push([!!d.title, 'Title is set']);
        out.push([!!d.about, 'The “About this opportunity” section is filled in', true]);
        out.push([!!d.duties, '“What you’ll do” is filled in']);
        out.push([!!d.qualifications, '“Who should apply” is filled in']);
        var hasPay = d.pay_min != null || d.pay_max != null;
        out.push([d.employment_type !== 'internship' || (hasPay && d.show_pay), d.employment_type === 'internship' ? 'Pay is filled in and shown (internships should show pay)' : 'Pay is optional for this type']);
        out.push([d.location_type !== 'remote' || !!d.applicant_country, 'Remote jobs say who can apply']);
        out.push([!d.apply_close || d.apply_close >= today, 'Closing date is in the future']);
        out.push([!!d.notify_email, 'Someone is set to receive new applications']);
        return out;
      }
      function paint() {
        var d = read();
        document.getElementById('checks').innerHTML = checks(d).map(function (c) { return '<li><span class="' + (c[0] ? 'ok' : 'warn') + '">' + (c[0] ? '✓' : '!') + '</span>' + esc(c[1]) + '</li>'; }).join('');
        document.getElementById('slug-show').textContent = d.slug;
        document.getElementById('f-where').style.display = d.location_type === 'remote' ? 'none' : '';
      }
      var slugTouched = !!id;
      document.getElementById('f-slug').addEventListener('input', function () { slugTouched = true; });
      document.getElementById('f-title').addEventListener('input', function () { if (!slugTouched) document.getElementById('f-slug').value = slugify(this.value); });
      document.querySelector('.ad-wrap').addEventListener('input', paint); document.querySelector('.ad-wrap').addEventListener('change', paint); paint();

      function save(publish) {
        var d = read();
        if (!d.title) { toast('Add a job title first', true); return; }
        if (publish) {
          var blockers = checks(d).filter(function (c) { return !c[0] && c[2]; });
          if (blockers.length) { toast(blockers[0][1].replace('is filled in', 'needs filling in'), true); return; }
          var warns = checks(d).filter(function (c) { return !c[0] && !c[2]; });
          if (warns.length && !confirm('Publish anyway?\n\n• ' + warns.map(function (w) { return w[1]; }).join('\n• '))) return;
          d.status = 'published'; d.published_at = j.published_at || new Date().toISOString();
        }
        var req = id ? sb.from('jobs').update(d).eq('id', id).select().single() : sb.from('jobs').insert(d).select().single();
        req.then(function (r) {
          if (r.error) { toast(r.error.code === '23505' ? 'That web address is already used by another job. Change the ending.' : r.error.message, true); return; }
          toast(publish ? 'Published' : 'Saved');
          if (!id) location.hash = '#edit/' + r.data.id; else if (publish) viewEdit(id);
        });
      }
      document.getElementById('b-save').addEventListener('click', function () { save(false); });
      var bp = document.getElementById('b-pub'); if (bp) bp.addEventListener('click', function () { save(true); });
    });
  }

  // ------------------------------------------------------------ applications
  function viewApps(jobId) {
    page('apps', '<p class="ad-empty">Loading…</p>');
    var q = sb.from('job_applications').select('*, jobs(title)').order('created_at', { ascending: false });
    if (jobId && jobId !== 'all') q = q.eq('job_id', jobId);
    Promise.all([q, sb.from('jobs').select('id,title').order('title')]).then(function (r) {
      if (r[0].error) { page('apps', '<p class="ad-err">' + esc(r[0].error.message) + '</p>'); return; }
      var apps = r[0].data || [], jobs = r[1].data || [];
      state.apps = apps;
      var sel = apps.filter(function (a) { return a.id === state.selApp; })[0] || apps[0] || null;
      if (sel) state.selApp = sel.id;
      var rows = apps.map(function (a) {
        return '<tr data-app="' + a.id + '"' + (sel && sel.id === a.id ? ' class="ad-row-sel"' : '') + '><td><b>' + esc(a.first_name + ' ' + a.last_name) + '</b><br><small style="color:var(--color-text-secondary)">' + esc(a.email) + '</small></td>' +
          '<td>' + esc(a.state || '') + '</td><td>' + fmt(a.created_at) + '</td><td><span class="st ' + (a.email_confirmed_at ? 'ok' : 'wait') + '">' + (a.email_confirmed_at ? 'Confirmed' : 'Not confirmed') + '</span></td>' +
          '<td>' + (a.work_authorized == null ? '' : a.work_authorized ? 'Yes' : 'No') + '</td><td><span class="st ' + STATUS_CLASS[a.status] + '">' + STATUS[a.status] + '</span></td></tr>';
      }).join('');
      var detail = sel ? '<div class="ad-card"><h2>' + esc(sel.first_name + ' ' + sel.last_name) + '</h2><div class="ad-detail">' +
        '<p><b>Email</b> ' + esc(sel.email) + (sel.email_confirmed_at ? ' (confirmed)' : ' (not confirmed)') + ' &middot; <b>State</b> ' + esc(sel.state || '') + (sel.phone ? ' &middot; <b>Phone</b> ' + esc(sel.phone) : '') + '</p>' +
        '<p><b>Job</b> ' + esc((sel.jobs && sel.jobs.title) || 'General application') + '</p>' +
        '<p><b>Links</b> ' + (/^https?:\/\//i.test(sel.link_url || '') ? '<a href="' + esc(sel.link_url) + '" target="_blank" rel="noopener noreferrer">' + esc(sel.link_url) + '</a>' : esc(sel.link_url || '')) + ' &middot; <b>Resume</b> ' + (sel.resume_path ? '<a href="#" id="a-resume">Open (link expires in 10 minutes)</a>' : 'none') + '</p>' +
        '<p><b>Authorized to work in the US?</b> ' + (sel.work_authorized == null ? '' : sel.work_authorized ? 'Yes' : 'No') + '</p>' +
        (sel.exams ? '<p><b>Claude exams</b> ' + esc(sel.exams) + '</p>' : '') +
        '<p style="margin:0"><b>Something they built or learned with AI</b><br>' + esc(sel.answer || '') + '</p></div>' +
        '<div class="ad-f" style="margin-top:14px"><label>Status</label><select id="a-status">' + Object.keys(STATUS).map(function (k) { return opt(k, STATUS[k], sel.status); }).join('') + '</select></div>' +
        '<div class="ad-f"><label>Internal notes (applicants never see these)</label><textarea id="a-notes" placeholder="Notes for the team">' + esc(sel.notes || '') + '</textarea></div>' +
        '<div class="ad-pub"><button class="ad-btn pri" id="a-save">Save</button><a class="ad-btn" href="mailto:' + esc(sel.email) + '">Email applicant</a>' + (isAdmin() ? '<button class="ad-btn dng" id="a-del">Delete</button>' : '') + '</div></div>'
        : '<div class="ad-card"><p class="ad-empty">No applications yet.</p></div>';
      page('apps', '<div class="ad-bar"><h1 class="ad-h1">Applications</h1><div class="ad-pub"><select class="ad-btn" id="a-job"><option value="all">All jobs</option>' +
        jobs.map(function (x) { return opt(x.id, x.title, jobId); }).join('') + '</select>' + (isAdmin() ? '<button class="ad-btn" id="a-csv">Download CSV</button>' : '') + '</div></div>' +
        '<div class="ad-grid"><div class="ad-card ad-scroll">' + (apps.length ? '<table class="ad-table"><tr><th>Applicant</th><th>State</th><th>Applied</th><th>Email</th><th>Work auth.</th><th>Status</th></tr>' + rows + '</table>' +
          '<p class="ad-hint" style="margin:10px 12px 0">Applicants who haven’t confirmed their email stay marked until they do. Unconfirmed applications are the first ones to ignore.</p>' : '<p class="ad-empty">No applications yet.</p>') + '</div><div>' + detail + '</div></div>');
      document.getElementById('a-job').addEventListener('change', function () { location.hash = '#apps/' + this.value; });
      document.querySelectorAll('tr[data-app]').forEach(function (tr) { tr.addEventListener('click', function () { state.selApp = tr.getAttribute('data-app'); viewApps(jobId); }); });
      if (!sel) return;
      document.getElementById('a-save').addEventListener('click', function () {
        sb.from('job_applications').update({ status: document.getElementById('a-status').value, notes: document.getElementById('a-notes').value }).eq('id', sel.id).then(function (x) {
          if (x.error) toast(x.error.message, true); else { toast('Saved'); viewApps(jobId); }
        });
      });
      var rs = document.getElementById('a-resume');
      if (rs) rs.addEventListener('click', function (e) {
        e.preventDefault();
        sb.storage.from('resumes').createSignedUrl(sel.resume_path, 600).then(function (x) { if (x.error) toast(x.error.message, true); else window.open(x.data.signedUrl, '_blank', 'noopener'); });
      });
      var del = document.getElementById('a-del');
      if (del) del.addEventListener('click', function () {
        if (!confirm('Delete this applicant for good?')) return;
        sb.from('job_applications').delete().eq('id', sel.id).then(function (x) { if (x.error) toast(x.error.message, true); else { toast('Deleted'); state.selApp = null; viewApps(jobId); } });
      });
      var csv = document.getElementById('a-csv');
      if (csv) csv.addEventListener('click', function () {
        var cols = ['created_at', 'first_name', 'last_name', 'email', 'phone', 'state', 'link_url', 'work_authorized', 'exams', 'status', 'email_confirmed_at', 'answer'];
        var cell = function (v) { v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
        var text = cols.join(',') + '\n' + apps.map(function (a) { return cols.map(function (c) { return cell(a[c]); }).join(','); }).join('\n');
        var link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); link.download = 'takgio-applications.csv'; link.click();
      });
    });
  }

  // ------------------------------------------------------------ team & access (admins only)
  function viewTeam() {
    page('team', '<p class="ad-empty">Loading…</p>');
    Promise.all([sb.from('careers_editors').select('*').order('created_at'), sb.from('audit_log').select('*').order('at', { ascending: false }).limit(50)]).then(function (r) {
      var people = r[0].data || [], log = r[1].data || [];
      var rows = people.map(function (p) {
        var me = p.user_id === state.user.id;
        return '<tr><td><b>' + esc(p.display_name || 'Unnamed') + '</b>' + (me ? ' <small>(you)</small>' : '') + '</td><td><span class="st ' + (p.role === 'admin' ? 'pub' : 'new') + '">' + (p.role === 'admin' ? 'Admin' : 'Editor') + '</span></td>' +
          '<td>' + fmt(p.created_at) + '</td><td class="ad-act">' + (me ? '' : '<a href="#" data-role="' + (p.role === 'admin' ? 'editor' : 'admin') + '" data-uid="' + p.user_id + '">Make ' + (p.role === 'admin' ? 'Editor' : 'Admin') + '</a><a href="#" data-remove="' + p.user_id + '" style="color:#b91c1c">Remove</a>') + '</td></tr>';
      }).join('');
      var items = log.map(function (l) {
        var verb = { insert: 'created', update: 'changed', delete: 'deleted' }[l.action] || l.action;
        return '<li>' + esc((l.actor_email || 'Someone') + ' ' + verb + ' ' + (l.entity === 'jobs' ? 'a job' : l.entity === 'job_applications' ? 'an application' : l.entity) + (l.detail && l.detail.title ? ' “' + l.detail.title + '”' : '') + (l.detail && l.detail.status ? ' (' + l.detail.status + ')' : '')) +
          '<small>' + esc(new Date(l.at).toLocaleString()) + '</small></li>';
      }).join('');
      page('team', '<div class="ad-bar"><h1 class="ad-h1">Team &amp; access</h1></div><div class="ad-grid"><div class="ad-card ad-scroll"><h2>People with careers access</h2>' +
        '<table class="ad-table"><tr><th>Name</th><th>Role</th><th>Added</th><th></th></tr>' + (rows || '<tr><td colspan="4" class="ad-empty">Nobody yet.</td></tr>') + '</table>' +
        '<p class="ad-hint" style="margin:10px 12px 0">To add someone: invite their email in Supabase (Authentication → Users), then ask an admin to give them a role here. Adding people from this page comes later.</p></div>' +
        '<div class="ad-card"><h2>What each role can do</h2><ul class="ad-check"><li><span class="ok">✓</span><span><b>Editor:</b> create, edit, publish and unpublish jobs; review applicants and change their status</span></li>' +
        '<li><span class="ok">✓</span><span><b>Admin:</b> everything an Editor can, plus delete jobs and applicants, download the full list, and manage who has access</span></li></ul></div></div>' +
        '<div class="ad-card"><h2>Activity</h2><ul class="ad-log">' + (items || '<li>Nothing recorded yet.</li>') + '</ul><p class="ad-hint" style="margin:10px 0 0">Every publish, edit and delete is recorded with who and when. Nobody can erase an entry.</p></div>');
      document.querySelector('.ad-wrap').addEventListener('click', function (e) {
        var a = e.target.closest('[data-role],[data-remove]'); if (!a) return; e.preventDefault();
        var req = a.hasAttribute('data-remove') ? (confirm('Remove this person’s careers access?') ? sb.from('careers_editors').delete().eq('user_id', a.getAttribute('data-remove')) : null)
          : sb.from('careers_editors').update({ role: a.getAttribute('data-role') }).eq('user_id', a.getAttribute('data-uid'));
        if (req) req.then(function (x) { if (x.error) toast(x.error.message, true); else { toast('Done'); viewTeam(); } });
      });
    });
  }

  // ------------------------------------------------------------ start
  sb.auth.onAuthStateChange(function (event) { if (event === 'PASSWORD_RECOVERY') { shell('<h2>Set a new password</h2><form id="f-new"><div class="ad-f"><input type="password" id="np" minlength="8" required placeholder="New password (8+ characters)"></div><button class="ad-btn pri" style="width:100%" type="submit">Update password</button><p class="ad-err" id="err"></p></form>'); document.getElementById('f-new').addEventListener('submit', function (e) { e.preventDefault(); sb.auth.updateUser({ password: document.getElementById('np').value }).then(function (r) { if (r.error) document.getElementById('err').textContent = r.error.message; else afterAuth(); }); }); } });
  sb.auth.getSession().then(function (s) { if (!s.data.session) showLogin(); else afterAuth(); });

  window.__adminTest = { slugify: slugify, esc: esc, fmt: fmt };
})();
