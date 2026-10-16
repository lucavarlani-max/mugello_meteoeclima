/* Pagina della serie di Kremsmünster: dati mensili da data/serie/kremsmuenster.json (scripts/fetch_kremsmuenster.py).
   Stessi grafici delle altre serie storiche (serie-storica.js), ma su medie e somme mensili: non ci sono dati giornalieri. */
(function(){
  const $=id=>document.getElementById(id);
  const MESI=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
  const MES=["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  const f1=v=>v==null?"—":(Math.round(v*10)/10).toFixed(1).replace(".",",").replace("-","−");
  const sg=v=>v==null?"—":(v>0?"+":"")+f1(v);
  const mIt=s=>MESI[+s.slice(5,7)-1]+" "+s.slice(0,4);
  const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const EARLY=[1851,1900];          // periodo di confronto: dal 1851, quando si misurano anche massime e minime medie
  let D=null, A=[], BASE={};

  fetch("./data/serie/kremsmuenster.json").then(r=>r.json()).then(d=>{
    D=d; A=d.anni.filter(a=>a.y>=1768);
    ["tm","txm","tnm"].forEach(k=>{BASE[k]=mean(A.filter(a=>a.y>=1961&&a.y<=1990).map(a=>a[k]));});
    tiles(); stripes(); yearChart(); monthInit(); precChart(); sommerChart(); normTable(); records(); confronto();
    let rt; addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>{stripes();yearChart();monthChart();precChart();sommerChart();},150);});
    if(window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change",stripes);
  }).catch(()=>{$("tiles").innerHTML='<div class="loading">Dati non disponibili.</div>';});

  function mean(xs){xs=xs.filter(v=>v!=null);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;}
  function movAvg(pts,w){const h=Math.floor(w/2);return pts.map((p,i)=>{if(i<h||i>=pts.length-h)return null;const s=pts.slice(i-h,i+h+1).map(q=>q[1]).filter(v=>v!=null);return s.length>=w*0.8?[p[0],mean(s)]:null;}).filter(Boolean);}
  function slope(pts){const n=pts.length,mx=mean(pts.map(p=>p[0])),my=mean(pts.map(p=>p[1]));let a=0,b=0;pts.forEach(p=>{a+=(p[0]-mx)*(p[1]-my);b+=(p[0]-mx)**2;});return a/b;}

  function tiles(){
    const AC=A.filter(a=>a.tm!=null), early=mean(AC.filter(a=>a.y>=EARLY[0]&&a.y<=EARLY[1]).map(a=>a.tm)), recent=mean(AC.filter(a=>a.y>=1991&&a.y<=2020).map(a=>a.tm));
    const hot=[...AC].sort((a,b)=>b.tm-a.tm)[0], L10=AC.slice(-10), rx=D.record.tx[0], rn=D.record.tn[0], rp=D.record.rr_max[0];
    $("lead-n").textContent=`Qui trovi ${D.mesi.toLocaleString("it-IT")} mesi di misure, dal dicembre 1767 al ${mIt(D.al)}: come è cambiato il clima, le stagioni, la pioggia e i record.`;
    const t=(lab,big,unit,who)=>`<div class="tile"><div class="lab">${lab}</div><div class="big">${big}<s>${unit}</s></div><div class="who">${who}</div></div>`;
    $("tiles").innerHTML=
      t("Anni di osservazioni",A[A.length-1].y-1768+1,"","temperatura media dal dicembre 1767")+
      t("Riscaldamento",sg(recent-early),"°C",`media 1991–2020 (${f1(recent)}°) contro ${EARLY[0]}–${EARLY[1]} (${f1(early)}°)`)+
      t("Anno più caldo",hot.y,"",`media ${f1(hot.tm)}°C · ultimi 10 anni ${f1(mean(L10.map(a=>a.tm)))}°`)+
      t("Record di caldo",f1(rx.v),"°C",`massima di ${mIt(rx.m)}`)+
      t("Record di freddo",f1(rn.v),"°C",`minima di ${mIt(rn.m)} · pioggia record in un giorno ${f1(rp.v)} mm (${mIt(rp.m)})`);
  }

  function hex(c){c=c.replace("#","");return [0,2,4].map(i=>parseInt(c.slice(i,i+2),16));}
  function mix(a,b,t){return "rgb("+a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(",")+")";}
  function stripeColor(an){const c=hex(css("--cold")),n=hex(css("--neutral")),w=hex(css("--warm"));const t=Math.max(-1,Math.min(1,an/2));return t<0?mix(n,c,-t):mix(n,w,t);}
  function stripes(){
    const el=$("stripes"), W=el.clientWidth, H=el.clientHeight, n=A.length, bw=W/n;
    let g=""; A.forEach((a,i)=>{if(a.tm!=null)g+=`<rect x="${(i*bw).toFixed(2)}" y="0" width="${(bw+0.6).toFixed(2)}" height="${H}" fill="${stripeColor(a.tm-BASE.tm)}"/>`;});
    $("stripes-ax").innerHTML=[A[0].y,...(W<560?[1850,1950]:[1800,1850,1900,1950,2000]),A[n-1].y].map(y=>`<span style="left:${((y-A[0].y+(y===A[n-1].y?1:0))/n*100).toFixed(2)}%">${y}</span>`).join("");
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Strisce del riscaldamento: anomalia della temperatura media annua a Kremsmünster dal ${A[0].y} al ${A[n-1].y}">${g}<rect id="st-hl" x="-9" y="0" width="${Math.max(2,bw)}" height="${H}" fill="none" stroke="${css("--ink")}" stroke-width="1.5"/></svg><div class="tip"></div>`;
    const svg=el.querySelector("svg"),tip=el.querySelector(".tip"),hl=el.querySelector("#st-hl");
    svg.addEventListener("pointermove",e=>{const r=svg.getBoundingClientRect();const i=Math.max(0,Math.min(n-1,Math.floor((e.clientX-r.left)/r.width*n)));const a=A[i];
      hl.setAttribute("x",i*bw);tip.innerHTML=a.tm==null?`<b>${a.y}</b> · anno incompleto`:`<b>${a.y}</b> · media ${f1(a.tm)}°C<br><span class="m">${sg(a.tm-BASE.tm)}° rispetto al 1961–1990</span>`;place(el,tip,i*bw,10);});
    svg.addEventListener("pointerleave",()=>{tip.style.opacity=0;hl.setAttribute("x",-9);});
  }

  function ticks(lo,hi,n){const s0=(hi-lo)/n,m=Math.pow(10,Math.floor(Math.log10(s0)));const st=[1,2,2.5,5,10].map(k=>k*m).find(s=>s>=s0);const o=[];for(let v=Math.floor(lo/st)*st;v<hi+st-1e-9;v+=st)o.push(+v.toFixed(6));return o;}
  function place(el,tip,x,y){tip.style.opacity=1;const tw=tip.offsetWidth,W=el.clientWidth;let lx=x+14;if(lx+tw>W)lx=x-tw-14;if(lx<0)lx=0;tip.style.left=lx+"px";tip.style.top=Math.max(0,y-10)+"px";}
  /* opts: {pts, avg, bars, avgCls, barCls, ref:{y}, unit, tip, ombra:[x0,x1] (periodo da leggere con cautela)} */
  function lineChart(el,o){
    const W=el.clientWidth,H=el.clientHeight,m={l:44,r:12,t:12,b:26},iw=W-m.l-m.r,ih=H-m.t-m.b;
    const xs=o.pts.map(p=>p[0]), ys=o.pts.map(p=>p[1]).filter(v=>v!=null).concat(o.ref?[o.ref.y]:[]);
    const x0=Math.min(...xs)-(o.bars?0.6:0),x1=Math.max(...xs)+(o.bars?0.6:0);
    let lo=Math.min(...ys),hi=Math.max(...ys); if(o.bars) lo=0;
    const yT=ticks(lo,hi,5),y0=yT[0],y1=yT[yT.length-1];
    const X=x=>m.l+(x-x0)/(x1-x0)*iw, Y=v=>m.t+ih-(v-y0)/(y1-y0)*ih;
    let g="";
    if(o.ombra&&o.ombra[1]>x0) g+=`<rect x="${X(Math.max(x0,o.ombra[0]))}" y="${m.t}" width="${X(Math.min(x1,o.ombra[1]))-X(Math.max(x0,o.ombra[0]))}" height="${ih}" fill="var(--line)" opacity=".45"/><text class="axl" x="${X(Math.max(x0,o.ombra[0]))+6}" y="${m.t+12}">letture antiche</text>`;
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

  const NOMEV={tm:"media",txm:"massima media",tnm:"minima media"};
  let yv="tm"; segInit("seg-var",v=>{yv=v;yearChart();});
  function yearChart(){
    const pts=A.map(a=>[a.y,a[yv]]).filter((p,i,L)=>yv==="tm"||p[0]>=1851), avg=movAvg(pts,21);
    lineChart($("ch-year"),{pts,avg,ref:{y:BASE[yv]},unit:"°",ombra:yv==="tm"?[1768,1850]:null,label:"Temperatura "+NOMEV[yv]+" annua a Kremsmünster",
      tip:(x,v,a)=>`<b>${x}</b><br>Temperatura ${NOMEV[yv]} <b>${f1(v)}°C</b>`+(a!=null?`<br><span class="m">media 21 anni ${f1(a)}° · ${sg(v-BASE[yv])}° sul 1961–90</span>`:"")});
    const ok=pts.filter(p=>p[1]!=null), s1=slope(ok.filter(p=>p[0]>=1851))*100, s2=slope(ok.filter(p=>p[0]>=1981))*10;
    $("trend-note").textContent=`Tendenza della temperatura ${NOMEV[yv]}: ${sg(s1)} °C per secolo dal 1851, ${sg(s2)} °C per decennio dal 1981.`;
  }

  const PER=[...MESI.map((n,i)=>({k:"m"+i,lab:n[0].toUpperCase()+n.slice(1),ms:[i]})),
    {k:"djf",lab:"Inverno (dic–feb)",ms:[-1,0,1]},{k:"mam",lab:"Primavera (mar–mag)",ms:[2,3,4]},{k:"jja",lab:"Estate (giu–ago)",ms:[5,6,7]},{k:"son",lab:"Autunno (set–nov)",ms:[8,9,10]},{k:"ann",lab:"Anno intero",ms:[0,1,2,3,4,5,6,7,8,9,10,11]}];
  const EP=[[1768,1850],[1851,1900],[1901,1950],[1951,2000],[2001,2025]];
  let per=PER[16], mv=0;
  function monthInit(){
    $("sel-per").innerHTML=`<optgroup label="Mesi">${PER.slice(0,12).map(p=>`<option value="${p.k}">${p.lab}</option>`).join("")}</optgroup><optgroup label="Stagioni">${PER.slice(12).map(p=>`<option value="${p.k}">${p.lab}</option>`).join("")}</optgroup>`;
    per=PER[new Date().getMonth()]; $("sel-per").value=per.k;
    $("sel-per").addEventListener("change",e=>{per=PER.find(p=>p.k===e.target.value);monthChart();});
    segInit("seg-mvar",v=>{mv=+v;monthChart();}); monthChart();
  }
  function perVal(y,M){const v=per.ms.map(i=>{const a=M.get(i<0?y-1:y);return a&&a.m[i<0?11:i]?a.m[i<0?11:i][mv]:null;});return v.some(x=>x==null)?null:mean(v);}
  function monthChart(){
    const M=new Map(D.anni.map(a=>[a.y,a])), pts=A.map(a=>[a.y,perVal(a.y,M)]).filter(p=>mv===0||p[0]>=1851);
    const base=mean(pts.filter(p=>p[0]>=1961&&p[0]<=1990).map(p=>p[1])), avg=movAvg(pts,21), vv=["media","massima media","minima media"][mv];
    lineChart($("ch-month"),{pts,avg,ref:{y:base},unit:"°",ombra:mv===0?[1768,1850]:null,label:`Temperatura ${vv} di ${per.lab.toLowerCase()} a Kremsmünster`,
      tip:(x,v,a)=>`<b>${per.lab} ${x}</b><br>Temperatura ${vv} <b>${f1(v)}°C</b>`+(v!=null?`<br><span class="m">${sg(v-base)}° sul 1961–90${a!=null?" · media 21 anni "+f1(a)+"°":""}</span>`:"")});
    $("ep-title").textContent=`${per.lab}: temperatura ${vv} per epoca`;
    $("ep").innerHTML=`<thead><tr><th>Periodo</th><th>Media</th><th>Più caldo</th><th>Più freddo</th></tr></thead><tbody>`+EP.map(([a,b])=>{const v=pts.filter(p=>p[0]>=a&&p[0]<=b&&p[1]!=null);if(!v.length)return "";
      const mx=v.reduce((p,q)=>q[1]>p[1]?q:p),mn=v.reduce((p,q)=>q[1]<p[1]?q:p);
      return `<tr><td>${a}–${Math.min(b,A[A.length-1].y)}</td><td class="v">${f1(mean(v.map(p=>p[1])))}°</td><td>${f1(mx[1])}° <span class="m">(${mx[0]})</span></td><td>${f1(mn[1])}° <span class="m">(${mn[0]})</span></td></tr>`;}).join("")+"</tbody>";
    const s=pts.filter(p=>p[1]!=null).sort((a,b)=>b[1]-a[1]), top=s.slice(0,5), bot=s.slice(-5).reverse();
    $("rk").innerHTML=`<thead><tr><th></th><th>Più caldi</th><th></th><th>Più freddi</th><th></th></tr></thead><tbody>`+top.map((p,i)=>`<tr><td class="rank">${i+1}</td><td>${p[0]}</td><td class="v up">${f1(p[1])}°</td><td>${bot[i][0]}</td><td class="v down">${f1(bot[i][1])}°</td></tr>`).join("")+"</tbody>";
  }

  function precChart(){
    const pts=A.filter(a=>a.y>=1821).map(a=>[a.y,a.p]), avg=movAvg(pts,11), base=mean(pts.filter(p=>p[0]>=1991&&p[0]<=2020).map(p=>p[1]));
    lineChart($("ch-prec"),{pts,avg,bars:true,barCls:"sky",avgCls:"sky",ref:{y:base},label:"Precipitazione annua a Kremsmünster dal 1821",
      tip:(x,v,a)=>`<b>${x}</b><br>Precipitazione <b>${v==null?"anno incompleto":Math.round(v)+" mm"}</b>`+(a!=null?`<br><span class="m">media 11 anni ${Math.round(a)} mm · media 1991–2020 ${Math.round(base)} mm</span>`:"")});
    const ok=pts.filter(p=>p[1]!=null), w=[...ok].sort((a,b)=>b[1]-a[1]);
    $("prec-note").textContent=`Media 1991–2020: ${Math.round(base)} mm l'anno. L'anno più piovoso è il ${w[0][0]} (${Math.round(w[0][1])} mm), il più secco il ${w[w.length-1][0]} (${Math.round(w[w.length-1][1])} mm).`;
  }
  function sommerChart(){
    const pts=A.filter(a=>a.y>=1876).map(a=>[a.y,a.sommer]), avg=movAvg(pts,11), base=mean(pts.filter(p=>p[0]>=1961&&p[0]<=1990).map(p=>p[1]));
    lineChart($("ch-som"),{pts,avg,bars:true,ref:{y:base},label:"Giorni estivi (massima di almeno 25 °C) a Kremsmünster",
      tip:(x,v,a)=>`<b>${x}</b><br>Giorni estivi <b>${v==null?"—":v}</b>`+(a!=null?`<br><span class="m">media 11 anni ${Math.round(a)} · media 1961–1990 ${Math.round(base)}</span>`:"")});
    const r=mean(pts.filter(p=>p[0]>=1991&&p[0]<=2020).map(p=>p[1]));
    $("som-note").textContent=`In media ${Math.round(base)} giorni estivi l'anno nel 1961–1990, ${Math.round(r)} nel 1991–2020.`;
  }
  function normTable(){
    const a=D.normali["1961-1990"], b=D.normali["1991-2020"];
    $("norm").innerHTML=`<thead><tr><th>Mese</th><th>Max 91–20</th><th>Min 91–20</th><th>Δ media</th><th>Pioggia</th></tr></thead><tbody>`+
      b.map((r,i)=>{const d=r[0]-a[i][0];return `<tr><td>${MES[i]}</td><td class="v">${f1(r[1])}°</td><td>${f1(r[2])}°</td><td><span class="${d>0?"up":"down"}">${sg(d)}</span>°</td><td>${Math.round(r[3])} mm</td></tr>`;}).join("")+"</tbody>";
  }
  function records(){
    const rows=(L,u,cls)=>"<tbody>"+L.slice(0,10).map((r,i)=>`<tr><td class="rank">${i+1}</td><td>${mIt(r.m)}</td><td class="v ${cls}">${f1(r.v)}${u}</td></tr>`).join("")+"</tbody>";
    $("r-tx").innerHTML=rows(D.record.tx,"°","up"); $("r-tn").innerHTML=rows(D.record.tn,"°","down"); $("r-p").innerHTML=rows(D.record.rr_max," mm","");
  }
  function confronto(){
    const c=D.confronto, s=c&&c.scarti; if(!s||!s.tm){$("conf").textContent="Il confronto fra le due stazioni non è disponibile.";return;}
    const nome={tm:"temperatura media",txm:"massima media",tnm:"minima media",rr:"precipitazione mensile"};
    $("conf").innerHTML=`<p class="sub" style="margin-top:0">Dal ${mIt(c.periodo[0])} al ${mIt(c.periodo[1])} le due stazioni hanno misurato insieme. Differenza media della stazione automatica rispetto a quella storica:</p><ul class="note">`+
      Object.entries(s).map(([k,v])=>`<li><b>${nome[k]}</b>: ${k==="rr"?sg(v.media)+" mm":sg(v.media)+" °C"} in media su ${v.n} mesi (da ${k==="rr"?sg(Math.min(...v.mesi))+" a "+sg(Math.max(...v.mesi))+" mm":sg(Math.min(...v.mesi))+" a "+sg(Math.max(...v.mesi))+" °C"} a seconda del mese)</li>`).join("")+
      `</ul><p class="note">La serie unita usa la stazione storica fino al 2008 e quella automatica dal 2009, senza correzioni: queste differenze danno l'ordine di grandezza dell'errore possibile nel punto di giunzione.</p>`;
  }
})();
