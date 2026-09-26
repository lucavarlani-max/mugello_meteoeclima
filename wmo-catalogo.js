/* Catalogo delle stazioni centenarie OMM: mappa, numeri, elenco Italia, tabella e scheda.
   Uso: WMOCat.mount({ map:"#id", stats:"#id", italia:"#id", table:"#id", links:{ "<nome OMM>": "pagina.html" } })
   Dati: data/serie/wmo-centenarie.json (stazioni già proiettate in coordinate x,y della mappa). */
(function(){
  const CSS = `
  .wc-seg{display:inline-flex;background:var(--panel-2);border:1px solid var(--line);border-radius:999px;padding:3px;gap:2px;flex-wrap:wrap}
  .wc-seg button{font:inherit;font-size:12.5px;font-weight:600;color:var(--ink-soft);background:none;border:0;border-radius:999px;padding:6px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
  .wc-seg button[aria-pressed="true"]{background:var(--pine);color:#fff}
  .wc-dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none}
  .wc-met{--c:var(--wc-met)} .wc-hyd{--c:var(--wc-hyd)} .wc-mar{--c:var(--wc-mar)}
  .wc-dot.wc-met,.wc-dot.wc-hyd,.wc-dot.wc-mar{background:var(--c)}
  .wc-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
  .wc-map{position:relative;width:100%;aspect-ratio:1000/470;border-radius:12px;overflow:hidden;background:var(--wc-sea)}
  .wc-map.eu{aspect-ratio:1000/470}
  .wc-map svg{display:block;width:100%;height:100%}
  .wc-land{fill:var(--wc-land)} .wc-brd{fill:none;stroke:var(--wc-brd);stroke-width:.5;vector-effect:non-scaling-stroke}
  .wc-pt{fill:var(--c);stroke:var(--panel);stroke-width:1.2;vector-effect:non-scaling-stroke;cursor:pointer}
  .wc-pt.dim{opacity:.12;pointer-events:none}
  .wc-pt.star{stroke:var(--ink);stroke-width:2}
  .wc-lab{font-family:var(--sans);font-weight:700;fill:var(--ink);paint-order:stroke;stroke:var(--panel);stroke-width:3px;stroke-linejoin:round;pointer-events:none}
  .wc-hl{fill:none;stroke:var(--ink);stroke-width:2;vector-effect:non-scaling-stroke;pointer-events:none}
  .wc-tip{position:absolute;pointer-events:none;background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow);padding:8px 11px;font-size:12.5px;line-height:1.45;opacity:0;transition:opacity .12s;z-index:5;white-space:nowrap}
  .wc-tip .m{font-family:var(--mono);font-size:11px;color:var(--ink-faint)}
  .wc-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--ink-soft);margin-top:10px;align-items:center}
  .wc-legend span{display:inline-flex;align-items:center;gap:6px}
  .wc-legend .star{width:11px;height:11px;border-radius:50%;border:2px solid var(--ink);display:inline-block}
  .wc-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .wc-stat{background:var(--panel);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:14px 16px;min-width:0}
  .wc-stat .l{font-family:var(--mono);font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-faint)}
  .wc-stat .b{font-family:var(--serif);font-weight:800;font-size:30px;line-height:1.1;letter-spacing:-.02em;margin-top:4px}
  .wc-stat .s{font-size:12.5px;color:var(--ink-soft)}
  .wc-it{list-style:none;margin:0;padding:0;columns:3 230px;column-gap:28px}
  .wc-it li{break-inside:avoid;display:flex;gap:10px;align-items:baseline;padding:6px 0;border-top:1px solid var(--line-soft)}
  .wc-it li b{font-family:var(--mono);font-size:12px;color:var(--ink-faint);font-weight:600;width:38px;flex:none}
  .wc-it li button{all:unset;cursor:pointer;color:var(--ink);flex:1;min-width:0} .wc-it li button:hover{color:var(--pine);text-decoration:underline}
  .wc-it li a{font-size:12px;font-weight:600;margin-left:auto;white-space:nowrap}
  .wc-f{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
  .wc-f input,.wc-f select{font:inherit;font-size:13px;color:var(--ink);background:var(--panel-2);border:1px solid var(--line);border-radius:11px;padding:8px 11px;min-width:0}
  .wc-f input{flex:1 1 220px}
  .wc-count{font-family:var(--mono);font-size:11.5px;color:var(--ink-faint);margin-bottom:6px}
  .wc-tbl{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .wc-tbl table{border-collapse:collapse;width:100%;min-width:640px;font-size:13px}
  .wc-tbl th,.wc-tbl td{padding:9px 8px;text-align:left;border-top:1px solid var(--line-soft)}
  .wc-tbl thead th{border-top:0;font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint);font-weight:600;white-space:nowrap}
  .wc-tbl th button{all:unset;cursor:pointer} .wc-tbl th button:hover{color:var(--ink)}
  .wc-tbl th[aria-sort] button::after{content:" ↓"} .wc-tbl th[aria-sort="ascending"] button::after{content:" ↑"}
  .wc-tbl td.n{text-align:right;font-variant-numeric:tabular-nums} .wc-tbl th.n{text-align:right}
  .wc-tbl tbody tr{cursor:pointer} .wc-tbl tbody tr:hover td{background:var(--line-soft)}
  .wc-tbl .wc-nm{font-weight:600} .wc-tbl .sub{display:block;font-size:11.5px;color:var(--ink-faint);max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .wc-badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-soft);white-space:nowrap}
  .wc-an{font-family:var(--mono);font-size:10px;font-weight:600;padding:2px 7px;border-radius:999px;background:var(--pine-tint);color:var(--pine-deep);margin-left:6px;vertical-align:1px}
  .wc-pag{display:flex;align-items:center;justify-content:center;gap:8px;padding-top:12px;flex-wrap:wrap}
  .wc-pag button{font:inherit;font-size:13px;font-weight:600;color:var(--pine-deep);background:var(--pine-tint);border:0;border-radius:999px;padding:7px 14px;cursor:pointer}
  .wc-pag button:disabled{opacity:.35;cursor:default}
  .wc-pag span{font-family:var(--mono);font-size:11.5px;color:var(--ink-faint);min-width:90px;text-align:center}
  .wc-dr{position:fixed;inset:0;z-index:200;display:none}
  .wc-dr.open{display:block}
  .wc-dr .bg{position:absolute;inset:0;background:rgba(10,20,15,.35)}
  .wc-dr .pn{position:absolute;top:0;right:0;height:100%;width:min(400px,100vw);background:var(--panel);border-left:1px solid var(--line);box-shadow:var(--shadow);padding:22px 22px 30px;overflow-y:auto}
  .wc-dr .x{position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:50%;border:1px solid var(--line);background:var(--panel-2);color:var(--ink-soft);font-size:15px;cursor:pointer}
  .wc-dr .ty{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint);display:flex;align-items:center;gap:8px}
  .wc-dr h3{font-family:var(--serif);font-size:24px;font-weight:800;margin:.3em 0 .1em;line-height:1.15;padding-right:34px}
  .wc-dr .co{color:var(--ink-soft);margin-bottom:16px}
  .wc-dr .gr{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;margin-bottom:16px}
  .wc-dr .gr .k{font-family:var(--mono);font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-faint)}
  .wc-dr .gr .v{font-weight:600}
  .wc-dr .in{border-top:1px solid var(--line);padding-top:12px;color:var(--ink-soft)}
  .wc-dr .acts{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
  .wc-dr .acts a{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;border-radius:999px;padding:9px 15px;text-decoration:none;background:var(--pine-tint);color:var(--pine-deep)}
  .wc-dr .acts a.pri{background:var(--pine);color:#fff}
  .wc-mob{display:none}
  @media (max-width:640px){
    .wc-tbl table{min-width:0} .wc-tbl th:nth-child(2),.wc-tbl td:nth-child(2),.wc-tbl th:nth-child(3),.wc-tbl td:nth-child(3),.wc-tbl th:nth-child(5),.wc-tbl td:nth-child(5){display:none}
    .wc-mob{display:inline} .wc-tbl .sub{white-space:normal;max-width:none}
    .wc-f select{flex:1 1 140px}
  }
  @media (max-width:760px){ .wc-stats{grid-template-columns:repeat(2,minmax(0,1fr))} .wc-stat .b{font-size:26px} }
  :root{--wc-met:#2f7cc4;--wc-hyd:#1a9a7a;--wc-mar:#c9671f;--wc-land:#e3e8e1;--wc-brd:#ffffff;--wc-sea:#f7f9f6}
  @media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--wc-met:#4f93d6;--wc-hyd:#2fa585;--wc-mar:#c97a36;--wc-land:#26332c;--wc-brd:#16211c;--wc-sea:#131d18}}
  :root[data-theme="dark"]{--wc-met:#4f93d6;--wc-hyd:#2fa585;--wc-mar:#c97a36;--wc-land:#26332c;--wc-brd:#16211c;--wc-sea:#131d18}
  `;
  const TIPO={MET:{n:"Meteorologica",p:"meteorologiche",c:"wc-met"},HYD:{n:"Idrologica",p:"idrologiche",c:"wc-hyd"},MAR:{n:"Mareografica",p:"mareografiche",c:"wc-mar"}};
  const RA={1:"Africa",2:"Asia",3:"Sud America",4:"Nord e Centro America",5:"Pacifico sud-occidentale",6:"Europa"};
  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const $=s=>typeof s==="string"?document.querySelector(s):s;
  const ANNO=new Date().getFullYear();

  let S=[], M=null, EU=null, links={}, tipo="", view="mondo", drawer=null, listeners=[];
  const st=r=>({ra:r[0],paese:r[1],nome:r[2],tipo:r[3],inizio:r[4],quota:r[5],lat:r[6],lon:r[7],wmo:r[8],ist:r[9],x:r[10],y:r[11]});

  function mount(o){
    if(!document.getElementById("wc-css")){const s=document.createElement("style");s.id="wc-css";s.textContent=CSS;document.head.appendChild(s);}
    links=o.links||{};
    return fetch(o.src||"./data/serie/wmo-centenarie.json").then(r=>r.json()).then(d=>{
      S=d.stazioni.map(st).map((s,i)=>({...s,i,link:links[s.nome]||null})); M=d.mappa; EU=d.europa;
      if(o.stats) stats($(o.stats));
      if(o.map) map($(o.map), o);
      if(o.italia) italia($(o.italia));
      if(o.table) table($(o.table), o);
      drawerInit();
      return d;
    });
  }
  function setTipo(t){tipo=t;listeners.forEach(f=>f());}
  function visibile(s){return !tipo||s.tipo===tipo;}

  /* ---------- numeri ---------- */
  function stats(el){
    const paesi=new Set(S.map(s=>s.paese)).size, old=[...S].sort((a,b)=>a.inizio-b.inizio), oldMet=old.find(s=>s.tipo==="MET"), it=S.filter(s=>s.paese==="Italia");
    const c=t=>S.filter(s=>s.tipo===t).length;
    const box=(l,b,s)=>`<div class="wc-stat"><div class="l">${l}</div><div class="b">${b}</div><div class="s">${s}</div></div>`;
    el.innerHTML=`<div class="wc-stats">`+
      box("Stazioni centenarie",S.length,`${c("MET")} meteorologiche · ${c("HYD")} idrologiche · ${c("MAR")} mareografiche`)+
      box("Paesi",paesi,"in tutti i continenti, Antartide compresa")+
      box("La più antica",old[0].inizio,`${esc(old[0].nome)} (${esc(old[0].paese)}), mareografo · meteo: ${esc(oldMet.nome)} ${oldMet.inizio}`)+
      box("In Italia",it.length,`la più antica è ${esc(it.sort((a,b)=>a.inizio-b.inizio)[0].nome.replace("Osservatorio Astronomico di ",""))}, dal ${it[0].inizio}`)+
      `</div>`;
  }

  /* ---------- mappa ---------- */
  function map(el,o){
    el.innerHTML=`<div class="wc-bar">
        <div class="wc-seg" data-k="view"><button data-v="mondo" aria-pressed="true">Mondo</button><button data-v="europa" aria-pressed="false">Europa</button></div>
        <div class="wc-seg" data-k="tipo"><button data-v="" aria-pressed="true">Tutte</button>${Object.entries(TIPO).map(([k,t])=>`<button data-v="${k}" aria-pressed="false"><span class="wc-dot ${t.c}"></span>${t.n.replace(/a$/,"he").replace("Meteorologiche","Meteo")}</button>`).join("")}</div>
      </div>
      <div class="wc-map"><svg role="img" aria-label="Mappa delle stazioni centenarie riconosciute dall'OMM"></svg><div class="wc-tip"></div></div>
      <div class="wc-legend">${Object.values(TIPO).map(t=>`<span><span class="wc-dot ${t.c}"></span>Stazioni ${t.p}</span>`).join("")}${Object.keys(links).length?`<span><span class="star"></span>Con analisi su questo sito</span>`:""}</div>`;
    const svg=el.querySelector("svg"), box=el.querySelector(".wc-map"), tip=el.querySelector(".wc-tip");
    el.querySelectorAll(".wc-seg").forEach(sg=>sg.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
      sg.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));
      if(sg.dataset.k==="view"){view=b.dataset.v;draw();}else setTipo(b.dataset.v);}));
    function draw(){
      const eu=view==="europa", vb=eu?EU.box:[0,0,M.w,M.h], k=vb[2]/M.w;
      box.classList.toggle("eu",eu);
      svg.setAttribute("viewBox",vb.join(" "));
      const fs=Math.max(eu?4.2:11,10.5*vb[2]/(svg.clientWidth||1000));
      const px=svg.clientWidth||1000, r=Math.max(eu?1.25:3.4,(eu?1.9:2.4)*vb[2]/px), pts=[...S].sort((a,b)=>(a.link?1:0)-(b.link?1:0));
      svg.innerHTML=`<path class="wc-land" d="${eu?EU.land:M.land}"/><path class="wc-brd" d="${eu?EU.borders:M.borders}"/>`+
        pts.map(s=>`<circle class="wc-pt ${TIPO[s.tipo].c}${s.link?" star":""}${visibile(s)?"":" dim"}" data-i="${s.i}" cx="${s.x}" cy="${s.y}" r="${s.link?r*1.6:r}"/>`).join("")+
        pts.filter(s=>s.link).map(s=>`<text class="wc-lab" x="${s.x+r*2.2}" y="${s.y+r*0.9}" font-size="${fs}" style="stroke-width:${fs/3.6}px">${esc(s.nome.replace("Osservatorio Astronomico di ","").replace("-Milano"," · Milano").replace("New York City Central Park","New York"))}</text>`).join("")+
        `<circle class="wc-hl" r="${r*2.2}" cx="-99" cy="-99"/>`;
      const hl=svg.querySelector(".wc-hl");
      svg.onpointermove=e=>{const t=e.target.closest(".wc-pt");if(!t){tip.style.opacity=0;hl.setAttribute("cx",-99);return;}
        const s=S[+t.dataset.i];hl.setAttribute("cx",s.x);hl.setAttribute("cy",s.y);
        const rb=box.getBoundingClientRect(), px=e.clientX-rb.left, py=e.clientY-rb.top;
        tip.innerHTML=`<b>${esc(s.nome)}</b><br>${esc(s.paese)} · dal <b>${s.inizio}</b><br><span class="m">${TIPO[s.tipo].n}${s.quota!=null?" · "+s.quota+" m":""}${s.link?" · analisi disponibile":""}</span>`;
        tip.style.opacity=1;const tw=tip.offsetWidth;let lx=px+14;if(lx+tw>rb.width)lx=px-tw-14;tip.style.left=Math.max(0,lx)+"px";tip.style.top=Math.max(0,py-tip.offsetHeight-10)+"px";};
      svg.onpointerleave=()=>{tip.style.opacity=0;hl.setAttribute("cx",-99);};
      svg.onclick=e=>{const t=e.target.closest(".wc-pt");if(t)openDrawer(S[+t.dataset.i]);};
    }
    listeners.push(()=>{el.querySelectorAll('.wc-seg[data-k="tipo"] button').forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===tipo));draw();});
    draw();
    let rt; addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(draw,150);});
  }

  /* ---------- Italia ---------- */
  function italia(el){
    const it=S.filter(s=>s.paese==="Italia").sort((a,b)=>a.inizio-b.inizio);
    el.innerHTML=`<ul class="wc-it">`+it.map(s=>`<li><b>${s.inizio}</b><button data-i="${s.i}">${esc(s.nome)}</button>${s.link?`<a href="${s.link}">analisi →</a>`:""}</li>`).join("")+`</ul>`;
    el.addEventListener("click",e=>{const b=e.target.closest("button[data-i]");if(b)openDrawer(S[+b.dataset.i]);});
  }

  /* ---------- tabella ---------- */
  function table(el,o){
    const per=o.perPage||25; let pg=0, sk="inizio", sd=1;
    el.innerHTML=`<div class="wc-f">
        <input type="search" placeholder="Cerca stazione, paese, istituto…" aria-label="Cerca">
        <select aria-label="Paese"><option value="">Tutti i paesi</option>${[...new Set(S.map(s=>s.paese))].sort((a,b)=>a.localeCompare(b,"it")).map(p=>`<option>${esc(p)}</option>`).join("")}</select>
        <select aria-label="Continente"><option value="">Tutti i continenti</option>${Object.entries(RA).map(([k,v])=>`<option value="${k}">${v}</option>`).join("")}</select>
        ${o.map?"":`<div class="wc-seg" data-k="tipo"><button data-v="" aria-pressed="true">Tutte</button>${Object.entries(TIPO).map(([k,t])=>`<button data-v="${k}" aria-pressed="false"><span class="wc-dot ${t.c}"></span>${t.n}</button>`).join("")}</div>`}
      </div>
      <div class="wc-count"></div>
      <div class="wc-tbl"><table><thead><tr>
        <th data-k="nome"><button>Stazione</button></th><th data-k="paese"><button>Paese</button></th><th data-k="tipo"><button>Tipo</button></th>
        <th data-k="inizio" class="n"><button>Dal</button></th><th data-k="quota" class="n"><button>Quota</button></th></tr></thead><tbody></tbody></table></div>
      <div class="wc-pag"><button data-p="prev">‹ Precedenti</button><span></span><button data-p="next">Successive ›</button></div>`;
    const [q,sp,sr]=[el.querySelector("input"),...el.querySelectorAll("select")], tb=el.querySelector("tbody");
    [q,sp,sr].forEach(x=>x.addEventListener("input",()=>{pg=0;render();}));
    const seg=el.querySelector(".wc-seg"); if(seg) seg.addEventListener("click",e=>{const b=e.target.closest("button");if(b)setTipo(b.dataset.v);});
    el.querySelectorAll("th[data-k] button").forEach(b=>b.addEventListener("click",()=>{const k=b.parentNode.dataset.k;if(sk===k)sd=-sd;else{sk=k;sd=1;}pg=0;render();}));
    el.querySelector(".wc-pag").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;pg+=b.dataset.p==="next"?1:-1;render();el.scrollIntoView({block:"nearest"});});
    tb.addEventListener("click",e=>{const tr=e.target.closest("tr[data-i]");if(tr)openDrawer(S[+tr.dataset.i]);});
    function render(){
      if(seg) seg.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===tipo));
      const qq=q.value.trim().toLowerCase(), p=sp.value, r=sr.value;
      const V=S.filter(s=>visibile(s)&&(!p||s.paese===p)&&(!r||String(s.ra)===r)&&(!qq||(s.nome+" "+s.paese+" "+s.ist+" "+s.wmo).toLowerCase().includes(qq)))
        .sort((a,b)=>{const x=a[sk],y=b[sk];if(x==null)return 1;if(y==null)return -1;return (typeof x==="string"?x.localeCompare(y,"it"):x-y)*sd;});
      const max=Math.max(0,Math.ceil(V.length/per)-1); pg=Math.min(Math.max(0,pg),max);
      el.querySelectorAll("th[data-k]").forEach(th=>{if(th.dataset.k===sk)th.setAttribute("aria-sort",sd>0?"ascending":"descending");else th.removeAttribute("aria-sort");});
      el.querySelector(".wc-count").textContent=`${V.length} stazioni${V.length<S.length?" su "+S.length:""}`;
      tb.innerHTML=V.slice(pg*per,pg*per+per).map(s=>`<tr data-i="${s.i}"><td><span class="wc-nm">${esc(s.nome)}</span>${s.link?'<span class="wc-an">analisi</span>':""}<span class="sub"><span class="wc-mob">${esc(s.paese)} · ${TIPO[s.tipo].n} · </span>${esc(s.ist||"—")}</span></td>
        <td>${esc(s.paese)}</td><td><span class="wc-badge"><span class="wc-dot ${TIPO[s.tipo].c}"></span>${TIPO[s.tipo].n}</span></td>
        <td class="n"><b>${s.inizio}</b></td><td class="n">${s.quota!=null?s.quota.toLocaleString("it-IT")+" m":"—"}</td></tr>`).join("")||`<tr><td colspan="5">Nessuna stazione corrisponde ai filtri.</td></tr>`;
      const pag=el.querySelector(".wc-pag"); pag.hidden=V.length<=per;
      pag.querySelector("span").textContent=`pagina ${pg+1} di ${max+1}`;
      pag.querySelector('[data-p="prev"]').disabled=pg===0; pag.querySelector('[data-p="next"]').disabled=pg>=max;
    }
    listeners.push(()=>{pg=0;render();});
    render();
  }

  /* ---------- scheda ---------- */
  function drawerInit(){
    if(drawer) return;
    drawer=document.createElement("div"); drawer.className="wc-dr"; drawer.setAttribute("role","dialog"); drawer.setAttribute("aria-modal","true");
    drawer.innerHTML=`<div class="bg"></div><div class="pn"><button class="x" aria-label="Chiudi">✕</button><div class="c"></div></div>`;
    document.body.appendChild(drawer);
    drawer.querySelector(".bg").onclick=drawer.querySelector(".x").onclick=()=>drawer.classList.remove("open");
    document.addEventListener("keydown",e=>{if(e.key==="Escape")drawer.classList.remove("open");});
  }
  function openDrawer(s){
    const t=TIPO[s.tipo], g=(k,v)=>`<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
    drawer.querySelector(".c").innerHTML=`<div class="ty"><span class="wc-dot ${t.c}"></span>Stazione ${t.n.toLowerCase()} · ${RA[s.ra]||""}</div>
      <h3>${esc(s.nome)}</h3><div class="co">${esc(s.paese)}</div>
      <div class="gr">${g("In funzione dal",s.inizio)}${g("Anni di misure",(ANNO-s.inizio)+" anni")}${g("Quota",s.quota!=null?s.quota.toLocaleString("it-IT")+" m":"—")}${g("Codice OMM",esc(s.wmo)||"—")}${g("Latitudine",s.lat.toFixed(2).replace(".",",")+"°")}${g("Longitudine",s.lon.toFixed(2).replace(".",",")+"°")}</div>
      <div class="in"><div class="k" style="font-family:var(--mono);font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-faint)">Gestita da</div>${esc(s.ist)||"—"}</div>
      <div class="acts">${s.link?`<a class="pri" href="${s.link}">Apri l'analisi →</a>`:""}<a href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=12/${s.lat}/${s.lon}" target="_blank" rel="noopener">Vedi sulla mappa ↗</a></div>`;
    drawer.classList.add("open"); drawer.querySelector(".x").focus();
  }

  window.WMOCat={mount};
})();
