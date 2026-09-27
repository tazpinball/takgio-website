/* ============================================
   TAKGIO — Home page motion (v2.19)
   - Scroll reveals: only elements that start below the fold are hidden,
     so nothing above the fold flickers on load.
   - Count-ups for [data-count] numbers (final value is already in the HTML,
     so with JS off or reduced motion the page reads correctly).
   - Cursor spotlight on bento tiles (sets --mx / --my).
   ============================================ */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function format(n, decimals) {
    return decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString('en-US');
  }

  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var final = prefix + format(target, decimals) + suffix;
    if (reduce || isNaN(target)) { el.textContent = final; return; }
    var start = performance.now(), dur = 1400;
    function step(now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? prefix + format(target * eased, decimals) + suffix : final;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var counters = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  if (!('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
    return;
  }

  var vh = window.innerHeight || document.documentElement.clientHeight;
  reveals.forEach(function (el) {
    if (el.getBoundingClientRect().top > vh * 0.9 && !reduce) el.classList.add('pre');
    else el.classList.add('in');
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      if (el.classList.contains('reveal')) { el.classList.remove('pre'); el.classList.add('in'); }
      if (el.hasAttribute('data-count')) countUp(el);
      io.unobserve(el);
    });
  }, { threshold: 0.2 });

  reveals.forEach(function (el) { if (el.classList.contains('pre')) io.observe(el); });
  counters.forEach(function (el) { io.observe(el); });

  // Belt and braces: a plain scroll/resize sweep, so content can never stay
  // hidden if IntersectionObserver callbacks are delayed or throttled.
  function sweep() {
    var h = window.innerHeight || document.documentElement.clientHeight;
    reveals.forEach(function (el) {
      if (el.classList.contains('pre') && el.getBoundingClientRect().top < h * 0.95) {
        el.classList.remove('pre'); el.classList.add('in'); io.unobserve(el);
      }
    });
  }
  window.addEventListener('scroll', sweep, { passive: true });
  window.addEventListener('resize', sweep);
  window.addEventListener('load', sweep);

  // Cursor spotlight on tiles
  if (!reduce) {
    Array.prototype.forEach.call(document.querySelectorAll('.tile'), function (tile) {
      tile.addEventListener('pointermove', function (ev) {
        var r = tile.getBoundingClientRect();
        tile.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
        tile.style.setProperty('--my', (ev.clientY - r.top) + 'px');
      });
    });
  }
})();
