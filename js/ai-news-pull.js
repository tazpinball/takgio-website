// ============================================================
// Pull-a-story page for the daily AI news job (opened from the "Pull this story" link in the daily email).
// The link carries the story's secret token in the URL fragment (#t=...), which is never sent to a server and is cleared
// from the address bar right away. Opening the page pulls nothing; only the button does, because mail scanners open every link.
// Depends on: careers-config.js (newsPullUrl).
// ============================================================
(function () {
  'use strict';

  var cfg = window.CAREERS_CONFIG || {};
  var h = document.getElementById('apc-h'), p = document.getElementById('apc-p');
  var btn = document.getElementById('apc-btn'), err = document.getElementById('apc-err');

  var m = /[#&]t=([0-9a-f-]{36})(&|$)/i.exec(window.location.hash || '');
  var token = m ? m[1] : '';
  if (window.history && window.history.replaceState) window.history.replaceState(null, '', window.location.pathname);

  function say(title, text) { h.textContent = title; p.textContent = text; }

  if (!token || !cfg.newsPullUrl) {
    say('That link is not valid', 'Please use the link from the AI news email.');
    return;
  }

  say('Pull this story?', 'Press the button to take this story off takgio.com right away. You can restore it later in the News admin (takgio.com/admin/news).');
  btn.hidden = false;

  btn.addEventListener('click', function () {
    btn.disabled = true; btn.textContent = 'Pulling…'; err.textContent = '';
    fetch(cfg.newsPullUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: token }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error((res.body && res.body.error) || 'Something went wrong. Please try again.');
        btn.hidden = true; err.textContent = '';
        var title = (res.body && res.body.headline) ? '“' + res.body.headline + '”' : 'The story';
        if (res.body && res.body.status === 'already') say('Already pulled', title + ' was already off the site.');
        else say('Story pulled', title + ' is off takgio.com now.');
      })
      .catch(function (e) {
        btn.disabled = false; btn.textContent = 'Pull this story';
        err.textContent = e.message || 'Something went wrong. Please try again.';
      });
  });
})();
