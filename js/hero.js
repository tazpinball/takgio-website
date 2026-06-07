/* ============================================
   TAKGIO — Animated homepage hero
   Cycles the headline's last word through the industries we serve,
   shifting color + product line + background glow to match.
   Progressive enhancement: with JS off, the first industry shows statically
   and the subhead names all four.
   ============================================ */
(function () {
  var hero = document.getElementById('home-hero');
  if (!hero) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var slides = [
    { word: 'Construction',        color: '#f59e0b', product: 'Document intelligence that catches what gets missed.' },
    { word: 'Legal & Compliance',  color: '#a78bfa', product: 'Contract analysis in minutes, not hours.' },
    { word: 'Education',           color: '#2dd4bf', product: 'Personalized learning that adapts to every student.' },
    { word: 'Entertainment',       color: '#f472b6', product: 'Pinball Fantasy — AI-projected fantasy sports for the pinball circuit.' }
  ];

  var word = document.getElementById('hero-rotator');
  var product = document.getElementById('hero-product');
  var dots = Array.prototype.slice.call(hero.querySelectorAll('.hero-dot'));

  var i = -1, timer = null;

  function show(n) {
    i = (n + slides.length) % slides.length;
    var s = slides[i];
    hero.style.setProperty('--hero-accent', s.color);
    word.textContent = s.word;
    product.textContent = s.product;
    dots.forEach(function (d, di) {
      var on = di === i;
      d.classList.toggle('is-active', on);
      d.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (!reduce) {
      [word, product].forEach(function (el) {
        el.classList.remove('is-swap');
        void el.offsetWidth; /* restart animation */
        el.classList.add('is-swap');
      });
    }
  }

  function next() { show(i + 1); }
  function start() { if (!reduce && !timer) timer = setInterval(next, 2800); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  dots.forEach(function (d, di) {
    d.addEventListener('click', function () { stop(); show(di); start(); });
  });
  hero.addEventListener('mouseenter', stop);
  hero.addEventListener('mouseleave', start);
  hero.addEventListener('focusin', stop);
  hero.addEventListener('focusout', start);

  show(0);
  start();
})();
