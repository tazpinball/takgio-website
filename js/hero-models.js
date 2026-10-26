/* Home hero graphic (v2.55): the model pictures inside the .hx cards, drawn as turning lattices (the style of the v2.48
   canvas graphic, which Ted preferred to icons). Each picture says what it is by its SHAPE (v2.55.4, Ted: the combined
   model must look like neither model, yet clearly both):
     - the general-purpose LLM: a round lattice, cool colours (blue, cyan, purple, silver);
     - the Takgio expert model: a four-pointed STAR lattice (the Takgio spark), warm colours (gold, amber, green);
     - each Takgio app: the COMBINED model, ~70% LLM / 30% expert: a small gold star at the heart of a broad band of the
       cool lattice, joined at its points.
   All turn slowly (the star and the combined model as one rigid piece); nodes light up and pass the light along their edges; satellites orbit. The expert model lights up
   when the CSS loop's pulse reaches it (1/3 of the 6 s cycle, .hx's --T) and each app as its pulse arrives (~3/4);
   the LLM lights up on its own. One canvas per card (canvas.hx-lat[data-lat="llm"|"core"|"app"]), each drawn in a
   150 x 110 design box. Paused off screen; reduced motion draws one still frame. */
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

  // the star's outline: a superellipse with an exponent under 1 (points on the axes, waist at 45 degrees ~ 18% out)
  var STAR_Q = .4;
  function starK(a) { var c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); return 1 / Math.pow(Math.pow(c, STAR_Q) + Math.pow(s, STAR_Q), 1 / STAR_Q); }

  // rings: [{ r, n, pal, star }]; the centre node takes the first ring's look; sats: the satellites' palettes; rigid: the
  // whole lattice turns as one piece (the combined model), else round rings counter-rotate and only stars turn rigidly
  function Lattice(cv, rings, sz, sats, rigid) {
    var ctx = cv.getContext('2d'), cx = DW / 2, cy = DH / 2, S = 1, T = 0;
    var L = { R: rings[rings.length - 1].r, nodes: [], edges: [], energy: 0 };
    var all = [{ r: 0, n: 1, pal: rings[0].pal, star: rings[0].star }].concat(rings);
    all.forEach(function (rg, ri) { for (var i = 0; i < rg.n; i++) L.nodes.push({ r: rg.r, a0: (i / rg.n) * 6.283 + ri * .35, e: 0, ri: ri, x: 0, y: 0, h: ((i / rg.n) * 360 + ri * 28) % 360, p: rg.pal, star: rg.star }); });
    // a star's four points are thin, so evenly spaced ring nodes leave them almost empty: a ray of nodes runs out along
    // each point to the star's tip, which is what makes the star read as a star (and reach the ring in the combined model)
    var starR = 0, starPal = null; rings.forEach(function (rg) { if (rg.star && rg.r > starR) { starR = rg.r; starPal = rg.pal; } });
    for (var ax = 0; starR && ax < 4; ax++) for (var d = 6; d <= starR + .1; d += 4.5) L.nodes.push({ r: d, a0: ax * 1.5708, e: 0, ri: 1, x: 0, y: 0, h: (ax * 90 + d * 4) % 360, p: starPal, star: true });
    var glowIn = rings[0].pal, glowOut = rings[rings.length - 1].pal;
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
    // a star (and a rigid lattice) turns as one piece, so its edges never stretch; round rings slide, alternate rings
    // turning opposite ways, as in the v2.48 graphic
    function place() {
      var spin = T * .05;
      for (var i = 0; i < L.nodes.length; i++) {
        var n = L.nodes[i], still = rigid || n.star, a = still ? n.a0 + spin : n.a0 + T * .04 * (n.ri % 2 ? 1 : -1);
        var rr = n.r * (1 + .02 * Math.sin(T * .6 + i)) * (n.star ? starK(n.a0) : 1);
        n.x = cx + Math.cos(a) * rr; n.y = cy + Math.sin(a) * rr * (still ? 1 : 1 + .02 * Math.cos(T * .5 + i));
      }
    }
    place();
    for (var i = 0; i < L.nodes.length; i++) {
      var ds = [];
      for (var j = 0; j < L.nodes.length; j++) if (j !== i) ds.push([Math.hypot(L.nodes[i].x - L.nodes[j].x, L.nodes[i].y - L.nodes[j].y), j]);
      ds.sort(function (a, b) { return a[0] - b[0]; });
      for (var k = 0; k < 3; k++) if (i < ds[k][1]) L.edges.push([i, ds[k][1]]);
    }
    var outer = L.nodes.filter(function (n) { return n.ri >= all.length - 3; });
    L.light = function (m) {
      for (var q = 0; q < (m || 1); q++) { outer[(Math.random() * outer.length) | 0].e = 1; var inner = L.nodes[(Math.random() * L.nodes.length) | 0]; inner.e = Math.max(inner.e, .6); }
    };
    L.resize = function () {
      var r = cv.getBoundingClientRect(), dpr = Math.min(2, global.devicePixelRatio || 1);
      cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr);
      S = Math.min(r.width / DW, r.height / DH); cx = (r.width / S) / 2; cy = (r.height / S) / 2;
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
      glow(glowOut.spr[0], cx, cy, (108 + 18 * enr) * k, .18 + .2 * enr); glow(glowIn.spr[glowIn === glowOut ? 1 : 0], cx, cy, 63 * k, .1 + .16 * enr);
      ctx.lineWidth = Math.max(.8, S * .9 * sz);
      for (var e = 0; e < L.edges.length; e++) {
        var A2 = L.nodes[L.edges[e][0]], B2 = L.nodes[L.edges[e][1]], ee = Math.max(A2.e, B2.e), eh = (A2.h + B2.h) / 2 + (Math.abs(A2.h - B2.h) > 180 ? 180 : 0) + T * 10;
        setAlpha(.3 + .55 * ee);
        if (A2.p !== B2.p) {          // where the two models meet: the edge runs from one model's colour into the other's
          var g = ctx.createLinearGradient(A2.x * S, A2.y * S, B2.x * S, B2.y * S);
          g.addColorStop(0, palRgb(A2.p, A2.h, .2 + .35 * ee)); g.addColorStop(1, palRgb(B2.p, B2.h, .2 + .35 * ee)); ctx.strokeStyle = g;
        } else ctx.strokeStyle = palRgb(A2.p, eh - T * 10, .1 + .35 * ee);
        ctx.beginPath(); ctx.moveTo(A2.x * S, A2.y * S); ctx.lineTo(B2.x * S, B2.y * S); ctx.stroke();
      }
      for (var nq = 0; nq < L.nodes.length; nq++) { var nd = L.nodes[nq]; glow(palSpr(nd.p, nd.h), nd.x, nd.y, (4 + 4 * nd.e) * sz, .55 + .4 * nd.e); glow(WHITE, nd.x, nd.y, (1.5 + 2.5 * nd.e) * sz, .4 + .5 * nd.e); }
      var ox = L.R + 14, oy = ox * .42;
      for (var s = 0; s < 3; s++) { var sp = sats[s % sats.length], sa = T * .55 + s * 2.094; glow(sp.spr[s], cx + Math.cos(sa) * ox, cy + Math.sin(sa) * oy, 7, .85); glow(WHITE, cx + Math.cos(sa) * ox, cy + Math.sin(sa) * oy, 2.4, .9); }
      setAlpha(1); ctx.globalCompositeOperation = 'source-over';
    };
    return L;
  }

  function boot() {
    var llmCv = document.querySelector('canvas.hx-lat[data-lat="llm"]'), coreCv = document.querySelector('canvas.hx-lat[data-lat="core"]');
    if (!llmCv || !coreCv || !llmCv.getContext) return;
    var appCvs = [].slice.call(document.querySelectorAll('canvas.hx-lat[data-lat="app"]'));
    function rings(radii, total, pal, star) {
      var sum = 0, left = total; radii.forEach(function (r) { sum += r; });
      return radii.map(function (r, i) { var n = i === radii.length - 1 ? left : Math.round(total * r / sum); left -= n; return { r: r, n: n, pal: pal, star: star }; });
    }
    // the general-purpose LLM: a round cool lattice
    var LLM = Lattice(llmCv, rings([5, 10, 15, 20, 26, 32, 38, 44], 130, COOL, false), .85, [COOL]);
    // the Takgio expert model: a gold four-pointed star (25% smaller than at first, Ted)
    var CORE = Lattice(coreCv, rings([9, 18, 27, 36], 92, WARM, true), .7, [WARM]);
    // each app: the combined model, about 70% LLM and 30% expert model (Ted, 26 Oct): a small gold star at the heart of
    // a broad band of the cool lattice, joined at its points
    var APPS = appCvs.map(function (cv) {
      return Lattice(cv, rings([5, 10, 15, 21], 50, WARM, true).concat(rings([26, 31, 36, 41, 46], 150, COOL, false)), .78, [COOL, WARM], true);
    });
    var every = [LLM, CORE].concat(APPS), cvs = [llmCv, coreCv].concat(appCvs);
    var raf = 0, last = 0, T = 0, visible = true, lastCycle = -1, nextLLM = 0, appCycle = APPS.map(function () { return -1; });
    function draw(t, dt) { every.forEach(function (l) { l.frame(t, dt); }); }
    function resize() { every.forEach(function (l) { l.resize(); }); if (reduce) draw(5, 0); }
    // the CSS loop and this one share the document clock, so the lattices light as the pulses arrive
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
    if (ro) cvs.forEach(function (cv) { ro.observe(cv); }); else global.addEventListener('resize', resize);
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
