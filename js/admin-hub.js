// ============================================================
// Takgio admin: the hub (/admin). One card per admin area, each opening its own page.
// To add an area: build its page on js/admin-core.js, add a rewrite in vercel.json, and add a card to AREAS below.
// Depends on: Supabase JS (CDN), supabase-config.js, admin-core.js.
// ============================================================
(function () {
  'use strict';

  var esc = TakgioAdmin.esc;
  // href, title, what it covers, who sees it ('all' or 'admin'), and an optional live count (a function returning a promise of text)
  var AREAS = [
    { href: '/admin/careers', title: 'Careers', what: 'Post and edit jobs, review applications.', who: 'all',
      count: function (sb) {
        return Promise.all([sb.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'published'),
          sb.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'new')]).then(function (r) {
          return (r[0].count || 0) + ' published ' + ((r[0].count === 1) ? 'job' : 'jobs') + ' · ' + (r[1].count || 0) + ' new ' + ((r[1].count === 1) ? 'application' : 'applications');
        });
      } },
    { href: '/admin/news', title: 'News', what: 'AI news: the weekly stories, including what the daily job adds. Edit, pull or restore any story.', who: 'all',
      count: function (sb) {
        return Promise.all([sb.from('ai_news_weeks').select('week_start,status').order('week_start', { ascending: false }).limit(1),
          sb.from('ai_news_items').select('id', { count: 'exact', head: true }).eq('hidden', true)]).then(function (r) {
          var w = (r[0].data || [])[0];
          return (w ? 'Latest week ' + TakgioAdmin.fmt(w.week_start) + (w.status === 'published' ? ' (published)' : ' (draft)') : 'No weeks yet') + ' · ' + (r[1].count || 0) + ' pulled';
        });
      } },
    { href: '/admin/team', title: 'Team & access', what: 'Who can use the admin, their roles, and the activity log.', who: 'admin' },
    { href: '/dashboard.html', title: 'Project dashboard', what: 'The internal project dashboard. It has its own sign-in.', who: 'all', external: true },
  ];

  TakgioAdmin.start({
    area: null,
    tabs: [],
    route: function (a) {
      var mine = AREAS.filter(function (x) { return x.who === 'all' || a.isAdmin(); });
      a.page('', '<div class="cra-bar"><h1 class="cra-h1">Admin</h1></div><div class="adm-grid">' + mine.map(function (x, i) {
        return '<a class="adm-card" href="' + esc(x.href) + '"><b>' + esc(x.title) + (x.who === 'admin' ? '<span class="pill">Admin</span>' : '') + '</b><span>' + esc(x.what) + '</span>' +
          (x.count ? '<small id="adm-c' + i + '">…</small>' : '') + '<em>' + (x.external ? 'Open' : 'Open ' + esc(x.title)) + ' &rarr;</em></a>';
      }).join('') + '</div>');
      mine.forEach(function (x, i) {
        if (!x.count) return;
        x.count(a.sb).then(function (t) { var el = document.getElementById('adm-c' + i); if (el) el.textContent = t; })
          .catch(function () { var el = document.getElementById('adm-c' + i); if (el) el.textContent = ''; });
      });
    }
  });
})();
