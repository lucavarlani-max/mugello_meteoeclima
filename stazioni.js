/* Pagina "Le mie stazioni": ISCARP2 (Weather Underground, letta dal browser come in home)
   e la stazione Netatmo (data/netatmo.json, scritto da scripts/fetch_netatmo.py nell'Action). */
(function(){
  const WU_ID="ISCARP2", WU_KEY="06ae21018c5f4306ae21018c5f430678";   // stessa chiave pubblica della home
  const WU="https://api.weather.com/v2/pws/";
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const f1=v=>v==null||isNaN(v)?"—":(Math.round(v*10)/10).toFixed(1).replace(".",",").replace("-","−");
  const r0=v=>v==null||isNaN(v)?"—":String(Math.round(v));
  const CARD=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSO","SO","OSO","O","ONO","NO","NNO"];
  const card=d=>d==null?"":CARD[Math.round(((d%360)/22.5))%16];
  const ora=t=>new Date(t).toLocaleTimeString("it-IT",{timeZone:"Europe/Rome",hour:"2-digit",minute:"2-digit"});
  const GG=["dom","lun","mar","mer","gio","ven","sab"];
  const S={wu:{nome:"ISCARP2 · Scarperia",col:"var(--s-wu)",serie:[]},na:{nome:"Netatmo",col:"var(--s-na)",serie:[]}};

  const kv=(lab,val)=>`<div><span>${lab}</span><b>${val}</b></div>`;
  const live=(t,soglia)=>{const ok=t&&Date.now()-new Date(t).getTime()<soglia;return `<span class="live${ok?"":" off"}"><i></i>${ok?"in linea":"non aggiornata"}</span>`;};

  /* ---------- ISCARP2 ---------- */
  async function wu(){
    try{
      const j=await (await fetch(`${WU}observations/current?stationId=${WU_ID}&format=json&units=m&apiKey=${WU_KEY}`)).json();
      const o=j.observations[0], m=o.metric;
      let tmin=null,tmax=null;
      try{ const d=await (await fetch(`${WU}observations/all/1day?stationId=${WU_ID}&format=json&units=m&apiKey=${WU_KEY}`)).json();
        const v=(d.observations||[]).map(x=>x.metric||{}); tmin=Math.min(...v.map(x=>x.tempLow).filter(x=>x!=null)); tmax=Math.max(...v.map(x=>x.tempHigh).filter(x=>x!=null));
        if(!isFinite(tmin)) tmin=null; if(!isFinite(tmax)) tmax=null; }catch(e){}
      const quando=o.obsTimeUtc||(o.epoch?new Date(o.epoch*1000).toISOString():null);
      $("st-wu").innerHTML=`<div class="hd"><div><div class="nm">ISCARP2 · Scarperia</div><div class="sub">Weather Underground${o.neighborhood?" · "+esc(o.neighborhood):""}${m.elev!=null?" · "+r0(m.elev)+" m":""}</div></div>${live(quando,30*60e3)}</div>
        <div class="now"><div class="t">${f1(m.temp)}<s>°C</s></div><div class="mm">oggi min <b>${f1(tmin)}°</b> · max <b>${f1(tmax)}°</b>${m.heatIndex!=null&&m.temp>=20?`<br>percepita ${f1(m.heatIndex)}°`:m.windChill!=null&&m.temp<10?`<br>percepita ${f1(m.windChill)}°`:""}</div></div>
        <div class="kv">${kv("Umidità",r0(o.humidity)+" %")}${kv("Punto di rugiada",f1(m.dewpt)+"°")}${kv("Pressione",r0(m.pressure)+" hPa")}
          ${kv("Vento",r0(m.windSpeed)+" km/h "+card(o.winddir))}${kv("Raffica",r0(m.windGust)+" km/h")}${kv("Pioggia oggi",f1(m.precipTotal)+" mm")}
          ${o.uv!=null?kv("Indice UV",r0(o.uv)):""}${o.solarRadiation!=null?kv("Radiazione",r0(o.solarRadiation)+" W/m²"):""}${m.precipRate!=null?kv("Intensità",f1(m.precipRate)+" mm/h"):""}</div>
        <div class="foot2"><span>aggiornata alle ${quando?ora(quando):"—"}</span><a href="https://www.wunderground.com/dashboard/pws/${WU_ID}" target="_blank" rel="noopener">pagina su Weather Underground →</a></div>`;
    }catch(e){ $("st-wu").innerHTML=`<div class="nm">ISCARP2 · Scarperia</div><p class="wait">I dati di Weather Underground non sono raggiungibili in questo momento.</p>`; }
    // ultime 24 ore (orarie) e ultimi 7 giorni
    try{
      const h=await (await fetch(`${WU}observations/hourly/7day?stationId=${WU_ID}&format=json&units=m&apiKey=${WU_KEY}`)).json();
      const lim=Date.now()-24*3600e3;
      S.wu.serie=(h.observations||[]).map(x=>[x.epoch*1000,(x.metric||{}).tempAvg]).filter(p=>p[0]>=lim&&p[1]!=null);
    }catch(e){}
    try{
      const s=await (await fetch(`${WU}dailysummary/7day?stationId=${WU_ID}&format=json&units=m&apiKey=${WU_KEY}`)).json();
      const R=(s.summaries||[]).slice().reverse();
      $("tab").innerHTML=`<thead><tr><th>Giorno</th><th>Minima</th><th>Massima</th><th>Media</th><th>Umidità</th><th>Raffica max</th><th>Pioggia</th></tr></thead><tbody>`+
        R.map(d=>{const m=d.metric||{}, dt=new Date((d.obsTimeLocal||"").replace(" ","T"));
          return `<tr><td>${isNaN(dt)?"—":GG[dt.getDay()]+" "+dt.getDate()+"/"+(dt.getMonth()+1)}</td><td class="c">${f1(m.tempLow)}°</td><td class="r">${f1(m.tempHigh)}°</td><td>${f1(m.tempAvg)}°</td>
            <td>${r0(d.humidityAvg)} %</td><td>${r0(m.windgustHigh)} km/h</td><td class="v">${f1(m.precipTotal)} mm</td></tr>`;}).join("")+`</tbody>`;
    }catch(e){ $("tab").innerHTML='<tbody><tr><td class="loading">Riepilogo non disponibile in questo momento.</td></tr></tbody>'; }
  }

  /* ---------- Netatmo ---------- */
  async function na(){
    try{
      const d=await (await fetch("./data/netatmo.json",{cache:"no-store"})).json();
      const st=(d.stazioni||[])[0]; if(!st) throw 0;
      const e=st.moduli.esterno||{}, p=st.moduli.pioggia, w=st.moduli.vento, pr=st.pressione;
      S.na.nome="Netatmo"+(st.luogo?" · "+st.luogo:"");
      S.na.serie=((st.storia||{}).dati||[]).map(x=>[x[0]*1000,x[1]]).filter(p=>p[1]!=null&&p[0]>=Date.now()-24*3600e3);
      const tend={up:"↗ in salita",down:"↘ in calo",stable:"→ stabile"};
      $("st-na").innerHTML=`<div class="hd"><div><div class="nm">${esc(st.nome)}</div><div class="sub">Netatmo${st.luogo?" · "+esc(st.luogo):""}${st.quota!=null?" · "+r0(st.quota)+" m":""}</div></div>${live(e.agg,60*60e3)}</div>
        <div class="now"><div class="t">${f1(e.t)}<s>°C</s></div><div class="mm">oggi min <b>${f1(e.tmin)}°</b>${e.ora_min?" ("+ora(e.ora_min)+")":""} · max <b>${f1(e.tmax)}°</b>${e.ora_max?" ("+ora(e.ora_max)+")":""}${e.tendenza&&tend[e.tendenza]?`<br>${tend[e.tendenza]}`:""}</div></div>
        <div class="kv">${kv("Umidità",r0(e.u)+" %")}${pr?kv("Pressione",r0(pr.p)+" hPa"):""}${p?kv("Pioggia oggi",f1(p.oggi)+" mm"):""}${p?kv("Ultima ora",f1(p.ora)+" mm"):""}
          ${w?kv("Vento",r0(w.v)+" km/h "+card(w.dir)):""}${w?kv("Raffica",r0(w.raffica)+" km/h"):""}</div>
        <div class="foot2"><span>aggiornata alle ${e.agg?ora(e.agg):"—"}</span><span>Netatmo Weather API</span></div>`;
    }catch(err){
      $("st-na").innerHTML=`<div class="hd"><div><div class="nm">Stazione Netatmo</div><div class="sub">Netatmo</div></div><span class="live off"><i></i>in arrivo</span></div>
        <p class="wait">La stazione Netatmo comparirà qui appena sarà collegato l'accesso ai suoi dati: l'aggiornamento automatico del sito la leggerà ogni mezz'ora.</p>`;
    }
  }

  /* ---------- grafico 24 ore ---------- */
  function grafico(){
    const box=$("ch"), W=box.clientWidth, H=box.clientHeight, narrow=W<520;
    const ser=[S.wu,S.na].filter(s=>s.serie.length);
    $("leg").innerHTML=ser.map(s=>`<span><i style="background:${s.col}"></i>${esc(s.nome)}</span>`).join("");
    if(!ser.length){box.querySelector("svg")&&box.querySelector("svg").remove();$("ch-note").textContent="Dati delle ultime 24 ore non disponibili in questo momento.";return;}
    const m={l:36,r:12,t:12,b:26}, all=[].concat(...ser.map(s=>s.serie));
    const x0=Date.now()-24*3600e3, x1=Date.now();
    let lo=Math.floor(Math.min(...all.map(p=>p[1]))-1), hi=Math.ceil(Math.max(...all.map(p=>p[1]))+1);
    const st=hi-lo>12?4:2; lo=Math.floor(lo/st)*st; hi=Math.ceil(hi/st)*st;
    const X=t=>m.l+(t-x0)/(x1-x0)*(W-m.l-m.r), Y=v=>m.t+(hi-v)/(hi-lo)*(H-m.t-m.b);
    let g="";
    for(let v=lo;v<=hi;v+=st) g+=`<line class="grid" x1="${m.l}" x2="${W-m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axl" x="${m.l-6}" y="${Y(v)+3.5}" text-anchor="end">${v}°</text>`;
    const h0=new Date(x0); h0.setMinutes(0,0,0);
    for(let t=h0.getTime()+3600e3;t<x1;t+=3600e3){const hh=+new Date(t).toLocaleString("it-IT",{timeZone:"Europe/Rome",hour:"2-digit",hourCycle:"h23"});
      if(hh%(narrow?6:3)===0) g+=`<text class="axl" x="${X(t)}" y="${H-8}" text-anchor="middle">${String(hh).padStart(2,"0")}</text>`;}
    ser.forEach(s=>{let d="",prev=null;s.serie.forEach(p=>{d+=(prev!=null&&p[0]-prev<3*3600e3?"L":"M")+X(p[0]).toFixed(1)+" "+Y(p[1]).toFixed(1);prev=p[0];});
      g+=`<path class="ln" stroke="${s.col}" d="${d}"/>`;});
    g+=`<line class="cross" id="cx" y1="${m.t}" y2="${H-m.b}" style="display:none"/><g id="cp"></g><rect id="hit" x="${m.l}" y="0" width="${W-m.l-m.r}" height="${H}" fill="transparent"/>`;
    box.querySelector("svg")&&box.querySelector("svg").remove();
    box.insertAdjacentHTML("afterbegin",`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Temperatura delle ultime 24 ore nelle stazioni">${g}</svg>`);
    const svg=box.querySelector("svg"), tip=box.querySelector(".tip");
    const vicino=(s,t)=>s.serie.reduce((a,b)=>Math.abs(b[0]-t)<Math.abs(a[0]-t)?b:a);
    const move=e=>{const rc=svg.getBoundingClientRect(), px=(e.touches?e.touches[0].clientX:e.clientX)-rc.left, t=x0+(px-m.l)/(W-m.l-m.r)*(x1-x0);
      const righe=ser.map(s=>({s,p:vicino(s,t)})).filter(o=>Math.abs(o.p[0]-t)<90*60e3);
      if(!righe.length){tip.style.opacity=0;return;}
      $("cx").setAttribute("x1",X(t));$("cx").setAttribute("x2",X(t));$("cx").style.display="";
      $("cp").innerHTML=righe.map(o=>`<circle cx="${X(o.p[0])}" cy="${Y(o.p[1])}" r="4.5" fill="${o.s.col}" stroke="var(--panel)" stroke-width="2"/>`).join("");
      tip.innerHTML=`<b>ore ${ora(t)}</b><br>`+righe.map(o=>`<i style="background:${o.s.col}"></i>${esc(o.s.nome)}: <b>${f1(o.p[1])}°C</b>`).join("<br>");
      tip.style.opacity=1; const tw=tip.offsetWidth; let lx=X(t)+12; if(lx+tw>W) lx=X(t)-12-tw; tip.style.left=Math.max(0,lx)+"px"; tip.style.top=m.t+"px";};
    const hit=$("hit"); hit.addEventListener("mousemove",move); hit.addEventListener("touchstart",move,{passive:true}); hit.addEventListener("touchmove",move,{passive:true});
    hit.addEventListener("mouseleave",()=>{tip.style.opacity=0;$("cx").style.display="none";$("cp").innerHTML="";});
    const ul=s=>s.serie[s.serie.length-1];
    $("ch-note").textContent=ser.length===2
      ?`Ultimo confronto: ${S.wu.nome} ${f1(ul(S.wu)[1])}°C, ${S.na.nome} ${f1(ul(S.na)[1])}°C. Medie orarie per ISCARP2, valori ogni 30 minuti per Netatmo; ore italiane.`
      :`Medie orarie, ore italiane.${S.na.serie.length?"":" La curva della stazione Netatmo comparirà quando sarà collegata."}`;
  }

  Promise.all([wu(),na()]).then(grafico);
  let rt; addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(grafico,150);});
  setInterval(()=>{Promise.all([wu(),na()]).then(grafico);},5*60e3);
})();
