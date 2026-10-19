/* Home hero card reel (v2.42). The motion itself is a CSS animation (css/styles.css, rl-rise); this file only
   fits each card's duration to the reel's real height so every card keeps its own px/s speed, and pauses the
   reel while it is off-screen. Loaded by index.html only. */
(function () {
  var reel = document.querySelector('.h-reel');
  if (!reel || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cards = [].slice.call(reel.querySelectorAll('.rl-card'));
  var speed = parseFloat(reel.dataset.speed || '1');
  // keep every card at its own px/s speed whatever the reel's size: duration = distance / speed
  function fit() {
    var H = reel.clientHeight, gap = parseFloat(getComputedStyle(reel).getPropertyValue('--gap')) || 70;
    if (!H) return;
    reel.style.setProperty('--H', H + 'px');
    cards.forEach(function (c) {
      var d = (H + c.offsetHeight + 2 * gap) / (parseFloat(c.dataset.v) * speed);
      c.style.setProperty('--d', d.toFixed(2) + 's');
      c.style.setProperty('--delay', (-parseFloat(c.dataset.f) * d).toFixed(2) + 's');
    });
  }
  fit();
  var w = reel.clientWidth, t = 0;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () { if (Math.abs(reel.clientWidth - w) > 40) { w = reel.clientWidth; fit(); } }, 200);
  });
  // pause while off-screen
  if (window.IntersectionObserver) new IntersectionObserver(function (es) {
    reel.classList.toggle('rl-paused', !es[0].isIntersecting);
  }).observe(reel);
})();
