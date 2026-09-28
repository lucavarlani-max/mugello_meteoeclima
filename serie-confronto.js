/* Serie storiche: confronto del riscaldamento tra le stazioni (anomalia sul 1961–1990) */
(function(){
  const ROOT=document.getElementById("riscaldamento"); if(!ROOT) return;
  const ST=[
    {id:"milano-brera",n:"Milano Brera",c:"Milano"},
    {id:"new-york-central-park",n:"New York Central Park",c:"New York"},
    {id:"padova",n:"Padova",c:"Padova"},
    {id:"moncalieri",n:"Moncalieri",c:"Moncalieri"},
    {id:"de-bilt",n:"De Bilt",c:"De Bilt"},
    {id:"san-francisco",n:"San Francisco",c:"San Francisco"},
    {id:"genova",n:"Genova Università",c:"Genova"}
  ];
  ST.forEach((s,i)=>s.col="var(--s"+(i+1)+")");
  const B0=1961,B1=1990,WIN=5,MINW=6;
  const $=id=>document.getElementById(id);
  const f1=v=>(Math.round(v*10)/10).toFixed(1).replace(".",",");
  const f2=v=>(Math.round(v*100)/100).toFixed(2).replace(".",",");
  const sg=(v,f)=>(v>=0?"+":"−")+(f||f1)(Math.abs(v));
  const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
  let mode="m", from=1850, sel=null;

  function prep(s,d){
    const A=d.anni.filter(a=>a.tm!=null);
    const base=mean(A.filter(a=>a.y>=B0&&a.y<=B1).map(a=>a.tm));
    const by={}; A.forEach(a=>by[a.y]=a.tm-base);
    s.base=base; s.y0=A[0].y; s.y1=A[A.length-1].y;
    s.an=A.map(a=>({y:a.y,v:by[a.y]}));
    s.sm=[];
    for(let y=s.y0;y<=s.y1;y++){
      const w=[]; for(let k=y-WIN;k<=y+WIN;k++) if(by[k]!=null) w.push(by[k]);
      if(by[y]!=null&&w.length>=MINW) s.sm.push({y,v:mean(w)});
    }
    s.by=by; s.smBy={}; s.sm.forEach(p=>s.smBy[p.y]=p.v);
    const last=s.an.slice(-10); s.recent=mean(last.map(p=>p.v)); s.r0=last[0].y; s.r1=last[last.length-1].y;
    const xs=s.an.filter(p=>p.y>=1971), mx=mean(xs.map(p=>p.y)), my=mean(xs.map(p=>p.v));
    s.trend=10*xs.reduce((a,p)=>a+(p.y-mx)*(p.v-my),0)/xs.reduce((a,p)=>a+(p.y-mx)**2,0);
    s.hot=s.an.reduce((a,p)=>p.v>a.v?p:a);
  }

  function path(pts,X,Y){
    let d="",prev=null;
    pts.forEach(p=>{d+=(prev!=null&&p.y===prev+1?"L":"M")+X(p.y).toFixed(1)+" "+Y(p.v).toFixed(1); prev=p.y;});
    return d;
  }

  function draw(){
    const box=$("rs-chart"), W=box.clientWidth, H=box.clientHeight, narrow=W<520;
    const m={l:38,r:narrow?84:104,t:10,b:24};
    const data=ST.filter(s=>s.an);
    if(!data.length) return;
    const x0=Math.max(from||-1e9,Math.min(...data.map(s=>s.y0))), x1=Math.max(...data.map(s=>s.y1));
    const key=mode==="m"?"sm":"an";
    const vis=data.map(s=>s[key].filter(p=>p.y>=x0));
    const vs=[].concat(...vis.map(a=>a.map(p=>p.v)));
    let lo=Math.min(0,...vs), hi=Math.max(0,...vs);
    const st=(hi-lo)>3?1:.5; lo=Math.floor(lo/st)*st; hi=Math.ceil(hi/st)*st;
    const X=y=>m.l+(y-x0)/(x1-x0)*(W-m.l-m.r), Y=v=>m.t+(hi-v)/(hi-lo)*(H-m.t-m.b);
    let g="";
    for(let v=lo;v<=hi+1e-9;v+=st){
      const y=Y(v).toFixed(1);
      g+=`<line class="${Math.abs(v)<1e-9?"zero":"grid"}" x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}"/><text class="axl" x="${m.l-6}" y="${(+y+3.5).toFixed(1)}" text-anchor="end">${Math.abs(v)<1e-9?"0":sg(v,st<1?f1:(x=>String(Math.round(x))))}</text>`;
    }
    const span=x1-x0, pw=(W-m.l-m.r)/span, tk=[10,20,25,50,100].find(t=>t*pw>=48)||100;
    for(let y=Math.ceil(x0/tk)*tk;y<=x1;y+=tk) g+=`<text class="axl" x="${X(y).toFixed(1)}" y="${H-6}" text-anchor="middle">${y}</text>`;
    // linee
    data.forEach((s,i)=>{ g+=`<path class="ln${mode==="a"?" an":""}${sel===s.id?" on":""}" data-id="${s.id}" stroke="${s.col}" d="${path(vis[i],X,Y)}"/>`; });
    // etichette dirette in fondo alle linee, senza sovrapposizioni
    const labs=data.map((s,i)=>{const p=vis[i][vis[i].length-1]; return p?{s,x:X(p.y),y:Y(p.v)}:null;}).filter(Boolean).sort((a,b)=>a.y-b.y);
    const gap=14; labs.forEach((l,i)=>{l.ly=i?Math.max(l.y,labs[i-1].ly+gap):l.y;});
    const over=labs.length?labs[labs.length-1].ly-(H-m.b):0; if(over>0) labs.forEach(l=>l.ly-=over);
    for(let i=1;i<labs.length;i++) if(labs[i].ly<labs[i-1].ly+gap) labs[i].ly=labs[i-1].ly+gap;
    labs.forEach(l=>{ g+=`<line x1="${(l.x+3).toFixed(1)}" x2="${(W-m.r+6).toFixed(1)}" y1="${l.y.toFixed(1)}" y2="${l.ly.toFixed(1)}" stroke="${l.s.col}" stroke-width="1" opacity=".5" class="lab${sel===l.s.id?" on":""}"/>`+
      `<text class="lab${sel===l.s.id?" on":""}" data-id="${l.s.id}" x="${W-m.r+9}" y="${(l.ly+4).toFixed(1)}" style="cursor:pointer">${l.s.c}</text>`; });
    g+=`<line class="cross" id="rs-cross" y1="${m.t}" y2="${H-m.b}" style="display:none"/><g id="rs-hp"></g>`;
    g+=`<rect id="rs-hit" x="${m.l}" y="0" width="${W-m.l-m.r}" height="${H}" fill="transparent"/>`;
    box.querySelector("svg")&&box.querySelector("svg").remove();
    box.insertAdjacentHTML("afterbegin",`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Anomalia di temperatura annua rispetto al 1961–1990 nelle stazioni storiche, ${x0}–${x1}">${g}</svg>`);
    const svg=box.querySelector("svg"); svg.classList.toggle("dim",!!sel);
    svg.querySelectorAll("text.lab").forEach(t=>t.addEventListener("click",()=>focus(t.dataset.id)));
    // tooltip
    const tip=$("rs-tip"), cross=$("rs-cross"), hp=$("rs-hp");
    const move=e=>{
      const r=svg.getBoundingClientRect(), px=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
      const yr=Math.max(x0,Math.min(x1,Math.round(x0+(px-m.l)/(W-m.l-m.r)*(x1-x0))));
      const rows=data.map(s=>({s,v:mode==="m"?s.smBy[yr]:s.by[yr]})).filter(o=>o.v!=null).sort((a,b)=>b.v-a.v);
      if(!rows.length){leave();return;}
      const cx=X(yr); cross.setAttribute("x1",cx); cross.setAttribute("x2",cx); cross.style.display="";
      hp.innerHTML=rows.map(o=>`<circle class="hp${sel===o.s.id?" on":""}" cx="${cx.toFixed(1)}" cy="${Y(o.v).toFixed(1)}" r="4.5" fill="${o.s.col}"/>`).join("");
      tip.innerHTML=`<b>${yr}</b> <span style="color:var(--ink-faint);font-size:11.5px">${mode==="m"?"media su 11 anni":"anno"}</span><br>`+
        rows.map(o=>`<div${sel&&sel!==o.s.id?' style="opacity:.55"':""}><i style="background:${o.s.col}"></i>${o.s.c}<span class="v">${sg(o.v,f2)} °C</span></div>`).join("");
      tip.style.opacity=1;
      const tw=tip.offsetWidth; tip.style.left=(cx+14+tw>W?cx-14-tw:cx+14)+"px"; tip.style.top=m.t+"px";
    };
    const leave=()=>{tip.style.opacity=0;cross.style.display="none";hp.innerHTML="";};
    const hit=$("rs-hit");
    hit.addEventListener("mousemove",move); hit.addEventListener("mouseleave",leave);
    hit.addEventListener("touchstart",move,{passive:true}); hit.addEventListener("touchmove",move,{passive:true}); hit.addEventListener("touchend",leave);
  }

  function legend(){
    $("rs-leg").innerHTML=ST.filter(s=>s.an).map(s=>`<button data-id="${s.id}" aria-pressed="${sel===s.id}"><i style="background:${s.col}"></i>${s.n}</button>`).join("");
    $("rs-leg").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>focus(b.dataset.id)));
  }
  function focus(id){ sel=sel===id?null:id; legend(); draw(); }

  function table(){
    const d=ST.filter(s=>s.an);
    $("rs-tab").innerHTML=`<thead><tr><th>Stazione</th><th>Dati dal</th><th>Media 1961–1990</th><th>Ultimi 10 anni</th><th>Tendenza dal 1971</th><th>Anno più caldo</th></tr></thead><tbody>`+
      d.slice().sort((a,b)=>b.recent-a.recent).map(s=>`<tr><td><i style="background:${s.col}"></i><a href="${s.id}.html">${s.n}</a></td><td>${s.y0}</td><td>${f1(s.base)} °C</td>`+
        `<td><b>${sg(s.recent)} °C</b> <span class="per">${s.r0}–${s.r1}</span></td><td><b>${sg(s.trend,f2)}</b> °C/10 anni</td><td>${s.hot.y} <span style="color:var(--ink-faint)">(${sg(s.hot.v)})</span></td></tr>`).join("")+`</tbody>`;
    const r=d.slice().sort((a,b)=>b.recent-a.recent), t=d.map(s=>s.trend);
    $("rs-lead").innerHTML=`Le temperature medie annue delle ${d.length} stazioni analizzate qui, come scostamento dalla media di ciascuna nel trentennio 1961–1990: così si possono confrontare città con climi molto diversi. Negli ultimi dieci anni di dati la più calda rispetto al suo passato è <b>${r[0].n}</b> (${sg(r[0].recent)} °C), la meno <b>${r[r.length-1].n}</b> (${sg(r[r.length-1].recent)} °C)${r[r.length-1].id==="san-francisco"?", dove l'oceano Pacifico e le acque fredde lungo la costa smorzano il riscaldamento":""}. Dal 1971 la tendenza va da ${sg(Math.min(...t),f2)} a ${sg(Math.max(...t),f2)} °C ogni dieci anni.`;
  }

  function seg(id,fn){ $(id).querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
    $(id).querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b)); fn(b.dataset.v); draw(); })); }
  seg("rs-mode",v=>mode=v); seg("rs-from",v=>from=+v);

  Promise.all(ST.map(s=>fetch("./data/serie/"+s.id+".json").then(r=>r.json()).then(d=>prep(s,d)).catch(()=>{}))).then(()=>{
    if(!ST.some(s=>s.an)){ ROOT.style.display="none"; return; }
    legend(); table(); draw();
  });
  let rt; addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(draw,150);});
})();
