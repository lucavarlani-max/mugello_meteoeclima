// Rende il video «Ricerca analoghi»: node scripts/video-analoghi/render.js media/analoghi-mugello.mp4
// Prima: python scripts/video-analoghi/prepara.py [AAAA-MM-GG]. Servono Playwright (Chromium) e ffmpeg.
// Con un secondo argomento numerico salva solo quel fotogramma (secondi) come PNG: utile per le prove.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),cp=require('child_process');
const dir=__dirname,root=path.join(dir,'..','..'),out=process.argv[2],solo=process.argv[3],fps=30,dur=26,tipi={'.html':'text/html','.json':'application/json'};
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0],f=u.startsWith('/data/')?path.join(root,u):path.join(dir,u);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.statusCode=404;return r.end()}r.setHeader('content-type',tipi[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f))}).listen(8144,async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8144/video.html');await p.waitForFunction('window.pronto');
if(solo!==undefined){for(const s of solo.split(',')){await p.evaluate(t=>window.frame(t),+s);await p.locator('#c').screenshot({path:out.replace(/(\.\w+)?$/,'-'+s+'.png')});}await b.close();srv.close();return console.log('fotogrammi salvati');}
const ff=cp.spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(fps),'-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','medium','-movflags','+faststart',out],{stdio:['pipe','inherit','inherit']});
const n=fps*dur;for(let i=0;i<n;i++){await p.evaluate(t=>window.frame(t),i/fps);const buf=await p.locator('#c').screenshot({type:'jpeg',quality:95});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();srv.close();console.log('fatto')});
