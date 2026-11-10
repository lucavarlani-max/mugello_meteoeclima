const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),cp=require('child_process');
const dir=__dirname,out=process.argv[2],fps=30,dur=24,tipi={'.html':'text/html','.json':'application/json'};
const srv=http.createServer((q,r)=>{const f=path.join(dir,q.url.split('?')[0]);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.statusCode=404;return r.end()}r.setHeader('content-type',tipi[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f))}).listen(8143,async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8143/video.html');await p.waitForFunction('window.pronto');
const ff=cp.spawn('ffmpeg',['-y','-f','image2pipe','-framerate',String(fps),'-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','medium','-movflags','+faststart',out],{stdio:['pipe','inherit','inherit']});
const n=fps*dur;for(let i=0;i<n;i++){await p.evaluate(t=>window.frame(t),i/fps);const buf=await p.locator('#c').screenshot({type:'jpeg',quality:95});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();srv.close();console.log('fatto')});
