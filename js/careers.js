// ============================================================
// Careers (public): the open-positions list, a job page, and the application form.
// Depends on: Supabase JS (CDN), supabase-config.js, careers-config.js.
// Reads published jobs from the public view `jobs_public` (anon key; private columns are not in the view).
// ============================================================
(function () {
  'use strict';

  var cfg = window.CAREERS_CONFIG || {};
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  var TYPE = { internship: 'Internship', full_time: 'Full time', part_time: 'Part time', contract: 'Contract' };
  var LOC = { remote: 'Remote', onsite: 'On-site', hybrid: 'Hybrid' };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia',
    'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
    'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
    'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
    'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(d) {
    if (!d) return '';
    var p = String(d).slice(0, 10).split('-');
    return MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
  }
  // Plain text in, safe HTML out: blank-line paragraphs and "- " bullet lists. Nothing else is interpreted.
  function rich(text) {
    var out = [], list = null;
    String(text || '').replace(/\r/g, '').split('\n').forEach(function (line) {
      var t = line.trim();
      if (/^[-•*]\s+/.test(t)) {
        if (!list) list = [];
        list.push('<li>' + esc(t.replace(/^[-•*]\s+/, '')) + '</li>');
        return;
      }
      if (list) { out.push('<ul>' + list.join('') + '</ul>'); list = null; }
      if (t) out.push('<p>' + esc(t) + '</p>');
    });
    if (list) out.push('<ul>' + list.join('') + '</ul>');
    return out.join('');
  }
  function payText(j) {
    if (j.pay_min == null && j.pay_max == null) return '';
    var unit = j.pay_unit === 'year' ? 'per year' : 'per hour';
    var fmt = function (n) { return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); };
    if (j.pay_min != null && j.pay_max != null && Number(j.pay_min) !== Number(j.pay_max)) return fmt(j.pay_min) + ' – ' + fmt(j.pay_max) + ' ' + unit;
    return fmt(j.pay_min != null ? j.pay_min : j.pay_max) + ' ' + unit;
  }
  function locationText(j) {
    if (j.location_type === 'remote') return 'Remote' + (j.applicant_country === 'US' ? ' (US)' : ' (' + esc(j.applicant_country) + ')');
    var where = [j.city, j.state].filter(Boolean).join(', ');
    return (LOC[j.location_type] || '') + (where ? ' · ' + esc(where) : '');
  }
  function jobUrl(j) { return '/careers/' + encodeURIComponent(j.slug); }

  // ---------------------------------------------------------- list page
  function jobCard(j, feature) {
    var tags = ['<span class="cr-tag hot">Now hiring</span>', '<span class="cr-tag">' + esc(TYPE[j.employment_type] || '') + '</span>'];
    if (j.schedule) tags.push('<span class="cr-tag">' + (j.schedule === 'part_time' ? 'Part time' : 'Full time') + '</span>');
    tags.push('<span class="cr-tag">' + locationText(j) + '</span>');
    var more = [];
    if (j.start_date && j.end_date) more.push(fmtDate(j.start_date) + ' – ' + fmtDate(j.end_date));
    if (j.openings) more.push(j.openings + (j.openings === 1 ? ' opening' : ' openings'));
    if (j.apply_close) more.push('Apply by ' + fmtDate(j.apply_close));
    var pay = payText(j); if (pay) more.push(esc(pay));
    var sum = (j.about || '').split('\n').filter(function (l) { return l.trim(); })[0] || '';
    if (sum.length > 220) sum = sum.slice(0, 217).replace(/\s+\S*$/, '') + '…';
    return '<a class="cr-job' + (feature ? ' feature' : '') + '" href="' + jobUrl(j) + '"><div>' +
      '<div class="cr-tags" style="margin-bottom:10px">' + tags.join('') + '</div>' +
      '<h3>' + esc(j.title) + '</h3>' +
      (sum ? '<p class="cr-sum">' + esc(sum) + '</p>' : '') +
      '<div class="cr-tags">' + more.map(function (m) { return '<span class="cr-tag">' + m + '</span>'; }).join('') + '</div></div>' +
      '<span class="btn btn-primary btn-lg">View role &amp; apply &rarr;</span></a>';
  }

  function renderList(rows) {
    var box = document.getElementById('cr-jobs'), count = document.getElementById('cr-count'), hero = document.getElementById('cr-hero-count');
    if (!box) return;
    if (!rows.length) {
      count.textContent = '0 open positions';
      if (hero) hero.textContent = 'No open positions right now';
      box.innerHTML = '<div class="cr-empty"><h3>No open positions right now</h3><p>We hire in waves. Send us your resume and we will be in touch when something fits.</p></div>';
      return;
    }
    if (hero) hero.textContent = rows.length + (rows.length === 1 ? ' open position is below' : ' open positions are below');
    var feature = rows.length <= 3;
    var shown = rows;
    function draw() {
      count.textContent = shown.length + (shown.length === 1 ? ' open position' : ' open positions');
      var groups = {}, order = [];
      shown.forEach(function (j) { var t = j.team || 'Other'; if (!groups[t]) { groups[t] = []; order.push(t); } groups[t].push(j); });
      box.innerHTML = order.map(function (t) {
        return '<div class="cr-dept">' + esc(t) + '</div>' + groups[t].map(function (j) { return jobCard(j, feature); }).join('');
      }).join('') || '<div class="cr-empty"><p>No positions match those filters.</p></div>';
    }
    // Filters only appear once there are enough roles for them to matter
    var f = document.getElementById('cr-filters');
    if (f && rows.length >= 5) {
      var teams = Array.from(new Set(rows.map(function (j) { return j.team || 'Other'; })));
      f.hidden = false;
      f.innerHTML = '<label>Keyword<input type="text" id="cr-q" placeholder="Search jobs by keyword" aria-label="Search jobs by keyword"></label>' +
        '<label>Team<select id="cr-t"><option value="">All teams</option>' + teams.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') + '</select></label>' +
        '<label>Type<select id="cr-y"><option value="">All types</option>' + Object.keys(TYPE).map(function (k) { return '<option value="' + k + '">' + TYPE[k] + '</option>'; }).join('') + '</select></label>';
      var apply = function () {
        var q = document.getElementById('cr-q').value.toLowerCase(), t = document.getElementById('cr-t').value, y = document.getElementById('cr-y').value;
        shown = rows.filter(function (j) {
          return (!t || (j.team || 'Other') === t) && (!y || j.employment_type === y) &&
            (!q || (j.title + ' ' + (j.about || '') + ' ' + (j.skills || []).join(' ')).toLowerCase().indexOf(q) !== -1);
        });
        draw();
      };
      f.addEventListener('input', apply);
    }
    draw();
  }

  // ---------------------------------------------------------- job page
  function jsonLd(j) {
    var types = { internship: 'INTERN', full_time: 'FULL_TIME', part_time: 'PART_TIME', contract: 'CONTRACTOR' };
    var et = [types[j.employment_type]];
    if (j.schedule === 'part_time' && et.indexOf('PART_TIME') < 0) et.push('PART_TIME');
    var html = rich(j.about) + (j.duties ? '<h2>What you’ll do</h2>' + rich(j.duties) : '') + (j.qualifications ? '<h2>Who should apply</h2>' + rich(j.qualifications) : '');
    var ld = {
      '@context': 'https://schema.org/', '@type': 'JobPosting', title: j.title, description: html,
      datePosted: String(j.published_at || '').slice(0, 10), employmentType: et,
      hiringOrganization: { '@type': 'Organization', name: 'takgio', sameAs: 'https://www.takgio.com' },
      identifier: { '@type': 'PropertyValue', name: 'takgio', value: j.id }, directApply: true
    };
    if (j.apply_close) ld.validThrough = j.apply_close + 'T23:59:00-05:00';
    if (j.location_type === 'remote') {
      ld.jobLocationType = 'TELECOMMUTE';
      ld.applicantLocationRequirements = { '@type': 'Country', name: j.applicant_country || 'US' };
    } else {
      ld.jobLocation = { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: j.city || undefined, addressRegion: j.state || undefined, addressCountry: j.applicant_country || 'US' } };
    }
    if (j.pay_min != null || j.pay_max != null) {
      ld.baseSalary = { '@type': 'MonetaryAmount', currency: 'USD', value: { '@type': 'QuantitativeValue', unitText: j.pay_unit === 'year' ? 'YEAR' : 'HOUR' } };
      if (j.pay_min != null) ld.baseSalary.value.minValue = Number(j.pay_min);
      if (j.pay_max != null) ld.baseSalary.value.maxValue = Number(j.pay_max);
    }
    return ld;
  }

  function formHtml(j) {
    var open = !!cfg.applyUrl;
    var closed = j && j.apply_close && j.apply_close < new Date().toISOString().slice(0, 10);
    var stateOpts = '<option value="">Select a state</option>' + STATES.map(function (s) { return '<option>' + s + '</option>'; }).join('');
    var note = !open ? '<div class="cr-after" style="background:#fffbeb;border-color:#fde68a;color:#78350f"><b>Applications open soon</b>The form below isn’t taking applications yet. Please check back shortly.</div>' : '';
    var dis = (!open || closed) ? ' disabled' : '';
    return '<h2 id="apply-title">' + (j ? 'Apply for this role' : 'Send us your resume') + '</h2>' +
      (j && j.apply_close ? '<p class="cr-close">Applications close ' + fmtDate(j.apply_close) + '.</p>' : '<p class="cr-close">We read every application.</p>') + note +
      '<form id="cr-form" novalidate>' +
      '<input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">' +
      '<div class="cr-row two"><div class="cr-field"><label for="fn">First name <em>*</em></label><input type="text" id="fn" name="first_name" autocomplete="given-name" required' + dis + '></div>' +
      '<div class="cr-field"><label for="ln">Last name <em>*</em></label><input type="text" id="ln" name="last_name" autocomplete="family-name" required' + dis + '></div></div>' +
      '<div class="cr-field"><label for="em">Email <em>*</em></label><input type="email" id="em" name="email" autocomplete="email" placeholder="you@example.com" required' + dis + '><p class="hint">We’ll send a link to confirm this address.</p></div>' +
      '<div class="cr-row two"><div class="cr-field"><label for="ph">Phone</label><input type="tel" id="ph" name="phone" autocomplete="tel" placeholder="Optional"' + dis + '></div>' +
      '<div class="cr-field"><label for="st">State <em>*</em></label><select id="st" name="state" required' + dis + '>' + stateOpts + '</select></div></div>' +
      '<div class="cr-field"><label for="li">LinkedIn or portfolio link <em>*</em></label><input type="url" id="li" name="link_url" placeholder="https://www.linkedin.com/in/your-name" required' + dis + '></div>' +
      '<div class="cr-field"><label for="rs">Resume <em>*</em></label><input type="file" id="rs" name="resume" accept=".pdf,.doc,.docx" required' + dis + '><p class="hint">PDF or Word, up to 5 MB.</p></div>' +
      '<div class="cr-field"><fieldset style="border:0;padding:0;margin:0"><legend>Are you authorized to work in the United States? <em>*</em></legend><div class="cr-radio">' +
      '<label><input type="radio" name="work_authorized" value="yes"' + dis + '> Yes</label><label><input type="radio" name="work_authorized" value="no"' + dis + '> No</label></div></fieldset></div>' +
      '<div class="cr-field"><label for="ex">Which Claude certification exams have you taken, or plan to take?</label><input type="text" id="ex" name="exams" placeholder="Optional"' + dis + '></div>' +
      '<div class="cr-field"><label for="bu">' + esc((j && j.extra_question) || 'Tell us about something you built or learned with AI') + ' <em>*</em></label><textarea id="bu" name="answer" placeholder="Two or three sentences is plenty." required' + dis + '></textarea></div>' +
      '<div id="cr-turnstile" class="cr-bot"' + (cfg.turnstileSiteKey ? '' : ' hidden') + '></div>' +
      '<label class="cr-consent"><input type="checkbox" name="consent" required' + dis + '><span>I agree that takgio may store my application to consider me for this and future roles.</span></label>' +
      '<button type="submit" class="btn btn-primary btn-lg" style="width:100%" id="cr-submit"' + dis + '>Submit application</button>' +
      '<div id="cr-msg" role="status" aria-live="polite"></div></form>';
  }

  function wireForm(jobId) {
    var form = document.getElementById('cr-form');
    if (!form || !cfg.applyUrl) return;
    var token = '';
    if (cfg.turnstileSiteKey) {
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true;
      s.onload = function () {
        window.turnstile.render('#cr-turnstile', { sitekey: cfg.turnstileSiteKey, callback: function (t) { token = t; } });
      };
      document.head.appendChild(s);
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('cr-msg'), btn = document.getElementById('cr-submit');
      msg.className = ''; msg.textContent = '';
      var fd = new FormData(form);
      var file = form.resume.files[0];
      var need = ['first_name', 'last_name', 'email', 'state', 'link_url', 'answer'].filter(function (k) { return !String(fd.get(k) || '').trim(); });
      if (need.length || !file || !fd.get('work_authorized') || !fd.get('consent')) {
        msg.className = 'cr-err'; msg.textContent = 'Please fill in every field marked with a star, attach your resume and tick the box.'; return;
      }
      if (file.size > 5 * 1024 * 1024) { msg.className = 'cr-err'; msg.textContent = 'That file is over 5 MB. Please attach a smaller one.'; return; }
      if (cfg.turnstileSiteKey && !token) { msg.className = 'cr-err'; msg.textContent = 'Please complete the bot check.'; return; }
      if (jobId) fd.set('job_id', jobId);
      if (token) fd.set('turnstile_token', token);
      btn.disabled = true; btn.textContent = 'Sending…';
      fetch(cfg.applyUrl, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY }, body: fd })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, body: b }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error((res.body && res.body.error) || 'Something went wrong. Please try again.');
          form.innerHTML = '<div class="cr-after"><b>Thanks, we’ve got it.</b>Check your email for a link to confirm your address. Applications are reviewed once it’s confirmed.</div>';
        })
        .catch(function (err) {
          btn.disabled = false; btn.textContent = 'Submit application';
          msg.className = 'cr-err'; msg.textContent = err.message || 'Something went wrong. Please try again.';
        });
    });
  }

  function renderJob(j) {
    var root = document.getElementById('cr-job');
    var meta = [
      ['Type', esc(TYPE[j.employment_type] || '') + (j.schedule ? ', ' + (j.schedule === 'part_time' ? 'part time' : 'full time') : '')],
      ['Location', locationText(j)]
    ];
    if (j.start_date || j.end_date) meta.push(['Duration', fmtDate(j.start_date) + (j.end_date ? ' – ' + fmtDate(j.end_date) : '')]);
    if (j.openings) meta.push(['Openings', j.openings]);
    var pay = payText(j); if (pay) meta.push(['Pay', esc(pay)]);
    if (j.apply_close) meta.push(['Apply by', fmtDate(j.apply_close)]);
    var skills = (j.skills || []).map(function (s) { return '<span class="cr-tag">' + esc(s) + '</span>'; }).join('');
    root.innerHTML =
      '<p class="cr-crumb"><a href="/careers.html">&larr; Careers</a> &nbsp;/&nbsp; Open positions</p>' +
      '<div class="cr-detail"><article class="cr-body">' +
      '<div class="cr-tags" style="margin-bottom:10px"><span class="cr-tag hot">' + esc(TYPE[j.employment_type] || '') + '</span>' + (j.team ? '<span class="cr-tag">' + esc(j.team) + '</span>' : '') + '</div>' +
      '<h1 class="cr-title">' + esc(j.title) + '</h1>' +
      '<div class="cr-meta">' + meta.map(function (m) { return '<div><small>' + m[0] + '</small><b>' + m[1] + '</b></div>'; }).join('') + '</div>' +
      (j.about ? '<h2>About this opportunity</h2>' + rich(j.about) : '') +
      (j.duties ? '<h2>What you’ll do</h2>' + rich(j.duties) : '') +
      (j.qualifications ? '<h2>Who should apply</h2>' + rich(j.qualifications) : '') +
      (skills ? '<div class="cr-skills">' + skills + '</div>' : '') +
      '<p class="cr-eeo">takgio is an equal opportunity employer.</p>' +
      '</article><aside class="cr-form" aria-labelledby="apply-title">' + formHtml(j) + '</aside></div>';
    document.title = j.title + ' — takgio Careers';
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'takgio is hiring: ' + j.title + '. ' + (TYPE[j.employment_type] || '') + ', ' + locationText(j).replace(/&[a-z#0-9]+;/g, '') + '. Apply online.');
    var s = document.createElement('script'); s.type = 'application/ld+json'; s.textContent = JSON.stringify(jsonLd(j)); document.head.appendChild(s);
    wireForm(j.id);
  }

  function notFound() {
    var m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m);
    document.getElementById('cr-job').innerHTML = '<div class="cr-empty" style="margin-top:30px"><h3>This position is no longer open</h3><p>It may have been filled or closed. <a href="/careers.html">See our open positions</a>.</p></div>';
    document.title = 'Position closed — takgio Careers';
  }

  // ---------------------------------------------------------- start
  var listBox = document.getElementById('cr-jobs'), jobBox = document.getElementById('cr-job'), generalBox = document.getElementById('cr-general-form');
  if (generalBox) { generalBox.innerHTML = formHtml(null); wireForm(null); }
  if (listBox) {
    sb.from('jobs_public').select('*').order('published_at', { ascending: false }).then(function (r) {
      if (r.error) { listBox.innerHTML = '<div class="cr-empty"><p>We couldn’t load the open positions just now. Please try again in a moment.</p></div>'; return; }
      renderList(r.data || []);
    });
  }
  if (jobBox) {
    var parts = window.location.pathname.split('/').filter(Boolean);
    var slug = (parts[0] === 'careers' && parts[1]) ? decodeURIComponent(parts[1]) : new URLSearchParams(window.location.search).get('slug');
    if (!slug) { notFound(); return; }
    sb.from('jobs_public').select('*').eq('slug', slug).maybeSingle().then(function (r) {
      if (r.error || !r.data) { notFound(); return; }
      renderJob(r.data);
    });
  }

  // test hook (read-only): lets the browser tests call the pure helpers
  window.__careers = { rich: rich, payText: payText, jsonLd: jsonLd, fmtDate: fmtDate };
})();
