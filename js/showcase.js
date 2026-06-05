/* ============================================
   TAKGIO — "The TAKGIO Advantage" animated showcase (homepage)
   Self-playing motion graphic: rotates proven results with count-up
   animation and staggers in the competitive comparison. No deps.
   Progressive enhancement: with JS off, the first slide + full
   comparison still render statically.
   ============================================ */
(function () {
  var root = document.querySelector('.advantage');
  if (!root) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js-anim');

  var slides = [
    { tag: 'Construction', cls: 'tag-construction', value: 60, suffix: '%',
      claim: 'Faster document processing',
      desc: 'Claude reads, classifies, and routes RFIs, submittals, and change orders — cutting review time by 60% and driving missed deadlines to near zero.' },
    { tag: 'Legal & Compliance', cls: 'tag-legal', value: 85, suffix: '%',
      claim: 'Faster contract review',
      desc: 'Initial review drops from hours to minutes — while surfacing 23% more risk issues than manual review alone.' },
    { tag: 'Construction', cls: 'tag-construction', value: 75, suffix: '%',
      claim: 'Fewer compliance gaps',
      desc: 'Real-time safety monitoring that scaled one contractor from 8 to 22 job sites with no added admin staff.' },
    { tag: 'Education', cls: 'tag-education', value: 3, suffix: '×',
      claim: 'More student engagement',
      desc: 'Genuinely personalized instruction at scale — at roughly one-tenth the cost of one-on-one support.' }
  ];

  var elTag    = root.querySelector('.adv-tag');
  var elNum     = root.querySelector('.adv-num');
  var elSuffix  = root.querySelector('.adv-suffix');
  var elClaim   = root.querySelector('.adv-claim');
  var elDesc    = root.querySelector('.adv-desc');
  var showcase  = root.querySelector('.adv-showcase');
  var dots      = Array.prototype.slice.call(root.querySelectorAll('.adv-dot'));

  var current = -1, timer = null, rafId = null;
  var INTERVAL = 4200, COUNT_MS = 900;

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function countTo(target, suffix) {
    if (rafId) cancelAnimationFrame(rafId);
    elSuffix.textContent = suffix;
    if (reduce) { elNum.textContent = target; return; }
    var small = target <= 10;
    var start = performance.now();
    function step(now) {
      var p = Math.min(1, (now - start) / COUNT_MS);
      var v = target * easeOutCubic(p);
      elNum.textContent = p < 1 ? (small ? Math.max(1, Math.round(v)) : Math.round(v)) : target;
      if (p < 1) rafId = requestAnimationFrame(step);
    }
    rafId = requestAnimationFrame(step);
  }

  function show(i) {
    current = (i + slides.length) % slides.length;
    var s = slides[current];
    if (!reduce) {
      showcase.classList.remove('is-swapping');
      void showcase.offsetWidth; /* restart swap animation */
      showcase.classList.add('is-swapping');
    }
    elTag.textContent = s.tag;
    elTag.className = 'tag adv-tag ' + s.cls;
    elClaim.textContent = s.claim;
    elDesc.textContent = s.desc;
    countTo(s.value, s.suffix);
    dots.forEach(function (d, di) {
      var on = di === current;
      d.classList.toggle('is-active', on);
      d.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function next() { show(current + 1); }
  function start() { if (!reduce && !timer) timer = setInterval(next, INTERVAL); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  dots.forEach(function (d, di) {
    d.addEventListener('click', function () { stop(); show(di); start(); });
  });
  showcase.addEventListener('mouseenter', stop);
  showcase.addEventListener('mouseleave', start);
  showcase.addEventListener('focusin', stop);
  showcase.addEventListener('focusout', start);

  var started = false;
  function activate() {
    if (started) return;
    started = true;
    root.classList.add('is-visible');
    show(0);
    start();
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { activate(); io.disconnect(); } });
    }, { threshold: 0.3 });
    io.observe(root);
  } else {
    activate();
  }
})();
