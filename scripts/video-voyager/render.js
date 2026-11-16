// Registra video.html in MP4 (1080×1920, 30 fotogrammi al secondo) con Playwright e ffmpeg.
//   node scripts/video-voyager/render.js /percorso/voyager.mp4          video completo
//   node scripts/video-voyager/render.js /cartella --prova 1,7,13       solo alcuni fotogrammi (PNG), per controllare
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),cp=require('child_process');
const dir=__dirname,out=process.argv[2],prova=process.argv[3]==='--prova'?process.argv[4].split(',').map(Number):null,fps=30;
const tipi={'.html':'text/html','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{const f=path.join(dir,decodeURIComponent(q.url.split('?')[0]));if(!f.startsWith(dir)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.statusCode=404;return r.end()}r.setHeader('content-type',tipi[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f))}).listen(0,async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1080,height:1920}});p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('http://localhost:'+srv.address().port+'/video.html');await p.waitForFunction('window.pronto');
  const dur=await p.evaluate('window.DUR'),scatto=async(t,o)=>{await p.evaluate(x=>window.frame(x),t);return p.locator('#v').screenshot(o)};
  if(prova){for(const t of prova)await scatto(t,{path:path.join(out,'voy-'+String(t).replace('.','_')+'.png')});}
  else{const ff=cp.spawn('ffmpeg',['-y','-f','image2pipe','-framerate',String(fps),'-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','medium','-movflags','+faststart',out],{stdio:['pipe','ignore','inherit']});
    for(let i=0;i<fps*dur;i++){const buf=await scatto(i/fps,{type:'jpeg',quality:95});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));}
    ff.stdin.end();await new Promise(r=>ff.on('close',r));}
  await b.close();srv.close();console.log('fatto');});
