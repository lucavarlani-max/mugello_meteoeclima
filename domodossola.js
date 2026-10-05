/* Pagina di Domodossola: dati annuali e mensili (non giornalieri) digitalizzati dalle tabelle
   pubblicate su Nimbus 72 (Società Meteorologica Italiana / CNR-ISE), serie del Collegio Rosmini
   1872-2013. A differenza delle altre serie storiche del sito non ci sono massime/minime separate,
   conteggi di giorni estremi per anno, né dati giornalieri: niente "un giorno nella storia". */
(function(){
  const $=id=>document.getElementById(id);
  const MESI=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
  const MES=["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  const f1=v=>v==null?"—":(Math.round(v*10)/10).toFixed(1).replace(".",",").replace("-","−");
  const sg=v=>v==null?"—":(v>0?"+":"")+f1(v);
  const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let D=null, A=[];

  fetch("./data/serie/domodossola.json").then(r=>r.json()).then(d=>{
    D=d; A=d.anni;
    tiles(); stripes(); yearChart(); monthInit(); precChart(); normTable(); records(); periodi(); neve(); cifre();
    let rt; addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>{stripes();yearChart();monthChart();precChart();neveChart();},150);});
    if(window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change",stripes);
  }).catch(()=>{$("tiles").innerHTML='<div class="loading">Dati non disponibili.</div>';});

  function mean(xs){xs=xs.filter(v=>v!=null);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;}
  function movAvg(pts,w){const h=Math.floor(w/2);return pts.map((p,i)=>{if(i<h||i>=pts.length-h)return null;const s=pts.slice(i-h,i+h+1).map(q=>q[1]).filter(v=>v!=null);return s.length>=w*0.8?[p[0],mean(s)]:null;}).filter(Boolean);}
  function slope(pts){const n=pts.length,mx=mean(pts.map(p=>p[0])),my=mean(pts.map(p=>p[1]));let a=0,b=0;pts.forEach(p=>{a+=(p[0]-mx)*(p[1]-my);b+=(p[0]-mx)**2;});return a/b;}
  const MESEIDX={Gen:0,Feb:1,Mar:2,Apr:3,Mag:4,Giu:5,Lug:6,Ago:7,Set:8,Ott:9,Nov:10,Dic:11};
  function dataRecord(r){const [gg,aaaa]=r.data.split(".");return gg+" "+MESI[MESEIDX[r.mese]]+" "+aaaa;}

  /* ---------- tiles ---------- */
  function tiles(){
    const hot=[...A].filter(a=>a.tm!=null).sort((a,b)=>b.tm-a.tm)[0];
    const rtx=D.record_mensili.tmax.reduce((p,q)=>q.v>p.v?q:p);
    const rtn=D.record_mensili.tmin.reduce((p,q)=>q.v<p.v?q:p);
    $("lead-n").textContent=`Qui trovi 142 anni di dati annuali e mensili (1872–2013): come è cambiato il clima di Domodossola, la pioggia, la neve e i record.`;
    const t=(lab,big,unit,who)=>`<div class="tile"><div class="lab">${lab}</div><div class="big">${big}<s>${unit}</s></div><div class="who">${who}</div></div>`;
    $("tiles").innerHTML=
      t("Anni di osservazioni",142,"","dal 1872 (dati dal dicembre 1871)")+
      t("Riscaldamento",sg(D.trend_omogeneizzato_secolo),"°C/secolo","1872–2013, serie omogeneizzata CNR-ISAC")+
      t("Anno più caldo",hot.y,"",`media ${f1(hot.tm)}°C`)+
      t("Record di caldo",f1(rtx.v),"°C",dataRecord(rtx))+
      t("Record di freddo",f1(rtn.v),"°C",dataRecord(rtn)+` · pioggia record ${D.cifre.giorno_piovoso[1]} mm il ${D.cifre.giorno_piovoso[0]}`);
  }

  /* ---------- warming stripes ---------- */
  function hex(c){c=c.replace("#","");return [0,2,4].map(i=>parseInt(c.slice(i,i+2),16));}
  function mix(a,b,t){return "rgb("+a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(",")+")";}
  function stripeColor(an){const c=hex(css("--cold")),n=hex(css("--neutral")),w=hex(css("--warm"));const t=Math.max(-1,Math.min(1,an/2));return t<0?mix(n,c,-t):mix(n,w,t);}
  function stripes(){
    const el=$("stripes"); if(!el) return;
    const W=el.clientWidth, H=el.clientHeight, n=A.length, bw=W/n, base=D.baseline.tm_1961_1990;
    let g=""; A.forEach((a,i)=>{if(a.tm!=null)g+=`<rect x="${(i*bw).toFixed(2)}" y="0" width="${(bw+0.6).toFixed(2)}" height="${H}" fill="${stripeColor(a.tm-base)}"/>`;});
    const tacche=[1900,1950,2000];
    $("stripes-ax").innerHTML=[A[0].y,...tacche,A[n-1].y].map(y=>`<span style="left:${((y-A[0].y+(y===A[n-1].y?1:0))/n*100).toFixed(2)}%">${y}</span>`).join("");
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Strisce del riscaldamento: anomalia della temperatura media annua a Domodossola dal ${A[0].y} al ${A[n-1].y}">${g}<rect id="st-hl" x="-9" y="0" width="${Math.max(2,bw)}" height="${H}" fill="none" stroke="${css("--ink")}" stroke-width="1.5"/></svg><div class="tip"></div>`;
    const svg=el.querySelector("svg"),tip=el.querySelector(".tip"),hl=el.querySelector("#st-hl");
    svg.addEventListener("pointermove",e=>{const r=svg.getBoundingClientRect();const i=Math.max(0,Math.min(n-1,Math.floor((e.clientX-r.left)/r.width*n)));const a=A[i];
      hl.setAttribute("x",i*bw);tip.innerHTML=a.tm==null?`<b>${a.y}</b> · anno incompleto`:`<b>${a.y}</b> · media ${f1(a.tm)}°C<br><span class="m">${sg(a.tm-base)}° rispetto al 1961–1990</span>`;place(el,tip,i*bw,10);});
    svg.addEventListener("pointerleave",()=>{tip.style.opacity=0;hl.setAttribute("x",-9);});
  }

  /* ---------- line chart generico (identico alle altre pagine di serie storiche) ---------- */
  function ticks(lo,hi,n){const s0=(hi-lo)/n,m=Math.pow(10,Math.floor(Math.log10(s0)));const st=[1,2,2.5,5,10].map(k=>k*m).find(s=>s>=s0);const o=[];for(let v=Math.floor(lo/st)*st;v<hi+st-1e-9;v+=st)o.push(+v.toFixed(6));return o;}
  function place(el,tip,x,y){tip.style.opacity=1;const tw=tip.offsetWidth,W=el.clientWidth;let lx=x+14;if(lx+tw>W)lx=x-tw-14;if(lx<0)lx=0;tip.style.left=lx+"px";tip.style.top=Math.max(0,y-10)+"px";}
  function lineChart(el,o){
    if(!el) return;
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
  function segInit(id,cb){const s=$(id);if(!s)return;s.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;s.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));cb(b.dataset.v);});}

  /* ---------- temperatura annua (sola media: non ci sono massime/minime separate) ---------- */
  function yearChart(){
    const pts=A.map(a=>[a.y,a.tm]), avg=movAvg(pts,21), base=D.baseline.tm_1961_1990;
    lineChart($("ch-year"),{pts,avg,ref:{y:base},unit:"°",label:"Temperatura media annua a Domodossola",
      tip:(x,v,a)=>`<b>${x}</b><br>Temperatura media <b>${f1(v)}°C</b>`+(a!=null?`<br><span class="m">media 21 anni ${f1(a)}° · ${sg(v-base)}° sul 1961–90</span>`:"")});
    const s1=slope(pts.filter(p=>p[1]!=null))*100;
    $("trend-note").textContent=`Tendenza calcolata sulla serie originale non omogeneizzata (questa pagina): ${sg(s1)} °C per secolo. Gli autori dello studio, usando una serie omogeneizzata a cura di CNR-ISAC per correggere la discontinuità del 1905 (spostamento degli strumenti dalla torretta alla capannina), calcolano invece +1,3 °C per secolo nel periodo 1872–2013: è questo il valore da considerare per il reale andamento climatico.`;
  }

  /* ---------- mese / stagione (solo media, niente massime/minime) ---------- */
  const PER=[...MESI.map((n,i)=>({k:"m"+i,lab:n[0].toUpperCase()+n.slice(1),ms:[i]})),
    {k:"djf",lab:"Inverno (dic–feb)",ms:[-1,0,1]},{k:"mam",lab:"Primavera (mar–mag)",ms:[2,3,4]},{k:"jja",lab:"Estate (giu–ago)",ms:[5,6,7]},{k:"son",lab:"Autunno (set–nov)",ms:[8,9,10]},{k:"ann",lab:"Anno intero",ms:[0,1,2,3,4,5,6,7,8,9,10,11]}];
  let per=PER[12];
  function monthInit(){
    $("sel-per").innerHTML=`<optgroup label="Mesi">${PER.slice(0,12).map(p=>`<option value="${p.k}">${p.lab}</option>`).join("")}</optgroup><optgroup label="Stagioni">${PER.slice(12).map(p=>`<option value="${p.k}">${p.lab}</option>`).join("")}</optgroup>`;
    const cur=PER[new Date().getMonth()]; per=cur; $("sel-per").value=cur.k;
    $("sel-per").addEventListener("change",e=>{per=PER.find(p=>p.k===e.target.value);monthChart();});
    monthChart();
  }
  const byY=()=>new Map(A.map(a=>[a.y,a]));
  function perVal(y,M){const vals=per.ms.map(i=>{const a=M.get(i<0?y-1:y);if(!a)return null;const r=a.m[i<0?11:i];return r?r[0]:null;});return vals.some(v=>v==null)?null:mean(vals);}
  function monthChart(){
    const M=byY();
    const pts=A.map(a=>[a.y,perVal(a.y,M)]), base=mean(pts.filter(p=>p[0]>=1961&&p[0]<=1990).map(p=>p[1])), avg=movAvg(pts,21);
    const nome=per.lab.toLowerCase();
    lineChart($("ch-month"),{pts,avg,ref:{y:base},unit:"°",label:`Temperatura media di ${nome} a Domodossola`,
      tip:(x,v,a)=>`<b>${per.lab} ${x}</b><br>Temperatura media <b>${f1(v)}°C</b>`+(v!=null?`<br><span class="m">${sg(v-base)}° sul 1961–90${a!=null?" · media 21 anni "+f1(a)+"°":""}</span>`:"")});
    const EP=[[1872,1904],[1905,1949],[1950,1999],[2000,2013]];
    $("ep-title").textContent=`${per.lab}: temperatura media per epoca`;
    $("ep").innerHTML=`<thead><tr><th>Periodo</th><th>Media</th><th>Più caldo</th><th>Più freddo</th></tr></thead><tbody>`+EP.map(([a,b])=>{const v=pts.filter(p=>p[0]>=a&&p[0]<=b&&p[1]!=null);if(!v.length)return"";const mx=v.reduce((p,q)=>q[1]>p[1]?q:p),mn=v.reduce((p,q)=>q[1]<p[1]?q:p);
      return `<tr><td>${a}–${b}</td><td class="v">${f1(mean(v.map(p=>p[1])))}°</td><td>${f1(mx[1])}° <span class="m">(${mx[0]})</span></td><td>${f1(mn[1])}° <span class="m">(${mn[0]})</span></td></tr>`;}).join("")+"</tbody>";
    const s=pts.filter(p=>p[1]!=null).sort((a,b)=>b[1]-a[1]), top=s.slice(0,5), bot=s.slice(-5).reverse();
    $("rk").innerHTML=`<thead><tr><th></th><th>Più caldi</th><th></th><th>Più freddi</th><th></th></tr></thead><tbody>`+top.map((p,i)=>`<tr><td class="rank">${i+1}</td><td>${p[0]}</td><td class="v up">${f1(p[1])}°</td><td>${bot[i][0]}</td><td class="v down">${f1(bot[i][1])}°</td></tr>`).join("")+"</tbody>";
  }

  /* ---------- pioggia ---------- */
  function precChart(){
    const pts=A.map(a=>[a.y,a.p]), avg=movAvg(pts,11), base=D.baseline.p_1961_1990;
    lineChart($("ch-prec"),{pts,avg,bars:true,barCls:"sky",avgCls:"sky",ref:{y:base},unit:"",label:"Pioggia annua a Domodossola",
      tip:(x,v,a)=>`<b>${x}</b><br>Pioggia <b>${v??"—"} mm</b>`+(a!=null?`<br><span class="m">media 11 anni ${Math.round(a)} mm · media 1961–90 ${Math.round(base)} mm</span>`:"")});
  }
  function normTable(){
    const N=D.normali;
    $("norm").innerHTML=`<thead><tr><th>Mese</th><th>Media 1961–90</th><th>Media 1905–2013</th><th>Δ</th><th>Pioggia 1961–90</th></tr></thead><tbody>`+
      MES.map((mm,i)=>{const a=N.tm_1961_1990[i],b=N.tm_1905_2013[i],v=b-a;
        return `<tr><td>${mm}</td><td class="v">${f1(a)}°</td><td>${f1(b)}°</td><td class="${v>0?"up":"down"}">${sg(v)}°</td><td>${Math.round(N.p_1961_1990[i])} mm</td></tr>`;}).join("")+"</tbody>";
  }

  /* ---------- record mensili (un record per mese: non c'è una serie giornaliera per una classifica dei 15) ---------- */
  function records(){
    $("r-tn").innerHTML="<thead><tr><th>Mese</th><th>Minima</th><th>Quando</th></tr></thead><tbody>"+
      D.record_mensili.tmin.map(r=>`<tr><td>${r.mese}</td><td class="v down">${f1(r.v)}°</td><td>${dataRecord(r)}${r.nota?` <span class="m" title="${r.nota}">*</span>`:""}</td></tr>`).join("")+"</tbody>";
    $("r-tx").innerHTML="<thead><tr><th>Mese</th><th>Massima</th><th>Quando</th></tr></thead><tbody>"+
      D.record_mensili.tmax.map(r=>`<tr><td>${r.mese}</td><td class="v up">${f1(r.v)}°</td><td>${dataRecord(r)}${r.nota?` <span class="m" title="${r.nota}">*</span>`:""}</td></tr>`).join("")+"</tbody>";
  }

  /* ---------- inverni più freddi / estati più calde ---------- */
  function periodi(){
    const tbl=(obj,unit)=>{
      const a=obj["1872-1904"], b=obj["1905-2013"];
      return `<thead><tr><th>Periodo 1872–1904</th><th>Periodo 1905–2013</th></tr></thead><tbody>`+
        a.map((r,i)=>`<tr><td>${r[0]} <span class="v">${f1(r[1])}°</span></td><td>${b[i][0]} <span class="v">${f1(b[i][1])}°</span></td></tr>`).join("")+"</tbody>";
    };
    $("t-inverni").innerHTML=tbl(D.inverni_piu_freddi);
    $("t-estati").innerHTML=tbl(D.estati_piu_calde);
  }

  /* ---------- neve ---------- */
  function neve(){
    const N=D.neve.filter(s=>s.annociv!=null);
    const top=[...N].sort((a,b)=>b.annociv-a.annociv), low=[...N].sort((a,b)=>a.annociv-b.annociv);
    const e=mean(D.neve.filter(s=>s.y>=1961&&s.y<=1990).map(s=>s.annociv)), L10=N.slice(-10), l=mean(L10.map(s=>s.annociv));
    $("neve-note").textContent=`In media ${Math.round(e)} cm l'anno nel 1961–1990, ${Math.round(l)} cm negli ultimi dieci anni con dati (${L10[0].y}–${L10[9].y}). L'anno più nevoso: ${top[0].y}, con ${Math.round(top[0].annociv)} cm; il meno nevoso: ${low[0].y}, con ${Math.round(low[0].annociv)} cm. La nevicata più abbondante in un solo giorno: 88 cm, il 25 febbraio 1888.`;
    const rows=L=>"<tbody>"+L.map((r,i)=>`<tr><td class="rank">${i+1}</td><td>${r.y}</td><td class="v">${Math.round(r.annociv)} cm</td></tr>`).join("")+"</tbody>";
    $("r-stag").innerHTML=rows(top.slice(0,10));
    neveChart();
  }
  function neveChart(){
    const N=D.neve, byYm=new Map(N.map(s=>[s.y,s]));
    const pts=[]; for(let y=N[0].y;y<=N[N.length-1].y;y++) pts.push([y,byYm.has(y)?byYm.get(y).annociv:null]);
    const avg=movAvg(pts,11), base=mean(N.filter(s=>s.y>=1961&&s.y<=1990).map(s=>s.annociv));
    lineChart($("ch-neve"),{pts,avg,bars:true,barCls:"sky",avgCls:"sky",ref:{y:base},unit:"",label:"Neve fresca caduta per anno a Domodossola",
      tip:(x,v,a)=>`<b>${x}</b><br>Neve caduta <b>${v==null?"—":Math.round(v)+" cm"}</b>`+(a!=null?`<br><span class="m">media 11 anni ${Math.round(a)} cm · media 1961–90 ${Math.round(base)} cm</span>`:"")});
  }

  /* ---------- clima in cifre ---------- */
  function cifre(){
    const c=D.cifre;
    $("cifre").innerHTML=[
      ["Temperatura media annua",f1(c.tmedia_annua)+" °C"],
      ["Mese più freddo",c.mese_freddo[0]+", "+f1(c.mese_freddo[1])+" °C"],
      ["Mese più caldo",c.mese_caldo[0]+", "+f1(c.mese_caldo[1])+" °C"],
      ["Giorni di gelo l'anno",c.giorni_gelo],
      ["Giorno più freddo",c.giorno_freddo[0]+" ("+f1(c.giorno_freddo[1])+" °C)"],
      ["Giorno più caldo",c.giorno_caldo[0]+" ("+f1(c.giorno_caldo[1])+" °C)"],
      ["Precipitazioni medie annue",c.prec_media_annua+" mm"],
      ["Mese più piovoso",c.mese_piovoso[0]+", "+c.mese_piovoso[1]+" mm"],
      ["Mese più secco",c.mese_secco[0]+", "+c.mese_secco[1]+" mm"],
      ["Giorni piovosi l'anno",c.giorni_piovosi],
      ["Giorno più piovoso",c.giorno_piovoso[0]+" ("+c.giorno_piovoso[1]+" mm)"],
      ["Neve fresca media annua",c.neve_media_annua+" cm"],
      ["Giorni con nevicata l'anno",c.giorni_nevicata],
      ["Giorno più nevoso",c.giorno_nevoso[0]+" ("+c.giorno_nevoso[1]+" cm)"],
    ].map(([lab,v])=>`<div class="fact"><div class="lab">${lab}</div><b style="font-size:16px">${v}</b></div>`).join("");
  }
})();
