/* Pagina "Borgo San Lorenzo nella storia": confronto di un giorno (o di una temperatura)
   con tutta la serie della stazione TOS01000999, e della pioggia di un mese con gli stessi
   mesi degli altri anni. Dati: data/bsl/borgo.json (build_bsl.py + fetch_bsl.py). */
(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const MESI=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
  const MES=["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  const f1=v=>v==null||isNaN(v)?"—":(Math.round(v*10)/10).toFixed(1).replace(".",",").replace("-","−");
  const f0=v=>v==null||isNaN(v)?"—":String(Math.round(v)).replace("-","−");
  const sg=v=>(v>=0?"+":"")+f1(v);
  const pct=v=>Math.round(v*100)+"%";
  const ord=n=>n+"ª";
  const DAY=864e5;
  const NOME={tx:"massima",tn:"minima",tm:"media"};
  const iso=d=>d.toISOString().slice(0,10);
  const ud=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(Date.UTC(y,m-1,d));};
  const dIt=s=>{const d=ud(s);return d.getUTCDate()+" "+MESI[d.getUTCMonth()]+" "+d.getUTCFullYear();};
  const dm=s=>{const d=ud(s);return d.getUTCDate()+" "+MESI[d.getUTCMonth()];};
  const el1=s=>{const g=ud(s).getUTCDate();return g===8||g===11;};          // "l'11", "l'8"
  const il=s=>(el1(s)?"l'":"il ")+dm(s), Il=s=>(el1(s)?"L'":"Il ")+dm(s);
  const ilD=s=>(el1(s)?"l'":"il ")+dIt(s), IlD=s=>(el1(s)?"L'":"Il ")+dIt(s);
  const dei=s=>(el1(s)?"degli ":"dei ")+dm(s), ordM=n=>n+"°";
  const REF=Date.UTC(2000,0,1);                                   // anno bisestile di riferimento
  const doyOf=(m,d)=>Math.round((Date.UTC(2000,m,d)-REF)/DAY);   // 0..365
  const oggiIso=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome"}).format(new Date());
  function q(sorted,p){if(!sorted.length)return null;const i=(sorted.length-1)*p,a=Math.floor(i),b=Math.ceil(i);return sorted[a]+(sorted[b]-sorted[a])*(i-a);}
  const mean=a=>{a=a.filter(v=>v!=null);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;};
  const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  let B=null, REC=[], BYDOY=[], PART=null, LAST=null, PM=new Map(), CLIM={};
  let tv="tx";

  fetch("./data/bsl/borgo.json",{cache:"no-store"}).then(r=>r.json()).then(d=>{B=d;prepara();initT();initP();
    let rt;addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>{disegnaT();disegnaP();},150);});
  }).catch(()=>{$("h-lab").textContent="Dati non disponibili al momento.";});

  /* ---------------- dati ---------------- */
  function prepara(){
    const t0=ud(B.t.dal).getTime();
    BYDOY=Array.from({length:366},()=>[]);
    B.t.tx.forEach((x,i)=>{const n=B.t.tn[i]; if(x==null&&n==null)return;
      const d=new Date(t0+i*DAY), r={iso:iso(d),y:d.getUTCFullYear(),m:d.getUTCMonth(),dd:d.getUTCDate(),tx:x,tn:n,tm:(x!=null&&n!=null)?(x+n)/2:null};
      r.k=doyOf(r.m,r.dd); REC.push(r); BYDOY[r.k].push(r);});
    LAST=REC[REC.length-1].iso;
    const o=B.oggi;
    if(o&&o.data>LAST&&(o.max!=null||o.min!=null)){const d=ud(o.data);
      PART={iso:o.data,y:d.getUTCFullYear(),m:d.getUTCMonth(),dd:d.getUTCDate(),tx:o.max,tn:o.min,tm:(o.max!=null&&o.min!=null)?(o.max+o.min)/2:null,part:true,ora:o.ora};
      PART.k=doyOf(PART.m,PART.dd);}
    // pioggia per mese
    const p0=ud(B.p.dal).getTime();
    B.p.mm.forEach((v,i)=>{const d=new Date(p0+i*DAY),y=d.getUTCFullYear(),m=d.getUTCMonth(),k=y*12+m;
      if(!PM.has(k))PM.set(k,{y,m,days:Array(new Date(Date.UTC(y,m+1,0)).getUTCDate()).fill(null)});
      PM.get(k).days[d.getUTCDate()-1]=v;});
    if(o&&o.p!=null){const d=ud(o.data),k=d.getUTCFullYear()*12+d.getUTCMonth();
      if(!PM.has(k))PM.set(k,{y:d.getUTCFullYear(),m:d.getUTCMonth(),days:Array(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()).fill(null)});
      const g=PM.get(k).days; if(g[d.getUTCDate()-1]==null) g[d.getUTCDate()-1]=o.p;}
    const oy=+oggiIso.slice(0,4), om=+oggiIso.slice(5,7)-1;
    PM.forEach(M=>{M.miss=M.days.filter(v=>v==null).length; M.tot=M.days.reduce((a,v)=>a+(v||0),0);
      M.corrente=(M.y===oy&&M.m===om); M.ok=!M.corrente&&M.miss<=2;
      if(M.corrente){const oggiG=+oggiIso.slice(8,10);M.finoA=oggiG;M.miss=M.days.slice(0,oggiG).filter(v=>v==null).length;}});
    const nT=REC.filter(r=>r.tx!=null).length, anni=new Set(REC.map(r=>r.y)).size;
    $("lead-n").textContent=`Nell'archivio ci sono ${nT.toLocaleString("it-IT")} giorni con la temperatura, su ${anni} anni.`;
    $("m-sir").textContent=dIt(B.sir_al);
    $("t-src").textContent=`dal 1951 · dati fino al ${dIt(PART?PART.iso:LAST)}${PART?" (oggi in corso)":""}`;
  }
  function clim(v){ // fasce per giorno dell'anno, finestra di 7 giorni
    if(CLIM[v]) return CLIM[v];
    const out=[];
    for(let k=0;k<366;k++){const all=[],norm=[];
      for(let j=-3;j<=3;j++){const L=BYDOY[(k+j+366)%366];L.forEach(r=>{if(r[v]!=null){all.push(r[v]);if(r.y>=1991&&r.y<=2020)norm.push(r[v]);}});}
      all.sort((a,b)=>a-b);
      out.push({min:all[0],max:all[all.length-1],p10:q(all,.1),p50:q(all,.5),p90:q(all,.9),norm:mean(norm)});}
    return CLIM[v]=out;
  }

  /* ---------------- tooltip e utilità grafiche ---------------- */
  function tipIn(el){let t=el.querySelector(".tip");if(!t){t=document.createElement("div");t.className="tip";el.appendChild(t);}return t;}
  function place(el,tip,x,y){tip.style.opacity=1;const tw=tip.offsetWidth,W=el.clientWidth;let lx=x+14;if(lx+tw>W)lx=x-tw-14;tip.style.left=Math.max(0,lx)+"px";tip.style.top=Math.max(0,y-10)+"px";}
  function ticks(lo,hi,n){const s0=(hi-lo)/n||1,m=Math.pow(10,Math.floor(Math.log10(s0)));const st=[1,2,2.5,5,10].map(k=>k*m).find(s=>s>=s0);const o=[];for(let v=Math.ceil(lo/st)*st;v<=hi+1e-9;v+=st)o.push(+v.toFixed(6));return o;}
  const lab=v=>String(v).replace(".",",").replace("-","−");
  const yearCol=(y,y0,y1)=>`color-mix(in srgb,var(--pine) ${Math.round(18+82*(y-y0)/Math.max(1,y1-y0))}%,var(--panel))`;

  /* ---------------- temperatura ---------------- */
  /* scelta della data in formato europeo: giorno / mese / anno */
  function dataInit(){
    const d=$("t-day"), max=PART?PART.iso:LAST, min=B.t.dal, a0=+min.slice(0,4), a1=+max.slice(0,4);
    $("d-m").innerHTML=MESI.map((n,i)=>`<option value="${i+1}">${n}</option>`).join("");
    $("d-a").innerHTML=Array.from({length:a1-a0+1},(_,i)=>`<option>${a1-i}</option>`).join("");
    const giorni=()=>{const n=new Date(Date.UTC(+$("d-a").value,+$("d-m").value,0)).getUTCDate(),g=Math.min(+$("d-g").value||1,n);
      $("d-g").innerHTML=Array.from({length:n},(_,i)=>`<option value="${i+1}">${String(i+1).padStart(2,"0")}</option>`).join("");$("d-g").value=g;};
    const scrivi=s=>{if(s>max)s=max;if(s<min)s=min;d.value=s;$("d-a").value=+s.slice(0,4);$("d-m").value=+s.slice(5,7);giorni();$("d-g").value=+s.slice(8,10);
      $("d-prev").disabled=s<=min;$("d-next").disabled=s>=max;};
    const leggi=()=>{giorni();return `${$("d-a").value}-${String($("d-m").value).padStart(2,"0")}-${String($("d-g").value).padStart(2,"0")}`;};
    const cambia=s=>{scrivi(s);$("t-val").value="";disegnaT();};
    ["d-g","d-m","d-a"].forEach(id=>$(id).addEventListener("change",()=>cambia(leggi())));
    const passo=k=>cambia(iso(new Date(ud(d.value).getTime()+k*DAY)));
    $("d-prev").addEventListener("click",()=>passo(-1)); $("d-next").addEventListener("click",()=>passo(1));
    d.imposta=scrivi; scrivi(max);
  }
  function initT(){
    const d=$("t-day"); dataInit();
    $("t-var").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;$("t-var").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));tv=b.dataset.v;disegnaT();});
    let t;$("t-val").addEventListener("input",()=>{clearTimeout(t);t=setTimeout(disegnaT,250);});
    $("t-reset").addEventListener("click",()=>{d.imposta(PART?PART.iso:LAST);$("t-val").value="";disegnaT();});
    disegnaT();
  }
  function scelto(){
    const s=$("t-day").value||LAST, dd=ud(s), k=doyOf(dd.getUTCMonth(),dd.getUTCDate());
    const rec=(PART&&PART.iso===s)?PART:BYDOY[k].find(r=>r.iso===s)||null;
    const cv=parseFloat(String($("t-val").value).replace(",","."));
    const custom=!isNaN(cv);
    return {iso:s,k,y:dd.getUTCFullYear(),rec,custom,v:custom?cv:(rec?rec[tv]:null)};
  }
  function disegnaT(){
    if(!B) return;
    const S=scelto(), C=clim(tv), c=C[S.k], same=BYDOY[S.k].filter(r=>r[tv]!=null&&!(S.rec&&r.iso===S.iso&&!S.custom));
    const vals=same.map(r=>r[tv]).sort((a,b)=>a-b), v=S.v, nome=NOME[tv];
    // eroe
    const partTxt=(!S.custom&&S.rec&&S.rec.part)?` · finora, alle ${S.rec.ora||""}`:"";
    $("h-lab").textContent=S.custom?`Temperatura inserita · confronto con ${il(S.iso)}`:`${nome[0].toUpperCase()+nome.slice(1)} ${el1(S.iso)?"dell'":"del "}${dIt(S.iso)}${partTxt}`;
    $("h-val").innerHTML=v==null?"—":`${f1(v)}<small>°C</small>`;
    if(v==null){$("h-sub").textContent=S.rec?"":"Nessun dato per questo giorno: prova un'altra data o scrivi una temperatura.";$("h-facts").innerHTML="";$("h-phrase").textContent="";}
    else{
      const anom=v-c.norm, sopra=vals.filter(x=>x>v).length, sotto=vals.filter(x=>x<v).length, n=vals.length;
      const alto=sotto>=sopra, rank=alto?sopra+1:sotto+1, perc=n?(sotto+0.5*(n-sopra-sotto))/n:.5;
      const hi=same.reduce((a,r)=>r[tv]>a[tv]?r:a,same[0]||{}), lo=same.reduce((a,r)=>r[tv]<a[tv]?r:a,same[0]||{});
      $("h-sub").innerHTML=`norma 1991–2020 per ${il(S.iso)}: <b>${f1(c.norm)} °C</b> · <b style="color:${anom>=0?"var(--warm)":"var(--cold)"}">${sg(anom)} °C</b>`;
      $("h-facts").innerHTML=
        `<div class="fact"><b class="${alto?"up":"down"}">${ord(rank)}</b><span>${alto?"più alta":"più bassa"} per ${il(S.iso)} su ${n+1} anni${S.custom?" (se fosse misurata)":""}</span></div>`+
        `<div class="fact"><b>${pct(perc)}</b><span>${dei(S.iso)} misurati ha avuto una ${nome} più bassa</span></div>`+
        `<div class="fact"><b>${f1(hi[tv])}° <span style="font-size:14px;color:var(--ink-faint)">${hi.y||""}</span></b><span>record del giorno · il più basso ${f1(lo[tv])}° nel ${lo.y||""}</span></div>`;
      $("h-meter").querySelector("i").style.left=(Math.max(.02,Math.min(.98,perc))*100)+"%";
      let fr;
      if(S.custom) fr=`Una ${nome} di <b>${f1(v)} °C</b> ${il(S.iso)} sarebbe ${rank===1?`<b>il nuovo record ${alto?"di caldo":"di freddo"}</b> per questa data`:`la <b>${ord(rank)} ${alto?"più alta":"più bassa"}</b> in ${n} anni di misure`}, ${f1(Math.abs(anom))} °C ${anom>=0?"sopra":"sotto"} la norma.`;
      else{const oltre=same.filter(r=>alto?r[tv]>v:r[tv]<v).map(r=>r.y).sort((a,b)=>b-a);
        fr=`${S.rec&&S.rec.part?"Oggi":IlD(S.iso)} a Borgo San Lorenzo la ${nome} ${S.rec&&S.rec.part?"ha raggiunto finora":"è stata di"} <b>${f1(v)} °C</b>: ${rank===1?`<b>il valore più ${alto?"alto":"basso"} mai misurato in questa data</b>`:`la <b>${ord(rank)} più ${alto?"alta":"bassa"}</b> per ${il(S.iso)} in ${n+1} anni di misure`}, ${f1(Math.abs(anom))} °C ${anom>=0?"sopra":"sotto"} la norma.`+
          (oltre.length&&oltre.length<=3?` ${alto?"Più caldo":"Più freddo"} solo nel ${oltre.join(", nel ").replace(/, nel (\d+)$/," e nel $1")}.`:"");}
      $("h-phrase").innerHTML=fr;
    }
    $("sw-title").textContent=`${Il(S.iso)}, anno per anno: la ${nome}`;
    $("fan-yr").textContent=S.custom?"il valore inserito":`il ${S.y}`;
    $("fan-title").textContent=`La ${nome} nell'anno${S.custom?"":" "+S.y}`;
    swarm(S,same,c); fan(S,C); hist(S);
  }
  function swarm(S,same,c){
    const el=$("ch-swarm"), W=el.clientWidth, H=el.clientHeight, m={l:14,r:14,t:18,b:28}, iw=W-m.l-m.r, cy=m.t+(H-m.t-m.b)/2;
    const all=same.map(r=>r[S.custom?tv:tv]); if(S.v!=null) all.push(S.v);
    if(!all.length){el.innerHTML="";return;}
    let lo=Math.min(...all), hi=Math.max(...all); const pad=Math.max(1,(hi-lo)*.08); lo-=pad; hi+=pad;
    const X=v=>m.l+(v-lo)/(hi-lo)*iw, R=W<520?5:6.5, y0=Math.min(...same.map(r=>r.y)), y1=Math.max(...same.map(r=>r.y));
    // disposizione a sciame
    const pts=same.map(r=>({r,x:X(r[tv]),y:cy})).sort((a,b)=>a.x-b.x), placed=[];
    pts.forEach(p=>{for(let k=0;k<60;k++){const off=(k%2?1:-1)*Math.ceil(k/2)*(R*2+1.2);p.y=cy+off;
      if(!placed.some(o=>Math.abs(o.x-p.x)<R*2+1&&Math.abs(o.y-p.y)<R*2+1))break;} placed.push(p);});
    let g=""; ticks(lo,hi,W<520?5:9).forEach(t=>{g+=`<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${H-m.b}"/><text class="axl" x="${X(t)}" y="${H-m.b+17}" text-anchor="middle">${lab(t)}°</text>`;});
    if(c.norm!=null) g+=`<line class="ref" x1="${X(c.norm)}" x2="${X(c.norm)}" y1="${m.t-6}" y2="${H-m.b}"/><text class="reflab" x="${X(c.norm)}" y="${m.t-8}" text-anchor="middle">norma ${f1(c.norm)}°</text>`;
    pts.forEach((p,i)=>{g+=`<circle class="dot" data-i="${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${R}" fill="${yearCol(p.r.y,y0,y1)}"/>`;});
    if(S.v!=null){const x=X(S.v);g+=`<line class="vline" x1="${x}" x2="${x}" y1="${m.t}" y2="${H-m.b}"/><circle class="dot sel" cx="${x}" cy="${cy}" r="${R+3}"/><text class="vlab" x="${x}" y="${H-m.b-6}" text-anchor="${x>W-80?"end":x<80?"start":"middle"}">${S.custom?"valore scelto":S.y} · ${f1(S.v)}°</text>`;}
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Temperatura ${NOME[tv]} del ${dm(S.iso)} in ogni anno della serie">${g}</svg>`;
    const svg=el.querySelector("svg"), tip=tipIn(el);
    svg.addEventListener("pointermove",e=>{const rb=svg.getBoundingClientRect(),px=e.clientX-rb.left,py=e.clientY-rb.top;let b=null,bd=18*18;
      pts.forEach(p=>{const d=(p.x-px)**2+(p.y-py)**2;if(d<bd){bd=d;b=p;}});if(!b){tip.style.opacity=0;return;}
      tip.innerHTML=`<b>${dm(S.iso)} ${b.r.y}</b><br>${NOME[tv]} <b>${f1(b.r[tv])} °C</b><br><span class="m">massima ${f1(b.r.tx)}° · minima ${f1(b.r.tn)}°</span>`;place(el,tip,b.x,b.y);});
    svg.addEventListener("pointerleave",()=>{tip.style.opacity=0;});
  }
  function fan(S,C){
    const el=$("ch-fan"), W=el.clientWidth, H=el.clientHeight, m={l:40,r:12,t:12,b:26}, iw=W-m.l-m.r, ih=H-m.t-m.b;
    const yr=S.custom?null:S.y, serie=[];
    if(yr!=null){REC.forEach(r=>{if(r.y===yr&&r[tv]!=null)serie.push([r.k,r[tv]]);}); if(PART&&PART.y===yr&&PART[tv]!=null)serie.push([PART.k,PART[tv]]);}
    let lo=Math.min(...C.map(c=>c.min)), hi=Math.max(...C.map(c=>c.max)); if(S.v!=null){lo=Math.min(lo,S.v);hi=Math.max(hi,S.v);}
    const yT=ticks(lo,hi,6), y0=Math.min(yT[0],lo), y1=Math.max(yT[yT.length-1],hi);
    const X=k=>m.l+k/365*iw, Y=v=>m.t+ih-(v-y0)/(y1-y0)*ih;
    const area=(a,b)=>"M"+C.map((c,k)=>X(k).toFixed(1)+" "+Y(c[a]).toFixed(1)).join("L")+"L"+C.map((c,k)=>[k,c]).reverse().map(([k,c])=>X(k).toFixed(1)+" "+Y(c[b]).toFixed(1)).join("L")+"Z";
    let g="";
    yT.forEach(t=>{g+=`<line class="grid" x1="${m.l}" x2="${m.l+iw}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axl" x="${m.l-6}" y="${Y(t)+3.5}" text-anchor="end">${lab(t)}°</text>`;});
    MES.forEach((n,i)=>{const k=doyOf(i,1);g+=`<text class="axl" x="${X(k+15)}" y="${H-8}" text-anchor="middle">${n}</text>`;if(i)g+=`<line class="grid" x1="${X(k)}" x2="${X(k)}" y1="${m.t+ih}" y2="${m.t+ih+4}"/>`;});
    g+=`<path class="band0" d="${area("max","min")}"/><path class="band1" d="${area("p90","p10")}"/>`;
    g+=`<path class="med" d="M${C.map((c,k)=>X(k).toFixed(1)+" "+Y(c.p50).toFixed(1)).join("L")}"/>`;
    if(serie.length){serie.sort((a,b)=>a[0]-b[0]);let d="",prev=-9;serie.forEach(([k,v])=>{d+=(k-prev>1?"M":"L")+X(k).toFixed(1)+" "+Y(v).toFixed(1);prev=k;});g+=`<path class="yr" d="${d}"/>`;}
    if(S.v!=null) g+=`<circle class="dot sel" cx="${X(S.k)}" cy="${Y(S.v)}" r="6"/>`;
    g+=`<line class="cross" id="fx" x1="-9999" x2="-9999" y1="${m.t}" y2="${m.t+ih}"/>`;
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Temperatura ${NOME[tv]} nell'anno rispetto ai record e ai valori tipici">${g}</svg>`;
    const svg=el.querySelector("svg"), tip=tipIn(el), cx=svg.querySelector("#fx"), byK=new Map(serie);
    svg.addEventListener("pointermove",e=>{const rb=svg.getBoundingClientRect();const k=Math.max(0,Math.min(365,Math.round((e.clientX-rb.left-m.l)/iw*365)));const c=C[k],x=X(k);
      cx.setAttribute("x1",x);cx.setAttribute("x2",x);const dd=new Date(REF+k*DAY),v=byK.get(k);
      tip.innerHTML=`<b>${dd.getUTCDate()} ${MESI[dd.getUTCMonth()]}</b>`+(v!=null?`<br>${yr}: <b>${f1(v)} °C</b>`:"")+`<br><span class="m">tipico ${f1(c.p50)}° · 8 anni su 10 tra ${f1(c.p10)}° e ${f1(c.p90)}°<br>record ${f1(c.min)}° / ${f1(c.max)}°</span>`;place(el,tip,x,m.t);});
    svg.addEventListener("pointerleave",()=>{tip.style.opacity=0;cx.setAttribute("x1",-9999);cx.setAttribute("x2",-9999);});
  }
  function hist(S){
    const el=$("ch-hist"), W=el.clientWidth, H=el.clientHeight, m={l:40,r:12,t:22,b:26}, iw=W-m.l-m.r, ih=H-m.t-m.b;
    const V=REC.map(r=>r[tv]).filter(v=>v!=null), lo=Math.floor(Math.min(...V)), hi=Math.ceil(Math.max(...V));
    const nb=hi-lo, cnt=Array(nb).fill(0); V.forEach(v=>{cnt[Math.min(nb-1,Math.floor(v-lo))]++;});
    const mx=Math.max(...cnt), X=v=>m.l+(v-lo)/(hi-lo)*iw, Y=c=>m.t+ih-c/mx*ih, bw=Math.max(1,iw/nb-1.5);
    const v=S.v, alto=v!=null&&v>=q([...V].sort((a,b)=>a-b),.5);
    let g=""; ticks(0,mx,4).forEach(t=>{g+=`<line class="grid" x1="${m.l}" x2="${m.l+iw}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axl" x="${m.l-6}" y="${Y(t)+3.5}" text-anchor="end">${t.toLocaleString("it-IT")}</text>`;});
    ticks(lo,hi,W<520?5:10).forEach(t=>{g+=`<text class="axl" x="${X(t)}" y="${H-8}" text-anchor="middle">${lab(t)}°</text>`;});
    cnt.forEach((c,i)=>{const a=lo+i, on=v!=null&&(alto?a>=Math.floor(v):a+1<=Math.ceil(v));g+=`<rect class="hb${on?" on":""}" data-i="${i}" x="${X(a)+0.75}" y="${Y(c)}" width="${bw}" height="${m.t+ih-Y(c)}" rx="2"/>`;});
    if(v!=null){const x=X(v);g+=`<line class="vline" x1="${x}" x2="${x}" y1="${m.t-8}" y2="${m.t+ih}"/><text class="vlab" x="${x}" y="${m.t-10}" text-anchor="${x>W-90?"end":x<90?"start":"middle"}">${f1(v)}°</text>`;}
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribuzione della temperatura ${NOME[tv]} di tutti i giorni della serie">${g}</svg>`;
    const svg=el.querySelector("svg"), tip=tipIn(el);
    svg.addEventListener("pointermove",e=>{const rb=svg.getBoundingClientRect();const i=Math.floor((e.clientX-rb.left-m.l)/iw*nb);if(i<0||i>=nb){tip.style.opacity=0;return;}
      tip.innerHTML=`<b>${lab(lo+i)}° – ${lab(lo+i+1)}°</b><br>${cnt[i].toLocaleString("it-IT")} giorni`;place(el,tip,X(lo+i+.5),Y(cnt[i]));});
    svg.addEventListener("pointerleave",()=>{tip.style.opacity=0;});
    if(v==null){$("hist-note").textContent="";return;}
    const oltre=REC.filter(r=>r[tv]!=null&&(alto?r[tv]>=v:r[tv]<=v)&&r.iso!==S.iso).sort((a,b)=>b.iso.localeCompare(a.iso)), n=V.length;
    $("hist-note").innerHTML=`Una ${NOME[tv]} di ${alto?"almeno":"al massimo"} ${f1(v)} °C si è vista in <b>${oltre.length.toLocaleString("it-IT")}</b> giorni su ${n.toLocaleString("it-IT")} (${(oltre.length/n*100).toFixed(1).replace(".",",")}%)`+
      (oltre.length?`; l'ultima volta ${ilD(oltre[0].iso).replace(/^(il |l')/,"$1<b>")}</b> (${f1(oltre[0][tv])} °C).`:S.custom?`: <b>non è mai successo</b>.`:`: è <b>il valore più ${alto?"alto":"basso"} di tutta la serie</b>.`);
  }

  /* ---------------- pioggia ---------------- */
  function initP(){
    $("p-mon").innerHTML=MESI.map((n,i)=>`<option value="${i}">${n[0].toUpperCase()+n.slice(1)}</option>`).join("");
    const anni=[...new Set([...PM.values()].map(M=>M.y))].sort((a,b)=>b-a);
    $("p-year").innerHTML=anni.map(y=>`<option>${y}</option>`).join("");
    const reset=()=>{$("p-mon").value=+oggiIso.slice(5,7)-1;$("p-year").value=+oggiIso.slice(0,4);disegnaP();};
    $("p-mon").addEventListener("change",disegnaP); $("p-year").addEventListener("change",disegnaP); $("p-reset").addEventListener("click",reset);
    $("p-src").textContent=`dal 1991 · dati fino al ${dIt(B.oggi&&B.oggi.p!=null?B.oggi.data:LAST)}`;
    reset();
  }
  function disegnaP(){
    if(!B) return;
    const m=+$("p-mon").value, y=+$("p-year").value, M=PM.get(y*12+m);
    const tutti=[...PM.values()].filter(x=>x.m===m&&x.ok).sort((a,b)=>a.y-b.y), tot=tutti.map(x=>x.tot).sort((a,b)=>a-b);
    const med=q(tot,.5), t33=q(tot,1/3), t66=q(tot,2/3), nomeM=MESI[m];
    const part=M&&M.corrente, fin=part?M.finoA:(M?M.days.length:0);
    $("pb-title").textContent=`${nomeM[0].toUpperCase()+nomeM.slice(1)}, anno per anno`;
    if(!M||(!M.ok&&!part)){
      $("ph-lab").textContent=`Pioggia di ${nomeM} ${y}`;$("ph-val").textContent="—";$("ph-sub").textContent=M?"Mese con troppi giorni mancanti.":"Nessun dato per questo mese.";$("ph-facts").innerHTML="";$("p-phrase").textContent="";
    }else{
      const v=M.tot, sopra=tot.filter(x=>x>v).length, sotto=tot.filter(x=>x<v).length, n=tot.length, perc=n?(sotto+.5*(n-sopra-sotto))/n:.5;
      const giorniP=M.days.filter(x=>x!=null&&x>=1).length, gTip=mean(tutti.map(x=>x.days.filter(d=>d!=null&&d>=1).length));
      const maxG=M.days.reduce((a,x,i)=>x!=null&&x>a.v?{v:x,i}:a,{v:-1,i:0});
      $("ph-lab").textContent=`Pioggia di ${nomeM} ${y}${part?` · dal 1° al ${fin}`:""}`;
      $("ph-val").innerHTML=`${f1(v)}<small>mm</small>`;
      $("ph-sub").innerHTML=`valore tipico per ${nomeM}: <b>${f0(med)} mm</b> (mediana ${tutti[0]?tutti[0].y:""}–${tutti.length?tutti[tutti.length-1].y:""})`;
      const alto=sotto>=sopra, rank=alto?sopra+1:sotto+1;
      $("ph-facts").innerHTML=
        `<div class="fact"><b>${med?Math.round(v/med*100)+"%":"—"}</b><span>del valore tipico di ${nomeM}${part?", e il mese non è finito":""}</span></div>`+
        (part?`<div class="fact"><b>${sotto}</b><span>${nomeM} interi su ${n} hanno avuto meno pioggia di così</span></div>`
             :`<div class="fact"><b>${ordM(rank)}</b><span>${nomeM} ${alto?"più piovoso":"più secco"} su ${n+ (M.ok?0:1)}</span></div>`)+
        `<div class="fact"><b>${giorniP}</b><span>giorni di pioggia (almeno 1 mm); di solito ${f0(gTip)}${maxG.v>0?` · il più piovoso ${maxG.i+1===8||maxG.i+1===11?"l'":"il "}${maxG.i+1}, ${f1(maxG.v)} mm`:""}</span></div>`;
      $("ph-meter").querySelector("i").style.left=(Math.max(.02,Math.min(.98,perc))*100)+"%";
      const cl=v<t33?"più secco del normale":v>t66?"più piovoso del normale":"nella norma";
      $("p-phrase").innerHTML=part
        ?`Dall'inizio di ${nomeM} a Borgo San Lorenzo sono caduti <b>${f1(v)} mm</b>, il ${med?Math.round(v/med*100):"—"}% di quanto piove di solito in tutto il mese. ${v>=t66?"Il mese è già <b>più piovoso del normale</b>.":v>=med?"Ha già raggiunto la quantità tipica del mese.":`Per arrivare al valore tipico mancano <b>${f0(med-v)} mm</b>.`}`
        :`${nomeM[0].toUpperCase()+nomeM.slice(1)} ${y} è stato <b>${cl}</b>: ${f1(v)} mm, ${rank===1?`<b>il ${alto?"più piovoso":"più secco"}</b> dal 1992`:`il ${ordM(rank)} ${alto?"più piovoso":"più secco"}`} su ${n} anni.`;
    }
    pbars(m,y,tutti,M,med,t33,t66); pcum(m,y,tutti,M);
  }
  function pbars(m,y,tutti,M,med,t33,t66){
    const el=$("ch-pbars"), W=el.clientWidth, H=el.clientHeight, mg={l:40,r:52,t:12,b:26}, iw=W-mg.l-mg.r, ih=H-mg.t-mg.b;
    const L=[...tutti]; if(M&&M.corrente&&!L.includes(M)) L.push(M);
    if(!L.length){el.innerHTML="";return;}
    const y0=Math.min(...L.map(x=>x.y)), y1=Math.max(...L.map(x=>x.y)), hi=Math.max(...L.map(x=>x.tot),1)*1.05;
    const n=y1-y0+1, X=yy=>mg.l+(yy-y0+.5)/n*iw, Y=v=>mg.t+ih-v/hi*ih, bw=Math.max(2,iw/n-3);
    let g="";
    if(t33!=null){g+=`<rect class="zone" x="${mg.l}" y="${Y(t33)}" width="${iw}" height="${mg.t+ih-Y(t33)}"/><text class="zlab" x="${mg.l+iw+4}" y="${Y(t33/2)+3}">secco</text>`;
      g+=`<text class="zlab" x="${mg.l+iw+4}" y="${Y((t33+t66)/2)+3}">normale</text><rect class="zone" x="${mg.l}" y="${mg.t}" width="${iw}" height="${Y(t66)-mg.t}" style="opacity:.55"/><text class="zlab" x="${mg.l+iw+4}" y="${Y(Math.min(hi,(t66+hi)/2))+3}">piovoso</text>`;}
    ticks(0,hi,5).forEach(t=>{g+=`<line class="grid" x1="${mg.l}" x2="${mg.l+iw}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axl" x="${mg.l-6}" y="${Y(t)+3.5}" text-anchor="end">${t}</text>`;});
    const step=n>24?(W<520?10:5):(W<520?5:2); for(let yy=Math.ceil(y0/step)*step;yy<=y1;yy+=step) g+=`<text class="axl" x="${X(yy)}" y="${H-8}" text-anchor="middle">${yy}</text>`;
    L.forEach(x=>{const sel=x.y===y, c=x.corrente?"pb part"+(sel?" sel":""):"pb"+(sel?" sel":"");g+=`<rect class="${c}" x="${X(x.y)-bw/2}" y="${Y(x.tot)}" width="${bw}" height="${Math.max(0,mg.t+ih-Y(x.tot))}" rx="${Math.min(3,bw/2)}"/>`;});
    if(med!=null) g+=`<line class="ref" x1="${mg.l}" x2="${mg.l+iw}" y1="${Y(med)}" y2="${Y(med)}"/>`;
    g+=`<text class="axl" x="${mg.l-6}" y="${mg.t-2}" text-anchor="end">mm</text>`;
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pioggia di ${MESI[m]} in ogni anno dal ${y0}">${g}</svg>`;
    const svg=el.querySelector("svg"), tip=tipIn(el), by=new Map(L.map(x=>[x.y,x]));
    svg.addEventListener("pointermove",e=>{const rb=svg.getBoundingClientRect();const yy=Math.round(y0-.5+(e.clientX-rb.left-mg.l)/iw*n);const x=by.get(yy);if(!x){tip.style.opacity=0;return;}
      tip.innerHTML=`<b>${MESI[m]} ${yy}</b><br><b>${f1(x.tot)} mm</b>${x.corrente?" finora":""}<br><span class="m">${med?Math.round(x.tot/med*100)+"% del valore tipico":""}</span>`;place(el,tip,X(yy),Y(x.tot));});
    svg.addEventListener("pointerleave",()=>{tip.style.opacity=0;});
    svg.addEventListener("click",e=>{const rb=svg.getBoundingClientRect();const yy=Math.round(y0-.5+(e.clientX-rb.left-mg.l)/iw*n);if(by.has(yy)){$("p-year").value=yy;disegnaP();}});
  }
  function pcum(m,y,tutti,M){
    const el=$("ch-pcum"), W=el.clientWidth, H=el.clientHeight, mg={l:40,r:12,t:12,b:26}, iw=W-mg.l-mg.r, ih=H-mg.t-mg.b;
    const nd=new Date(Date.UTC(2001,m+1,0)).getUTCDate(); // mese non bisestile come riferimento
    const cum=x=>{let s=0;return x.days.slice(0,nd).map(v=>s+=(v||0));};
    const C=tutti.map(cum), band=[];
    for(let d=0;d<nd;d++){const v=C.map(c=>c[d]).filter(x=>x!=null).sort((a,b)=>a-b);band.push({p10:q(v,.1),p50:q(v,.5),p90:q(v,.9)});}
    const sel=M?cum(M).slice(0,M.corrente?M.finoA:nd):[];
    const hi=Math.max(1,...band.map(b=>b.p90||0),...sel)*1.08, X=d=>mg.l+d/(nd-1)*iw, Y=v=>mg.t+ih-v/hi*ih;
    let g=""; ticks(0,hi,5).forEach(t=>{g+=`<line class="grid" x1="${mg.l}" x2="${mg.l+iw}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axl" x="${mg.l-6}" y="${Y(t)+3.5}" text-anchor="end">${t}</text>`;});
    [1,5,10,15,20,25,nd].forEach(d=>{g+=`<text class="axl" x="${X(d-1)}" y="${H-8}" text-anchor="middle">${d}</text>`;});
    if(band.length&&band[0].p10!=null){g+=`<path class="cband" d="M${band.map((b,d)=>X(d).toFixed(1)+" "+Y(b.p90).toFixed(1)).join("L")}L${band.map((b,d)=>[d,b]).reverse().map(([d,b])=>X(d).toFixed(1)+" "+Y(b.p10).toFixed(1)).join("L")}Z"/>`;
      g+=`<path class="cmed" d="M${band.map((b,d)=>X(d).toFixed(1)+" "+Y(b.p50).toFixed(1)).join("L")}"/>`;}
    if(sel.length){g+=`<path class="cyr" d="M${sel.map((v,d)=>X(d).toFixed(1)+" "+Y(v).toFixed(1)).join("L")}"/><circle class="dot sel" cx="${X(sel.length-1)}" cy="${Y(sel[sel.length-1])}" r="5"/>`;}
    g+=`<text class="axl" x="${mg.l-6}" y="${mg.t-2}" text-anchor="end">mm</text><line class="cross" id="cx2" x1="-9999" x2="-9999" y1="${mg.t}" y2="${mg.t+ih}"/>`;
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pioggia cumulata giorno per giorno a ${MESI[m]}">${g}</svg>`;
    const svg=el.querySelector("svg"), tip=tipIn(el), cx=svg.querySelector("#cx2");
    svg.addEventListener("pointermove",e=>{const rb=svg.getBoundingClientRect();const d=Math.max(0,Math.min(nd-1,Math.round((e.clientX-rb.left-mg.l)/iw*(nd-1))));const b=band[d],x=X(d);
      cx.setAttribute("x1",x);cx.setAttribute("x2",x);
      tip.innerHTML=`<b>${d+1} ${MESI[m]}</b>`+(sel[d]!=null?`<br>${y}: <b>${f1(sel[d])} mm</b> dal 1°`:"")+(b&&b.p50!=null?`<br><span class="m">tipico ${f0(b.p50)} mm · 8 anni su 10 tra ${f0(b.p10)} e ${f0(b.p90)} mm</span>`:"");place(el,tip,x,mg.t);});
    svg.addEventListener("pointerleave",()=>{tip.style.opacity=0;cx.setAttribute("x1",-9999);cx.setAttribute("x2",-9999);});
  }
})();
