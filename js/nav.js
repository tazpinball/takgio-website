/* ============================================
   Takgio — site header + product sub-menu (v2.26)
   - Desktop: Products / Services / Company open as dropdown panels
     (click or Enter; hover on pointer devices). Escape or an outside click closes.
   - Phone/tablet: the menu button opens a full-screen menu; the same
     triggers expand their section in place.
   - Marks the current section in the header.
   - Product pages: product switcher + section highlight in the sticky sub-menu.
   ============================================ */
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;
  var nav = document.getElementById('site-nav');
  var toggle = document.getElementById('nav-toggle');
  var items = Array.prototype.slice.call(header.querySelectorAll('.sh-item'));
  var desktop = window.matchMedia('(min-width: 1024px)');
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

  function trigger(item) { return item.querySelector('.sh-trigger'); }

  // Menu images are lazy so pages don't pay for them up front; start fetching them the moment
  // someone reaches for the header, so the panels never open with blank icons.
  var warmed = false;
  function warm() {
    if (warmed) return;
    warmed = true;
    header.querySelectorAll('img[loading="lazy"]').forEach(function (img) { img.loading = 'eager'; });
  }
  header.addEventListener('pointerenter', warm);
  header.addEventListener('focusin', warm);
  header.addEventListener('touchstart', warm, { passive: true });

  function setItem(item, open) {
    var t = trigger(item);
    if (!t) return;
    item.classList.toggle('is-open', open);
    t.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function closeAll(except) {
    items.forEach(function (it) { if (it !== except) setItem(it, false); });
  }

  // Phone menu
  function setMenu(open) {
    header.classList.toggle('menu-open', open);
    document.body.classList.toggle('nav-locked', open);
    if (toggle) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    if (!open) closeAll();
  }
  if (toggle) {
    toggle.addEventListener('click', function () { setMenu(!header.classList.contains('menu-open')); });
  }

  items.forEach(function (item) {
    var t = trigger(item);
    if (!t) return;
    // Hover opens on desktop pointers; a short delay lets the cursor cross into the panel
    var timer, hoverOpenedAt = 0;
    t.addEventListener('click', function (e) {
      e.stopPropagation();
      // The pointer that clicks has just hovered the trigger open: a click then means "open", not "toggle shut"
      if (item.classList.contains('is-open') && Date.now() - hoverOpenedAt < 600) return;
      var open = !item.classList.contains('is-open');
      if (desktop.matches) closeAll(item);
      setItem(item, open);
    });
    item.addEventListener('mouseenter', function () {
      if (!desktop.matches || !canHover.matches) return;
      clearTimeout(timer);
      if (!item.classList.contains('is-open')) hoverOpenedAt = Date.now();
      closeAll(item);
      setItem(item, true);
    });
    item.addEventListener('mouseleave', function () {
      if (!desktop.matches || !canHover.matches) return;
      timer = setTimeout(function () { setItem(item, false); }, 140);
    });
  });

  // Clicking a link closes everything (phone menu included)
  if (nav) {
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
  }
  document.addEventListener('click', function (e) {
    if (desktop.matches && !header.contains(e.target)) closeAll();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (header.classList.contains('menu-open')) { setMenu(false); if (toggle) toggle.focus(); return; }
    var open = header.querySelector('.sh-item.is-open');
    if (open) { setItem(open, false); trigger(open).focus(); }
  });
  var onChange = function () { if (desktop.matches) setMenu(false); closeAll(); };
  if (desktop.addEventListener) desktop.addEventListener('change', onChange); else desktop.addListener(onChange);

  // Current section in the header
  var page = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var PRODUCT_PAGES = ['products.html', 'concreteiq.html', 'brickture.html', 'hoof-harted.html', 'true-record.html', 'ann-elise.html', 'meta-ray-ban-display.html'];
  var section = PRODUCT_PAGES.indexOf(page) !== -1 ? 'products'
    : page === 'services.html' ? 'services'
    : (page === 'case-studies.html' || page.indexOf('case-study-') === 0) ? 'case-studies'
    : (page === 'insights.html' || page.indexOf('insight-') === 0) ? 'insights'
    : (page === 'about.html' || page === 'contact.html') ? 'company' : '';
  items.forEach(function (it) {
    if (it.getAttribute('data-section') === section) {
      it.classList.add('is-current');
      var direct = it.querySelector('.sh-link');
      if (direct) direct.setAttribute('aria-current', 'page');
    }
  });
  header.querySelectorAll('.sh-prod').forEach(function (a) {
    if (a.getAttribute('href').replace('/', '') === page) a.setAttribute('aria-current', 'page');
  });

  // ---- Product pages: sticky sub-menu ----
  var sub = document.querySelector('.pp-subnav');
  if (!sub) return;
  var sw = sub.querySelector('.pp-sw');
  var swBtn = sub.querySelector('.pp-sw-btn');
  function setSw(open) {
    sw.classList.toggle('is-open', open);
    swBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (sw && swBtn) {
    swBtn.addEventListener('click', function (e) { e.stopPropagation(); setSw(!sw.classList.contains('is-open')); });
    document.addEventListener('click', function (e) { if (!sw.contains(e.target)) setSw(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sw.classList.contains('is-open')) { setSw(false); swBtn.focus(); }
    });
  }

  // Highlight the section being read (the last one whose top has passed under the bars)
  var links = Array.prototype.slice.call(sub.querySelectorAll('.pp-subnav-links a'));
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  // Runs straight from the scroll event: it is a handful of position reads, and not waiting on an
  // animation frame means it can never get stuck while a tab is in the background.
  function spy() {
    var line = 140, current = 0;
    targets.forEach(function (el, i) { if (el && el.getBoundingClientRect().top <= line) current = i; });
    links.forEach(function (a, i) {
      var on = i === current;
      a.classList.toggle('is-on', on);
      if (on) { a.setAttribute('aria-current', 'location'); } else { a.removeAttribute('aria-current'); }
    });
    var box = sub.querySelector('.pp-subnav-links');
    var cur = links[current];
    if (box && cur && box.scrollWidth > box.clientWidth) {
      var l = cur.offsetLeft - box.offsetLeft;
      if (l < box.scrollLeft || l + cur.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = l - 12;
    }
  }
  window.addEventListener('scroll', spy, { passive: true });
  window.addEventListener('resize', spy);
  spy();
})();
