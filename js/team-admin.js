// ============================================================
// Takgio admin: Team & access (/admin/team: who can use the admin, their roles, and the activity log; admins only).
// Runs on the shared admin core (js/admin-core.js): sign-in, two-step code, access check and the page frame live there.
// Who may do what is enforced by the DATABASE (docs/careers-schema.sql), not by this page.
// Depends on: Supabase JS (CDN), supabase-config.js, admin-core.js.
// ============================================================
(function () {
  'use strict';

  // bound to the shared core when it first routes (js/admin-core.js)
  var A, sb, state, esc = TakgioAdmin.esc, fmt = TakgioAdmin.fmt, MONTHS = TakgioAdmin.MONTHS, toast, isAdmin, page, route;
  function bind(a) { A = a; sb = a.sb; state = a.state; toast = a.toast; isAdmin = a.isAdmin; page = a.page; route = a.route; }

  // ------------------------------------------------------------ team & access (admins only)
  function viewTeam() {
    page('team', '<p class="cra-empty">Loading…</p>');
    // admin_team() (docs/admin-team-emails.sql) adds each person's sign-in email, which only the database can read;
    // if it is not installed yet, the page falls back to the plain table and says so.
    var team = sb.rpc('admin_team').then(function (x) {
      return x.error ? sb.from('careers_editors').select('*').order('created_at').then(function (y) { y.noEmail = true; return y; }) : x;
    });
    Promise.all([team, sb.from('audit_log').select('*').order('at', { ascending: false }).limit(50)]).then(function (r) {
      var people = r[0].data || [], log = r[1].data || [], noEmail = !!r[0].noEmail;
      var rows = people.map(function (p) {
        var me = p.user_id === state.user.id;
        return '<tr><td><b>' + esc(p.display_name || 'Unnamed') + '</b>' + (me ? ' <small>(you)</small>' : '') + '</td>' +
          '<td>' + (p.email ? '<a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>' : '<small>—</small>') + '</td><td><span class="st ' + (p.role === 'admin' ? 'pub' : 'new') + '">' + (p.role === 'admin' ? 'Admin' : 'Editor') + '</span></td>' +
          '<td>' + fmt(p.created_at) + '</td><td class="cra-act">' + (me ? '' : '<a href="#" data-role="' + (p.role === 'admin' ? 'editor' : 'admin') + '" data-uid="' + p.user_id + '">Make ' + (p.role === 'admin' ? 'Editor' : 'Admin') + '</a><a href="#" data-remove="' + p.user_id + '" style="color:#b91c1c">Remove</a>') + '</td></tr>';
      }).join('');
      var items = log.map(function (l) {
        var verb = { insert: 'created', update: 'changed', delete: 'deleted' }[l.action] || l.action;
        return '<li>' + esc((l.actor_email || 'Someone') + ' ' + verb + ' ' + (l.entity === 'jobs' ? 'a job' : l.entity === 'job_applications' ? 'an application' : l.entity === 'ai_news_weeks' ? 'an AI news week' : l.entity === 'ai_news_items' ? 'an AI news story' : l.entity) + (l.detail && l.detail.title ? ' “' + l.detail.title + '”' : '') + (l.detail && l.detail.status ? ' (' + l.detail.status + ')' : '')) +
          '<small>' + esc(new Date(l.at).toLocaleString()) + '</small></li>';
      }).join('');
      page('team', '<div class="cra-bar"><h1 class="cra-h1">Team &amp; access</h1></div><div class="cra-grid"><div class="cra-card cra-scroll"><h2>People with admin access</h2>' +
        '<table class="cra-table"><tr><th>Name</th><th>Email</th><th>Role</th><th>Added</th><th></th></tr>' + (rows || '<tr><td colspan="5" class="cra-empty">Nobody yet.</td></tr>') + '</table>' +
        (noEmail ? '<p class="cra-hint" style="margin:10px 12px 0">Emails show here once the database function in docs/admin-team-emails.sql is installed.</p>' : '') +
        '<p class="cra-hint" style="margin:10px 12px 0">To add someone: invite their email in Supabase (Authentication → Users), then ask an admin to give them a role here. Adding people from this page comes later.</p></div>' +
        '<div class="cra-card"><h2>What each role can do</h2><ul class="cra-check"><li><span class="ok">✓</span><span><b>Editor:</b> create, edit, publish and unpublish jobs; review applicants and change their status; add, edit, publish and delete AI news stories</span></li>' +
        '<li><span class="ok">✓</span><span><b>Admin:</b> everything an Editor can, plus delete jobs, applicants and whole AI news weeks, download the full list, and manage who has access</span></li></ul></div></div>' +
        '<div class="cra-card"><h2>Activity</h2><ul class="cra-log">' + (items || '<li>Nothing recorded yet.</li>') + '</ul><p class="cra-hint" style="margin:10px 0 0">Every publish, edit and delete is recorded with who and when. Nobody can erase an entry.</p></div>');
      document.querySelector('.cra-wrap').addEventListener('click', function (e) {
        var a = e.target.closest('[data-role],[data-remove]'); if (!a) return; e.preventDefault();
        var req = a.hasAttribute('data-remove') ? (confirm('Remove this person’s admin access?') ? sb.from('careers_editors').delete().eq('user_id', a.getAttribute('data-remove')) : null)
          : sb.from('careers_editors').update({ role: a.getAttribute('data-role') }).eq('user_id', a.getAttribute('data-uid'));
        if (req) req.then(function (x) { if (x.error) toast(x.error.message, true); else { toast('Done'); viewTeam(); } });
      });
    });
  }

  TakgioAdmin.start({
    area: 'Team & access',
    tabs: [['team', 'Team &amp; access', true]],
    route: function (a) {
      bind(a);
      if (!isAdmin()) return page('team', '<div class="cra-card"><p class="cra-empty">Only admins manage access. <a href="/admin">Back to Admin</a></p></div>');
      return viewTeam();
    }
  });
})();
