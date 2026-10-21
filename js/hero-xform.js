/* Home hero graphic "Human expertise into AI products" (canvas), v12. Story, left to right: three heads in a column, each a man
   with a glowing brain facing the AI model (Ted's picture, flipped; human expertise), send Word, Excel, CAD and
   PowerPoint documents in orderly streams into the AI models (a turning lattice that stands for Claude
   or a model like it); and that flows into three glass figures facing left (Ted's picture, flipped), one per app
   (ConcreteIQ, Brickture, BuyersGuide), which brighten as the knowledge arrives and talk to each other.
   Design space 660 x 560, scaled to the container. Prefix xc- / xform. */
(function (global) {
  var DW = 660, DH = 560;
  function bez(p, u) {
    var a = 1 - u, b = a * a * a, c = 3 * a * a * u, d = 3 * a * u * u, e = u * u * u;
    return [b * p[0][0] + c * p[1][0] + d * p[2][0] + e * p[3][0], b * p[0][1] + c * p[1][1] + d * p[2][1] + e * p[3][1]];
  }
  function sprite(rgb, size) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(' + rgb + ',1)'); g.addColorStop(.3, 'rgba(' + rgb + ',.45)'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
  }
  // three glass figures (picture 524 x 694), one per app, staggered top left / middle right / bottom left like the brains
  var FW = 131, FK = FW / 524, FH = 694 * FK; // v11: 25% larger than v10
  var FIGS = [{ x: 380, y: 50 }, { x: 522, y: 185 }, { x: 380, y: 320 }];
  function F(f, x, y) { return [f.x + x * FK, f.y + y * FK]; }
  FIGS.forEach(function (f) { f.E = F(f, 120, 150); f.B = F(f, 285, 140); f.glow = 0; f.rip = []; }); // E: where knowledge enters, B: the brain

  // a document as a small picture, drawn once at 4x: a Word page, an Excel sheet, a PowerPoint slide or a CAD blueprint
  var DOC_R = 4, DOC_PAD = 5;
  function rr(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
  function badge(x, X, Y, W, H, col, letter) {
    rr(x, X, Y, W, H, 1.4); x.fillStyle = col; x.fill();
    x.fillStyle = '#fff'; x.font = 'bold ' + (H * .78) + 'px "Segoe UI", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(letter, X + W / 2, Y + H / 2 + .3);
  }
  // the other things an expert knows from: music (a pair of beamed notes) and conversations (two speech bubbles)
  function makeIcon(kind) {
    var music = kind === 'music', w = music ? 18 : 26, h = music ? 20 : 20, R = DOC_R, P = DOC_PAD;
    var c = document.createElement('canvas'); c.width = (w + 2 * P) * R; c.height = (h + 2 * P) * R;
    var x = c.getContext('2d'); x.scale(R, R); x.translate(P, P);
    if (music) {
      var g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ffd166'); g.addColorStop(1, '#ff7ab6');
      x.fillStyle = g; x.strokeStyle = g; x.shadowColor = 'rgba(255,170,150,.9)'; x.shadowBlur = 3 * R;
      [[4.2, 16.4], [14, 14.2]].forEach(function (n) { x.save(); x.translate(n[0], n[1]); x.rotate(-.45); x.beginPath(); x.ellipse(0, 0, 3.4, 2.4, 0, 0, 6.283); x.fill(); x.restore(); });
      x.lineWidth = 1.3; x.beginPath(); x.moveTo(7.2, 15.6); x.lineTo(7.2, 3.2); x.moveTo(17, 13.4); x.lineTo(17, 1); x.stroke();
      x.beginPath(); x.moveTo(6.55, 1.9); x.lineTo(17.65, -.3); x.lineTo(17.65, 2.6); x.lineTo(6.55, 4.8); x.closePath(); x.fill();
    } else {
      x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 3 * R; x.shadowOffsetY = R;
      rr(x, 0, 0, 17, 11.5, 3); x.fillStyle = '#5b8cff'; x.fill();                        // the first speaker
      x.beginPath(); x.moveTo(3, 11); x.lineTo(2.2, 15); x.lineTo(7, 11); x.closePath(); x.fill();
      x.shadowColor = 'transparent'; x.fillStyle = '#fff'; [5, 8.5, 12].forEach(function (dx) { x.beginPath(); x.arc(dx, 5.8, 1.05, 0, 6.283); x.fill(); });
      x.shadowColor = 'rgba(0,0,0,.45)';
      rr(x, 8.5, 7, 17.5, 11, 3); x.fillStyle = '#fbfcfe'; x.fill();                      // the reply
      x.beginPath(); x.moveTo(22.5, 17.5); x.lineTo(24.2, 21); x.lineTo(19, 17.5); x.closePath(); x.fill();
      x.shadowColor = 'transparent'; x.fillStyle = '#7b8496'; x.fillRect(11.5, 10.3, 11.5, .9); x.fillRect(11.5, 13, 8, .9);
    }
    return { c: c, w: w + 2 * P, h: h + 2 * P };
  }
  function makeDoc(kind) {
    if (kind === 'music' || kind === 'chat') return makeIcon(kind);
    var land = kind === 'ppt' || kind === 'cad', w = land ? 30 : 22, h = land ? 21 : 28, R = DOC_R, P = DOC_PAD;
    var c = document.createElement('canvas'); c.width = (w + 2 * P) * R; c.height = (h + 2 * P) * R;
    var x = c.getContext('2d'); x.scale(R, R); x.translate(P, P);
    x.beginPath(); if (land) x.rect(0, 0, w, h); else { x.moveTo(0, 0); x.lineTo(w - 6, 0); x.lineTo(w, 6); x.lineTo(w, h); x.lineTo(0, h); x.closePath(); }
    x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 3 * R; x.shadowOffsetY = R;
    x.fillStyle = kind === 'cad' ? '#173c82' : '#fbfcfe'; x.fill();
    x.shadowColor = 'transparent'; x.lineWidth = .3; x.strokeStyle = kind === 'cad' ? 'rgba(160,200,255,.6)' : 'rgba(0,0,0,.14)'; x.stroke();
    if (!land) { x.beginPath(); x.moveTo(w - 6, 0); x.lineTo(w - 6, 6); x.lineTo(w, 6); x.closePath(); x.fillStyle = '#d7dce6'; x.fill(); }
    var i;
    if (kind === 'word') {
      x.fillStyle = '#2b579a'; x.fillRect(3, 4, 11, 1.7);
      x.fillStyle = '#9aa3b2'; var ww = [15, 16, 14.5, 9, 0, 16, 15.5, 12];
      for (i = 0; i < ww.length; i++) if (ww[i]) x.fillRect(3, 8 + i * 1.9, ww[i], .75);
      for (i = 0; i < 3; i++) x.fillRect(13.5, 20 + i * 1.9, i === 2 ? 4 : 5.5, .75);
      badge(x, 2.5, 18.5, 9, 7.5, '#2b579a', 'W');
    } else if (kind === 'excel') {
      x.fillStyle = '#dff0e5'; x.fillRect(2.5, 3.5, w - 5, 2.4);
      x.strokeStyle = '#9fcbb0'; x.lineWidth = .3; x.beginPath();
      for (i = 0; i <= 4; i++) { x.moveTo(2.5 + i * 4.25, 3.5); x.lineTo(2.5 + i * 4.25, 15.5); }
      for (i = 0; i <= 5; i++) { x.moveTo(2.5, 3.5 + i * 2.4); x.lineTo(w - 2.5, 3.5 + i * 2.4); }
      x.stroke(); x.fillStyle = '#4b5d52';
      for (var r = 1; r < 5; r++) for (var cI = 0; cI < 4; cI++) if ((r + cI) % 3) x.fillRect(3.3 + cI * 4.25, 4.6 + r * 2.4, 1.6 + ((r * 3 + cI) % 3) * .6, .6);
      badge(x, 2.5, 18.5, 9, 7.5, '#217346', 'X');
      x.fillStyle = '#217346'; x.fillRect(13.5, 23, 1.3, 2.5); x.fillRect(15.5, 21.2, 1.3, 4.3); x.fillRect(17.5, 22.2, 1.3, 3.3);
    } else if (kind === 'ppt') {
      x.fillStyle = '#d24726'; x.fillRect(0, 0, w, 4.4);
      x.fillStyle = 'rgba(255,255,255,.95)'; x.fillRect(2.5, 1.5, 12, 1.4);
      var bars = [4, 6.5, 5, 8.5], cols = ['#d24726', '#f0a30a', '#8a8f99', '#d24726'];
      for (i = 0; i < 4; i++) { x.fillStyle = cols[i]; x.fillRect(3 + i * 3, 16 - bars[i], 2.1, bars[i]); }
      x.fillStyle = '#c4c8d0'; x.fillRect(2.5, 16, 12.5, .35);
      var pc = [20.5, 10.3], pr = 3.8, ang = [0, 2.6, 4.4, 6.283], pcol = ['#d24726', '#f0a30a', '#8a8f99'];
      for (i = 0; i < 3; i++) { x.beginPath(); x.moveTo(pc[0], pc[1]); x.arc(pc[0], pc[1], pr, ang[i] - 1.57, ang[i + 1] - 1.57); x.closePath(); x.fillStyle = pcol[i]; x.fill(); }
      badge(x, w - 9, h - 6.8, 7.2, 5.6, '#d24726', 'P');
    } else { // cad: a blueprint floor plan with a title block
      x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = .2; x.beginPath();
      for (i = 2.5; i < w; i += 2.5) { x.moveTo(i, 0); x.lineTo(i, h); } for (i = 2.5; i < h; i += 2.5) { x.moveTo(0, i); x.lineTo(w, i); } x.stroke();
      x.strokeStyle = '#dbe8ff'; x.lineWidth = .7; x.strokeRect(3, 3, 17, 12.5);
      x.lineWidth = .45; x.beginPath(); x.moveTo(11, 3); x.lineTo(11, 9.5); x.moveTo(3, 9.5); x.lineTo(7.5, 9.5); x.moveTo(11, 11.5); x.lineTo(20, 11.5); x.moveTo(15, 3); x.lineTo(15, 7); x.stroke();
      x.lineWidth = .3; x.beginPath(); x.moveTo(7.5, 9.5); x.arc(7.5, 9.5, 3.2, -1.57, 0); x.moveTo(11, 9.5); x.lineTo(11, 11.5); x.stroke();
      x.strokeStyle = '#8fb6ff'; x.lineWidth = .25; x.beginPath(); x.moveTo(3, 17.6); x.lineTo(20, 17.6); x.moveTo(3, 16.8); x.lineTo(3, 18.4); x.moveTo(20, 16.8); x.lineTo(20, 18.4); x.moveTo(21.6, 3); x.lineTo(21.6, 15.5); x.stroke();
      x.beginPath(); x.arc(25.3, 6, 2.4, 0, 6.283); x.moveTo(22.3, 6); x.lineTo(28.3, 6); x.moveTo(25.3, 3); x.lineTo(25.3, 9); x.stroke();
      x.strokeStyle = '#dbe8ff'; x.lineWidth = .3; x.strokeRect(22.6, 12.4, 6, 6.8); x.beginPath(); x.moveTo(22.6, 14.6); x.lineTo(28.6, 14.6); x.moveTo(22.6, 16.8); x.lineTo(28.6, 16.8); x.stroke();
    }
    return { c: c, w: w + 2 * P, h: h + 2 * P };
  }

  function start(root) {
    var cv = root.querySelector('canvas'), ctx = cv.getContext('2d'), fig = root.querySelector('img.xc-fig'), man = root.querySelector('img.xc-man');
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var S = 1, raf = 0, last = 0, T = 0, alive = true, visible = true, ready = false; // ready: everything below is set up, so a still frame may be drawn
    var HUE_SPR = []; for (var hs = 0; hs < 12; hs++) { var hc = document.createElement('canvas').getContext('2d'); hc.fillStyle = 'hsl(' + hs * 30 + ',100%,62%)'; hc.fillRect(0, 0, 1, 1); var hd = hc.getImageData(0, 0, 1, 1).data; HUE_SPR.push(sprite(hd[0] + ',' + hd[1] + ',' + hd[2], 48)); }
    function hueSpr(h) { return HUE_SPR[Math.round((((h % 360) + 360) % 360) / 30) % 12]; }
    var spTeal = sprite('110,231,214', 64), spBlue = sprite('140,170,255', 64), spWhite = sprite('255,255,255', 64), spPeach = sprite('255,190,150', 64), spViolet = sprite('190,160,255', 64), spSky = sprite('120,190,255', 64);

    // human expertise: Ted's picture of a man's head and brain (cut out at mid-neck, flipped to face the AI model),
    // three times in a column; picture 880 x 940, drawn 140 design px tall
    var HK = 119 / 940, HW = 880 * HK, HH = 119; // v11: 15% smaller than v10, same centres
    var BRAINS = [{ x: 16, y: 90 }, { x: 16, y: 240 }, { x: 16, y: 390 }];
    BRAINS.forEach(function (b) { b.e = 0; b.out = [b.x + 700 * HK, b.y + 240 * HK]; b.gb = [b.x + 420 * HK, b.y + 250 * HK]; });

    // documents flow out of each brain, along its stream, into the AI model: one speed, evenly spaced, varied type and size
    var KINDS = ['word', 'music', 'excel', 'chat', 'cad', 'ppt'], DOCS = {}; KINDS.forEach(function (k) { DOCS[k] = makeDoc(k); });
    var SPEED = 68, GAP = 46; // design px per second, design px between documents
    var streams = [];

    // AI models: a slowly turning lattice with three small orbiting models
    // v8: 10% smaller than v7 (outer ring 61 vs 68) with twice the dots (186 vs 93) in eleven rings, so about twice the
    // connections; each ring's count follows its circumference
    var LR = 61, LC = [290, 300], rings = [[0, 1]], nodes = [], edges = [];
    (function () { var radii = [6, 12, 18, 24, 30, 36, 42, 48, 55, 61], sum = 0, left = 185; radii.forEach(function (r) { sum += r; });
      radii.forEach(function (r, i) { var n = i === radii.length - 1 ? left : Math.round(185 * r / sum); rings.push([r, n]); left -= n; }); })();
    rings.forEach(function (r, ri) { for (var i = 0; i < r[1]; i++) nodes.push({ r: r[0], a0: (i / r[1]) * 6.283 + ri * .35, e: 0, ri: ri, x: 0, y: 0, h: ((i / r[1]) * 360 + ri * 28) % 360 }); });
    function placeNodes() {
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i], dir = n.ri % 2 ? 1 : -1, a = n.a0 + T * .04 * dir;
        n.x = LC[0] + Math.cos(a) * n.r * (1 + .02 * Math.sin(T * .6 + i)); n.y = LC[1] + Math.sin(a) * n.r * (1 + .02 * Math.cos(T * .5 + i));
      }
    }
    placeNodes();
    for (var i = 0; i < nodes.length; i++) {
      var ds = [];
      for (var j = 0; j < nodes.length; j++) if (j !== i) ds.push([Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y), j]);
      ds.sort(function (a, b) { return a[0] - b[0]; });
      for (var k = 0; k < 3; k++) if (i < ds[k][1]) edges.push([i, ds[k][1]]);
    }
    var outerN = nodes.filter(function (n) { return n.ri >= 7; });

    // each app's own model: sparks sampled from the bright parts of the figure, which flash as knowledge arrives
    var sparks = [], figReady = false;
    function figLoaded() {
      figReady = true;
      try {
        var oc = document.createElement('canvas'); oc.width = 131; oc.height = 174; var ox = oc.getContext('2d'); ox.drawImage(fig, 0, 0, 131, 174);
        var px = ox.getImageData(0, 0, 131, 174).data;
        for (var t = 0; t < 4000 && sparks.length < 40; t++) {
          var sx = (Math.random() * 131) | 0, sy = (Math.random() * 150) | 0, o = (sy * 131 + sx) * 4;
          if (px[o] + px[o + 1] + px[o + 2] > 330) sparks.push({ x: sx * 4, y: sy * 4, e: 0, ph: Math.random() * 6.283, d: 0 });
        }
        sparks.forEach(function (s) { s.d = Math.hypot(s.x - 120, s.y - 150); }); // distance from the entry point, for a ripple
      } catch (err) { /* a picture that cannot be read just goes without sparks */ }
      if (reduce && ready) frame(performance.now());
    }
    if (fig) { if (fig.complete && fig.naturalWidth) figLoaded(); else fig.addEventListener('load', figLoaded); }
    var manReady = false;
    function manLoaded() { manReady = true; if (reduce && ready) frame(performance.now()); }
    if (man) { if (man.complete && man.naturalWidth) manLoaded(); else man.addEventListener('load', manLoaded); }

    // flows: each brain into the lattice, the lattice into each figure
    BRAINS.forEach(function (b, si) {
      var k = b.out, ey = LC[1] + (k[1] - LC[1]) * .3, ex = LC[0] - Math.sqrt(LR * LR - (ey - LC[1]) * (ey - LC[1])) + 12;
      b.P1 = [k, [k[0] + 50, k[1]], [ex - 60, ey], [ex, ey]];
      var len = 0, pv = b.P1[0]; for (var t = 1; t <= 40; t++) { var pt = bez(b.P1, t / 40); len += Math.hypot(pt[0] - pv[0], pt[1] - pv[1]); pv = pt; }
      var n = Math.max(2, Math.round(len / GAP)), docs = [];
      for (var d = 0; d < n; d++) docs.push({ k: KINDS[(si * 3 + d) % KINDS.length], s: .5 + ((si * 7 + d * 11) % 4) * .1, rot: (((si + d * 3) % 5) - 2) * .05 });
      streams.push({ bi: si, path: b.P1, len: len, u: (si * .37) % (1 / n), shift: 0, docs: docs });
    });

    // the app minds talk to each other: arcs between their brains, with pulses going both ways
    var LINKS = [[0, 1, 40], [1, 2, 40], [0, 2, -46]].map(function (l) {
      var A = FIGS[l[0]].B, B = FIGS[l[1]].B, mx = (A[0] + B[0]) / 2 + l[2], my = (A[1] + B[1]) / 2;
      return { a: l[0], b: l[1], P: [A, [mx, A[1] + (my - A[1]) * .3], [mx, B[1] - (B[1] - my) * .3], B] };
    });
    var talk = []; LINKS.forEach(function (lk, li) { for (var q = 0; q < 4; q++) talk.push({ l: li, dir: q % 2, u: (q * .27 + li * .11) % 1, v: .32 + q * .03 }); });
    FIGS.forEach(function (f) { f.P2 = [[LC[0] + LR - 20, LC[1]], [LC[0] + LR + 22, LC[1]], [f.E[0] - 50, f.E[1] + (f.E[1] < LC[1] ? 40 : 0)], f.E]; });
    var parts = [];
    function mk(kind, u) { return { k: kind, u: u, b: (Math.random() * BRAINS.length) | 0, f: (Math.random() * FIGS.length) | 0, v: .13 + Math.random() * .1, off: (Math.random() - .5) * 2, ph: Math.random() * 6.283, sz: .8 + Math.random() * .7, a: .55 + Math.random() * .45 }; }
    // the documents now carry knowledge from the brains to the AI model, so only the lattice-to-app flow uses light particles
    // an even, steady flow to each figure (13 particles each, evenly spaced, one speed), so every figure glows steadily
    for (var q2 = 0; q2 < 39; q2++) { var pq2 = mk('b', ((q2 / 3) | 0) / 13 + (q2 % 3) * .025); pq2.f = q2 % 3; pq2.v = .2; parts.push(pq2); }
    var dust = []; for (var dd2 = 0; dd2 < 40; dd2++) dust.push({ x: Math.random() * DW, y: Math.random() * DH, s: .4 + Math.random() * .9, v: 3 + Math.random() * 6, ph: Math.random() * 6.283 });

    function resize() {
      var r = root.getBoundingClientRect(), dpr = Math.min(2, global.devicePixelRatio || 1);
      cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); S = r.width / DW;
      if (reduce && ready) frame(performance.now());
    }
    // a canvas silently IGNORES an opacity outside 0..1 and keeps the previous one, so every computed opacity goes through here
    function setAlpha(a) { ctx.globalAlpha = a < 0 ? 0 : a > 1 ? 1 : a; }
    function glow(spr, x, y, r, a) { setAlpha(a); ctx.drawImage(spr, (x - r) * S, (y - r) * S, 2 * r * S, 2 * r * S); }
    function ribbon(pp, w, alpha, dash, off) {
      ctx.beginPath(); ctx.moveTo(pp[0][0] * S, pp[0][1] * S); ctx.bezierCurveTo(pp[1][0] * S, pp[1][1] * S, pp[2][0] * S, pp[2][1] * S, pp[3][0] * S, pp[3][1] * S);
      ctx.lineWidth = w * S; setAlpha(alpha); ctx.setLineDash(dash || []); ctx.lineDashOffset = off || 0; ctx.stroke(); ctx.setLineDash([]);
    }
    function paper(pp, x, y, u) {     // u: 0 at the stream's start, 1 inside the brain
      var fade = Math.min(1, u * 8) * Math.min(1, (1 - u) * 7), sc = pp.s * (1 - .55 * Math.max(0, (u - .8) / .2)), D = DOCS[pp.k];
      ctx.save(); ctx.translate(x * S, y * S); ctx.rotate(pp.rot); setAlpha(fade);
      ctx.drawImage(D.c, -D.w / 2 * sc * S, -D.h / 2 * sc * S, D.w * sc * S, D.h * sc * S);
      ctx.restore();
    }
    function head(b) {
      glow(spPeach, b.gb[0], b.gb[1], 62 + 8 * b.e, .08 + .2 * b.e);
      setAlpha(.92 + .08 * b.e); ctx.drawImage(man, b.x * S, b.y * S, HW * S, HH * S);
    }

    function frame(now) {
      raf = 0;
      if (!alive) return;
      var dt = Math.min(.05, (now - last) / 1000 || .016); last = now; if (!reduce) T += dt;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.imageSmoothingQuality = 'high';
      placeNodes();
      var energy = 0; for (var i = 0; i < nodes.length; i++) { nodes[i].e *= Math.pow(.25, dt); energy += nodes[i].e; } energy = Math.min(1, energy / 14);
      // light spreads a little along the lattice's connections
      for (var le = 0; le < edges.length; le++) { var LA = nodes[edges[le][0]], LB = nodes[edges[le][1]]; if (LA.e > .6 && LB.e < LA.e - .2) LB.e += (LA.e - LB.e) * dt * 3; else if (LB.e > .6 && LA.e < LB.e - .2) LA.e += (LB.e - LA.e) * dt * 3; }
      FIGS.forEach(function (f) { f.glow *= Math.pow(.4, dt); });
      BRAINS.forEach(function (b) { b.e *= Math.pow(.35, dt); });

      // stardust
      for (var q = 0; q < dust.length; q++) { var du = dust[q]; if (!reduce) { du.y -= du.v * dt; if (du.y < -4) du.y = DH + 4; } glow(spWhite, du.x, du.y, 2.2 * du.s, .1 + .08 * Math.sin(T + du.ph)); }

      // ---------- each app's own model: the glass figures ----------
      if (figReady) FIGS.forEach(function (f) {
        glow(spSky, f.B[0], f.B[1], 60 + 9 * f.glow, .1 + .22 * f.glow);
        setAlpha(.9 + .1 * f.glow + .04 * Math.sin(T * .8 + f.y)); ctx.drawImage(fig, f.x * S, f.y * S, FW * S, FH * S);
        for (var r = f.rip.length - 1; r >= 0; r--) { f.rip[r] += dt * 260; if (f.rip[r] > 700) f.rip.splice(r, 1); }
        for (var s = 0; s < sparks.length; s++) {
          var sp = sparks[s], e = sp['e' + f.y] || 0;
          for (var r2 = 0; r2 < f.rip.length; r2++) if (Math.abs(f.rip[r2] - sp.d) < 30) e = 1;
          e *= Math.pow(.25, dt); sp['e' + f.y] = e;
          var sq = F(f, sp.x, sp.y), tw3 = Math.max(0, Math.sin(T * 1.7 + sp.ph + f.x));
          glow(spSky, sq[0], sq[1], 3 + 6 * e, .15 * tw3 + .7 * e); glow(spWhite, sq[0], sq[1], 1.1 + 1.8 * e, .25 * tw3 + .8 * e);
        }
      });

      // ---------- human expertise: the heads ----------
      if (manReady) for (var b2 = 0; b2 < BRAINS.length; b2++) head(BRAINS[b2]);

      // ---------- ribbons ----------
      var flow = -T * 22;
      BRAINS.forEach(function (b, bi) {
        var g = ctx.createLinearGradient(b.P1[0][0] * S, 0, b.P1[3][0] * S, 0); g.addColorStop(0, 'rgba(200,160,255,1)'); g.addColorStop(1, 'rgba(140,170,255,1)');
        ctx.strokeStyle = g; ribbon(b.P1, 10, .04 + .05 * b.e, null, 0); ribbon(b.P1, 1.4, .22, null, 0); ribbon(b.P1, 2, .42, [2, 30], flow + bi * 11);
      });
      FIGS.forEach(function (f, fi) {
        var g2 = ctx.createLinearGradient(f.P2[0][0] * S, 0, f.P2[3][0] * S, 0); g2.addColorStop(0, 'rgba(140,170,255,1)'); g2.addColorStop(1, 'rgba(110,231,214,1)');
        ctx.strokeStyle = g2; ribbon(f.P2, 10, .05 + .06 * f.glow, null, 0); ribbon(f.P2, 1.6, .28, null, 0); ribbon(f.P2, 2.2, .48, [2, 26], flow + 9 + fi * 13);
      });

      // documents leaving each brain for the AI model; each one that arrives lights the lattice, and its brain pulses as the next leaves
      ctx.globalCompositeOperation = 'source-over';
      for (var si = 0; si < streams.length; si++) {
        var st = streams[si], step = 1 / st.docs.length, before = st.u;
        if (!reduce) st.u = (st.u + SPEED * dt / st.len) % step;
        if (st.u < before) {
          st.shift++; var tb = BRAINS[st.bi]; tb.e = Math.min(1, tb.e + .3);
          var tgt = outerN[(Math.random() * outerN.length) | 0]; tgt.e = 1; var inner = nodes[(Math.random() * nodes.length) | 0]; inner.e = Math.max(inner.e, .6);
        }
        var nd2 = st.docs.length; // slot j shows document (j - shift), so each document keeps its look all the way along
        for (var dI = 0; dI < nd2; dI++) { var du2 = st.u + dI * step, pos2 = bez(st.path, du2); paper(st.docs[((dI - st.shift) % nd2 + nd2) % nd2], pos2[0], pos2[1], du2); }
      }
      ctx.globalCompositeOperation = 'lighter';

      // ---------- the app minds talking to each other ----------
      LINKS.forEach(function (lk, li) {
        var g3 = ctx.createLinearGradient(lk.P[0][0] * S, lk.P[0][1] * S, lk.P[3][0] * S, lk.P[3][1] * S); g3.addColorStop(0, 'rgba(110,231,214,1)'); g3.addColorStop(.5, 'rgba(190,160,255,1)'); g3.addColorStop(1, 'rgba(110,231,214,1)');
        ctx.strokeStyle = g3; ribbon(lk.P, 6, .05, null, 0); ribbon(lk.P, 1.1, .2, [1.5, 9], -T * 14 + li * 5);
      });
      for (var tk = 0; tk < talk.length; tk++) {
        var tp = talk[tk], lk2 = LINKS[tp.l]; if (!reduce) tp.u += tp.v * dt;
        if (tp.u >= 1) { tp.u -= 1; var rf = FIGS[tp.dir ? lk2.a : lk2.b]; rf.glow = Math.min(1, rf.glow + .15); rf.rip.push(0); }
        var tu = tp.dir ? 1 - tp.u : tp.u, tq = bez(lk2.P, tu), tfade = Math.min(1, tp.u * 6, (1 - tp.u) * 6);
        glow(tp.dir ? spViolet : spTeal, tq[0], tq[1], 4, tfade * .8); glow(spWhite, tq[0], tq[1], 1.5, tfade * .9);
      }

      // ---------- AI models lattice ----------
      glow(spBlue, LC[0], LC[1], 108 + 18 * energy, .2 + .22 * energy); glow(spTeal, LC[0], LC[1], 63, .1 + .18 * energy);
      ctx.lineWidth = Math.max(1, S * .9);
      for (var e = 0; e < edges.length; e++) {
        var A2 = nodes[edges[e][0]], B2 = nodes[edges[e][1]], en = Math.max(A2.e, B2.e), eh = (A2.h + B2.h) / 2 + (Math.abs(A2.h - B2.h) > 180 ? 180 : 0) + T * 10;
        setAlpha(.3 + .55 * en); ctx.strokeStyle = 'hsl(' + (eh % 360) + ',95%,' + (62 + 18 * en) + '%)';
        ctx.beginPath(); ctx.moveTo(A2.x * S, A2.y * S); ctx.lineTo(B2.x * S, B2.y * S); ctx.stroke();
      }
      for (var nq = 0; nq < nodes.length; nq++) { var nd = nodes[nq]; glow(hueSpr(nd.h + T * 10), nd.x, nd.y, 4 + 4 * nd.e, .55 + .4 * nd.e); glow(spWhite, nd.x, nd.y, 1.5 + 2.5 * nd.e, .4 + .5 * nd.e); }
      var sats = [spTeal, spViolet, spBlue];
      for (var sIdx = 0; sIdx < 3; sIdx++) { var sa = T * .55 + sIdx * 2.094; glow(sats[sIdx], LC[0] + Math.cos(sa) * 77, LC[1] + Math.sin(sa) * 32, 8, .85); glow(spWhite, LC[0] + Math.cos(sa) * 77, LC[1] + Math.sin(sa) * 32, 2.7, .9); }

      // ---------- particles ----------
      for (var p = 0; p < parts.length; p++) {
        var pa = parts[p]; if (!reduce) pa.u += pa.v * dt;
        if (pa.u >= 1) {
          { var tf = FIGS[pa.f]; tf.glow = Math.min(1, tf.glow + .3); tf.rip.push(0); }
          pa.u -= 1;
        }
        var path = FIGS[pa.f].P2, u = pa.u, pos = bez(path, u), nx = bez(path, Math.min(1, u + .01));
        var tx = nx[0] - pos[0], ty = nx[1] - pos[1], tl = Math.hypot(tx, ty) || 1, amp = 4 * Math.sin(u * 3.14159) * pa.off + Math.sin(T * 1.4 + pa.ph) * 1.2;
        var X = pos[0] - ty / tl * amp, Y = pos[1] + tx / tl * amp, fade = Math.min(1, u * 5, (1 - u) * 5) * pa.a;
        glow(pa.k === 'a' ? spViolet : spTeal, X, Y, 4.5 * pa.sz, fade * .75); glow(spWhite, X, Y, 1.8 * pa.sz, fade * .9);
      }

      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (!reduce && visible) raf = requestAnimationFrame(frame);
    }

    var ro = global.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe(root); else global.addEventListener('resize', resize);
    var io = global.IntersectionObserver ? new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting; if (visible && !raf && alive && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }) : null; if (io) io.observe(root);
    last = performance.now();
    ready = true;
    if (reduce) { T = 5; FIGS.forEach(function (f) { f.rip.push(120); }); resize(); } else { resize(); raf = requestAnimationFrame(frame); }
    return function stop() { alive = false; if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (io) io.disconnect(); };
  }
  global.xformHero = start;
  // the home page: start the graphic in the hero (the mockup starts it itself, from a template)
  function boot() { var el = document.querySelector('.xg-c'); if (el && !el.dataset.xc) { el.dataset.xc = '1'; start(el); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
