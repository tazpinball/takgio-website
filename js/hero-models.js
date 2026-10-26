/* Home hero graphic (v2.55.2): the two model pictures inside the .hx cards, kept from the v2.48 canvas graphic at Ted's
   request (Oct 26: "I prefer the graphic we have on the site now"). The general-purpose LLM is the big cool lattice
   (blue, cyan, purple, silver); the Takgio expert model is the smaller warm one (gold, amber, green). Both turn slowly,
   nodes light up and pass the light along their edges, and three satellites orbit each. The expert model lights up
   when the CSS cycle's pulse reaches it (1/3 of the way through the 6 s loop, .hx's --T); the LLM lights up on its own.
   Each Takgio app shows the COMBINED model (v2.55.3): the gold expert lattice at the heart of the cool LLM lattice,
   lighting up as the pulse reaches that app.
   One canvas per card (canvas.hx-lat[data-lat="llm"|"core"]); each draws in a 150 x 110 design box. Paused off screen;
   reduced motion draws one still frame. */
(function (global) {
  var DW = 150, DH = 110, CYCLE = 6000, ARRIVE = .33, APP_ARRIVE = .72;
  var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function sprite(rgb, size) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(' + rgb + ',1)'); g.addColorStop(.3, 'rgba(' + rgb + ',.45)'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
  }
  function palette(cols) { return { cols: cols, spr: cols.map(function (c) { return sprite(c.join(','), 48); }) }; }
  var WARM = palette([[255, 196, 55], [255, 160, 30], [255, 232, 80], [255, 122, 45], [122, 196, 82]]);   // gold, amber, yellow, warm orange, organic green
  var COOL = palette([[35, 110, 255], [30, 225, 255], [185, 75, 255], [205, 214, 230]]);                 // electric blue, cyan, neon purple, silver
  var WHITE = sprite('255,255,255', 32);

  // pal is one palette, or { inner, outer, split }: rings below `split` take the inner palette (the combined model:
  // the warm expert model at the heart of the cool LLM)
  function Lattice(cv, radii, total, sz, pal) {
    var mix = pal.inner ? pal : null, base = mix ? mix.outer : pal;
    var ctx = cv.getContext('2d'), cx = DW / 2, cy = DH / 2, S = 1, T = 0;
    var L = { R: radii[radii.length - 1], nodes: [], edges: [], energy: 0 }, rings = [[0, 1]], sum = 0, left = total;
    radii.forEach(function (r) { sum += r; });
    radii.forEach(function (r, i) { var n = i === radii.length - 1 ? left : Math.round(total * r / sum); rings.push([r, n]); left -= n; });
    rings.forEach(function (r, ri) { for (var i = 0; i < r[1]; i++) L.nodes.push({ r: r[0], a0: (i / r[1]) * 6.283 + ri * .35, e: 0, ri: ri, x: 0, y: 0, h: ((i / r[1]) * 360 + ri * 28) % 360, p: mix && ri < mix.split ? mix.inner : base }); });
    function palPos(p, h) { var n = p.cols.length; return (((h / 360) * n + T * .06) % n + n) % n; }
    function palRgb(p, h, white) {
      var f = palPos(p, h), i = Math.floor(f), t = f - i, a = p.cols[i], b = p.cols[(i + 1) % p.cols.length], w = white || 0, o = [];
      for (var c = 0; c < 3; c++) { var v = a[c] + (b[c] - a[c]) * t; o.push(Math.round(v + (255 - v) * w)); }
      return 'rgb(' + o.join(',') + ')';
    }
    function palSpr(p, h) { return p.spr[Math.round(palPos(p, h)) % p.spr.length]; }
    // a canvas silently IGNORES an opacity outside 0..1 and keeps the previous one, so every opacity goes through here
    function setAlpha(a) { ctx.globalAlpha = a < 0 ? 0 : a > 1 ? 1 : a; }
    function glow(spr, x, y, r, a) { setAlpha(a); ctx.drawImage(spr, (x - r) * S, (y - r) * S, 2 * r * S, 2 * r * S); }
    function place() {
      for (var i = 0; i < L.nodes.length; i++) {
        var n = L.nodes[i], dir = n.ri % 2 ? 1 : -1, a = n.a0 + T * .04 * dir;
        n.x = cx + Math.cos(a) * n.r * (1 + .02 * Math.sin(T * .6 + i)); n.y = cy + Math.sin(a) * n.r * (1 + .02 * Math.cos(T * .5 + i));
      }
    }
    place();
    for (var i = 0; i < L.nodes.length; i++) {
      var ds = [];
      for (var j = 0; j < L.nodes.length; j++) if (j !== i) ds.push([Math.hypot(L.nodes[i].x - L.nodes[j].x, L.nodes[i].y - L.nodes[j].y), j]);
      ds.sort(function (a, b) { return a[0] - b[0]; });
      for (var k = 0; k < 3; k++) if (i < ds[k][1]) L.edges.push([i, ds[k][1]]);
    }
    var outer = L.nodes.filter(function (n) { return n.ri >= rings.length - 4; });
    L.light = function (m) {
      for (var q = 0; q < (m || 1); q++) { outer[(Math.random() * outer.length) | 0].e = 1; var inner = L.nodes[(Math.random() * L.nodes.length) | 0]; inner.e = Math.max(inner.e, .6); }
    };
    L.resize = function () {
      var r = cv.getBoundingClientRect(), dpr = Math.min(2, global.devicePixelRatio || 1);
      cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr);
      S = Math.min(r.width / DW, r.height / DH); cx = (r.width / S) / 2; cy = DH / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    L.frame = function (t, dt) {
      T = t;
      place();
      var en = 0; for (var i = 0; i < L.nodes.length; i++) { L.nodes[i].e *= Math.pow(.25, dt); en += L.nodes[i].e; } L.energy = Math.min(1, en / (L.nodes.length / 13));
      for (var le = 0; le < L.edges.length; le++) { var A = L.nodes[L.edges[le][0]], B = L.nodes[L.edges[le][1]]; if (A.e > .6 && B.e < A.e - .2) B.e += (A.e - B.e) * dt * 3; else if (B.e > .6 && A.e < B.e - .2) A.e += (B.e - A.e) * dt * 3; }
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
      var k = L.R / 61, enr = L.energy;
      glow(base.spr[0], cx, cy, (108 + 18 * enr) * k, .18 + .2 * enr); glow((mix ? mix.inner : base).spr[mix ? 0 : 1], cx, cy, 63 * k, .1 + .16 * enr);
      ctx.lineWidth = Math.max(.8, S * .9 * sz);
      for (var e = 0; e < L.edges.length; e++) {
        var A2 = L.nodes[L.edges[e][0]], B2 = L.nodes[L.edges[e][1]], ee = Math.max(A2.e, B2.e), eh = (A2.h + B2.h) / 2 + (Math.abs(A2.h - B2.h) > 180 ? 180 : 0) + T * 10;
        setAlpha(.3 + .55 * ee); ctx.strokeStyle = palRgb(A2.p, eh - T * 10, .1 + .35 * ee);
        ctx.beginPath(); ctx.moveTo(A2.x * S, A2.y * S); ctx.lineTo(B2.x * S, B2.y * S); ctx.stroke();
      }
      for (var nq = 0; nq < L.nodes.length; nq++) { var nd = L.nodes[nq]; glow(palSpr(nd.p, nd.h), nd.x, nd.y, (4 + 4 * nd.e) * sz, .55 + .4 * nd.e); glow(WHITE, nd.x, nd.y, (1.5 + 2.5 * nd.e) * sz, .4 + .5 * nd.e); }
      var ox = L.R + 16, oy = ox * .42;
      for (var s = 0; s < 3; s++) { var sa = T * .55 + s * 2.094; glow((mix && s === 1 ? mix.inner : base).spr[s], cx + Math.cos(sa) * ox, cy + Math.sin(sa) * oy, 7, .85); glow(WHITE, cx + Math.cos(sa) * ox, cy + Math.sin(sa) * oy, 2.4, .9); }
      setAlpha(1); ctx.globalCompositeOperation = 'source-over';
    };
    return L;
  }

  function boot() {
    var llmCv = document.querySelector('canvas.hx-lat[data-lat="llm"]'), coreCv = document.querySelector('canvas.hx-lat[data-lat="core"]');
    if (!llmCv || !coreCv || !llmCv.getContext) return;
    var LLM = Lattice(llmCv, [5, 10, 15, 20, 26, 32, 38, 44], 130, .85, COOL);   // the general-purpose LLM: the big lattice
    var CORE = Lattice(coreCv, [6.7, 13.3, 20, 26.7], 80, .7, WARM);             // the Takgio expert model: the smaller one
    // each app: the COMBINED model, the gold expert lattice at the heart of the cool LLM lattice (v2.55.3, Ted's idea)
    var APPS = [].slice.call(document.querySelectorAll('canvas.hx-lat[data-lat="app"]')).map(function (cv) {
      return Lattice(cv, [5, 10, 15, 21, 28, 35, 42], 110, .8, { inner: WARM, outer: COOL, split: 5 });
    });
    var both = [LLM, CORE].concat(APPS), raf = 0, last = 0, T = 0, visible = true, lastCycle = -1, nextLLM = 0, appCycle = [-1, -1, -1];
    function resize() { both.forEach(function (l) { l.resize(); }); if (reduce) draw(5, 0); }
    function draw(t, dt) { both.forEach(function (l) { l.frame(t, dt); }); }
    // the CSS loop and this one share the document clock, so the warm lattice lights as the pulse arrives
    function clock() { return (document.timeline && document.timeline.currentTime != null) ? document.timeline.currentTime : performance.now(); }
    function frame(now) {
      raf = 0;
      var dt = Math.min(.05, (now - last) / 1000 || .016); last = now; T += dt;
      var c = clock(), cyc = Math.floor(c / CYCLE), ph = (c % CYCLE) / CYCLE;
      if (cyc !== lastCycle && ph >= ARRIVE) { lastCycle = cyc; CORE.light(4); LLM.light(1); }
      APPS.forEach(function (A, i) { if (appCycle[i] !== cyc && ph >= APP_ARRIVE + i * .025) { appCycle[i] = cyc; A.light(4); } });
      if (T >= nextLLM) { LLM.light(1); nextLLM = T + 1.1 + Math.random() * 1.2; }
      draw(T, dt);
      if (visible) raf = requestAnimationFrame(frame);
    }
    var ro = global.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) { ro.observe(llmCv); ro.observe(coreCv); } else global.addEventListener('resize', resize);
    resize();
    if (reduce) return;
    var io = global.IntersectionObserver ? new IntersectionObserver(function (es) {
      visible = es.some(function (e) { return e.isIntersecting; });
      if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }) : null;
    if (io) io.observe(llmCv.closest('.hx') || llmCv);
    raf = requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
