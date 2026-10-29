// Render the Takgio promo's picture: serve the stage folder, call window.render(t)
// for every frame of video.html (index.html in the stage), screenshot it, pipe to ffmpeg.
//   node render.js <stage dir> <out.mp4> [from s] [to s]
//   node render.js <stage dir> --stills <out dir> t1 t2 ...
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const [root, out, ...rest] = process.argv.slice(2);
const FPS = 30;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.error('page error:', e.message));
  await p.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await p.waitForFunction(() => window.ready === true, null, { timeout: 180000 });
  if (out === '--stills') {
    const [dir, ...ts] = rest; fs.mkdirSync(dir, { recursive: true });
    for (const t of ts) { await p.evaluate(t => window.render(t), +t); await p.screenshot({ path: path.join(dir, `t${(+t).toFixed(2)}.png`) }); }
  } else {
    const tl = JSON.parse(fs.readFileSync(path.join(root, 'timeline.json'), 'utf8'));
    const from = +(rest[0] || 0), to = +(rest[1] || tl.duration);
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', out],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = Math.round(from * FPS); f < Math.round(to * FPS); f++) {
      await p.evaluate(t => window.render(t), f / FPS);
      const buf = await p.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(ok => ff.stdin.once('drain', ok));
      if (f % 150 === 0) console.log('frame', f);
    }
    ff.stdin.end(); await new Promise(ok => ff.on('close', ok)); console.log('->', out);
  }
  await b.close(); server.close();
})();
