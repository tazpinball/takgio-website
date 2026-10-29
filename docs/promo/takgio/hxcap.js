// Capture the live home-page hero graphic (.hx) frame by frame at exact times.
// node hxcap.js <base url> <out dir> <seconds> <scale> [width]
const { chromium } = require('playwright'); const fs=require('fs');
const [base,out,secs='12',scale='2',vw='1440']=process.argv.slice(2); fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch(); const p=await b.newPage({viewport:{width:+vw,height:1000},deviceScaleFactor:+scale});
await p.addInitScript(()=>{ window.__t=0; Object.defineProperty(document.timeline,'currentTime',{get:()=>window.__t}); const pn=performance.now.bind(performance); performance.now=()=>window.__t; });
await p.goto(base+'/index.html',{waitUntil:'networkidle'});
await p.addStyleTag({content:'.hx{margin:0!important}'});
const hx=await p.$('.hx'); await hx.scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
const FPS=30, N=Math.round(+secs*FPS);
for(let f=0;f<N;f++){ const t=f*1000/FPS;
  await p.evaluate(t=>{window.__t=t; for(const a of document.getAnimations()){a.pause(); a.currentTime=t;} return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},t);
  await hx.screenshot({path:`${out}/f${String(f).padStart(4,'0')}.png`});
  if(f%60===0) console.log('frame',f);}
await b.close();})();
