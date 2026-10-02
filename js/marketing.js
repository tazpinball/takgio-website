/* ============================================
   Takgio — marketing pages (v2.34)
   - "Present": one banner fills the whole viewport (no site header or footer). Arrow keys switch, A turns on
     auto-rotate, F goes full screen, Esc closes. The controls hide after 3 s and come back on any movement or touch.
   - Deep links (also after a #): ?show=<banner id> opens on that banner, ?show=all starts on the first one,
     &every=<seconds> starts the loop.
   - Copy buttons. The page address shown on the page is the address it was opened at.
   The banners come from the page itself: every [data-slide] carries data-id, data-kind (art | qr), data-src,
   data-title and data-caption, and [data-present="<id>|all"] buttons open the display.
   ============================================ */
(function () {
  'use strict';
  var cards = Array.prototype.slice.call(document.querySelectorAll('[data-slide]'));
  if (!cards.length) return;
  var SL = cards.map(function (c) {
    return { id: c.getAttribute('data-id'), kind: c.getAttribute('data-kind') === 'qr' ? 'qr' : 'art', src: c.getAttribute('data-src'),
             title: c.getAttribute('data-title') || '', caption: c.getAttribute('data-caption') || '' };
  });

  // ---- the display, built once ----
  var root = document.createElement('div');
  root.className = 'mpd'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Full-screen display');
  root.innerHTML =
    '<div class="mpd-bg" aria-hidden="true"></div>' +
    '<div class="mpd-stage"><img class="mpd-img" alt=""></div>' +
    '<div class="mpd-cap" hidden></div>' +
    '<div class="mpd-ui">' +
      '<div class="mpd-top"><span class="mpd-name"></span><span class="mpd-ctl">' +
        '<button class="mpd-btn" data-mpd="auto" type="button" title="Auto-rotate (A)">&#9654; Auto</button>' +
        '<select class="mpd-btn" data-mpd="every" aria-label="Seconds per screen"><option value="10">10 s</option><option value="20" selected>20 s</option><option value="30">30 s</option><option value="60">60 s</option></select>' +
        '<button class="mpd-btn" data-mpd="full" type="button" title="Full screen (F)">&#9974; Full screen</button>' +
        '<button class="mpd-btn" data-mpd="close" type="button" title="Close (Esc)" aria-label="Close">&#10005;</button>' +
      '</span></div>' +
      '<button class="mpd-arrow mpd-prev" data-mpd="prev" type="button" aria-label="Previous">&#8249;</button>' +
      '<button class="mpd-arrow mpd-next" data-mpd="next" type="button" aria-label="Next">&#8250;</button>' +
      '<div class="mpd-hint">&larr; &rarr; switch &nbsp;&middot;&nbsp; A auto-rotate &nbsp;&middot;&nbsp; F full screen &nbsp;&middot;&nbsp; Esc close</div>' +
    '</div>';
  document.body.appendChild(root);
  function q(sel) { return root.querySelector(sel); }
  var img = q('.mpd-img'), bg = q('.mpd-bg'), nameEl = q('.mpd-name'), cap = q('.mpd-cap'), hint = q('.mpd-hint'),
      autoBtn = q('[data-mpd="auto"]'), everySel = q('[data-mpd="every"]'), closeBtn = q('[data-mpd="close"]');
  var idx = 0, auto = null, idleT = null, hintT = null, opener = null;

  function preload(i) { var im = new Image(); im.src = SL[i].src; }
  function render() {
    var s = SL[idx];
    root.setAttribute('data-kind', s.kind);
    img.src = s.src; img.alt = s.title;
    bg.style.backgroundImage = s.kind === 'art' ? 'url("' + s.src + '")' : 'none';
    nameEl.textContent = (idx + 1) + ' / ' + SL.length + ' · ' + s.title;
    cap.textContent = s.caption; cap.hidden = !s.caption;
    preload((idx + 1) % SL.length);
  }
  function wake() {
    root.classList.remove('is-idle'); clearTimeout(idleT);
    idleT = setTimeout(function () { root.classList.add('is-idle'); }, 3000);
  }
  function go(d) { idx = (idx + d + SL.length) % SL.length; render(); }
  function stopAuto() { if (auto) { clearInterval(auto); auto = null; } autoBtn.classList.remove('on'); autoBtn.innerHTML = '&#9654; Auto'; }
  function startAuto() {
    stopAuto();
    auto = setInterval(function () { go(1); }, (parseInt(everySel.value, 10) || 20) * 1000);
    autoBtn.classList.add('on'); autoBtn.innerHTML = '&#10074;&#10074; Auto';
  }
  function setEvery(sec) {
    for (var i = 0; i < everySel.options.length; i++) { if (+everySel.options[i].value === sec) { everySel.selectedIndex = i; return; } }
    var o = document.createElement('option'); o.value = sec; o.textContent = sec + ' s'; everySel.appendChild(o); everySel.value = String(sec);
  }
  function open(which, every, from) {
    idx = 0;
    for (var i = 0; i < SL.length; i++) { if (SL[i].id === which) idx = i; }
    if (every > 0) setEvery(every);
    opener = from || null;
    root.hidden = false; document.documentElement.style.overflow = 'hidden';
    render(); wake();
    hint.classList.add('on'); clearTimeout(hintT); hintT = setTimeout(function () { hint.classList.remove('on'); }, 4500);
    if (every > 0) startAuto(); else stopAuto();
    closeBtn.focus();
  }
  function close() {
    stopAuto(); clearTimeout(idleT); root.hidden = true; document.documentElement.style.overflow = '';
    if (document.fullscreenElement && document.exitFullscreen) { try { document.exitFullscreen(); } catch (e) {} }
    if (opener && opener.focus) opener.focus();
  }
  function fullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    } catch (e) {}
  }

  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mpd]'); if (!b) return;
    var a = b.getAttribute('data-mpd');
    if (a === 'close') close();
    else if (a === 'prev') go(-1);
    else if (a === 'next') go(1);
    else if (a === 'full') fullscreen();
    else if (a === 'auto') { if (auto) stopAuto(); else startAuto(); }
    wake();
  });
  everySel.addEventListener('change', function () { if (auto) startAuto(); wake(); });
  ['mousemove', 'pointerdown', 'touchstart'].forEach(function (t) { root.addEventListener(t, wake, { passive: true }); });
  document.addEventListener('keydown', function (e) {
    if (root.hidden) return;
    var k = e.key, inSelect = !!e.target && e.target.tagName === 'SELECT';
    if (k === 'Escape') close();
    else if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !inSelect)) { e.preventDefault(); go(1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(-1); }
    else if ((k === 'a' || k === 'A') && !inSelect) { if (auto) stopAuto(); else startAuto(); }
    else if (k === 'f' || k === 'F') fullscreen();
    else if (k === 'Tab') {   // keep keyboard focus inside the display while it is open
      var f = root.querySelectorAll('button, select');
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
    wake();
  });

  // ---- the page: Present buttons, copy buttons, the address shown ----
  var here = location.host + location.pathname, hereFull = location.origin + location.pathname;
  Array.prototype.forEach.call(document.querySelectorAll('[data-addr]'), function (el) {
    var id = el.getAttribute('data-addr'), tail = id ? '?show=' + id : '';
    el.textContent = here + tail;
    var btn = el.nextElementSibling;
    if (btn && btn.hasAttribute('data-copy-text')) btn.setAttribute('data-copy-text', hereFull + tail);
  });
  function flash(btn, text) {
    var old = btn.getAttribute('data-label') || btn.textContent;
    btn.setAttribute('data-label', old); btn.textContent = text;
    setTimeout(function () { btn.textContent = old; }, 1800);
  }
  function copy(btn) {
    var text = btn.getAttribute('data-copy-text'), span = btn.previousElementSibling;
    var fallback = function () {   // clipboard blocked: select the address so Ctrl+C works
      if (span) { var r = document.createRange(); r.selectNodeContents(span); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
      flash(btn, 'Selected — press Ctrl+C');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { flash(btn, 'Copied'); }, fallback);
    else fallback();
  }
  document.addEventListener('click', function (e) {
    var p = e.target.closest('[data-present]');
    if (p) { e.preventDefault(); open(p.getAttribute('data-present'), parseInt(p.getAttribute('data-every') || '0', 10) || 0, p); return; }
    var c = e.target.closest('[data-copy-text]');
    if (c) copy(c);
  });

  // ---- deep links ----
  var qs = new URLSearchParams(location.search), hs = new URLSearchParams(location.hash.replace(/^#/, ''));
  var show = qs.get('show') || hs.get('show'), every = parseInt(qs.get('every') || hs.get('every') || '0', 10) || 0;
  if (show) open(show, every, null);
})();
