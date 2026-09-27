/* ============================================
   TAKGIO — Page motion (home, about, services, case studies)
   - Scroll reveals: only elements that start below the fold are hidden,
     so nothing above the fold flickers on load.
   - Count-ups for [data-count] numbers (final value is already in the HTML,
     so with JS off or reduced motion the page reads correctly).
   - Cursor spotlight on bento tiles (sets --mx / --my).
   ============================================ */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Case-study filter chips: <button data-filter="construction"> toggles cards by data-cat
  Array.prototype.forEach.call(document.querySelectorAll('.cs-filter'), function (bar) {
    var buttons = Array.prototype.slice.call(bar.querySelectorAll('[data-filter]'));
    var cards = Array.prototype.slice.call(document.querySelectorAll('[data-cat]'));
    buttons.forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.classList.contains('is-on') ? 'true' : 'false');
      btn.addEventListener('click', function () {
        var f = btn.getAttribute('data-filter');
        buttons.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        cards.forEach(function (c) {
          var show = f === 'all' || c.getAttribute('data-cat') === f;
          c.classList.toggle('is-hidden', !show);
          if (show) { c.classList.remove('pre'); c.classList.add('in'); }
        });
      });
    });
  });

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

  // Contact form: ?topic=invest (or a [data-topic] link) preselects "I'm interested in"
  var topic = document.getElementById('topic');
  if (topic) {
    var pick = function (v) {
      if (!v) return;
      for (var k = 0; k < topic.options.length; k++) if (topic.options[k].value === v) { topic.value = v; return; }
    };
    try { pick(new URLSearchParams(window.location.search).get('topic')); } catch (e) {}
    Array.prototype.forEach.call(document.querySelectorAll('[data-topic]'), function (a) {
      a.addEventListener('click', function () { pick(a.getAttribute('data-topic')); });
    });
  }

  // Article reading-progress bar
  var bar = document.querySelector('.read-progress span');
  if (bar) {
    var update = function () {
      var d = document.documentElement, max = d.scrollHeight - d.clientHeight;
      bar.style.width = (max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0) + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
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
