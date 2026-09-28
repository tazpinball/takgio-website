/* ============================================
   Takgio — logo spark intro (v2.28)
   0    - 0.25 s  the Takgio wordmark fades in at 4x in the middle of the screen
   0.25 s         its spark lifts off; the big logo stays until 0.5 s, then fades away
   0.25 - 1.875 s the spark spirals toward the header logo, accelerating the whole way: the loops tighten, the
                  spiral's centre is drawn to the logo, and at the end it is pulled straight in (a magnet capture)
   1.875 - 2.125 s it arrives at 3x the spark's size and snaps down to normal; a ring pulses
   2.125 - 5.375 s the header spark twinkles, a second softer ring pulses, and everything clears
   Plays once per visit (the first page opened), never for visitors who ask for reduced motion,
   and never blocks clicks. The header markup (.logo-spark) is what makes the spark movable.
   ============================================ */
(function () {
  var logo = document.querySelector('.site-header .logo');
  var spark = logo && logo.querySelector('.logo-spark');
  var wordmark = logo && logo.querySelector('img');
  if (!spark || !wordmark) return;

  var APPEAR = 250, LOGO_OUT = 500, FLIGHT = 1625, SNAP = 250, TWINKLE = 3250;
  var END = APPEAR + FLIGHT + SNAP + TWINKLE;   // 5.375 s
  function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  var UEXP = 1.3, ARRIVE_SCALE = 3;
  // Speed (Ted, 2026-09-28): relative to the approved 2.25-loop design, lift off at 2x its speed and reach 3.5x its
  // speed just before the capture. The path that gives this in 4 s is ~3.1x longer (more loops, sized per screen);
  // Ted then kept that path and flew it in 1.625 s ("double the speed", option A), so it runs 4/1.625 = 2.46x faster again.
  var REF_TURNS = 2.25, REF_PULL = .5, PULL = .3;
  // The first approved design's pace along its path: rate .16 + 1.932 t^1.3 (share of path per unit of flight time).
  // New pace = that x a multiplier rising from 2.1 at lift-off (Ted: "at least 2x") to 3.5 just before the capture (t = .92).
  function refRate(t) { return .16 + 1.932 * Math.pow(t, 1.3); }
  function multiplier(t) { return 2.1 + 1.4 * smooth(t / .92); }
  var FN = 400, SHARE = [0];                 // SHARE[i]: distance covered by time i/FN, in reference-path lengths
  for (var j = 0; j < FN; j++) {
    var ta = j / FN, tb = (j + 1) / FN;
    SHARE.push(SHARE[j] + (multiplier(ta) * refRate(ta) + multiplier(tb) * refRate(tb)) / 2 / FN);
  }
  var LENGTH_X = SHARE[FN];                  // so the new path is this many times the reference path's length
  function covered(t) {                      // share of the NEW path covered at time t (0..1)
    var x = t * FN, i = Math.min(FN - 1, Math.floor(x));
    return (SHARE[i] + (SHARE[i + 1] - SHARE[i]) * (x - i)) / LENGTH_X;
  }
  var PATH = 'M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z';
  function sparkSvg(id) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#4a6cf7"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient></defs>' +
      '<path fill="url(#' + id + ')" d="' + PATH + '"/></svg>';
  }
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function centre(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }

  var running = false;
  function play() {
    if (running) return;
    running = true;
    var start = performance.now();
    var layer = document.createElement('div');
    layer.className = 'sparkx';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<div class="sparkx-scrim"></div>' +
      '<div class="sparkx-logo"><img src="' + wordmark.getAttribute('src') + '" alt=""><span class="sparkx-spark">' + sparkSvg('sparkx-g1') + '</span></div>' +
      '<span class="sparkx-flyer">' + sparkSvg('sparkx-g2') + '</span>';
    document.body.appendChild(layer);
    var bigSpark = layer.querySelector('.sparkx-spark');
    var flyer = layer.querySelector('.sparkx-flyer');
    spark.classList.add('is-hidden');
    requestAnimationFrame(function () { layer.classList.add('is-in'); });
    setTimeout(launch, APPEAR);
    setTimeout(function () { layer.classList.remove('is-in'); layer.classList.add('is-out'); }, LOGO_OUT);

    // The path: loops around a centre that slides from the big logo to the header logo. Each loop's radius is a
    // fixed share of the distance still to go, so the spark is always being drawn in, and the loops come faster
    // as it closes (the closer, the faster it orbits). The last stretch is a straight pull onto the i.
    function spiral(from, to, TURNS, PULL) {
      var W = window.innerWidth, H = window.innerHeight, K = .8, N = 900;
      var rho = .45, d0, c0, r0;
      for (;;) {                                  // the first loop starts at its top, right where the big spark is
        var q = rho * K, a = from.x - to.x, b = from.y - to.y, A = 1 - q * q;
        d0 = (2 * b * q + Math.sqrt(4 * b * b * q * q + 4 * A * (a * a + b * b))) / (2 * A);
        c0 = { x: from.x, y: from.y + q * d0 }; r0 = rho * d0;
        if ((c0.y + r0 * K <= H - 24 && c0.x + r0 <= W - 20 && c0.x - r0 >= 20) || rho <= .18) break;
        rho -= .01;                               // shrink the loops until they fit the screen
      }
      var om = [], i;
      for (i = 0; i <= N; i++) { om.push(Math.pow(d0 / Math.max(d0 * (1 - Math.pow(i / N, UEXP)), 26), PULL)); }
      var cum = [0];
      for (i = 0; i < N; i++) cum.push(cum[i] + (om[i] + om[i + 1]) / 2 / N);
      var k = TURNS * Math.PI * 2 / cum[N], pts = [], len = [0];
      for (i = 0; i <= N; i++) {
        var t = i / N, u = Math.pow(t, UEXP);
        var cx = c0.x + (to.x - c0.x) * u, cy = c0.y + (to.y - c0.y) * u;
        var r = rho * Math.sqrt((cx - to.x) * (cx - to.x) + (cy - to.y) * (cy - to.y));
        var th = -Math.PI / 2 + cum[i] * k;
        var x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r * K;
        if (t > .92) { var s = Math.pow((t - .92) / .08, 3); x += (to.x - x) * s; y += (to.y - y) * s; }
        pts.push([x, y]);
        if (i) len.push(len[i - 1] + Math.sqrt(Math.pow(x - pts[i - 1][0], 2) + Math.pow(y - pts[i - 1][1], 2)));
      }
      return { pts: pts, len: len, total: len[N] };
    }
    function along(path, dist) {                  // the point at a given distance along the path
      var lo = 0, hi = path.len.length - 1;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (path.len[mid] < dist) lo = mid; else hi = mid; }
      var seg = path.len[hi] - path.len[lo] || 1, f = (dist - path.len[lo]) / seg;
      return [path.pts[lo][0] + (path.pts[hi][0] - path.pts[lo][0]) * f, path.pts[lo][1] + (path.pts[hi][1] - path.pts[lo][1]) * f];
    }

    function launch() {
      var from = centre(bigSpark), to = centre(spark);
      bigSpark.classList.add('is-hidden');
      // find the number of loops that makes the path LENGTH_X times the reference design's
      var want = spiral(from, to, REF_TURNS, REF_PULL).total * LENGTH_X, lo = REF_TURNS, hi = 20, path;
      for (var n = 0; n < 18; n++) {
        var mid = (lo + hi) / 2;
        path = spiral(from, to, mid, PULL);
        if (path.total < want) lo = mid; else hi = mid;
      }
      var startSize = from.w, peak = Math.max(startSize * 1.4, 40), end = to.w * ARRIVE_SCALE;
      var t0 = null, lastTrail = 0;              // lastTrail: path distance of the last trail dot
      flyer.style.opacity = '1';
      function frame(now) {
        if (t0 === null) t0 = now;
        var t = Math.min(1, (now - t0) / FLIGHT);
        // Share of the path covered: its rate only ever rises, so the spark keeps accelerating to the capture.
        var f = covered(t);
        var p = along(path, f * path.total), x = p[0], y = p[1];
        var size = t < .35 ? startSize + (peak - startSize) * smooth(t / .35)
                           : peak + (end - peak) * Math.pow((t - .35) / .65, 1.3);
        flyer.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + (size / 46) + ') rotate(' + (f * 2160) + 'deg)';
        if (t < .97) {                                            // trail: fill the ground covered since the last frame
          var travelled = f * path.total, stepPx = 14, dots = 0;
          for (var dist = Math.max(lastTrail, travelled - 8 * stepPx); dist + stepPx <= travelled && dots < 8; dist += stepPx, dots++) {
            var q2 = along(path, dist + stepPx), d = document.createElement('span');
            d.className = 'sparkx-trail';
            d.style.left = q2[0] + 'px'; d.style.top = q2[1] + 'px';
            d.style.transform = 'scale(' + (0.4 + size / 46 * .9) + ')';
            layer.appendChild(d);
            setTimeout(d.remove.bind(d), 750);
            lastTrail = dist + stepPx;
          }
        }
        if (t < 1) { requestAnimationFrame(frame); return; }
        land();
      }
      requestAnimationFrame(frame);
    }

    function land() {
      flyer.style.opacity = '0';
      spark.classList.remove('is-hidden');
      restart(spark, 'is-snapping');                              // 3x -> normal, 0.25 s
      restart(spark, 'is-pinging');
      setTimeout(function () {
        spark.classList.remove('is-snapping');
        restart(spark, 'is-settling');                            // twinkles until the end
      }, SNAP);
      setTimeout(function () { restart(spark, 'is-pinging'); }, SNAP + 900);   // a second, softer ring
      setTimeout(function () {
        spark.classList.remove('is-pinging', 'is-settling');
        layer.remove();
        running = false;
      }, Math.max(0, END - (performance.now() - start)));
    }
  }

  window.takgioSparkReplay = play;   // replay from the console (previews and testing)
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var force = window.TAKGIO_SPARK_FORCE === true;
  try {
    if (!force && sessionStorage.getItem('tg-spark-seen')) return;
    sessionStorage.setItem('tg-spark-seen', '1');
  } catch (e) { /* storage blocked: still play, just can't remember it */ }
  // Play once the page has loaded AND is on screen: a tab opened in the background waits until it is viewed,
  // instead of starting while the browser has animation paused.
  function whenVisible() {
    if (!document.hidden) { play(); return; }
    document.addEventListener('visibilitychange', function onShow() {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', onShow);
      play();
    });
  }
  if (document.readyState === 'complete') { whenVisible(); } else { window.addEventListener('load', whenVisible, { once: true }); }
})();
