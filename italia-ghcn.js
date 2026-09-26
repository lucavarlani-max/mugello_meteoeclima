/* Pagina "Italia, stazioni NOAA" delle Serie storiche: grafici da data/serie/italia-ghcn.json. */
(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const f1=v=>v==null||isNaN(v)?"—":(Math.round(v*10)/10).toFixed(1).replace(".",",").replace("-","−");
  const f2=v=>v==null||isNaN(v)?"—":v.toFixed(2).replace(".",",").replace("-","−");
  const sg=v=>(v>0?"+":"")+f2(v);
  const MES=["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  const dIt=iso=>{const [y,m,d]=iso.split("-").map(Number);return d+" "+MES[m-1]+" "+y;};
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  function fit(P){const mx=mean(P.map(p=>p[0])),my=mean(P.map(p=>p[1]));let a=0,b=0;P.forEach(p=>{a+=(p[0]-mx)*(p[1]-my);b+=(p[0]-mx)**2;});const s=a/b;return {s,q:my-s*mx};}
  let D=null;

  fetch("./data/serie/italia-ghcn.json").then(r=>r.json()).then(d=>{D=d;tiles();disegna();tabella();mappa();
    let rt;addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>{disegna();gantt();},150);});
  }).catch(()=>{$("tiles").innerHTML='<div class="loading">Dati non disponibili.</div>';});

  function tiles(){
    const S=D.stats, t=(l,b,u,w)=>`<div class="tile"><div class="lab">${l}</div><div class="big">${b}<s>${u}</s></div><div class="who">${w}</div></div>`;
    const recenti=D.stazioni.filter(s=>s.al>="2020").length, primo=[...D.stazioni].sort((a,b)=>a.dal.localeCompare(b.dal))[0];
    $("tiles").innerHTML=
      t("Stazioni nel registro",D.stazioni.length,"",`${recenti} con dati recenti · la più antica dal ${primo.dal.slice(0,4)}`)+
      t("Osservazioni analizzate",(S.n_observations/1e6).toFixed(2).replace(".",","),"mln","46 stazioni · 1996–2025")+
      t("Riscaldamento",sg(S.trend_temp_decade),"°C",`per decennio · significativo (p = ${String(S.trend_temp_p).replace(".",",")})`)+
      t("Ultimo decennio",sg(S.dec3_avg-S.dec1_avg),"°C",`2016–2025 contro 1996–2005`)+
      t("Record di caldo",f1(S.record_hot.value),"°C",`${esc(S.record_hot.station)}, ${dIt(S.record_hot.date)}`)+
      t("Record di freddo",f1(S.record_cold.value),"°C",`Plateau Rosa (3.488 m), ${dIt(S.record_cold.date)}`);
  }

  /* ---------- grafico generico ---------- */
  function ticks(lo,hi,n){const s0=(hi-lo)/n||1,m=Math.pow(10,Math.floor(Math.log10(s0)));const st=[1,2,2.5,5,10].map(k=>k*m).find(s=>s>=s0);const o=[];for(let v=Math.floor(lo/st)*st;v<hi+st-1e-9;v+=st)o.push(+v.toFixed(6));return o;}
  function place(el,tip,x,y){tip.style.opacity=1;const tw=tip.offsetWidth,W=el.clientWidth;let lx=x+14;if(lx+tw>W)lx=x-tw-14;tip.style.left=Math.max(0,lx)+"px";tip.style.top=Math.max(0,y-10)+"px";}
  /* o: {xs:[..] (valori x o etichette), cat:bool, y0,y1 opzionali, layers(X,Y,ctx)->svg, hit(px,py,X,Y)->{x,y,html}|null, unit, xfmt} */
  function chart(el,o){
    const W=el.clientWidth,H=el.clientHeight,m={l:46,r:14,t:12,b:28},iw=W-m.l-m.r,ih=H-m.t-m.b;
    const yT=ticks(o.lo,o.hi,5),y0=yT[0],y1=yT[yT.length-1];
    const n=o.xs.length, X=o.cat?(i=>m.l+(i+.5)/n*iw):(x=>m.l+(x-o.xs[0])/(o.xs[n-1]-o.xs[0])*iw), Y=v=>m.t+ih-(v-y0)/(y1-y0)*ih;
    let g=""; yT.forEach(t=>{g+=`<line class="grid" x1="${m.l}" x2="${m.l+iw}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axl" x="${m.l-8}" y="${Y(t)+3.5}" text-anchor="end">${String(t).replace(".",",").replace("-","−")}${o.unit||""}</text>`;});
    if(o.cat){const every=Math.ceil(n/(W<520?6:12));o.xs.forEach((x,i)=>{if(i%every===0)g+=`<text class="axl" x="${X(i)}" y="${m.t+ih+18}" text-anchor="middle">${o.xfmt?o.xfmt(x):x}</text>`;});}
    else ticks(o.xs[0],o.xs[n-1],W<520?4:7).forEach(x=>{if(x>=o.xs[0]&&x<=o.xs[n-1])g+=`<text class="axl" x="${X(x)}" y="${m.t+ih+18}" text-anchor="middle">${o.xfmt?o.xfmt(x):String(x).replace(".",",")}</text>`;});
    g+=o.layers(X,Y,{m,iw,ih,W,H,n});
    g+=`<circle id="hl" r="6" cx="-9999" cy="-9999" fill="none" stroke="var(--ink)" stroke-width="2"/>`;
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label)}">${g}</svg><div class="tip"></div>`;
    const svg=el.querySelector("svg"),tip=el.querySelector(".tip"),hl=el.querySelector("#hl");
    svg.addEventListener("pointermove",e=>{const r=svg.getBoundingClientRect();const h=o.hit(e.clientX-r.left,e.clientY-r.top,X,Y);
      if(!h){tip.style.opacity=0;hl.setAttribute("cx",-9999);return;} if(h.dot){hl.setAttribute("cx",h.x);hl.setAttribute("cy",h.y);}else hl.setAttribute("cx",-9999);
      tip.innerHTML=h.html;place(el,tip,h.x,h.y);});
    svg.addEventListener("pointerleave",()=>{tip.style.opacity=0;hl.setAttribute("cx",-9999);});
  }
  const near=(arr,px,key)=>{let b=null,bd=1e9;arr.forEach(a=>{const d=Math.abs(key(a)-px);if(d<bd){bd=d;b=a;}});return b;};

  function barre(el,serie,opt){ // serie: [{x,v,cls}]
    chart(el,{xs:serie.map(s=>s.x),cat:true,lo:opt.lo??Math.min(0,...serie.map(s=>s.v)),hi:Math.max(...serie.map(s=>s.v)),unit:opt.unit,label:opt.label,xfmt:opt.xfmt,
      layers:(X,Y,c)=>{const bw=Math.max(2,c.iw/c.n-3),base=Y(Math.max(opt.lo??0,ticks(opt.lo??Math.min(0,...serie.map(s=>s.v)),Math.max(...serie.map(s=>s.v)),5)[0]));
        return serie.map((s,i)=>`<rect class="bar ${s.cls||opt.cls||""}" x="${X(i)-bw/2}" y="${Math.min(Y(s.v),base)}" width="${bw}" height="${Math.abs(base-Y(s.v))}" rx="${Math.min(3,bw/2)}"/>`).join("")+(opt.extra?opt.extra(X,Y,c):"");},
      hit:(px,py,X,Y)=>{const i=Math.max(0,Math.min(serie.length-1,Math.round(((px-46)/(el.clientWidth-60))*serie.length-.5)));const s=serie[i];return {x:X(i),y:Y(s.v),html:opt.tip(s)};}});
  }

  function disegna(){
    const S=D.stats;
    // temperatura annua + tendenza
    const A=S.annual_temp.filter(a=>a.year<=2025), P=A.map(a=>[a.year,a.value]), F=fit(P);
    chart($("ch-anno"),{xs:A.map(a=>a.year),lo:Math.min(...A.map(a=>a.value))-.2,hi:Math.max(...A.map(a=>a.value))+.2,unit:"°",label:"Temperatura media annua delle stazioni italiane 1996-2025",
      layers:(X,Y)=>`<path class="fitl" d="M${X(A[0].year)} ${Y(F.q+F.s*A[0].year)} L${X(A[A.length-1].year)} ${Y(F.q+F.s*A[A.length-1].year)}"/>`+
        `<path class="avg" d="${A.map((a,i)=>(i?"L":"M")+X(a.year).toFixed(1)+" "+Y(a.value).toFixed(1)).join("")}"/>`+A.map(a=>`<circle class="dot" cx="${X(a.year)}" cy="${Y(a.value)}" r="3.5"/>`).join(""),
      hit:(px,py,X,Y)=>{const a=near(A,px,a=>X(a.year));return {dot:1,x:X(a.year),y:Y(a.value),html:`<b>${a.year}</b><br>Media <b>${f1(a.value)} °C</b><br><span class="m">tendenza ${f1(F.q+F.s*a.year)} °C</span>`};}});
    $("anno-note").textContent=`Tendenza: ${sg(S.trend_temp_decade)} °C per decennio (p = ${String(S.trend_temp_p).replace(".",",")}, statisticamente significativa). Media 1996–2005: ${f1(S.dec1_avg)} °C, media 2016–2025: ${f1(S.dec3_avg)} °C.`;
    // gelo e caldo
    const G=S.frost_days.filter(a=>a.year<=2025), C=S.hot_days.filter(a=>a.year<=2025);
    barre($("ch-gelo"),G.map(a=>({x:a.year,v:a.frost_days_per_station})),{cls:"lo",label:"Giorni di gelo per stazione",tip:s=>`<b>${s.x}</b><br><b>${f1(s.v)}</b> giorni di gelo per stazione`});
    barre($("ch-caldo"),C.map(a=>({x:a.year,v:a.hot_days_per_station})),{cls:"hi",label:"Giorni sopra 35 gradi per stazione",tip:s=>`<b>${s.x}</b><br><b>${f1(s.v)}</b> giorni sopra 35 °C per stazione`});
    const g0=mean(G.slice(0,5).map(a=>a.frost_days_per_station)),g1=mean(G.slice(-5).map(a=>a.frost_days_per_station)),c0=mean(C.slice(0,5).map(a=>a.hot_days_per_station)),c1=mean(C.slice(-5).map(a=>a.hot_days_per_station));
    $("ext-note").textContent=`Giorni di gelo: in media ${f1(g0)} all'anno nel 1996–2000, ${f1(g1)} nel 2021–2025. Giorni sopra i 35 °C: da ${f1(c0)} a ${f1(c1)} all'anno per stazione.`;
    // mesi e pioggia
    barre($("ch-mesi"),S.monthly_temp.map(m=>({x:m.month,v:m.value})),{cls:"hi",unit:"°",lo:0,xfmt:m=>MES[m-1],label:"Temperatura media per mese",tip:s=>`<b>${MES[s.x-1]}</b><br>Media <b>${f1(s.v)} °C</b>`});
    const R=S.annual_prcp.filter(a=>a.year<=2025), rm=mean(R.map(a=>a.value));
    barre($("ch-prec"),R.map(a=>({x:a.year,v:a.value})),{cls:"sky",label:"Pioggia annua media per stazione",
      extra:(X,Y,c)=>`<line class="fitl" x1="${c.m.l}" x2="${c.m.l+c.iw}" y1="${Y(rm)}" y2="${Y(rm)}"/>`,tip:s=>`<b>${s.x}</b><br>Pioggia <b>${Math.round(s.v)} mm</b><br><span class="m">media 1996–2025 ${Math.round(rm)} mm</span>`});
    $("prec-note").textContent=`Nessuna tendenza significativa nella pioggia annua: molto variabile da un anno all'altro (media ${Math.round(rm)} mm per stazione). La temperatura per mese è la media 1996–2025 di tutte le stazioni.`;
    // quota
    const Q=S.station_ranking.filter(s=>s.elevation!=null), FQ=fit(Q.map(s=>[s.elevation,s.value]));
    chart($("ch-quota"),{xs:[0,Math.ceil(Math.max(...Q.map(s=>s.elevation))/500)*500],lo:Math.min(...Q.map(s=>s.value))-1,hi:Math.max(...Q.map(s=>s.value))+1,unit:"°",label:"Temperatura media e quota delle stazioni",xfmt:x=>x+" m",
      layers:(X,Y,c)=>{const x1=c.m.l+c.iw;return `<path class="fitl" d="M${X(0)} ${Y(FQ.q)} L${x1} ${Y(FQ.q+FQ.s*(Math.ceil(Math.max(...Q.map(s=>s.elevation))/500)*500))}"/>`+Q.map(s=>`<circle class="dot" cx="${X(s.elevation)}" cy="${Y(s.value)}" r="5"/>`).join("");},
      hit:(px,py,X,Y)=>{let b=null,bd=24*24;Q.forEach(s=>{const d=(X(s.elevation)-px)**2+(Y(s.value)-py)**2;if(d<bd){bd=d;b=s;}});if(!b)return null;
        return {dot:1,x:X(b.elevation),y:Y(b.value),html:`<b>${esc(b.nome)}</b> <span class="m">${Math.round(b.elevation)} m</span><br>Media <b>${f1(b.value)} °C</b>`};}});
    $("quota-note").textContent=`La temperatura cala di circa ${f1(-S.lapse_rate)} °C ogni 1.000 m di quota, in linea con il gradiente atmosferico standard (circa 6,5 °C/km). Le stazioni più calde sono in Sicilia e sulle coste del Sud, la più fredda è Plateau Rosa, a 3.488 m.`;
    giugno();
  }

  function giugno(){
    const GA=D.giugno_anno, m=mean(GA.map(a=>a.v));
    barre($("ch-giu"),GA.map(a=>({x:a.y,v:a.v,cls:a.v>=m?"hi":"lo"})),{lo:Math.floor(Math.min(...GA.map(a=>a.v))-1),unit:"°",label:"Temperatura media di giugno per anno",
      extra:(X,Y,c)=>`<line class="fitl" x1="${c.m.l}" x2="${c.m.l+c.iw}" y1="${Y(m)}" y2="${Y(m)}"/>`,tip:s=>`<b>Giugno ${s.x}</b><br>Media <b>${f1(s.v)} °C</b><br><span class="m">${sg(s.v-m)} °C sulla media 1996–2025</span>`});
    const hot=[...GA].sort((a,b)=>b.v-a.v), F=fit(GA.map(a=>[a.y,a.v]));
    $("giu-note").textContent=`Media di giugno 1996–2025: ${f1(m)} °C. Il più caldo è stato il ${hot[0].y} (${f1(hot[0].v)} °C, l'ondata di calore europea), poi ${hot[1].y} e ${hot[2].y}; il più fresco il ${hot[hot.length-1].y} (${f1(hot[hot.length-1].v)} °C). Tendenza ${sg(F.s*10)} °C per decennio, non statisticamente significativa: un singolo mese varia molto da un anno all'altro.`;
    // classifica
    const GS=D.giugno_stazione, mx=Math.max(...GS.map(s=>s.v));
    $("rk").innerHTML=GS.map(s=>`<div class="r"><span class="n" title="${esc(s.nome)}">${esc(s.nome)}<s>${Math.round(s.quota)} m</s></span><span><i class="t" style="display:block;width:${Math.max(2,s.v/mx*100)}%"></i></span><span class="v">${f1(s.v)}°</span></div>`).join("");
    // spaghetti
    const L=D.giugno_linee, sel=$("sel-st");
    if(!sel.options.length){sel.innerHTML=`<option value="">— nessuna —</option>`+[...L].sort((a,b)=>a.nome.localeCompare(b.nome,"it")).map(s=>`<option>${esc(s.nome)}</option>`).join("");sel.value=L.some(s=>s.nome==="Pisa")?"Pisa":"";sel.addEventListener("change",spag);}
    spag();
  }
  function spag(){
    const L=D.giugno_linee, on=$("sel-st").value, yrs=D.giugno_anno.map(a=>a.y), all=L.flatMap(s=>s.serie.map(p=>p[1]));
    chart($("ch-spag"),{xs:[yrs[0],yrs[yrs.length-1]],lo:Math.min(...all)-1,hi:Math.max(...all)+1,unit:"°",label:"Temperatura di giugno di ogni stazione",
      layers:(X,Y)=>{const path=s=>s.serie.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+" "+Y(p[1]).toFixed(1)).join("");
        return L.filter(s=>s.nome!==on).map(s=>`<path class="spag" d="${path(s)}"/>`).join("")+`<path class="mean" d="${D.giugno_anno.map((a,i)=>(i?"L":"M")+X(a.y).toFixed(1)+" "+Y(a.v).toFixed(1)).join("")}"/>`+
          L.filter(s=>s.nome===on).map(s=>`<path class="spag on" d="${path(s)}"/>`).join("");},
      hit:(px,py,X,Y)=>{let b=null,bd=14*14;L.forEach(s=>s.serie.forEach(p=>{const d=(X(p[0])-px)**2+(Y(p[1])-py)**2;if(d<bd){bd=d;b={s,p};}}));
        if(!b)return null;return {dot:1,x:X(b.p[0]),y:Y(b.p[1]),html:`<b>${esc(b.s.nome)}</b> <span class="m">${Math.round(b.s.quota)} m</span><br>Giugno ${b.p[0]}: <b>${f1(b.p[1])} °C</b>`};}});
  }

  /* ---------- mappa, cronologia, tabella ---------- */
  function mappa(){
    const el=$("map"); const io=new IntersectionObserver(es=>{if(!es[0].isIntersecting)return;io.disconnect();
      fetch("./data/serie/wmo-centenarie.json").then(r=>r.json()).then(w=>{
        const B=D.italia_box, r=B[2]/120;
        el.innerHTML=`<svg viewBox="${B.join(" ")}" role="img" aria-label="Mappa delle stazioni italiane nel registro NOAA"><path class="land" d="${w.europa.land}"/><path class="brd" d="${w.europa.borders}"/>`+
          [...D.stazioni].sort((a,b)=>(a.al>="2020")-(b.al>="2020")).map(s=>`<circle class="st ${s.gsn?"gsn":s.al>="2020"?"now":"old"}" data-id="${s.id}" cx="${s.x}" cy="${s.y}" r="${s.al>="2020"?r*1.25:r}"/>`).join("")+`</svg><div class="tip"></div>`;
        const svg=el.querySelector("svg"),tip=el.querySelector(".tip");
        svg.addEventListener("pointermove",e=>{const c=e.target.closest(".st");if(!c){tip.style.opacity=0;return;}const s=D.stazioni.find(x=>x.id===c.dataset.id),rb=el.getBoundingClientRect();
          tip.innerHTML=`<b>${esc(s.nome)}</b> <span class="m">${s.quota!=null?Math.round(s.quota)+" m":""}</span><br>dati ${s.dal.slice(0,4)}–${s.al.slice(0,4)}${s.wmo?`<br><span class="m">WMO ${esc(s.wmo)}</span>`:""}`;place(el,tip,e.clientX-rb.left,e.clientY-rb.top);});
        svg.addEventListener("pointerleave",()=>{tip.style.opacity=0;});
      }).catch(()=>{el.innerHTML='<div class="loading" style="padding:20px">Mappa non disponibile.</div>';});
      gantt();},{rootMargin:"300px"}); io.observe(el);
  }
  function gantt(){
    const el=$("gantt"); if(!D||!el) return;
    const S=[...D.stazioni].sort((a,b)=>a.dal.localeCompare(b.dal)), W=el.clientWidth, rh=11, m={l:130,r:10,t:20}, H=m.t+S.length*rh+6;
    const y0=1760,y1=2030, X=y=>m.l+(y-y0)/(y1-y0)*(W-m.l-m.r), yr=s=>{const [y,mo]=s.split("-").map(Number);return y+(mo-1)/12;};
    let g=[1800,1850,1900,1950,2000].map(y=>`<line class="grid" x1="${X(y)}" x2="${X(y)}" y1="${m.t-4}" y2="${H}"/><text class="axl" x="${X(y)}" y="12" text-anchor="middle">${y}</text>`).join("");
    g+=S.map((s,i)=>`<text class="yl" x="${m.l-6}" y="${m.t+i*rh+8}" text-anchor="end">${esc(s.nome.length>18?s.nome.slice(0,17)+"…":s.nome)}</text><rect class="gantt ${s.al>="2020"?"now":""}" data-id="${s.id}" x="${X(yr(s.dal))}" y="${m.t+i*rh+1}" width="${Math.max(2,X(yr(s.al))-X(yr(s.dal)))}" height="${rh-3}" rx="2"/>`).join("");
    el.innerHTML=`<div style="position:relative"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Periodo di attività di ogni stazione">${g}</svg><div class="tip"></div></div>`;
    const box=el.firstChild, svg=box.querySelector("svg"), tip=box.querySelector(".tip");
    svg.addEventListener("pointermove",e=>{const c=e.target.closest(".gantt");if(!c){tip.style.opacity=0;return;}const s=D.stazioni.find(x=>x.id===c.dataset.id),rb=box.getBoundingClientRect();
      tip.innerHTML=`<b>${esc(s.nome)}</b><br>${dIt(s.dal)} – ${dIt(s.al)}`;place(box,tip,e.clientX-rb.left,e.clientY-rb.top);});
    svg.addEventListener("pointerleave",()=>{tip.style.opacity=0;});
  }
  let sk="dal",sd=1,tutte=false;
  function tabella(){
    const draw=()=>{
      const q=$("q").value.trim().toLowerCase(), f=$("fq").value;
      const V=D.stazioni.map(s=>({...s,anni:+s.al.slice(0,4)-+s.dal.slice(0,4)+1})).filter(s=>(!q||(s.nome+" "+s.id+" "+s.wmo).toLowerCase().includes(q))&&(!f||(f==="now"&&s.al>="2020")||(f==="old"&&s.al<"2020")||(f==="wmo"&&s.wmo)))
        .sort((a,b)=>{const x=a[sk],y=b[sk];if(x==null)return 1;if(y==null)return -1;return (typeof x==="string"?x.localeCompare(y,"it"):x-y)*sd;});
      document.querySelectorAll("th[data-k]").forEach(th=>{if(th.dataset.k===sk)th.setAttribute("aria-sort",sd>0?"ascending":"descending");else th.removeAttribute("aria-sort");});
      const T=tutte?V:V.slice(0,25);
      $("cnt").textContent=`${V.length} stazioni su ${D.stazioni.length}`+(T.length<V.length?` · mostrate le prime ${T.length}`:"");
      $("more").hidden=V.length<=25; $("more").textContent=tutte?"Mostra meno":`Mostra tutte le ${V.length} stazioni`;
      $("rows").innerHTML=T.map(s=>`<tr><td><b>${esc(s.nome)}</b>${s.gsn?'<span class="pill">GSN</span>':""}${s.wmo?`<span class="m" style="margin-left:6px">WMO ${esc(s.wmo)}</span>`:""}<span class="m" style="display:block">${esc(s.id)}</span></td>
        <td>${s.quota!=null?Math.round(s.quota).toLocaleString("it-IT")+" m":"—"}</td><td>${s.dal.slice(0,4)}</td><td>${s.al.slice(0,4)}</td><td class="hm">${s.anni}</td><td class="hm">${s.cop!=null?Math.round(s.cop*100)+"%":"—"}</td></tr>`).join("")||'<tr><td colspan="6">Nessuna stazione corrisponde ai filtri.</td></tr>';
    };
    $("q").addEventListener("input",draw); $("fq").addEventListener("input",draw);
    $("more").addEventListener("click",()=>{tutte=!tutte;draw();});
    document.querySelectorAll("th[data-k] button").forEach(b=>b.addEventListener("click",()=>{const k=b.parentNode.dataset.k;if(sk===k)sd=-sd;else{sk=k;sd=k==="nome"?1:(k==="dal"?1:-1);}draw();}));
    draw();
  }
})();
