/* Mugello Meteo & Clima - menu principale delle pagine interne.
   Uso: <script src="menu.js" defer></script> nella pagina. Sostituisce la barra in alto della pagina
   (.top / .site-top / .topbar con il link "← Torna alla home") con lo stesso menu della home,
   fisso in alto durante lo scorrimento. Le voci si cambiano solo qui (e in index.html). */
(function(){
  if(document.querySelector(".mm-top")) return;
  const VOCI=[
    ["Previsioni","index.html#comuni",["comune"]],
    ["Radar & dati","radar.html",["radar"]],
    ["Stazioni","stazioni.html",["stazioni"]],
    ["Mappe","mappe.html",["mappe"]],
    ["Neve",[["❄️ Neve oggi","neve.html"],["📜 La neve a Firenze","neve-firenze.html"]],["neve","neve-firenze"]],
    ["Cielo","effemeridi.html",["effemeridi"]],
    ["Webcam",[["📷 Webcam Mugello","index.html#webcam"],["🌍 Webcam Panomax","webcam-panomax.html"]],["webcam-panomax"]],
    ["Toscana",[["Temperature"],["🌡️ Oggi e ieri","temperature-toscana.html"],["Firenze"],["🏛️ Clima di Firenze","clima-firenze.html"],["Borgo S. Lorenzo"],["📊 Oggi nella storia","borgo-storico.html"],["Report mensili"],["📅 Archivio climatico","archivio-climatico.html"],["Record storici"],["🔴 Massime","estremi-massime.html"],["🔵 Minime","estremi-minime.html"],["Piogge"],["🌧️ Piogge estreme","piogge-estreme.html"]],
      ["temperature-toscana","clima-firenze","borgo-storico","archivio-climatico","estremi-massime","estremi-minime","piogge-estreme"]],
    ["Serie storiche","serie-storiche.html",["serie-storiche","stazioni-centenarie","italia-ghcn","milano-brera","new-york-central-park","padova","moncalieri","de-bilt","san-francisco","genova","mont-aigoual","bangalore","firenzuola","oxford","domodossola"]],
    ["Notizie",[["📰 Terra & Cielo","notizie.html"],["📜 Proverbi del cielo","proverbi.html"]],["notizie","proverbi"]],
    ["🧪 MeteoGeek","meteogeek.html",["meteogeek","geek-*"]]   // geek-*: tutte le pagine delle sperimentazioni
  ];
  const pag=(location.pathname.split("/").pop()||"index.html").replace(/\.html$/,"");
  const esc=s=>s.replace(/&/g,"&amp;");

  const css=`
  .mm-top{position:sticky;top:0;z-index:1000;background:color-mix(in srgb,var(--bg,#f4f6f2) 90%,transparent);
    -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:1px solid var(--line,#e3e8e1);
    font-family:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;padding-top:env(safe-area-inset-top,0)}
  .mm-in{max-width:1180px;margin:0 auto;padding:0 20px;height:58px;display:flex;align-items:center;gap:14px}
  .mm-brand{display:flex;align-items:center;gap:9px;text-decoration:none;color:var(--ink,#16261f);white-space:nowrap;
    font-family:"Bricolage Grotesque",system-ui,-apple-system,"Segoe UI",sans-serif;font-weight:800;font-size:17px;letter-spacing:-.02em}
  .mm-brand svg{width:30px;height:30px;flex:none}
  .mm-brand i{font-style:normal;color:#2a64a8}
  .mm-top *{box-sizing:border-box}
  .mm-nav{display:flex;align-items:center;gap:0;margin-left:auto;position:static;background:none;padding:0;box-shadow:none}
  .mm-nav a,.mm-dd>button{font:inherit;font-size:13px;font-weight:500;color:var(--ink-soft,#48584f);text-decoration:none;
    padding:7px 6px;border-radius:999px;background:none;border:0;cursor:pointer;white-space:nowrap;line-height:1.3}
  .mm-nav a:hover,.mm-dd>button:hover{background:var(--pine-tint,#e3f1eb);color:var(--pine-deep,#0a4f3c)}
  .mm-nav a.on,.mm-dd.on>button{background:var(--pine,#0f6b52);color:#fff}
  .mm-dd{position:relative}
  .mm-menu{position:absolute;right:0;top:calc(100% + 6px);background:var(--panel,#fff);border:1px solid var(--line,#e3e8e1);border-radius:12px;
    box-shadow:0 2px 6px rgba(16,38,31,.07),0 20px 44px -20px rgba(16,38,31,.28);padding:6px;min-width:200px;display:none;flex-direction:column;gap:2px}
  .mm-dd.open .mm-menu{display:flex}
  @media (hover:hover) and (min-width:1181px){ .mm-dd:hover .mm-menu{display:flex} }
  .mm-menu a{border-radius:8px;padding:8px 10px;display:flex;gap:8px}
  .mm-menu a.on{background:var(--pine-tint,#e3f1eb);color:var(--pine-deep,#0a4f3c)}
  .mm-menu .mm-h{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint,#6f7c74);padding:6px 10px 3px}
  .mm-btn{display:none;margin-left:auto;border:1px solid var(--line,#e3e8e1);background:var(--panel,#fff);border-radius:10px;width:40px;height:40px;
    font-size:18px;color:var(--ink,#16261f);cursor:pointer}
  @media (max-width:1180px){
    .mm-nav{display:none} .mm-btn{display:block}
    .mm-top.open .mm-nav{display:flex;flex-direction:column;align-items:stretch;gap:2px;position:absolute;left:0;right:0;top:100%;
      background:var(--panel,#fff);border-bottom:1px solid var(--line,#e3e8e1);box-shadow:0 20px 44px -20px rgba(16,38,31,.35);
      padding:10px 16px 14px;max-height:calc(100vh - 70px);overflow:auto}
    .mm-top.open .mm-nav a,.mm-top.open .mm-dd>button{font-size:15px;padding:11px 10px;border-radius:8px;text-align:left;width:100%}
    .mm-top.open .mm-menu{position:static;display:none;box-shadow:none;border:0;padding:2px 0 4px 14px;min-width:0;background:none}
    .mm-top.open .mm-dd.open .mm-menu{display:flex}
    .mm-top.open .mm-dd.open>button{background:var(--pine-tint,#e3f1eb);color:var(--pine-deep,#0a4f3c)}
  }
  @media (max-width:520px){ .mm-in{padding:0 16px} .mm-brand{font-size:16px} }
  @media print{ .mm-top{display:none} }`;
  const st=document.createElement("style"); st.textContent=css; document.head.appendChild(st);

  const link=(t,h,on)=>`<a href="${h}"${on?' class="on" aria-current="page"':""}>${esc(t)}</a>`;
  const nav=VOCI.map(([t,v,pp])=>{
    const on=pp.some(x=>x.endsWith("*")?pag.startsWith(x.slice(0,-1)):x===pag);
    if(typeof v==="string") return link(t,v,on);
    return `<div class="mm-dd${on?" on":""}"><button type="button" aria-haspopup="true">${esc(t)} ▾</button><div class="mm-menu">`+
      v.map(x=>x.length===1?`<div class="mm-h">${esc(x[0])}</div>`:link(x[0],x[1],x[1].replace(/\.html.*$/,"")===pag)).join("")+`</div></div>`;
  }).join("");
  const h=document.createElement("header"); h.className="mm-top";
  h.innerHTML=`<div class="mm-in"><a class="mm-brand" href="index.html" aria-label="Mugello Meteo & Clima, home">
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M2 18 L11 8 L18 15 L27 6 L38 18" stroke="#0f6b52" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 35 C12 27 15 35 21 30 C27 25 31 33 37 25" stroke="#2a64a8" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span>Mugello Meteo <i>&amp;</i> Clima</span></a>
    <div class="mm-nav" role="navigation" aria-label="Menu principale">${nav}</div>
    <button class="mm-btn" type="button" aria-label="Menu" aria-expanded="false">☰</button></div>`;

  function monta(){
    // la vecchia barra con "← Torna alla home" non serve più
    document.querySelectorAll(".top,.site-top,.topbar,a.mmc-back").forEach(el=>{
      if(el.matches("a.mmc-back")||el.querySelector("a.back")) el.remove();
    });
    document.body.insertBefore(h,document.body.firstChild);
    const b=h.querySelector(".mm-btn");
    b.addEventListener("click",()=>{const o=h.classList.toggle("open");b.setAttribute("aria-expanded",o);b.textContent=o?"✕":"☰";
      h.querySelectorAll(".mm-dd.open").forEach(y=>y.classList.remove("open"));
      const cur=h.querySelector(".mm-dd.on"); if(o&&cur) cur.classList.add("open");});   // sottomenu chiusi, tranne quello della pagina
    h.querySelectorAll(".mm-dd>button").forEach(x=>x.addEventListener("click",e=>{e.stopPropagation();
      const d=x.parentNode, o=!d.classList.contains("open"); h.querySelectorAll(".mm-dd.open").forEach(y=>y.classList.remove("open")); if(o) d.classList.add("open");}));
    document.addEventListener("click",e=>{if(!h.contains(e.target)){h.querySelectorAll(".mm-dd.open").forEach(y=>y.classList.remove("open"));
      if(h.classList.contains("open")){h.classList.remove("open");b.setAttribute("aria-expanded","false");b.textContent="☰";}}});
    // gli altri elementi fissi in alto della pagina (schede, indici) scendono sotto il menu
    const fissi=[...document.querySelectorAll("body *")].filter(el=>!h.contains(el)&&el!==h&&getComputedStyle(el).position==="sticky"&&parseFloat(getComputedStyle(el).top)<20);
    const sposta=()=>{const H=h.offsetHeight; fissi.forEach(el=>el.style.top=H+"px");
      document.documentElement.style.scrollPaddingTop=(H+12)+"px";};
    sposta(); addEventListener("resize",sposta);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",monta); else monta();
})();
