// ============================================================
// Confirm-your-email page for a careers application (opened from the link in the confirmation email).
// The link carries the token in the URL fragment (#t=...), which is never sent to a server and is cleared from the address bar
// right away. Opening the page confirms nothing; only the button does, because mail scanners open every link in a message.
// Depends on: careers-config.js (confirmUrl).
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

  if (!token || !cfg.confirmUrl) {
    say('That link is not valid', 'Please use the link from your email.');
    return;
  }

  say('Confirm your email', 'Press the button to confirm your email address for your takgio application.');
  btn.hidden = false;

  btn.addEventListener('click', function () {
    btn.disabled = true; btn.textContent = 'Confirming…'; err.textContent = '';
    fetch(cfg.confirmUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: token }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error((res.body && res.body.error) || 'Something went wrong. Please try again.');
        btn.hidden = true; err.textContent = '';
        if (res.body && res.body.status === 'already') say('Already confirmed', 'Thanks, your email was already confirmed. We will be in touch if there is a fit.');
        else say('Thanks, you are confirmed', 'We have your application. We read every one and will be in touch if there is a fit.');
      })
      .catch(function (e) {
        btn.disabled = false; btn.textContent = 'Confirm my email';
        err.textContent = e.message || 'Something went wrong. Please try again.';
      });
  });
})();
