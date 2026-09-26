/* Pagina di una serie storica: grafici e tabelle da data/serie/<slug>.json.
   Configurazione nella pagina: window.SERIE = {slug, nome, citta, luogo, early:[a,b], epoche:[[a,b],...], tacche:[[mobile],[desktop]]} */
(function(){
  const $=id=>document.getElementById(id);
  const MESI=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
  const MES=["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  const f1=v=>v==null?"—":(Math.round(v*10)/10).toFixed(1).replace(".",",").replace("-","−");
  const sg=v=>v==null?"—":(v>0?"+":"")+f1(v);
  const dIt=iso=>{const [y,m,d]=iso.split("-").map(Number);return d+" "+MES[m-1]+" "+y;};
  const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const C=window.SERIE; let D=null, A=[], AC=[], BASE={};

  fetch("./data/serie/"+C.slug+".json").then(r=>r.json()).then(d=>{
    D=d; A=d.anni; AC=A.filter(a=>a.tm!=null);
    ["tm","tx","tn"].forEach(k=>{BASE[k]=mean(A.filter(a=>a.y>=1961&&a.y<=1990).map(a=>a[k]));});
    tiles(); stripes(); yearChart(); monthInit(); exInit(); precChart(); normTable(); records(); neve(); dayInit();
    let rt; addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>{stripes();yearChart();monthChart();exChart();precChart();neveChart();},150);});
    if(window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change",stripes);
  }).catch(()=>{$("tiles").innerHTML='<div class="loading">Dati non disponibili.</div>';});

  function mean(xs){xs=xs.filter(v=>v!=null);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;}
  function movAvg(pts,w){const h=Math.floor(w/2);return pts.map((p,i)=>{if(i<h||i>=pts.length-h)return null;const s=pts.slice(i-h,i+h+1).map(q=>q[1]).filter(v=>v!=null);return s.length>=w*0.8?[p[0],mean(s)]:null;}).filter(Boolean);}
  function slope(pts){const n=pts.length,mx=mean(pts.map(p=>p[0])),my=mean(pts.map(p=>p[1]));let a=0,b=0;pts.forEach(p=>{a+=(p[0]-mx)*(p[1]-my);b+=(p[0]-mx)**2;});return a/b;}

  /* ---------- tiles ---------- */
  function tiles(){
    const early=mean(AC.filter(a=>a.y>=C.early[0]&&a.y<=C.early[1]).map(a=>a.tm)), recent=mean(A.filter(a=>a.y>=1991&&a.y<=2020).map(a=>a.tm));
    const L10=AC.slice(-10), last10=mean(L10.map(a=>a.tm));
    const rx=D.record.tmax.filter(r=>r.v===D.record.tmax[0].v), rn=D.record.tmin[0], rp=D.record.prec[0];
    const hot=[...AC].sort((a,b)=>b.tm-a.tm)[0], [y0,m0,d0]=D.dal.split("-").map(Number);
    $("lead-n").textContent=`Qui trovi ${D.giorni.toLocaleString("it-IT")} giorni di dati: come è cambiato il clima di ${C.citta}, le stagioni, i giorni estremi, ${D.neve?"la pioggia, la neve":"la pioggia"} e i record.`;
    const t=(lab,big,unit,who)=>`<div class="tile"><div class="lab">${lab}</div><div class="big">${big}<s>${unit}</s></div><div class="who">${who}</div></div>`;
    $("tiles").innerHTML=
      t("Anni di osservazioni",A[A.length-1].y-A[0].y+1,"",`dal ${d0===1?"1°":d0} ${MESI[m0-1]} ${y0}`)+
      t("Riscaldamento",sg(recent-early),"°C",`media 1991–2020 (${f1(recent)}°) contro ${C.early[0]}–${C.early[1]} (${f1(early)}°)`)+
      t("Anno più caldo",hot.y,"",`media ${f1(hot.tm)}°C · ultimi 10 anni ${f1(last10)}°`)+
      t("Record di caldo",f1(rx[0].v),"°C",rx.map(r=>dIt(r.d)).join(" e "))+
      t("Record di freddo",f1(rn.v),"°C",dIt(rn.d)+` · pioggia record ${f1(rp.v)} mm il ${dIt(rp.d)}`);
  }

  /* ---------- warming stripes ---------- */
  function hex(c){c=c.replace("#","");return [0,2,4].map(i=>parseInt(c.slice(i,i+2),16));}
  function mix(a,b,t){return "rgb("+a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(",")+")";}
  function stripeColor(an){const c=hex(css("--cold")),n=hex(css("--neutral")),w=hex(css("--warm"));const t=Math.max(-1,Math.min(1,an/2));return t<0?mix(n,c,-t):mix(n,w,t);}
  function stripes(){
    const el=$("stripes"), W=el.clientWidth, H=el.clientHeight, n=A.length, bw=W/n;
    let g=""; A.forEach((a,i)=>{if(a.tm!=null)g+=`<rect x="${(i*bw).toFixed(2)}" y="0" width="${(bw+0.6).toFixed(2)}" height="${H}" fill="${stripeColor(a.tm-BASE.tm)}"/>`;});
    $("stripes-ax").innerHTML=[A[0].y,...(W<560?C.tacche[0]:C.tacche[1]),A[n-1].y].map(y=>`<span style="left:${((y-A[0].y+(y===A[n-1].y?1:0))/n*100).toFixed(2)}%">${y}</span>`).join("");
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Strisce del riscaldamento: anomalia della temperatura media annua a ${C.nome} dal ${A[0].y} al ${A[n-1].y}">${g}<rect id="st-hl" x="-9" y="0" width="${Math.max(2,bw)}" height="${H}" fill="none" stroke="${css("--ink")}" stroke-width="1.5"/></svg><div class="tip"></div>`;
    const svg=el.querySelector("svg"),tip=el.querySelector(".tip"),hl=el.querySelector("#st-hl");
    svg.addEventListener("pointermove",e=>{const r=svg.getBoundingClientRect();const i=Math.max(0,Math.min(n-1,Math.floor((e.clientX-r.left)/r.width*n)));const a=A[i];
      hl.setAttribute("x",i*bw);tip.innerHTML=a.tm==null?`<b>${a.y}</b> · anno incompleto`:`<b>${a.y}</b> · media ${f1(a.tm)}°C<br><span class="m">${sg(a.tm-BASE.tm)}° rispetto al 1961–1990</span>`;place(el,tip,i*bw,10);});
    svg.addEventListener("pointerleave",()=>{tip.style.opacity=0;hl.setAttribute("x",-9);});
  }

  /* ---------- line chart generico ---------- */
  function ticks(lo,hi,n){const s0=(hi-lo)/n,m=Math.pow(10,Math.floor(Math.log10(s0)));const st=[1,2,2.5,5,10].map(k=>k*m).find(s=>s>=s0);const o=[];for(let v=Math.floor(lo/st)*st;v<hi+st-1e-9;v+=st)o.push(+v.toFixed(6));return o;}
  function place(el,tip,x,y){tip.style.opacity=1;const tw=tip.offsetWidth,W=el.clientWidth;let lx=x+14;if(lx+tw>W)lx=x-tw-14;if(lx<0)lx=0;tip.style.left=lx+"px";tip.style.top=Math.max(0,y-10)+"px";}
  /* opts: {pts:[[x,y]], avg:[[x,y]], bars:bool, avgCls, barCls, ref:{y,lab}, unit, tip(x)} */
  function lineChart(el,o){
    const W=el.clientWidth,H=el.clientHeight,m={l:44,r:12,t:12,b:26},iw=W-m.l-m.r,ih=H-m.t-m.b;
    const xs=o.pts.map(p=>p[0]), ys=o.pts.map(p=>p[1]).filter(v=>v!=null).concat(o.ref?[o.ref.y]:[]);
    const x0=Math.min(...xs)-(o.bars?0.6:0),x1=Math.max(...xs)+(o.bars?0.6:0);
    let lo=Math.min(...ys),hi=Math.max(...ys); if(o.bars) lo=0;
    const yT=ticks(lo,hi,5),y0=yT[0],y1=yT[yT.length-1];
    const X=x=>m.l+(x-x0)/(x1-x0)*iw, Y=v=>m.t+ih-(v-y0)/(y1-y0)*ih;
    let g="";
    yT.forEach(t=>{g+=`<line class="grid" x1="${m.l}" x2="${m.l+iw}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axl" x="${m.l-8}" y="${Y(t)+3.5}" text-anchor="end">${String(t).replace(".",",").replace("-","−")}${o.unit||""}</text>`;});
    const step=(x1-x0)>150?(W<520?100:50):(W<520?40:20);
    for(let x=Math.ceil(x0/step)*step;x<=Math.floor(x1);x+=step) g+=`<text class="axl" x="${X(x)}" y="${m.t+ih+18}" text-anchor="middle">${x}</text>`;
    if(o.bars){const bw=Math.max(1,iw/(x1-x0+1)-1.5);o.pts.forEach(p=>{if(p[1]!=null)g+=`<rect class="bar ${o.barCls||""}" x="${X(p[0])-bw/2}" y="${Y(p[1])}" width="${bw}" height="${Math.max(0,Y(y0)-Y(p[1]))}" rx="${Math.min(2,bw/2)}"/>`;});}
    else{let d="",pen=false;o.pts.forEach(p=>{if(p[1]==null){pen=false;return;}d+=(pen?"L":"M")+X(p[0]).toFixed(1)+" "+Y(p[1]).toFixed(1);pen=true;});g+=`<path class="annual" d="${d}"/>`;}
    if(o.ref) g+=`<line class="ref" x1="${m.l}" x2="${m.l+iw}" y1="${Y(o.ref.y)}" y2="${Y(o.ref.y)}"/>`;
    if(o.avg&&o.avg.length) g+=`<path class="avg ${o.avgCls||""}" d="${o.avg.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+" "+Y(p[1]).toFixed(1)).join("")}"/>`;
    g+=`<line class="cross" id="cx" x1="-9999" x2="-9999" y1="${m.t}" y2="${m.t+ih}"/><circle class="hp ctx" id="h1" r="4" cx="-99" cy="-99"/><circle class="hp ${o.avgCls||""}" id="h2" r="5" cx="-99" cy="-99"/>`;
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.label||""}">${g}</svg><div class="tip"></div>`;
    const svg=el.querySelector("svg"),tip=el.querySelector(".tip"),cx=el.querySelector("#cx"),h1=el.querySelector("#h1"),h2=el.querySelector("#h2");
    const byX=new Map(o.pts.map(p=>[p[0],p[1]])), avX=new Map((o.avg||[]).map(p=>[p[0],p[1]]));
    svg.addEventListener("pointermove",e=>{const r=svg.getBoundingClientRect();let x=Math.round(x0+(e.clientX-r.left-m.l)/iw*(x1-x0));x=Math.max(Math.ceil(x0),Math.min(Math.floor(x1),x));
      const v=byX.get(x),a=avX.get(x),px=X(x);cx.setAttribute("x1",px);cx.setAttribute("x2",px);
      if(v!=null&&!o.bars){h1.setAttribute("cx",px);h1.setAttribute("cy",Y(v));}else h1.setAttribute("cx",-99);
      if(a!=null){h2.setAttribute("cx",px);h2.setAttribute("cy",Y(a));}else h2.setAttribute("cx",-99);
      tip.innerHTML=o.tip(x,v,a);place(el,tip,px,m.t);});
    svg.addEventListener("pointerleave",()=>{tip.style.opacity=0;cx.setAttribute("x1",-9999);cx.setAttribute("x2",-9999);h1.setAttribute("cx",-99);h2.setAttribute("cx",-99);});
  }
  function segInit(id,cb){const s=$(id);s.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;s.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));cb(b.dataset.v);});}

  /* ---------- temperatura annua ---------- */
  const NOMEV={tm:"media",tx:"massima media",tn:"minima media"};
  let yv="tm"; segInit("seg-var",v=>{yv=v;yearChart();});
  function yearChart(){
    const pts=A.map(a=>[a.y,a[yv]]), avg=movAvg(pts,21);
    lineChart($("ch-year"),{pts,avg,ref:{y:BASE[yv]},unit:"°",label:"Temperatura "+NOMEV[yv]+" annua a "+C.nome,
      tip:(x,v,a)=>`<b>${x}</b><br>Temperatura ${NOMEV[yv]} <b>${f1(v)}°C</b>`+(a!=null?`<br><span class="m">media 21 anni ${f1(a)}° · ${sg(v-BASE[yv])}° sul 1961–90</span>`:"")});
    const s1=slope(pts.filter(p=>p[1]!=null))*100, s2=slope(pts.filter(p=>p[0]>=1981&&p[1]!=null))*10;
    $("trend-note").textContent=`Tendenza della temperatura ${NOMEV[yv]}: ${sg(s1)} °C per secolo sull'intera serie, ${sg(s2)} °C per decennio dal 1981.`;
  }

  /* ---------- mese / stagione ---------- */
  const PER=[...MESI.map((n,i)=>({k:"m"+i,lab:n[0].toUpperCase()+n.slice(1),ms:[i]})),
    {k:"djf",lab:"Inverno (dic–feb)",ms:[-1,0,1]},{k:"mam",lab:"Primavera (mar–mag)",ms:[2,3,4]},{k:"jja",lab:"Estate (giu–ago)",ms:[5,6,7]},{k:"son",lab:"Autunno (set–nov)",ms:[8,9,10]},{k:"ann",lab:"Anno intero",ms:[0,1,2,3,4,5,6,7,8,9,10,11]}];
  let mv="tm", per=PER[4];
  function monthInit(){
    $("sel-per").innerHTML=`<optgroup label="Mesi">${PER.slice(0,12).map(p=>`<option value="${p.k}">${p.lab}</option>`).join("")}</optgroup><optgroup label="Stagioni">${PER.slice(12).map(p=>`<option value="${p.k}">${p.lab}</option>`).join("")}</optgroup>`;
    const cur=PER[new Date().getMonth()]; per=cur; $("sel-per").value=cur.k;
    $("sel-per").addEventListener("change",e=>{per=PER.find(p=>p.k===e.target.value);monthChart();});
    segInit("seg-mvar",v=>{mv=v;monthChart();}); monthChart();
  }
  const byY=()=>new Map(A.map(a=>[a.y,a]));
  function perVal(y,M){const vals=per.ms.map(i=>{const a=M.get(i<0?y-1:y);if(!a)return null;const r=a.m[i<0?11:i];if(!r||r[0]==null)return null;return mv==="tx"?r[0]:mv==="tn"?r[1]:(r[0]+r[1])/2;});return vals.some(v=>v==null)?null:mean(vals);}
  function monthChart(){
    if(!A.length) return; const M=byY();
    const pts=A.map(a=>[a.y,perVal(a.y,M)]), base=mean(pts.filter(p=>p[0]>=1961&&p[0]<=1990).map(p=>p[1])), avg=movAvg(pts,21);
    const nome=per.lab.toLowerCase(), vv={tm:"media",tx:"massima",tn:"minima"}[mv];
    lineChart($("ch-month"),{pts,avg,ref:{y:base},unit:"°",label:`Temperatura ${vv} di ${nome} a ${C.nome}`,
      tip:(x,v,a)=>`<b>${per.lab} ${x}</b><br>Temperatura ${vv} <b>${f1(v)}°C</b>`+(v!=null?`<br><span class="m">${sg(v-base)}° sul 1961–90${a!=null?" · media 21 anni "+f1(a)+"°":""}</span>`:"")});
    const EP=C.epoche;
    $("ep-title").textContent=`${per.lab}: temperatura ${vv} per epoca`;
    $("ep").innerHTML=`<thead><tr><th>Periodo</th><th>Media</th><th>Più caldo</th><th>Più freddo</th></tr></thead><tbody>`+EP.map(([a,b])=>{const v=pts.filter(p=>p[0]>=a&&p[0]<=b&&p[1]!=null);const mx=v.reduce((p,q)=>q[1]>p[1]?q:p),mn=v.reduce((p,q)=>q[1]<p[1]?q:p);
      return `<tr><td>${a}–${b}</td><td class="v">${f1(mean(v.map(p=>p[1])))}°</td><td>${f1(mx[1])}° <span class="m">(${mx[0]})</span></td><td>${f1(mn[1])}° <span class="m">(${mn[0]})</span></td></tr>`;}).join("")+"</tbody>";
    const s=pts.filter(p=>p[1]!=null).sort((a,b)=>b[1]-a[1]), top=s.slice(0,5), bot=s.slice(-5).reverse();
    $("rk").innerHTML=`<thead><tr><th></th><th>Più caldi</th><th></th><th>Più freddi</th><th></th></tr></thead><tbody>`+top.map((p,i)=>`<tr><td class="rank">${i+1}</td><td>${p[0]}</td><td class="v up">${f1(p[1])}°</td><td>${bot[i][0]}</td><td class="v down">${f1(bot[i][1])}°</td></tr>`).join("")+"</tbody>";
  }

  /* ---------- giorni estremi ---------- */
  const EX={c30:{n:"giorni con massima ≥ 30 °C",c:""},c35:{n:"giorni con massima ≥ 35 °C",c:""},tr20:{n:"notti tropicali (minima ≥ 20 °C)",c:""},g0:{n:"giorni di gelo (minima < 0 °C)",c:"sky"}};
  let ev="c30"; function exInit(){segInit("seg-ex",v=>{ev=v;exChart();});exChart();}
  function exChart(){
    if(!A.length) return; const pts=A.map(a=>[a.y,a[ev]]), avg=movAvg(pts,11), cls=EX[ev].c;
    $("ex-leg").style.background=cls?"var(--sky)":"var(--amber)";
    lineChart($("ch-ex"),{pts,avg,bars:true,avgCls:cls,label:"Numero di "+EX[ev].n+" per anno",tip:(x,v,a)=>`<b>${x}</b><br><b>${v??"—"}</b> ${EX[ev].n}`+(a!=null?`<br><span class="m">media 11 anni ${f1(a)}</span>`:"")});
    const e=mean(AC.filter(a=>a.y>=1961&&a.y<=1990).map(a=>a[ev])), L10=AC.slice(-10), l=mean(L10.map(a=>a[ev])), mx=[...AC].sort((a,b)=>b[ev]-a[ev])[0];
    $("ex-note").textContent=`In media ${f1(e)} ${EX[ev].n} l'anno nel 1961–1990, ${f1(l)} negli ultimi dieci anni (${L10[0].y}–${L10[9].y}). L'anno con più ${EX[ev].n.split(" (")[0]}: ${mx.y}, con ${mx[ev]}.`;
  }

  /* ---------- pioggia ---------- */
  function precChart(){
    if(!A.length) return; const pts=A.filter(a=>a.y>=D.prec_dal).map(a=>[a.y,a.p]), avg=movAvg(pts,11), base=mean(pts.filter(p=>p[0]>=1991&&p[0]<=2020).map(p=>p[1]));
    lineChart($("ch-prec"),{pts,avg,bars:true,barCls:"sky",avgCls:"sky",ref:{y:base},unit:"",label:(C.precNome||"Pioggia")+" annua a "+C.nome+" dal "+D.prec_dal,
      tip:(x,v,a)=>`<b>${x}</b><br>${C.precNome||"Pioggia"} <b>${v??"—"} mm</b>`+(a!=null?`<br><span class="m">media 11 anni ${Math.round(a)} mm · media 1991–2020 ${Math.round(base)} mm</span>`:"")});
  }
  function normTable(){
    const a=D.normali["1961-1990"], b=D.normali["1991-2020"];
    const d=(x,y)=>{const v=y-x;return `<span class="${v>0?"up":"down"}">${sg(v)}</span>`;};
    $("norm").innerHTML=`<thead><tr><th>Mese</th><th>Max 91–20</th><th>Min 91–20</th><th>Δ media</th><th>Pioggia</th></tr></thead><tbody>`+
      b.map((r,i)=>`<tr><td>${MES[i]}</td><td class="v">${f1(r[0])}°</td><td>${f1(r[1])}°</td><td>${d((a[i][0]+a[i][1])/2,(r[0]+r[1])/2)}°</td><td>${Math.round(r[2])} mm</td></tr>`).join("")+"</tbody>";
  }

  /* ---------- record ---------- */
  function records(){
    const rows=(L,u,cls)=>"<tbody>"+L.slice(0,10).map((r,i)=>`<tr><td class="rank">${i+1}</td><td>${dIt(r.d)}</td><td class="v ${cls}">${f1(r.v)}${u}</td></tr>`).join("")+"</tbody>";
    $("r-tx").innerHTML=rows(D.record.tmax,"°","up"); $("r-tn").innerHTML=rows(D.record.tmin,"°","down"); $("r-p").innerHTML=rows(D.record.prec," mm","");
  }

  /* ---------- neve (solo se la serie ce l'ha) ---------- */
  function neve(){
    const sec=$("sec-neve"); if(!sec||!D.neve) return; sec.hidden=false;
    const N=D.neve.stagioni, lab=y=>(y-1)+"/"+String(y).slice(2);
    const top=[...N].sort((a,b)=>b.cm-a.cm), low=[...N].sort((a,b)=>a.cm-b.cm);
    const e=mean(N.filter(s=>s.y>=1962&&s.y<=1991).map(s=>s.cm)), L10=N.slice(-10), l=mean(L10.map(s=>s.cm));
    $("neve-note").textContent=`In media ${Math.round(e)} cm a stagione nel 1961–1990, ${Math.round(l)} cm nelle ultime dieci stagioni (${lab(L10[0].y)}–${lab(L10[9].y)}). La più nevosa: ${lab(top[0].y)}, con ${Math.round(top[0].cm)} cm; la meno nevosa: ${lab(low[0].y)}, con ${f1(low[0].cm)} cm.`;
    const rows=L=>"<tbody>"+L.map((r,i)=>`<tr><td class="rank">${i+1}</td><td>${r.a}</td><td class="v">${r.b}</td></tr>`).join("")+"</tbody>";
    $("r-neve").innerHTML=rows(D.neve.record.slice(0,10).map(r=>({a:dIt(r.d),b:f1(r.v/10)+" cm"})));
    $("r-stag").innerHTML=rows(top.slice(0,10).map(s=>({a:"inverno "+lab(s.y),b:Math.round(s.cm)+" cm"})));
    neveChart();
  }
  function neveChart(){
    if(!D||!D.neve||!$("ch-neve")) return; const N=D.neve.stagioni, byY=new Map(N.map(s=>[s.y,s]));
    const pts=[]; for(let y=N[0].y;y<=N[N.length-1].y;y++) pts.push([y,byY.has(y)?byY.get(y).cm:null]);
    const avg=movAvg(pts,11), base=mean(N.filter(s=>s.y>=1992&&s.y<=2021).map(s=>s.cm));
    lineChart($("ch-neve"),{pts,avg,bars:true,barCls:"sky",avgCls:"sky",ref:{y:base},unit:"",label:"Neve caduta per stagione invernale a "+C.nome,
      tip:(x,v,a)=>{const s=byY.get(x);return `<b>Inverno ${x-1}/${String(x).slice(2)}</b><br>Neve caduta <b>${v==null?"—":Math.round(v)+" cm"}</b>`+(s?`<br><span class="m">${s.g25} giorni con almeno 2,5 cm · massimo in un giorno ${f1(s.max)} cm</span>`:"")+(a!=null?`<br><span class="m">media 11 stagioni ${Math.round(a)} cm · media 1991–2020 ${Math.round(base)} cm</span>`:"");}});
  }

  /* ---------- un giorno nella storia ---------- */
  let DAILY=null;
  function dayInit(){
    const t=new Date(); $("d-day").innerHTML=Array.from({length:31},(_,i)=>`<option>${i+1}</option>`).join(""); $("d-mon").innerHTML=MESI.map((n,i)=>`<option value="${i+1}">${n}</option>`).join("");
    $("d-day").value=t.getDate(); $("d-mon").value=t.getMonth()+1; $("d-year").placeholder="es. 1985";
    $("d-go").addEventListener("click",showDay);
  }
  async function loadDaily(){
    if(DAILY) return DAILY; $("d-res").innerHTML='<span class="loading">Carico la serie giornaliera (circa 2 MB)…</span>';
    const txt=await (await fetch("./data/serie/"+C.slug+".csv")).text(); DAILY=new Map();
    txt.split("\n").slice(1).forEach(l=>{if(!l)return;const [d,p,tx,tn,sn]=l.trim().split(",");const k=d.slice(5);if(!DAILY.has(k))DAILY.set(k,[]);DAILY.get(k).push({y:+d.slice(0,4),p:p===""?null:+p,tx:tx===""?null:+tx,tn:tn===""?null:+tn,sn:(sn===undefined||sn==="")?null:+sn});});
    return DAILY;
  }
  async function showDay(){
    const dd=+$("d-day").value, mm=+$("d-mon").value, yy=+$("d-year").value||null;
    const k=String(mm).padStart(2,"0")+"-"+String(dd).padStart(2,"0");
    let L; try{L=(await loadDaily()).get(k);}catch(e){$("d-res").innerHTML='<span class="loading">Serie giornaliera non disponibile.</span>';return;}
    if(!L){$("d-res").innerHTML=`<span class="loading">Questa data non esiste.</span>`;return;}
    const lab=dd+" "+MESI[mm-1], il=(dd===8||dd===11)?"l'":"il ", Il=il==="il "?"Il ":"L'";
    const nx=L.filter(r=>r.tx!=null), nn=L.filter(r=>r.tn!=null), np=L.filter(r=>r.p!=null);
    const hi=[...nx].sort((a,b)=>b.tx-a.tx), lo=[...nn].sort((a,b)=>a.tn-b.tn), wet=[...np].sort((a,b)=>b.p-a.p);
    const n91=L.filter(r=>r.y>=1991&&r.y<=2020), rainy=np.filter(r=>r.p>=1).length;
    const fact=(lab,v,s)=>`<div class="fact"><div class="lab">${lab}</div><b>${v}</b><span>${s}</span></div>`;
    let h=`<div class="facts">`+
      fact("Massima tipica",f1(mean(n91.map(r=>r.tx)))+"°","media 1991–2020")+
      fact("Minima tipica",f1(mean(n91.map(r=>r.tn)))+"°","media 1991–2020")+
      fact("Record di caldo",f1(hi[0].tx)+"°","nel "+hi[0].y)+
      fact("Record di freddo",f1(lo[0].tn)+"°","nel "+lo[0].y)+
      `</div>`;
    if(yy){const r=L.find(x=>x.y===yy);
      const pos=hi.findIndex(x=>x.y===yy)+1;
      h+=r?`<p><b>${Il}${lab} ${yy}</b> ${C.luogo}: massima <b>${f1(r.tx)}°C</b>, minima <b>${f1(r.tn)}°C</b>${r.p!=null?`, pioggia <b>${f1(r.p)} mm</b>`:""}${r.sn?`, neve <b>${f1(r.sn/10)} cm</b>`:""}. ${pos===1?`È ${il}${lab} più caldo`:`È al ${pos}° posto tra ${il==="il "?"i":"gli"} ${lab} più caldi`} su ${nx.length} anni di misure.</p>`:`<p>Nessun dato per ${il}${lab} ${yy}.</p>`;}
    h+=`<p class="note">Dal ${D.prec_dal} ${il}${lab} ha piovuto (almeno 1 mm) ${rainy} volte su ${np.length}, circa ${Math.round(rainy/np.length*100)} anni su 100. Il più piovoso è stato quello del ${wet[0].y}, con ${f1(wet[0].p)} mm.</p>`;
    const ns=L.filter(r=>r.sn!=null);
    if(ns.length){const snowy=ns.filter(r=>r.sn>0).sort((a,b)=>b.sn-a.sn);
      h+=`<p class="note">${snowy.length?`Ha nevicato ${il}${lab} ${snowy.length} volte su ${ns.length}; la nevicata più abbondante in questa data è del ${snowy[0].y}, con ${f1(snowy[0].sn/10)} cm.`:`${Il}${lab} non ha mai nevicato in ${ns.length} anni di misure.`}</p>`;}
    const row=(r,v,u,c)=>`<tr><td>${r.y}</td><td class="v ${c}">${f1(v)}${u}</td></tr>`;
    h+=`<div class="three" style="margin-top:12px">
      <div><h3>🔥 ${lab}: i più caldi</h3><table><tbody>${hi.slice(0,5).map(r=>row(r,r.tx,"°","up")).join("")}</tbody></table></div>
      <div><h3>🧊 ${lab}: i più freddi</h3><table><tbody>${lo.slice(0,5).map(r=>row(r,r.tn,"°","down")).join("")}</tbody></table></div>
      <div><h3>🌧️ ${lab}: i più piovosi</h3><table><tbody>${wet.slice(0,5).map(r=>row(r,r.p," mm","")).join("")}</tbody></table></div></div>`;
    $("d-res").innerHTML=h;
  }
})();
