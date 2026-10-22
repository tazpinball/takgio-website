/* Home hero graphic "Human expertise into AI products" (canvas), v22, after Ted's reference picture (Oct 22): three titled
   panels. HUMAN EXPERTISE: an expert's head (Ted's licensed picture) with people around it and books below; Word, Excel,
   CAD, PowerPoint, music, conversations and books stream into the TAKGIO GENERAL MODEL (a turning lattice) inside the
   magenta HUB, below a GENERAL-PURPOSE LLM (the big lattice); the two talk both ways;
   the two models talk both ways, and the hub feeds TAKGIO'S APPS: three glass figures (Ted's licensed picture, facing
   left) with name pills (ConcreteIQ, Brickture, BuyersGuide), which brighten as knowledge arrives (they do not talk to each other).
   Titles, captions, labels and cards are HTML over the canvas. Design space 660 x 560. Prefix xc- / xform. */
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
  // a document as a small picture, drawn once at 4x: a Word page, an Excel sheet, a PowerPoint slide or a CAD blueprint
  var DOC_R = 4, DOC_PAD = 5;
  function rr(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
  function badge(x, X, Y, W, H, col, letter) {
    rr(x, X, Y, W, H, 1.4); x.fillStyle = col; x.fill();
    x.fillStyle = '#fff'; x.font = 'bold ' + (H * .78) + 'px "Segoe UI", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(letter, X + W / 2, Y + H / 2 + .3);
  }
  // the other things an expert knows from: music (a pair of beamed notes) and conversations (two speech bubbles)
  function makeIcon(kind) {
    var music = kind === 'music', book = kind === 'book', w = music ? 18 : book ? 18 : 26, h = book ? 23 : 20, R = DOC_R, P = DOC_PAD;
    var c = document.createElement('canvas'); c.width = (w + 2 * P) * R; c.height = (h + 2 * P) * R;
    var x = c.getContext('2d'); x.scale(R, R); x.translate(P, P);
    if (book) {                       // a closed hardback: cover, spine, page edges, a gold title
      x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 3 * R; x.shadowOffsetY = R;
      rr(x, 1.5, 0, 16.5, 21, 1.6); x.fillStyle = '#6d5ce8'; x.fill();
      x.shadowColor = 'transparent'; x.fillStyle = '#f4efe2'; x.fillRect(16, 1.2, 2, 18.6);
      x.fillStyle = '#4c3fc0'; x.fillRect(1.5, 0, 2.6, 21);
      x.fillStyle = '#ffd166'; x.fillRect(6.5, 5, 7.5, 1.4); x.fillRect(7.5, 7.6, 5.5, .9); x.fillRect(6.5, 15.5, 7.5, .7);
    } else if (music) {
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
    if (kind === 'music' || kind === 'chat' || kind === 'book') return makeIcon(kind);
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

  // ---------- v14 layout: three panels (design space 660 x 560) ----------
  var PANELS = [
    { x: 4, w: 210, rgb: '90,140,255' },     // human expertise
    { x: 223, w: 214, rgb: '232,92,220' },   // dual-model architecture
    { x: 446, w: 210, rgb: '245,165,60' }    // Takgio's apps
  ];
  var PT = 4, PB = 556, HEAD_LINE = 66, FOOT_LINE = 494;
  var HUB = { x: 240, y: 80, w: 180, h: 360 };
  // the apps: three glass figures (Ted's licensed picture, 524 x 694, facing left), staggered inside the apps panel
  var FW = 93.5, FK = FW / 524, FH = 694 * FK; // v16: 15% smaller than v15, same centres
  var FIGS = [{ x: 472, y: 72 }, { x: 536, y: 205 }, { x: 472, y: 338 }]; // v22: less zigzag, centred as a group in the panel (x 472..629.5, middle 551)
  function F(f, x, y) { return [f.x + x * FK, f.y + y * FK]; }
  FIGS.forEach(function (f) { f.E = F(f, 120, 150); f.B = F(f, 285, 140); f.glow = 0; f.rip = []; }); // E: where knowledge enters, B: the brain

  function start(root) {
    var cv = root.querySelector('canvas'), ctx = cv.getContext('2d'), man = root.querySelector('img.xc-man'), fig = root.querySelector('img.xc-fig');
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var S = 1, raf = 0, last = 0, T = 0, alive = true, visible = true, ready = false; // ready: everything below is set up, so a still frame may be drawn
    var spTeal = sprite('110,231,214', 64), spBlue = sprite('140,170,255', 64), spWhite = sprite('255,255,255', 64), spPeach = sprite('255,190,150', 64),
      spViolet = sprite('190,160,255', 64), spAmber = sprite('255,176,80', 64), spSky = sprite('120,190,255', 64);

    // ---------- human expertise: Ted's picture of an expert's head (cut at mid-neck, facing the models), people around it ----------
    // v21: 5% smaller again (121.1 tall) and centred left to right in the Human expertise panel (x 4..214, middle 109)
    var HH = 121.1, HK = HH / 940, HW = 880 * HK;
    var HEAD = { x: (PANELS[0].x + PANELS[0].w / 2) - HW / 2, y: 200 - HH / 2, e: 0 };
    HEAD.out = [HEAD.x + 700 * HK, HEAD.y + 240 * HK]; HEAD.gb = [HEAD.x + 420 * HK, HEAD.y + 250 * HK];
    var PEOPLE = [{ x: 30, y: 98, rgb: '120,190,255' }, { x: 97, y: 84, rgb: '255,170,90' }, { x: 164, y: 98, rgb: '240,120,220' }, { x: 20, y: 185, rgb: '110,231,214' }, { x: 22, y: 262, rgb: '255,150,120' }];
    PEOPLE.forEach(function (p, i) { p.P = [[p.x, p.y], [p.x + (HEAD.gb[0] - p.x) * .4, p.y], [HEAD.gb[0], p.y + (HEAD.gb[1] - p.y) * .4], HEAD.gb]; p.u = i / PEOPLE.length; p.e = 0; });
    var BOOKS = [{ x: 40, y: 352 }, { x: 40, y: 420 }];

    // ---------- the Takgio expert model (a turning lattice) and the general-purpose HUMAN (a filament brain) ----------
    // colour palettes for the two models; each colour also gets a glow sprite
    function palette(cols) { return { cols: cols, spr: cols.map(function (c) { return sprite(c.join(','), 48); }) }; }
    var WARM = palette([[255, 196, 55], [255, 160, 30], [255, 232, 80], [255, 122, 45], [122, 196, 82]]);   // gold, amber, yellow, warm orange, organic green
    var COOL = palette([[35, 110, 255], [30, 225, 255], [185, 75, 255], [205, 214, 230]]);                 // electric blue, cyan, neon purple, silver
    function palPos(pal, h) { var n = pal.cols.length; return (((h / 360) * n + T * .06) % n + n) % n; }
    function palRgb(pal, h, white) {
      var f = palPos(pal, h), i = Math.floor(f), t = f - i, a = pal.cols[i], b = pal.cols[(i + 1) % pal.cols.length], w = white || 0, o = [];
      for (var c = 0; c < 3; c++) { var v = a[c] + (b[c] - a[c]) * t; o.push(Math.round(v + (255 - v) * w)); }
      return 'rgb(' + o.join(',') + ')';
    }
    function palSpr(pal, h) { return pal.spr[Math.round(palPos(pal, h)) % pal.spr.length]; }
    function makeLattice(cx, cy, radii, total, sz, pal) {
      var L = { c: [cx, cy], R: radii[radii.length - 1], sz: sz, nodes: [], edges: [], energy: 0 }, rings = [[0, 1]], sum = 0, left = total;
      radii.forEach(function (r) { sum += r; });
      radii.forEach(function (r, i) { var n = i === radii.length - 1 ? left : Math.round(total * r / sum); rings.push([r, n]); left -= n; });
      rings.forEach(function (r, ri) { for (var i = 0; i < r[1]; i++) L.nodes.push({ r: r[0], a0: (i / r[1]) * 6.283 + ri * .35, e: 0, ri: ri, x: 0, y: 0, h: ((i / r[1]) * 360 + ri * 28) % 360 }); });
      L.place = function () {
        for (var i = 0; i < L.nodes.length; i++) {
          var n = L.nodes[i], dir = n.ri % 2 ? 1 : -1, a = n.a0 + T * .04 * dir;
          n.x = cx + Math.cos(a) * n.r * (1 + .02 * Math.sin(T * .6 + i)); n.y = cy + Math.sin(a) * n.r * (1 + .02 * Math.cos(T * .5 + i));
        }
      };
      L.place();
      for (var i = 0; i < L.nodes.length; i++) {
        var ds = [];
        for (var j = 0; j < L.nodes.length; j++) if (j !== i) ds.push([Math.hypot(L.nodes[i].x - L.nodes[j].x, L.nodes[i].y - L.nodes[j].y), j]);
        ds.sort(function (a, b) { return a[0] - b[0]; });
        for (var k = 0; k < 3; k++) if (i < ds[k][1]) L.edges.push([i, ds[k][1]]);
      }
      L.outer = L.nodes.filter(function (n) { return n.ri >= rings.length - 4; });
      L.light = function () { L.outer[(Math.random() * L.outer.length) | 0].e = 1; var inner = L.nodes[(Math.random() * L.nodes.length) | 0]; inner.e = Math.max(inner.e, .6); };
      L.update = function (dt) {
        L.place();
        var en = 0; for (var i = 0; i < L.nodes.length; i++) { L.nodes[i].e *= Math.pow(.25, dt); en += L.nodes[i].e; } L.energy = Math.min(1, en / (L.nodes.length / 13));
        for (var le = 0; le < L.edges.length; le++) { var A = L.nodes[L.edges[le][0]], B = L.nodes[L.edges[le][1]]; if (A.e > .6 && B.e < A.e - .2) B.e += (A.e - B.e) * dt * 3; else if (B.e > .6 && A.e < B.e - .2) A.e += (B.e - A.e) * dt * 3; }
      };
      L.draw = function () {
        var k = L.R / 61, en = L.energy;
        glow(pal.spr[0], cx, cy, (108 + 18 * en) * k, .18 + .2 * en); glow(pal.spr[1], cx, cy, 63 * k, .1 + .16 * en);
        ctx.lineWidth = Math.max(.8, S * .9 * sz);
        for (var e = 0; e < L.edges.length; e++) {
          var A2 = L.nodes[L.edges[e][0]], B2 = L.nodes[L.edges[e][1]], ee = Math.max(A2.e, B2.e), eh = (A2.h + B2.h) / 2 + (Math.abs(A2.h - B2.h) > 180 ? 180 : 0) + T * 10;
          setAlpha(.3 + .55 * ee); ctx.strokeStyle = palRgb(pal, eh - T * 10, .1 + .35 * ee);
          ctx.beginPath(); ctx.moveTo(A2.x * S, A2.y * S); ctx.lineTo(B2.x * S, B2.y * S); ctx.stroke();
        }
        for (var nq = 0; nq < L.nodes.length; nq++) { var nd = L.nodes[nq]; glow(palSpr(pal, nd.h), nd.x, nd.y, (4 + 4 * nd.e) * sz, .55 + .4 * nd.e); glow(spWhite, nd.x, nd.y, (1.5 + 2.5 * nd.e) * sz, .4 + .5 * nd.e); }
        var sats = pal.spr, ox = L.R + 16, oy = ox * .42;
        for (var sIdx = 0; sIdx < 3; sIdx++) { var sa = T * .55 + sIdx * 2.094; glow(sats[sIdx], cx + Math.cos(sa) * ox, cy + Math.sin(sa) * oy, 7, .85); glow(spWhite, cx + Math.cos(sa) * ox, cy + Math.sin(sa) * oy, 2.4, .9); }
      };
      return L;
    }
    // the general-purpose LLM (the big lattice, general knowledge) above the Human AI model (Ted's name for the small lattice,
    // which is the Takgio expert model: human expertise flows into it)
    var GENERAL = makeLattice(330, 180, [5, 10, 15, 20, 26, 32, 38, 44], 130, .85, COOL);

    // the Human AI model / Takgio expert model: the smaller turning lattice (outer radius 26.7, 81 dots)
    var HUMAN = makeLattice(330, 330, [6.7, 13.3, 20, 26.7], 80, .7, WARM);

    // ---------- flows ----------
    var KINDS = ['word', 'music', 'excel', 'book', 'chat', 'cad', 'ppt'], DOCS = {}; KINDS.forEach(function (k) { DOCS[k] = makeDoc(k); });
    var SPEED = 68, GAP = 46, streams = [];
    function addStream(from, ey, si, src) {
      var L = HUMAN, dy = Math.max(-.6 * L.R, Math.min(.6 * L.R, ey - L.c[1])), ex = L.c[0] - Math.sqrt(L.R * L.R - dy * dy) + L.R * .2;
      var path = [from, [from[0] + 55, from[1]], [ex - 70, L.c[1] + dy], [ex, L.c[1] + dy]];
      var len = 0, pv = path[0]; for (var t = 1; t <= 40; t++) { var pt = bez(path, t / 40); len += Math.hypot(pt[0] - pv[0], pt[1] - pv[1]); pv = pt; }
      var n = Math.max(2, Math.round(len / GAP)), docs = [];
      for (var d = 0; d < n; d++) docs.push({ k: KINDS[(si * 3 + d) % KINDS.length], s: .5 + ((si * 7 + d * 11) % 4) * .1, rot: (((si + d * 3) % 5) - 2) * .05 });
      streams.push({ src: src, path: path, len: len, u: (si * .37) % (1 / n), shift: 0, docs: docs });
    }
    addStream(HEAD.out, HUMAN.c[1] - 10, 0, HEAD);
    addStream([BOOKS[0].x + 22, BOOKS[0].y], HUMAN.c[1] + 2, 1, BOOKS[0]);
    addStream([BOOKS[1].x + 22, BOOKS[1].y], HUMAN.c[1] + 12, 2, BOOKS[1]);
    BOOKS.forEach(function (b) { b.e = 0; });

    // the two models talk: a link between the expert model and the HUMAN's tile, pulses both ways
    var LINK = [[330, GENERAL.c[1] + GENERAL.R], [336, GENERAL.c[1] + GENERAL.R + 22], [336, HUMAN.c[1] - HUMAN.R - 22], [330, HUMAN.c[1] - HUMAN.R]];
    var talk = []; for (var q = 0; q < 6; q++) talk.push({ dir: q % 2, u: q / 6, v: .5 });
    // the hub's output: to every app figure (8 pulses each, evenly spaced, one speed)
    var OUTS = FIGS.map(function (f) { var s0 = [HUB.x + HUB.w - 8, HUB.y + HUB.h * .5]; return [s0, [s0[0] + 24, s0[1]], [f.E[0] - 30, f.E[1] + (f.E[1] < s0[1] ? 30 : -10)], f.E]; });
    var outs = []; for (var o0 = 0; o0 < 24; o0++) outs.push({ c: o0 % 3, u: ((o0 / 3) | 0) / 8 + (o0 % 3) * .04, v: .3 });
    // sparks sampled from the bright parts of the figure picture; a ripple runs through them as knowledge arrives
    var sparks = [], figReady = false;
    function figLoaded() {
      figReady = true;
      try {
        var oc = document.createElement('canvas'); oc.width = 131; oc.height = 174; var ox = oc.getContext('2d'); ox.drawImage(fig, 0, 0, 131, 174);
        var px = ox.getImageData(0, 0, 131, 174).data;
        for (var t = 0; t < 4000 && sparks.length < 34; t++) {
          var sx = (Math.random() * 131) | 0, sy = (Math.random() * 150) | 0, o = (sy * 131 + sx) * 4;
          if (px[o] + px[o + 1] + px[o + 2] > 330) sparks.push({ x: sx * 4, y: sy * 4, ph: Math.random() * 6.283, d: 0 });
        }
        sparks.forEach(function (sp) { sp.d = Math.hypot(sp.x - 120, sp.y - 150); });
      } catch (err) { /* a picture that cannot be read just goes without sparks */ }
      if (reduce && ready) frame(performance.now());
    }
    if (fig) { if (fig.complete && fig.naturalWidth) figLoaded(); else fig.addEventListener('load', figLoaded); }
    var dust = []; for (var dd2 = 0; dd2 < 34; dd2++) dust.push({ x: Math.random() * DW, y: Math.random() * DH, s: .4 + Math.random() * .9, v: 3 + Math.random() * 6, ph: Math.random() * 6.283 });

    var manReady = false;
    function manLoaded() { manReady = true; if (reduce && ready) frame(performance.now()); }
    if (man) { if (man.complete && man.naturalWidth) manLoaded(); else man.addEventListener('load', manLoaded); }

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
    function roundRect(X, Y, W, H, r) { rr(ctx, X * S, Y * S, W * S, H * S, r * S); }
    function panel(p) {
      roundRect(p.x, PT, p.w, PB - PT, 12);
      var g = ctx.createLinearGradient(0, PT * S, 0, PB * S); g.addColorStop(0, 'rgba(' + p.rgb + ',.10)'); g.addColorStop(1, 'rgba(' + p.rgb + ',.03)');
      setAlpha(1); ctx.fillStyle = g; ctx.fill();
      ctx.shadowColor = 'rgba(' + p.rgb + ',.9)'; ctx.shadowBlur = 10 * S; ctx.strokeStyle = 'rgba(' + p.rgb + ',1)'; ctx.lineWidth = 1.4 * S; setAlpha(.75); ctx.stroke(); ctx.shadowBlur = 0;
      setAlpha(.35); ctx.lineWidth = 1 * S; ctx.beginPath(); ctx.moveTo((p.x + 10) * S, HEAD_LINE * S); ctx.lineTo((p.x + p.w - 10) * S, HEAD_LINE * S); ctx.moveTo((p.x + 10) * S, FOOT_LINE * S); ctx.lineTo((p.x + p.w - 10) * S, FOOT_LINE * S); ctx.stroke();
    }
    function person(p) {
      var r = 12, e = p.e;
      glow(spBlue, p.x, p.y, 20, .1 + .25 * e);
      ctx.save(); ctx.translate(p.x * S, p.y * S);
      ctx.beginPath(); ctx.arc(0, 0, r * S, 0, 6.283); setAlpha(.18 + .2 * e); ctx.fillStyle = 'rgba(' + p.rgb + ',1)'; ctx.fill();
      ctx.save(); ctx.clip();
      setAlpha(.95); ctx.fillStyle = 'rgba(' + p.rgb + ',1)';
      ctx.beginPath(); ctx.arc(0, -3 * S, 4.2 * S, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 9.5 * S, 8 * S, 6.5 * S, 0, 0, 6.283); ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(0, 0, r * S, 0, 6.283); ctx.strokeStyle = 'rgba(' + p.rgb + ',1)'; ctx.lineWidth = 1.3 * S; setAlpha(.85); ctx.shadowColor = 'rgba(' + p.rgb + ',.9)'; ctx.shadowBlur = 8 * S; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.restore();
    }
    function book(b) {
      ctx.save(); ctx.translate(b.x * S, b.y * S); ctx.scale(S, S);
      ctx.strokeStyle = 'rgba(150,185,255,1)'; ctx.lineWidth = 1.4; ctx.shadowColor = 'rgba(120,170,255,.95)'; ctx.shadowBlur = 8 + 8 * b.e; setAlpha(.85 + .15 * b.e);
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(-9, -12, -18, -9); ctx.lineTo(-18, 10); ctx.quadraticCurveTo(-9, 7, 0, 10); ctx.quadraticCurveTo(9, 7, 18, 10); ctx.lineTo(18, -9); ctx.quadraticCurveTo(9, -12, 0, -9); ctx.lineTo(0, 10); ctx.stroke();
      ctx.shadowBlur = 0; ctx.lineWidth = .8; setAlpha(.55); ctx.beginPath();
      for (var l = 0; l < 3; l++) { ctx.moveTo(-15, -4 + l * 4.5); ctx.lineTo(-4, -4 + l * 4.5); ctx.moveTo(4, -4 + l * 4.5); ctx.lineTo(15, -4 + l * 4.5); }
      ctx.stroke(); ctx.restore();
    }
    function paper(pp, x, y, u) {     // u: 0 at the stream's start, 1 inside the model
      var fade = Math.min(1, u * 8) * Math.min(1, (1 - u) * 7), sc = pp.s * (1 - .55 * Math.max(0, (u - .8) / .2)), D = DOCS[pp.k];
      ctx.save(); ctx.translate(x * S, y * S); ctx.rotate(pp.rot); setAlpha(fade);
      ctx.drawImage(D.c, -D.w / 2 * sc * S, -D.h / 2 * sc * S, D.w * sc * S, D.h * sc * S);
      ctx.restore();
    }
    function pulses(list, path, rgbSpr, onArrive, size, dt) {
      for (var i = 0; i < list.length; i++) {
        var p = list[i]; if (!reduce) p.u += p.v * dt;
        if (p.u >= 1) { p.u -= 1; onArrive(p); }
        var uu = p.dir ? 1 - p.u : p.u, P = typeof path === 'function' ? path(p) : path, q = bez(P, uu), f = Math.min(1, p.u * 6, (1 - p.u) * 6);
        glow(typeof rgbSpr === 'function' ? rgbSpr(p) : rgbSpr, q[0], q[1], size, f * .8); glow(spWhite, q[0], q[1], size * .38, f * .9);
      }
    }

    function frame(now) {
      raf = 0;
      if (!alive) return;
      var dt = Math.min(.05, (now - last) / 1000 || .016); last = now; if (!reduce) T += dt;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.imageSmoothingQuality = 'high';
      GENERAL.update(dt);
      HUMAN.update(dt);
      HEAD.e *= Math.pow(.35, dt); BOOKS.forEach(function (b) { b.e *= Math.pow(.35, dt); }); PEOPLE.forEach(function (p) { p.e *= Math.pow(.4, dt); });
      FIGS.forEach(function (f) { f.glow *= Math.pow(.4, dt); });

      // panels
      ctx.globalCompositeOperation = 'source-over';
      PANELS.forEach(panel);
      ctx.globalCompositeOperation = 'lighter';

      // stardust
      for (var q0 = 0; q0 < dust.length; q0++) { var du = dust[q0]; if (!reduce) { du.y -= du.v * dt; if (du.y < -4) du.y = DH + 4; } glow(spWhite, du.x, du.y, 2 * du.s, .08 + .07 * Math.sin(T + du.ph)); }

      // the hub
      roundRect(HUB.x, HUB.y, HUB.w, HUB.h, 16); setAlpha(1); ctx.fillStyle = 'rgba(232,92,220,.05)'; ctx.fill();
      ctx.strokeStyle = 'rgba(240,120,230,1)'; ctx.lineWidth = 1.6 * S; ctx.shadowColor = 'rgba(232,92,220,.95)'; ctx.shadowBlur = 14 * S; setAlpha(.8); ctx.stroke(); ctx.shadowBlur = 0;
      roundRect(HUB.x + 6, HUB.y + 6, HUB.w - 12, HUB.h - 12, 12); ctx.lineWidth = 1 * S; setAlpha(.25); ctx.stroke();

      // human expertise: people feeding the expert, then the head
      ctx.lineWidth = .9 * S;
      PEOPLE.forEach(function (p, i) { ctx.strokeStyle = 'rgba(' + p.rgb + ',1)'; ribbon(p.P, .9, .25, [2, 6], -T * 10 + i * 3); });
      PEOPLE.forEach(function (p) {
        if (!reduce) p.u += .32 * dt;
        if (p.u >= 1) { p.u -= 1; HEAD.e = Math.min(1, HEAD.e + .2); p.e = 1; }
        var q1 = bez(p.P, p.u), f1 = Math.min(1, p.u * 6, (1 - p.u) * 6); glow(spWhite, q1[0], q1[1], 2.4, f1 * .9);
      });
      if (manReady) { glow(spPeach, HEAD.gb[0], HEAD.gb[1], 70 + 8 * HEAD.e, .08 + .2 * HEAD.e); setAlpha(.92 + .08 * HEAD.e); ctx.drawImage(man, HEAD.x * S, HEAD.y * S, HW * S, HH * S); }
      ctx.globalCompositeOperation = 'source-over';
      PEOPLE.forEach(person); BOOKS.forEach(book);
      ctx.globalCompositeOperation = 'lighter';

      // ribbons: knowledge streams, the models' link, general knowledge, the hub's outputs
      var flow = -T * 22;
      streams.forEach(function (st, si) {
        var P = st.path, g = ctx.createLinearGradient(P[0][0] * S, 0, P[3][0] * S, 0); g.addColorStop(0, 'rgba(150,185,255,1)'); g.addColorStop(1, 'rgba(232,120,225,1)');
        ctx.strokeStyle = g; ribbon(P, 9, .05 + .05 * st.src.e, null, 0); ribbon(P, 1.3, .24, null, 0); ribbon(P, 1.9, .42, [2, 30], flow + si * 11);
      });
      ctx.strokeStyle = 'rgba(200,160,255,1)'; ribbon(LINK, 6, .06, null, 0); ribbon(LINK, 1.2, .28, [1.5, 8], -T * 14);
      // the apps: glass figures, brightening and rippling as knowledge arrives
      if (figReady) FIGS.forEach(function (f) {
        glow(spSky, f.B[0], f.B[1], 50 + 8 * f.glow, .1 + .22 * f.glow);
        setAlpha(.9 + .1 * f.glow + .04 * Math.sin(T * .8 + f.y)); ctx.drawImage(fig, f.x * S, f.y * S, FW * S, FH * S);
        for (var r = f.rip.length - 1; r >= 0; r--) { f.rip[r] += dt * 260; if (f.rip[r] > 700) f.rip.splice(r, 1); }
        for (var s2 = 0; s2 < sparks.length; s2++) {
          var sp = sparks[s2], e = sp['e' + f.y] || 0;
          for (var r2 = 0; r2 < f.rip.length; r2++) if (Math.abs(f.rip[r2] - sp.d) < 30) e = 1;
          e *= Math.pow(.25, dt); sp['e' + f.y] = e;
          var sq = F(f, sp.x, sp.y), tw3 = Math.max(0, Math.sin(T * 1.7 + sp.ph + f.x));
          glow(spSky, sq[0], sq[1], 2.6 + 5 * e, .15 * tw3 + .7 * e); glow(spWhite, sq[0], sq[1], 1 + 1.6 * e, .25 * tw3 + .8 * e);
        }
      });
      OUTS.forEach(function (P, ci) {
        var g2 = ctx.createLinearGradient(P[0][0] * S, 0, P[3][0] * S, 0); g2.addColorStop(0, 'rgba(240,120,230,1)'); g2.addColorStop(1, 'rgba(255,176,80,1)');
        ctx.strokeStyle = g2; ribbon(P, 8, .05 + .06 * FIGS[ci].glow, null, 0); ribbon(P, 1.5, .3, null, 0); ribbon(P, 2, .5, [2, 24], flow + ci * 13);
      });

      // documents, books, music and conversations streaming into the expert model
      ctx.globalCompositeOperation = 'source-over';
      for (var si = 0; si < streams.length; si++) {
        var st = streams[si], step = 1 / st.docs.length, before = st.u;
        if (!reduce) st.u = (st.u + SPEED * dt / st.len) % step;
        if (st.u < before) { st.shift++; st.src.e = Math.min(1, st.src.e + .3); HUMAN.light(); }
        var nd2 = st.docs.length; // slot j shows document (j - shift), so each document keeps its look all the way along
        for (var dI = 0; dI < nd2; dI++) { var du2 = st.u + dI * step, pos2 = bez(st.path, du2); paper(st.docs[((dI - st.shift) % nd2 + nd2) % nd2], pos2[0], pos2[1], du2); }
      }
      ctx.globalCompositeOperation = 'lighter';

      // pulses: between the two models (both ways), general knowledge into the HUMAN, the hub out to the apps
      pulses(talk, LINK, function (p) { return p.dir ? spViolet : spTeal; }, function (p) { if (p.dir) GENERAL.light(); else HUMAN.light(); }, 4, dt);
      pulses(outs, function (p) { return OUTS[p.c]; }, spAmber, function (p) { var f = FIGS[p.c]; f.glow = Math.min(1, f.glow + .3); f.rip.push(0); }, 4.2, dt);

      // the two models
      GENERAL.draw();
      HUMAN.draw();

      setAlpha(1); ctx.globalCompositeOperation = 'source-over';
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
  // the home page: start the graphic in the hero (a mockup can start it itself)
  // touch screens have no hover: a tap on a panel opens its card, a tap elsewhere closes it
  function taps(el) {
    var hots = el.querySelectorAll('.xc-hot');
    document.addEventListener('pointerup', function (e) {
      if (e.pointerType === 'mouse') return;
      for (var i = 0; i < hots.length; i++) hots[i].classList.toggle('open', hots[i].contains(e.target) && !hots[i].classList.contains('open'));
    });
  }
  function boot() { var el = document.querySelector('.xg-c'); if (el && !el.dataset.xc) { el.dataset.xc = '1'; start(el); taps(el); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
