/* Piogge estreme in Toscana: grafici della pagina piogge-estreme.html (dati in data/piogge-estreme.json) */
(function(){
  const $=id=>document.getElementById(id);
  const DUR=[5,10,15,20,30,60,180,360,720,1440];
  const dLab=d=>d<60?d+" min":d===60?"1 ora":(d/60)+" ore";
  const dShort=d=>d<60?d+"′":(d/60)+"h";
  const f1=v=>(Math.round(v*10)/10).toFixed(1).replace(".",",");
  const MES=["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  const dIt=s=>{const [y,m,d]=s.split("-").map(Number);return d+" "+MES[m-1]+" "+y;};
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  // eventi: colore per identità (non per rango)
  const EV=[
    {id:"e96",n:"19 giugno 1996 · Versilia e Garfagnana",t:r=>r.data==="1996-06-19"||r.data==="1996-06-18"&&r.cod==="TOS02000281"},
    {id:"e17",n:"10 settembre 2017 · Livorno",t:r=>r.data==="2017-09-10"},
    {id:"e30",n:"28 settembre 1930 · Cecina",t:r=>r.data==="1930-09-28"},
    {id:"eot",n:"Altri eventi",t:()=>true}
  ];
  const evOf=r=>EV.find(e=>e.t(r));
  const col=r=>`var(--${evOf(r).id})`;
  let R=[], unit="mm", sel=null, dur=60;

  fetch("./data/piogge-estreme.json").then(r=>r.json()).then(d=>{
    R=d.record.map(r=>({...r,ih:r.mm/(r.dur/60),y:+r.data.slice(0,4),ev:null}));
    R.forEach(r=>r.ev=evOf(r).id);
    DUR.forEach(x=>R.filter(r=>r.dur===x).sort((a,b)=>b.mm-a.mm).forEach((r,i)=>r.pos=i+1));
    tiles(); legend(); env(); durSeg(); classifica(); timeline(); stazioni(); eventi(); tabella();
    let t; addEventListener("resize",()=>{clearTimeout(t);t=setTimeout(()=>{env();timeline();},150);});
  }).catch(()=>{$("tiles").innerHTML='<div class="loading">Dati non disponibili.</div>';});

  function tiles(){
    const top=x=>R.find(r=>r.dur===x&&r.pos===1);
    const n96=DUR.filter(x=>top(x).ev==="e96").length;
    const t=(lab,big,unit,who)=>`<div class="tile"><div class="lab">${lab}</div><div class="big">${big}<s>${unit}</s></div><div class="who">${who}</div></div>`;
    $("tiles").innerHTML=
      t("In 5 minuti",f1(top(5).mm)," mm",`${top(5).st}, ${dIt(top(5).data)} · ${Math.round(top(5).ih)} mm/h`)+
      t("In un'ora",f1(top(60).mm)," mm",`${top(60).st}, ${dIt(top(60).data)}`)+
      t("In 24 ore",f1(top(1440).mm)," mm",`${top(1440).st}, ${dIt(top(1440).data)}`)+
      t("19 giugno 1996",n96+" su 10","",`record di durata detenuti dall'evento di Versilia e Garfagnana`);
  }

  function legend(){
    $("leg").innerHTML=EV.map(e=>`<button data-id="${e.id}" aria-pressed="${sel===e.id}"><i style="background:var(--${e.id})"></i>${e.n}</button>`).join("");
    $("leg").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{sel=sel===b.dataset.id?null:b.dataset.id;legend();env();}));
  }

  /* --- grafico durata / pioggia (asse x logaritmico) --- */
  function env(){
    const box=$("ch-env"), W=box.clientWidth, H=box.clientHeight, narrow=W<520;
    const m={l:44,r:narrow?14:20,t:26,b:28};
    const v=r=>unit==="mm"?r.mm:r.ih;
    const lx=Math.log(DUR[0]), hx=Math.log(DUR[DUR.length-1]);
    const X=d=>m.l+(Math.log(d)-lx)/(hx-lx)*(W-m.l-m.r);
    const vmax=Math.max(...R.map(v)); const st=unit==="mm"?(vmax>300?100:50):50; const hi=Math.ceil(vmax/st)*st;
    const Y=y=>m.t+(1-y/hi)*(H-m.t-m.b);
    let g="";
    for(let y=0;y<=hi;y+=st) g+=`<line class="grid" x1="${m.l}" x2="${W-m.r}" y1="${Y(y)}" y2="${Y(y)}"/><text class="axl" x="${m.l-6}" y="${Y(y)+3.5}" text-anchor="end">${y}</text>`;
    DUR.forEach((d,i)=>{ if(narrow&&[10,20].includes(d))return; g+=`<text class="axl" x="${X(d)}" y="${H-8}" text-anchor="middle">${narrow?dShort(d):dLab(d)}</text>`;});
    g+=`<text class="axl" x="${m.l-6}" y="${m.t-14}" text-anchor="end">${unit==="mm"?"mm":"mm/h"}</text>`;
    const tops=DUR.map(d=>R.filter(r=>r.dur===d).sort((a,b)=>v(b)-v(a))[0]);
    g+=`<path class="env" d="${tops.map((r,i)=>(i?"L":"M")+X(r.dur).toFixed(1)+" "+Y(v(r)).toFixed(1)).join(" ")}"/>`;
    // punti: gli altri sotto, i primi posti sopra
    [...R].sort((a,b)=>b.pos-a.pos).forEach(r=>{
      g+=`<circle class="pt${sel===r.ev?" on":""}" cx="${X(r.dur).toFixed(1)}" cy="${Y(v(r)).toFixed(1)}" r="${r.pos===1?7:4.5}" fill="${col(r)}"/>`;});
    g+=`<line class="cross" id="env-x" y1="${m.t}" y2="${H-m.b}" style="display:none"/><rect id="env-hit" x="${m.l-10}" y="0" width="${W-m.l-m.r+20}" height="${H}" fill="transparent"/>`;
    box.querySelector("svg")&&box.querySelector("svg").remove();
    box.insertAdjacentHTML("afterbegin",`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Le cinque piogge più forti registrate in Toscana per ogni durata, da 5 minuti a 24 ore">${g}</svg>`);
    const svg=box.querySelector("svg"); svg.classList.toggle("dim",!!sel);
    const tip=box.querySelector(".tip"), cx=$("env-x");
    const move=e=>{const r=svg.getBoundingClientRect(), px=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
      const d=DUR.reduce((a,b)=>Math.abs(X(b)-px)<Math.abs(X(a)-px)?b:a);
      const rows=R.filter(x=>x.dur===d).sort((a,b)=>v(b)-v(a));
      cx.setAttribute("x1",X(d));cx.setAttribute("x2",X(d));cx.style.display="";
      tip.innerHTML=`<b>${dLab(d)}</b><br>`+rows.map((x,i)=>`<div><i style="background:${col(x)}"></i>${i+1}. ${esc(x.st)} <span style="color:var(--ink-faint)">${x.y}</span><span class="v">${unit==="mm"?f1(x.mm)+" mm":f1(x.ih)+" mm/h"}</span></div>`).join("");
      tip.style.opacity=1; const tw=tip.offsetWidth; let lx=X(d)+14; if(lx+tw>W) lx=X(d)-14-tw; if(lx<0) lx=0; tip.style.left=lx+"px"; tip.style.top=m.t+"px";};
    const leave=()=>{tip.style.opacity=0;cx.style.display="none";};
    const hit=$("env-hit"); hit.addEventListener("mousemove",move); hit.addEventListener("mouseleave",leave);
    hit.addEventListener("touchstart",move,{passive:true}); hit.addEventListener("touchmove",move,{passive:true});
    hit.addEventListener("click",e=>{const r=svg.getBoundingClientRect(), px=e.clientX-r.left; dur=DUR.reduce((a,b)=>Math.abs(X(b)-px)<Math.abs(X(a)-px)?b:a); durSeg(); classifica();});
    const t5=tops[0], t24=tops[tops.length-1];
    $("env-note").textContent=unit==="mm"
      ?`La pioggia cresce con la durata ma sempre più lentamente: dai ${f1(t5.mm)} mm in 5 minuti ai ${f1(t24.mm)} mm in 24 ore. A Pomezzana, il 19 giugno 1996, 474,4 dei 478 mm del giorno caddero in 12 ore. Clicca su una durata per vederne la classifica qui sotto.`
      :`L'intensità è massima nei primi minuti: ${Math.round(t5.ih)} mm/h per 5 minuti a ${t5.st}, contro ${f1(t24.ih)} mm/h di media sulle 24 ore. Per confronto, una pioggia da 10 mm/h è già intensa.`;
  }

  /* --- classifica per durata --- */
  function durSeg(){
    $("seg-d").innerHTML=DUR.map(d=>`<button data-v="${d}" aria-pressed="${d===dur}">${dLab(d)}</button>`).join("");
    $("seg-d").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{dur=+b.dataset.v;durSeg();classifica();}));
  }
  function classifica(){
    const rows=R.filter(r=>r.dur===dur).sort((a,b)=>b.mm-a.mm), mx=rows[0].mm;
    $("bars").innerHTML=rows.map((r,i)=>`<div class="bar"><div class="n">${i+1}</div><div>
      <div class="t"><span><b>${esc(r.st)}</b> · ${dIt(r.data)}</span><span class="mm">${f1(r.mm)} mm · ${f1(r.ih)} mm/h</span></div>
      <div class="tr"><div class="fl" style="width:${(r.mm/mx*100).toFixed(1)}%;background:${col(r)}"></div></div></div></div>`).join("");
    const r=rows[0];
    $("dur-box").innerHTML=`<div class="lab" style="font-family:var(--mono);font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-faint)">Record per ${dLab(dur)}</div>
      <div class="big-n" style="margin:6px 0 2px">${f1(r.mm)} <span style="font-size:18px;color:var(--ink-faint)">mm</span></div>
      <p style="margin:0 0 10px;color:var(--ink-soft)">${esc(r.st)} (${r.cod}), ${dIt(r.data)}</p>
      <p class="note">Sono <b>${f1(r.mm)} litri su ogni metro quadrato</b> in ${dLab(dur)}: un'intensità media di <b>${f1(r.ih)} mm/h</b>${r.ih>=50?`, ${Math.floor(r.ih/10)} volte una pioggia già intensa da 10 mm/h`:""}. Il secondo posto è ${f1(rows[1].mm)} mm (${esc(rows[1].st)}, ${rows[1].y}), ${Math.round((1-rows[1].mm/r.mm)*100)}% in meno.</p>`;
  }

  /* --- linea del tempo --- */
  function timeline(){
    const box=$("ch-time"), W=box.clientWidth, H=box.clientHeight, narrow=W<520;
    const m={l:narrow?44:60,r:14,t:10,b:26}, y0=1920, y1=2020;
    const X=y=>m.l+(y-y0)/(y1-y0)*(W-m.l-m.r), rowH=(H-m.t-m.b)/DUR.length, Y=d=>m.t+(DUR.indexOf(d)+.5)*rowH;
    let g="";
    DUR.forEach(d=>{g+=`<line class="grid" x1="${m.l}" x2="${W-m.r}" y1="${Y(d)}" y2="${Y(d)}" style="stroke-dasharray:2 4"/><text class="axl" x="${m.l-8}" y="${Y(d)+3.5}" text-anchor="end">${narrow?dShort(d):dLab(d)}</text>`;});
    for(let y=y0;y<=y1;y+=narrow?20:10) g+=`<text class="axl" x="${X(y)}" y="${H-6}" text-anchor="middle">${y}</text>`;
    g+=`<line x1="${X(1991)}" x2="${X(1991)}" y1="${m.t}" y2="${H-m.b}" stroke="var(--ink-faint)" stroke-dasharray="3 3"/><text class="axl" x="${X(1991)+4}" y="${m.t+9}">telemisura dal 1991</text>`;
    // piccolo scarto verticale se nello stesso anno e durata ci sono più punti
    const seen={};
    [...R].sort((a,b)=>b.pos-a.pos).forEach(r=>{const k=r.dur+"-"+r.y; const n=seen[k]=(seen[k]||0)+1; const dy=(n-1)*7;
      const t=`${r.st} · ${dIt(r.data)} · ${dLab(r.dur)}: ${f1(r.mm)} mm (${r.pos}° posto)`;
      g+=`<circle class="pt" data-t="${esc(t)}" cx="${X(r.y+(+r.data.slice(5,7)-.5)/12).toFixed(1)}" cy="${(Y(r.dur)-dy).toFixed(1)}" r="${r.pos===1?7:4.5}" fill="${col(r)}" style="cursor:pointer"/>`;});
    box.querySelector("svg")&&box.querySelector("svg").remove();
    box.insertAdjacentHTML("afterbegin",`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Anno in cui sono state registrate le piogge da record, per durata">${g}</svg>`);
    const tip=box.querySelector(".tip");
    box.querySelectorAll("circle[data-t]").forEach(c=>{
      const show=()=>{tip.textContent=c.dataset.t;tip.style.opacity=1;const tw=tip.offsetWidth,x=+c.getAttribute("cx"),y=+c.getAttribute("cy");
        tip.style.left=Math.max(0,Math.min(W-tw,x-tw/2))+"px";tip.style.top=Math.max(0,y-44)+"px";};
      c.addEventListener("mouseenter",show); c.addEventListener("click",show); c.addEventListener("mouseleave",()=>tip.style.opacity=0);});
  }

  /* --- stazioni --- */
  function stazioni(){
    const c={}; R.forEach(r=>{const k=r.st; c[k]=c[k]||{n:0,best:0}; c[k].n++; if(r.pos===1)c[k].best++;});
    const L=Object.entries(c).sort((a,b)=>b[1].n-a[1].n||b[1].best-a[1].best).slice(0,10), mx=L[0][1].n;
    $("stz").innerHTML=L.map(([s,o])=>`<span>${esc(s)}${o.best?` <span style="color:var(--ink-faint);font-size:12px">· ${o.best} record</span>`:""}</span><b>${o.n}</b><div class="tr"><div class="fl" style="width:${(o.n/mx*100).toFixed(0)}%"></div></div>`).join("");
  }

  /* --- eventi --- */
  function eventi(){
    const k=(id,lim)=>{const rs=R.filter(r=>r.ev===id); const best=DUR.map(d=>rs.filter(r=>r.dur===d).sort((a,b)=>b.mm-a.mm)[0]).filter(Boolean);
      return best.filter(r=>lim.includes(r.dur)).map(r=>`<div><b>${f1(r.mm)} mm</b>in ${dLab(r.dur)}</div>`).join("");};
    $("k96").innerHTML=k("e96",[60,720,1440]); $("k17").innerHTML=k("e17",[30,60,180]); $("k30").innerHTML=k("e30",[720]);
  }

  /* --- tabella --- */
  function tabella(){
    const rows=[...R].sort((a,b)=>a.dur-b.dur||a.pos-b.pos);
    const draw=()=>{const q=$("q").value.trim().toLowerCase();
      const F=rows.filter(r=>!q||(r.st+" "+r.cod+" "+r.data+" "+dLab(r.dur)).toLowerCase().includes(q));
      $("tab").innerHTML=`<thead><tr><th>Durata</th><th>Pos.</th><th style="text-align:left">Stazione</th><th>Codice</th><th>Data</th><th>Pioggia</th><th>Intensità</th></tr></thead><tbody>`+
        F.map(r=>`<tr><td>${dLab(r.dur)}</td><td class="rank">${r.pos}</td><td class="st"><span class="dot" style="background:${col(r)}"></span>${esc(r.st)}</td><td class="m">${r.cod}</td><td>${dIt(r.data)}</td><td class="v">${f1(r.mm)} mm</td><td>${f1(r.ih)} mm/h</td></tr>`).join("")+`</tbody>`;
      $("tab-n").textContent=`${F.length} di ${rows.length} valori`;};
    $("q").addEventListener("input",draw); draw();
    const csv="durata_min;posizione;codice;stazione;data;pioggia_mm;intensita_mm_h\n"+rows.map(r=>[r.dur,r.pos,r.cod,r.st,r.data,f1(r.mm),f1(r.ih)].join(";")).join("\n");
    $("csv").href="data:text/csv;charset=utf-8,"+encodeURIComponent("﻿"+csv);
  }

  document.querySelectorAll("#seg-u button").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll("#seg-u button").forEach(x=>x.setAttribute("aria-pressed",x===b)); unit=b.dataset.v; env();}));
})();
