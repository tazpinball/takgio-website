// ============================================================
// Takgio admin: Careers (/admin/careers: jobs, posting and editing a job, applications).
// Runs on the shared admin core (js/admin-core.js): sign-in, two-step code, access check and the page frame live there.
// Who may do what is enforced by the DATABASE (docs/careers-schema.sql), not by this page.
// Depends on: Supabase JS (CDN), supabase-config.js, admin-core.js.
// ============================================================
(function () {
  'use strict';

  // bound to the shared core when it first routes (js/admin-core.js)
  var A, sb, state, esc = TakgioAdmin.esc, fmt = TakgioAdmin.fmt, MONTHS = TakgioAdmin.MONTHS, toast, isAdmin, page, route;
  function bind(a) { A = a; sb = a.sb; state = a.state; toast = a.toast; isAdmin = a.isAdmin; page = a.page; route = a.route; }

  var TYPE = { internship: 'Internship', full_time: 'Full time', part_time: 'Part time', contract: 'Contract' };
  var STATUS = { new: 'New', reviewing: 'Reviewing', interview: 'Interview', not_a_fit: 'Not a fit', hired: 'Hired' };
  var STATUS_CLASS = { new: 'new', reviewing: 'rev', interview: 'rev', not_a_fit: 'draft', hired: 'ok' };
  function slugify(s) {
    return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
  }

  // ------------------------------------------------------------ jobs list
  function viewJobs() {
    page('jobs', '<p class="cra-empty">Loading…</p>');
    Promise.all([sb.from('jobs').select('*').order('updated_at', { ascending: false }), sb.from('job_applications').select('id,job_id,status')]).then(function (r) {
      if (r[0].error) { page('jobs', '<p class="cra-err">' + esc(r[0].error.message) + '</p>'); return; }
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
          '<td class="cra-act"><a href="#edit/' + j.id + '">Edit</a><a href="#apps/' + j.id + '">Applications</a>' +
          (pub ? '<a href="/careers/' + encodeURIComponent(j.slug) + '" target="_blank" rel="noopener">View live page</a><a href="#" data-act="unpublish" data-id="' + j.id + '" style="color:#b45309">Unpublish</a>' : '') +
          (!pub ? '<a href="#" data-act="publish" data-id="' + j.id + '" style="color:#166534">Publish</a>' : '') +
          (isAdmin() ? '<a href="#" data-act="delete" data-id="' + j.id + '" style="color:#b91c1c">Delete</a>' : '') + '</td></tr>';
      }).join('');
      page('jobs', '<div class="cra-bar"><h1 class="cra-h1">Jobs</h1><a class="cra-btn pri" href="#edit">+ Post a job</a></div>' +
        '<div class="cra-stats"><div class="cra-stat"><b>' + count('published') + '</b><span>Published</span></div><div class="cra-stat"><b>' + count('draft') + '</b><span>Drafts</span></div>' +
        '<div class="cra-stat"><b>' + count('closed') + '</b><span>Closed</span></div><div class="cra-stat"><b>' + newTotal + '</b><span>New applications</span></div></div>' +
        '<div class="cra-card cra-scroll">' + (jobs.length ? '<table class="cra-table"><tr><th>Job</th><th>Status</th><th>Type &middot; Location</th><th>Posted</th><th>Closes</th><th>Applicants</th><th>Actions</th></tr>' + rows + '</table>' :
          '<p class="cra-empty">No jobs yet. Press “+ Post a job” to add the first one.</p>') + '</div>');
      document.querySelector('.cra-wrap').addEventListener('click', function (e) {
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
    page('jobs', '<p class="cra-empty">Loading…</p>');
    var load = id ? sb.from('jobs').select('*').eq('id', id).maybeSingle() : Promise.resolve({ data: Object.assign({}, BLANK) });
    load.then(function (r) {
      if (r.error || !r.data) { page('jobs', '<p class="cra-err">' + esc((r.error && r.error.message) || 'That job was not found.') + '</p>'); return; }
      var j = r.data, pub = j.status === 'published';
      var v = function (k) { return esc(j[k] == null ? '' : j[k]); };
      var team = ['AI & Engineering', 'Product', 'Marketing', 'Operations'];
      page('jobs',
        '<div class="cra-bar"><div><div style="font-size:.9rem"><a href="#jobs" style="font-weight:700;text-decoration:none">&larr; Jobs</a></div><h1 class="cra-h1">' + (id ? 'Edit job' : 'Post a job') + ' <span class="st ' + (pub ? 'pub' : 'draft') + '">' + (pub ? 'Published' : j.status === 'closed' ? 'Closed' : 'Draft') + '</span></h1></div>' +
        '<div class="cra-pub">' + (pub ? '<a class="cra-btn" href="/careers/' + encodeURIComponent(j.slug) + '" target="_blank" rel="noopener">View live page</a>' : '') +
        '<button class="cra-btn" id="b-save">' + (pub ? 'Save changes' : 'Save draft') + '</button>' + (!pub ? '<button class="cra-btn pri" id="b-pub">Publish</button>' : '') + '</div></div>' +
        '<div class="cra-grid"><div>' +
        '<div class="cra-card"><h2>The basics</h2><div class="cra-f"><label>Job title *</label><input type="text" id="f-title" value="' + v('title') + '"></div>' +
        '<div class="cra-f"><label>Web address ending</label><input type="text" id="f-slug" value="' + v('slug') + '"><p class="hint">takgio.com/careers/<span id="slug-show">' + v('slug') + '</span></p></div>' +
        '<div class="cra-r3"><div class="cra-f"><label>Team *</label><select id="f-team">' + team.map(function (t) { return opt(t, t, j.team); }).join('') + '</select></div>' +
        '<div class="cra-f"><label>Type *</label><select id="f-type">' + Object.keys(TYPE).map(function (k) { return opt(k, TYPE[k], j.employment_type); }).join('') + '</select></div>' +
        '<div class="cra-f"><label>Schedule</label><select id="f-sched">' + opt('part_time', 'Part time', j.schedule) + opt('full_time', 'Full time', j.schedule) + '</select></div></div>' +
        '<div class="cra-r3"><div class="cra-f"><label>Number of openings</label><input type="number" min="1" id="f-open" value="' + v('openings') + '"></div>' +
        '<div class="cra-f"><label>Start date</label><input type="date" id="f-start" value="' + v('start_date') + '"></div>' +
        '<div class="cra-f"><label>End date (temporary roles)</label><input type="date" id="f-end" value="' + v('end_date') + '"></div></div></div>' +
        '<div class="cra-card"><h2>Where it’s done</h2><div class="cra-r2"><div class="cra-f"><label>Location type *</label><select id="f-loc">' +
        opt('remote', 'Remote', j.location_type) + opt('onsite', 'On-site', j.location_type) + opt('hybrid', 'Hybrid', j.location_type) + '</select></div>' +
        '<div class="cra-f"><label>Candidates must be based in *</label><select id="f-country">' + opt('US', 'United States', j.applicant_country) + '</select><p class="hint">Remote jobs must say who can apply, so Google shows them to the right people.</p></div></div>' +
        '<div class="cra-r2" id="f-where"><div class="cra-f"><label>City (on-site or hybrid)</label><input type="text" id="f-city" value="' + v('city') + '"></div><div class="cra-f"><label>State</label><input type="text" id="f-state" value="' + v('state') + '"></div></div></div>' +
        '<div class="cra-card"><h2>Pay</h2><div class="cra-r3"><div class="cra-f"><label>From</label><input type="number" step="0.01" min="0" id="f-pmin" placeholder="$" value="' + v('pay_min') + '"></div>' +
        '<div class="cra-f"><label>To</label><input type="number" step="0.01" min="0" id="f-pmax" placeholder="$" value="' + v('pay_max') + '"></div>' +
        '<div class="cra-f"><label>Per</label><select id="f-punit">' + opt('hour', 'Hour', j.pay_unit) + opt('year', 'Year', j.pay_unit) + '</select></div></div>' +
        '<div class="cra-f"><label><input type="checkbox" id="f-showpay"' + (j.show_pay ? ' checked' : '') + '> Show pay on the posting</label><p class="hint">Internships at Takgio are paid. The checklist warns before you publish an internship without pay.</p></div></div>' +
        '<div class="cra-card"><h2>Description</h2><p class="cra-hint">Plain text. Leave a blank line between paragraphs, and start a line with “- ” for a bullet.</p>' +
        '<div class="cra-f"><label>About this opportunity *</label><textarea id="f-about">' + v('about') + '</textarea></div>' +
        '<div class="cra-f"><label>What you’ll do *</label><textarea id="f-duties">' + v('duties') + '</textarea></div>' +
        '<div class="cra-f"><label>Who should apply *</label><textarea id="f-qual">' + v('qualifications') + '</textarea></div>' +
        '<div class="cra-f"><label>Skills (separate with commas)</label><input type="text" id="f-skills" value="' + esc((j.skills || []).join(', ')) + '"></div></div>' +
        '<div class="cra-card"><h2>Applying</h2><div class="cra-r2"><div class="cra-f"><label>Applications open</label><input type="date" id="f-aopen" value="' + v('apply_open') + '"></div>' +
        '<div class="cra-f"><label>Applications close</label><input type="date" id="f-aclose" value="' + v('apply_close') + '"></div></div>' +
        '<div class="cra-f"><label>Extra question for this job (optional)</label><input type="text" id="f-extra" placeholder="Tell us about something you built or learned with AI" value="' + v('extra_question') + '"></div>' +
        '<div class="cra-f"><label>Send new applications to</label><input type="email" id="f-notify" value="' + v('notify_email') + '"></div></div>' +
        '</div><div><div class="cra-card"><h2>Before you publish</h2><ul class="cra-check" id="checks"></ul></div>' +
        '<div class="cra-card"><h2>What publishing does</h2><p style="margin:0 0 8px;font-size:.9rem">Creates the job page on takgio.com, adds it to the Careers list, and adds the markup Google Jobs reads, so it can appear in Google search.</p><p style="margin:0;font-size:.9rem">When the closing date passes, the job drops off the Careers page by itself.</p></div>' +
        '<div class="cra-card"><h2>Who can do what</h2><p style="margin:0;font-size:.9rem"><b>Editors</b> create, edit and publish jobs and review applicants. <b>Admins</b> can also delete and manage access. Every change is logged with who and when.</p></div></div></div>');

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
      document.querySelector('.cra-wrap').addEventListener('input', paint); document.querySelector('.cra-wrap').addEventListener('change', paint); paint();

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
    page('apps', '<p class="cra-empty">Loading…</p>');
    var q = sb.from('job_applications').select('*, jobs(title)').order('created_at', { ascending: false });
    if (jobId && jobId !== 'all') q = q.eq('job_id', jobId);
    Promise.all([q, sb.from('jobs').select('id,title').order('title')]).then(function (r) {
      if (r[0].error) { page('apps', '<p class="cra-err">' + esc(r[0].error.message) + '</p>'); return; }
      var apps = r[0].data || [], jobs = r[1].data || [];
      state.apps = apps;
      var sel = apps.filter(function (a) { return a.id === state.selApp; })[0] || apps[0] || null;
      if (sel) state.selApp = sel.id;
      var rows = apps.map(function (a) {
        return '<tr data-app="' + a.id + '"' + (sel && sel.id === a.id ? ' class="cra-row-sel"' : '') + '><td><b>' + esc(a.first_name + ' ' + a.last_name) + '</b><br><small style="color:var(--color-text-secondary)">' + esc(a.email) + '</small></td>' +
          '<td>' + esc(a.state || '') + '</td><td>' + fmt(a.created_at) + '</td><td><span class="st ' + (a.email_confirmed_at ? 'ok' : 'wait') + '">' + (a.email_confirmed_at ? 'Confirmed' : 'Not confirmed') + '</span></td>' +
          '<td>' + (a.work_authorized == null ? '' : a.work_authorized ? 'Yes' : 'No') + '</td><td><span class="st ' + STATUS_CLASS[a.status] + '">' + STATUS[a.status] + '</span></td></tr>';
      }).join('');
      var detail = sel ? '<div class="cra-card"><h2>' + esc(sel.first_name + ' ' + sel.last_name) + '</h2><div class="cra-detail">' +
        '<p><b>Email</b> ' + esc(sel.email) + (sel.email_confirmed_at ? ' (confirmed)' : ' (not confirmed)') + ' &middot; <b>State</b> ' + esc(sel.state || '') + (sel.phone ? ' &middot; <b>Phone</b> ' + esc(sel.phone) : '') + '</p>' +
        '<p><b>Job</b> ' + esc((sel.jobs && sel.jobs.title) || 'General application') + '</p>' +
        '<p><b>Links</b> ' + (/^https?:\/\//i.test(sel.link_url || '') ? '<a href="' + esc(sel.link_url) + '" target="_blank" rel="noopener noreferrer">' + esc(sel.link_url) + '</a>' : esc(sel.link_url || '')) + ' &middot; <b>Resume</b> ' + (sel.resume_path ? '<a href="#" id="a-resume">Open (link expires in 10 minutes)</a>' : 'none') + '</p>' +
        '<p><b>Authorized to work in the US?</b> ' + (sel.work_authorized == null ? '' : sel.work_authorized ? 'Yes' : 'No') + '</p>' +
        (sel.exams ? '<p><b>Claude exams</b> ' + esc(sel.exams) + '</p>' : '') +
        '<p style="margin:0"><b>Something they built or learned with AI</b><br>' + esc(sel.answer || '') + '</p></div>' +
        '<div class="cra-f" style="margin-top:14px"><label>Status</label><select id="a-status">' + Object.keys(STATUS).map(function (k) { return opt(k, STATUS[k], sel.status); }).join('') + '</select></div>' +
        '<div class="cra-f"><label>Internal notes (applicants never see these)</label><textarea id="a-notes" placeholder="Notes for the team">' + esc(sel.notes || '') + '</textarea></div>' +
        '<div class="cra-pub"><button class="cra-btn pri" id="a-save">Save</button><a class="cra-btn" href="mailto:' + esc(sel.email) + '">Email applicant</a>' + (isAdmin() ? '<button class="cra-btn dng" id="a-del">Delete</button>' : '') + '</div></div>'
        : '<div class="cra-card"><p class="cra-empty">No applications yet.</p></div>';
      page('apps', '<div class="cra-bar"><h1 class="cra-h1">Applications</h1><div class="cra-pub"><select class="cra-btn" id="a-job"><option value="all">All jobs</option>' +
        jobs.map(function (x) { return opt(x.id, x.title, jobId); }).join('') + '</select>' + (isAdmin() ? '<button class="cra-btn" id="a-csv">Download CSV</button>' : '') + '</div></div>' +
        '<div class="cra-grid"><div class="cra-card cra-scroll">' + (apps.length ? '<table class="cra-table"><tr><th>Applicant</th><th>State</th><th>Applied</th><th>Email</th><th>Work auth.</th><th>Status</th></tr>' + rows + '</table>' +
          '<p class="cra-hint" style="margin:10px 12px 0">Applicants who haven’t confirmed their email stay marked until they do. Unconfirmed applications are the first ones to ignore.</p>' : '<p class="cra-empty">No applications yet.</p>') + '</div><div>' + detail + '</div></div>');
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
        if (!confirm('Delete this applicant for good? Their resume file is deleted too.')) return;
        var dropRow = function () {
          sb.from('job_applications').delete().eq('id', sel.id).then(function (x) { if (x.error) toast(x.error.message, true); else { toast('Deleted'); state.selApp = null; viewApps(jobId); } });
        };
        if (!sel.resume_path) return dropRow();
        // The file goes first: if it cannot be removed, keep the record so the resume is never left behind with nothing pointing at it.
        // (A storage delete that the database rules refuse comes back as an empty list, not an error, so check the list.)
        sb.storage.from('resumes').remove([sel.resume_path]).then(function (rm) {
          if (rm.error) { toast('Could not delete the resume file: ' + rm.error.message, true); return; }
          if (!rm.data || !rm.data.length) {
            if (!confirm('The resume file was not found or could not be removed. Delete the applicant record anyway?')) return;
          }
          dropRow();
        });
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

  // older links (#news, #week/..., #team) now live on their own pages
  TakgioAdmin.start({
    area: 'Careers',
    tabs: [['jobs', 'Jobs'], ['apps', 'Applications']],
    route: function (a, view, parts) {
      bind(a); state.apps = state.apps || []; state.selApp = state.selApp || null;
      if (view === 'news' || view === 'week') return location.replace('/admin/news' + location.hash);
      if (view === 'team') return location.replace('/admin/team');
      if (view === 'edit') return viewEdit(parts[1] || null);
      if (view === 'apps') return viewApps(parts[1] || null);
      return viewJobs();
    }
  });
})();
