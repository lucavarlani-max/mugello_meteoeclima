/* Pagina "Effemeridi del Mugello": Sole, Luna, pianeti ed eventi del cielo per
   Borgo San Lorenzo, calcolati nel browser con astro.js, in ora italiana. */
(function(){
  const A=window.Astro, $=id=>document.getElementById(id), rad=A.rad, DAY=864e5;
  const MESI=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
  const MES=["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  const A0=1950, A1=2050;
  const ora=A.ora, pad=n=>String(n).padStart(2,"0");
  const dur=m=>Math.floor(m/60)+"h "+pad(Math.round(m%60))+"m";
  const deg=v=>Math.round(v)+"°";
  const num=v=>Math.round(v).toLocaleString("it-IT");
  const gg=(d,o)=>A.giorno(d,o);
  const dayName=d=>gg(d,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  let Y,M,D;                                       // giorno scelto (calendario italiano)
  let skyT="sera";

  /* ---------- utilità ---------- */
  const noonOf=(y,m,d)=>A.mezzogiorno(y,m,d);
  const midOf=(y,m,d)=>A.mezzanotte(noonOf(y,m,d));
  const hLoc=t=>(t-A.mezzanotte(t))/36e5;          // ore trascorse dalla mezzanotte italiana
  const oggi=()=>A.partiRoma(new Date());
  const isOggi=()=>{const [y,m,d]=oggi();return y===Y&&m===M&&d===D;};
  const giorniMese=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
  function tipIn(el){let t=el.querySelector(".tip");if(!t){t=document.createElement("div");t.className="tip";el.appendChild(t);}return t;}
  function place(el,tip,x,y){tip.style.opacity=1;const tw=tip.offsetWidth,W=el.clientWidth;let lx=x+14;if(lx+tw>W)lx=x-tw-14;tip.style.left=Math.max(0,lx)+"px";tip.style.top=Math.max(0,y-10)+"px";}

  // disco lunare: p = fase 0..1 (0 nuova, .5 piena); lato illuminato a destra quando cresce
  function moonSvg(p,size,cls){
    return `<svg viewBox="0 0 ${size} ${size}" class="${cls||""}" aria-hidden="true">${moonG(p,size)}</svg>`;
  }
  function moonG(p,size){
    const r=size/2-1,c=size/2,k=Math.cos(2*Math.PI*p),rx=Math.abs(k)*r,cres=p<0.5;
    let d;
    if(cres) d=`M${c} ${c-r}A${r} ${r} 0 0 1 ${c} ${c+r}A${rx} ${r} 0 0 ${k>0?0:1} ${c} ${c-r}Z`;
    else d=`M${c} ${c-r}A${r} ${r} 0 0 0 ${c} ${c+r}A${rx} ${r} 0 0 ${k>0?1:0} ${c} ${c-r}Z`;
    const lit=(p<0.005||p>0.995)?"":`<path d="${d}" fill="var(--moon-lit)"/>`;
    return `<circle cx="${c}" cy="${c}" r="${r}" fill="var(--moon-dark)" stroke="var(--line)" stroke-width="1"/>${lit}`;
  }

  /* ---------- scelta della data (giorno / mese / anno) ---------- */
  function dataInit(){
    $("d-m").innerHTML=MESI.map((n,i)=>`<option value="${i+1}">${n}</option>`).join("");
    $("d-a").innerHTML=Array.from({length:A1-A0+1},(_,i)=>`<option>${A0+i}</option>`).join("");
    const leggi=()=>{const y=+$("d-a").value,m=+$("d-m").value,d=Math.min(+$("d-g").value,giorniMese(y,m));imposta(y,m,d);};
    ["d-g","d-m","d-a"].forEach(id=>$(id).addEventListener("change",leggi));
    const passo=k=>{const t=new Date(Date.UTC(Y,M-1,D)+k*DAY);imposta(t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate());};
    $("d-prev").addEventListener("click",()=>passo(-1));$("d-next").addEventListener("click",()=>passo(1));
    $("d-oggi").addEventListener("click",()=>imposta(...oggi()));
  }
  function imposta(y,m,d,noHist){
    if(y<A0){y=A0;m=1;d=1;} if(y>A1){y=A1;m=12;d=31;}
    Y=y;M=m;D=d;
    const n=giorniMese(y,m);$("d-g").innerHTML=Array.from({length:n},(_,i)=>`<option value="${i+1}">${pad(i+1)}</option>`).join("");
    $("d-g").value=d;$("d-m").value=m;$("d-a").value=y;
    $("d-prev").disabled=(y===A0&&m===1&&d===1);$("d-next").disabled=(y===A1&&m===12&&d===31);
    if(!noHist){try{const u=new URL(location.href);if(isOggi())u.searchParams.delete("d");else u.searchParams.set("d",`${y}-${pad(m)}-${pad(d)}`);history.replaceState(null,"",u);}catch(e){}}
    disegna();
  }

  /* ---------- Sole ---------- */
  function stagioneDi(t){
    const s=[];for(const y of [Y-1,Y,Y+1])[[0,"primavera"],[90,"estate"],[180,"autunno"],[270,"inverno"]].forEach(([g,n])=>s.push({t:A.stagione(y,g),n}));
    s.sort((a,b)=>a.t-b.t);let i=s.findIndex(x=>x.t>t)-1;const cur=s[i],nx=s[i+1];
    const g1=Math.floor((A.mezzanotte(t)-A.mezzanotte(cur.t))/DAY)+1,tot=Math.round((A.mezzanotte(nx.t)-A.mezzanotte(cur.t))/DAY);
    return {nome:cur.n,giorno:g1,tot};
  }
  function sole(){
    const noon=noonOf(Y,M,D),s=A.sunTimes(noon),ieri=A.sunTimes(new Date(noon-DAY));
    const off=A.offsetMin(noon);
    $("quando").textContent=dayName(noon)+" · "+(off===120?"ora legale (UTC+2)":"ora solare (UTC+1)");
    $("t-alba").textContent=ora(s.alba);$("t-tram").textContent=ora(s.tramonto);
    const za=A.sunPosition(s.alba),zt=A.sunPosition(s.tramonto);
    $("t-alba-az").textContent=`all'orizzonte a ${deg(A.gradiAz(za.azimuth))} (${A.direzione(za.azimuth)})`;
    $("t-tram-az").textContent=`all'orizzonte a ${deg(A.gradiAz(zt.azimuth))} (${A.direzione(zt.azimuth)})`;
    const len=(s.tramonto-s.alba)/6e4,dif=Math.round((len-(ieri.tramonto-ieri.alba)/6e4)*10)/10;
    $("t-len").textContent=dur(len);
    const dm=Math.abs(dif)<1?Math.round(Math.abs(dif)*60)+" s":Math.round(Math.abs(dif))+" min";
    $("t-len-d").innerHTML=`<b class="${dif>=0?"up":"down"}">${dif>=0?"+":"−"}${dm}</b> rispetto al giorno prima`;
    $("t-noon").textContent=ora(s.mezzogiorno);
    // equazione del tempo: mezzogiorno medio locale (12:00 − longitudine/15 in UT) meno quello vero
    const medio=Date.UTC(Y,M-1,D,12)-A.LUOGO.lon/15*36e5,eot=Math.round((medio-s.mezzogiorno)/6e4);
    $("t-noon-d").textContent=eot===0?"il Sole è in orario con il tempo medio":`il Sole è ${Math.abs(eot)} min ${eot>0?"in anticipo":"in ritardo"} sul tempo medio`;
    $("t-alt").textContent=deg(s.altezzaMax);
    const st=stagioneDi(noon);$("t-alt-d").innerHTML=`<b>${st.nome}</b> astronomico: giorno ${st.giorno} di ${st.tot}`;
    $("s-src").textContent=`${ora(s.alba)} – ${ora(s.tramonto)} · ${dur(len)} di luce`;
    zone(s);giornata(s);anno();
  }
  function zone(s){
    const dom=A.sunTimes(noonOf(...A.partiRoma(new Date(noonOf(Y,M,D).valueOf()+DAY))));
    const iv=(a,b)=>a&&b?`${ora(a)}–${ora(b)}`:"—";
    const Z=[
      ["var(--sk-gold)","Ora d'oro","luce calda e radente, ombre lunghe",iv(s.bluMattinaFine,s.oroMattinaFine),iv(s.oroSeraInizio,s.bluSeraInizio)],
      ["#4d74c9","Ora blu","il cielo si tinge di blu profondo",iv(s.civileInizio,s.bluMattinaFine),iv(s.bluSeraInizio,s.civileFine)],
      ["var(--sk-civ)","Crepuscolo civile","si vede bene senza luce artificiale",iv(s.civileInizio,s.alba),iv(s.tramonto,s.civileFine)],
      ["var(--sk-nau)","Crepuscolo nautico","compaiono le stelle, l'orizzonte si distingue ancora",iv(s.nauticoInizio,s.civileInizio),iv(s.civileFine,s.nauticoFine)],
      ["var(--sk-ast)","Crepuscolo astronomico","il cielo è quasi buio, restano le stelle più deboli",iv(s.astroInizio,s.nauticoInizio),iv(s.nauticoFine,s.astroFine)],
      ["var(--sk-night)","Notte astronomica","buio completo: il momento per osservare",s.astroFine?`dalle ${ora(s.astroFine)}`:"—",dom.astroInizio?`alle ${ora(dom.astroInizio)} del giorno dopo`:"—"]
    ];
    $("ztab").innerHTML=Z.map(([c,n,d,a,b])=>`<div class="zr"><i style="background:${c}"></i><div><b>${n}</b><span class="mono">${n==="Notte astronomica"?a+" "+b:"mattina "+a+" · sera "+b}</span><span>${d}</span></div></div>`).join("");
  }
  function giornata(s){
    const el=$("ch-day"),W=el.clientWidth,H=el.clientHeight,m={l:38,r:12,t:10,b:26},iw=W-m.l-m.r,ih=H-m.t-m.b;
    const t0=midOf(Y,M,D),t1=A.mezzanotte(new Date(t0.valueOf()+30*36e5)),span=t1-t0;
    const P=[];for(let t=t0.valueOf();t<=t1.valueOf();t+=5*6e4){const p=A.sunPosition(new Date(t));P.push({t,h:p.altitude/rad,az:p.azimuth});}
    const lo=Math.min(...P.map(p=>p.h)),hi=Math.max(...P.map(p=>p.h));
    const y0=Math.floor((lo-4)/10)*10,y1=Math.ceil((hi+4)/10)*10;
    const X=t=>m.l+(t-t0)/span*iw,Yh=h=>m.t+ih-(h-y0)/(y1-y0)*ih,cl=h=>Math.max(y0,Math.min(y1,h));
    const B=[[6,y1,"var(--sk-day)"],[0,6,"var(--sk-gold)"],[-6,0,"var(--sk-civ)"],[-12,-6,"var(--sk-nau)"],[-18,-12,"var(--sk-ast)"],[y0,-18,"var(--sk-night)"]];
    let g="";
    B.forEach(([a,b,c])=>{if(b<=y0||a>=y1)return;const ya=Yh(cl(b)),yb=Yh(cl(a));g+=`<rect class="z" x="${m.l}" y="${ya}" width="${iw}" height="${yb-ya}" fill="${c}"/>`;});
    [[3,"ora d'oro"],[-3,"civile"],[-9,"nautico"],[-15,"astronomico"]].forEach(([h,n])=>{if(h>y0+2&&h<y1)g+=`<text class="zl${h<-6?" inv":""}" x="${m.l+6}" y="${Yh(h)+3.5}">${n}</text>`;});
    for(let v=y0;v<=y1;v+=(y1-y0>100?20:10))g+=`<text class="axl" x="${m.l-6}" y="${Yh(v)+3.5}" text-anchor="end">${v}°</text>`;
    g+=`<line class="hz" x1="${m.l}" x2="${m.l+iw}" y1="${Yh(0)}" y2="${Yh(0)}"/>`;
    for(let k=0;k<=24;k+=3){const t=t0.valueOf()+k*36e5;if(t>t1)break;g+=`<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="${m.t+ih}" y2="${m.t+ih+4}"/><text class="axl" x="${X(t)}" y="${H-8}" text-anchor="middle">${W<520&&k%6?"":ora(new Date(t))}</text>`;}
    g+=`<path class="sun" d="M${P.map(p=>X(p.t).toFixed(1)+" "+Yh(p.h).toFixed(1)).join("L")}"/>`;
    [[s.alba,"alba"],[s.tramonto,"tramonto"]].forEach(([t,n])=>{if(t)g+=`<circle cx="${X(t)}" cy="${Yh(-0.83)}" r="4.5" fill="var(--amber)" stroke="var(--panel)" stroke-width="2"/>`;});
    if(s.mezzogiorno)g+=`<text class="vlab" x="${X(s.mezzogiorno)}" y="${Yh(s.altezzaMax)-10}" text-anchor="middle" style="font-family:var(--sans);font-size:12px;font-weight:700;fill:var(--ink);paint-order:stroke;stroke:var(--panel);stroke-width:4px">${deg(s.altezzaMax)} alle ${ora(s.mezzogiorno)}</text>`;
    const now=Date.now();
    if(now>=t0&&now<t1){const p=A.sunPosition(new Date(now)),x=X(now);g+=`<line class="now" x1="${x}" x2="${x}" y1="${m.t}" y2="${m.t+ih}"/><circle cx="${x}" cy="${Yh(p.altitude/rad)}" r="7" fill="var(--amber)" stroke="var(--ink)" stroke-width="2"/><text class="axl" x="${x+6}" y="${m.t+12}">adesso</text>`;}
    g+=`<line class="cross" id="dx" x1="-9999" x2="-9999" y1="${m.t}" y2="${m.t+ih}"/><circle id="dp" r="5" cx="-9999" cy="0" fill="var(--panel)" stroke="var(--amber)" stroke-width="2.5"/>`;
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Altezza del Sole sull'orizzonte nel corso della giornata">${g}</svg>`;
    const svg=el.querySelector("svg"),tip=tipIn(el),cx=svg.querySelector("#dx"),dp=svg.querySelector("#dp");
    const fase=h=>h>6?"giorno":h>0?"ora d'oro":h>-6?"crepuscolo civile":h>-12?"crepuscolo nautico":h>-18?"crepuscolo astronomico":"notte";
    svg.addEventListener("pointermove",e=>{const rb=svg.getBoundingClientRect(),f=(e.clientX-rb.left-m.l)/iw;if(f<0||f>1){tip.style.opacity=0;return;}
      const p=P[Math.round(f*(P.length-1))],x=X(p.t),y=Yh(p.h);cx.setAttribute("x1",x);cx.setAttribute("x2",x);dp.setAttribute("cx",x);dp.setAttribute("cy",y);
      tip.innerHTML=`<b>${ora(new Date(p.t))}</b> · ${fase(p.h)}<br>Sole a <b>${(Math.round(p.h*10)/10).toString().replace(".",",").replace("-","−")}°</b> <span class="m">verso ${A.direzione(p.az)} (${deg(A.gradiAz(p.az))})</span>`;place(el,tip,x,m.t);});
    svg.addEventListener("pointerleave",()=>{tip.style.opacity=0;cx.setAttribute("x1",-9999);cx.setAttribute("x2",-9999);dp.setAttribute("cx",-9999);});
  }
  function anno(){
    const el=$("ch-year"),W=el.clientWidth,H=el.clientHeight,m={l:40,r:12,t:10,b:26},iw=W-m.l-m.r,ih=H-m.t-m.b;
    const n=(Y%4===0&&Y%100!==0)||Y%400===0?366:365,R=[];
    for(let i=0;i<n;i++){const d=new Date(Date.UTC(Y,0,1+i)),y=d.getUTCFullYear(),mm=d.getUTCMonth()+1,dd=d.getUTCDate(),s=A.sunTimes(noonOf(y,mm,dd));
      R.push({i,mm,dd,s,a:hLoc(s.alba),t:hLoc(s.tramonto),ca:s.civileInizio?hLoc(s.civileInizio):null,ct:s.civileFine?hLoc(s.civileFine):null,len:(s.tramonto-s.alba)/6e4});}
    const lo=Math.floor(Math.min(...R.map(r=>r.ca??r.a)))-1,hi=Math.ceil(Math.max(...R.map(r=>r.ct??r.t)))+1;
    const X=i=>m.l+i/n*iw,Yh=h=>m.t+(h-lo)/(hi-lo)*ih,bw=iw/n+0.6;   // ore crescenti verso il basso: il mattino in alto
    let g=`<rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="var(--sk-night)" opacity=".85"/>`;
    R.forEach(r=>{const x=X(r.i).toFixed(2);if(r.ca!=null)g+=`<rect class="z" x="${x}" y="${Yh(r.ca).toFixed(1)}" width="${bw.toFixed(2)}" height="${(Yh(r.ct)-Yh(r.ca)).toFixed(1)}" fill="var(--sk-civ)"/>`;
      g+=`<rect class="z" x="${x}" y="${Yh(r.a).toFixed(1)}" width="${bw.toFixed(2)}" height="${(Yh(r.t)-Yh(r.a)).toFixed(1)}" fill="var(--sk-day)"/>`;});
    for(let h=lo;h<=hi;h+=(ih<220?4:2))g+=`<line class="grid" x1="${m.l}" x2="${m.l+iw}" y1="${Yh(h)}" y2="${Yh(h)}" opacity=".5"/><text class="axl" x="${m.l-6}" y="${Yh(h)+3.5}" text-anchor="end">${pad(h)}:00</text>`;
    const line=k=>{let d="",prev=null;R.forEach(r=>{d+=(prev==null||Math.abs(r[k]-prev)>0.5?"M":"L")+(X(r.i)+bw/2).toFixed(1)+" "+Yh(r[k]).toFixed(1);prev=r[k];});return d;};
    g+=`<path class="rise" d="${line("a")}"/><path class="set" d="${line("t")}"/>`;
    MES.forEach((nm,i)=>{const k=Math.round((Date.UTC(Y,i,1)-Date.UTC(Y,0,1))/DAY);g+=`<text class="axl" x="${X(k+15)}" y="${H-8}" text-anchor="middle">${W<520?nm[0].toUpperCase():nm}</text>`;if(i)g+=`<line class="grid" x1="${X(k)}" x2="${X(k)}" y1="${m.t+ih}" y2="${m.t+ih+4}"/>`;});
    const sel=Math.round((Date.UTC(Y,M-1,D)-Date.UTC(Y,0,1))/DAY);g+=`<line class="selv" x1="${X(sel)+bw/2}" x2="${X(sel)+bw/2}" y1="${m.t}" y2="${m.t+ih}"/>`;
    g+=`<line class="cross" id="yx" x1="-9999" x2="-9999" y1="${m.t}" y2="${m.t+ih}"/>`;
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Orari di alba e tramonto giorno per giorno nel ${Y}">${g}</svg>`;
    $("y-title").textContent=`Alba e tramonto nel ${Y}`;
    const svg=el.querySelector("svg"),tip=tipIn(el),cx=svg.querySelector("#yx");
    svg.addEventListener("pointermove",e=>{const rb=svg.getBoundingClientRect(),i=Math.floor((e.clientX-rb.left-m.l)/iw*n);if(i<0||i>=n){tip.style.opacity=0;return;}
      const r=R[i],x=X(i)+bw/2;cx.setAttribute("x1",x);cx.setAttribute("x2",x);
      tip.innerHTML=`<b>${r.dd} ${MESI[r.mm-1]}</b><br>alba <b>${ora(r.s.alba)}</b> · tramonto <b>${ora(r.s.tramonto)}</b><br><span class="m">${dur(r.len)} di luce · crepuscolo ${ora(r.s.civileInizio)}–${ora(r.s.civileFine)}</span>`;place(el,tip,x,m.t);});
    svg.addEventListener("pointerleave",()=>{tip.style.opacity=0;cx.setAttribute("x1",-9999);cx.setAttribute("x2",-9999);});
    svg.addEventListener("click",e=>{const rb=svg.getBoundingClientRect(),i=Math.floor((e.clientX-rb.left-m.l)/iw*n);if(i>=0&&i<n)imposta(Y,R[i].mm,R[i].dd);});
    // curiosità dell'anno
    const by=(k,f)=>R.reduce((a,b)=>f(b[k],a[k])?b:a);
    const lg=by("len",(x,y)=>x>y),sh=by("len",(x,y)=>x<y),ea=by("a",(x,y)=>x<y),la=by("a",(x,y)=>x>y),lt=by("t",(x,y)=>x>y),et=by("t",(x,y)=>x<y);
    const dd=r=>`${r.dd===1||r.dd===8||r.dd===11?"l'":"il "}${r.dd} ${MESI[r.mm-1]}`;
    $("y-note").innerHTML=`Nel ${Y} il giorno più lungo è ${dd(lg)} (<b>${dur(lg.len)}</b>), il più corto ${dd(sh)} (<b>${dur(sh.len)}</b>). Curiosamente l'alba più precoce non cade al solstizio ma ${dd(ea)} (${ora(ea.s.alba)}) e il tramonto più tardo ${dd(lt)} (${ora(lt.s.tramonto)}); d'inverno il tramonto più precoce arriva già ${dd(et)} (${ora(et.s.tramonto)}), mentre l'alba più tardiva è ${dd(la)} (${ora(la.s.alba)}). È l'effetto dell'equazione del tempo. I salti di un'ora sono i cambi tra ora solare e legale. Tocca il grafico per scegliere un giorno.`;
  }

  /* ---------- Luna ---------- */
  function luna(){
    const t0=midOf(Y,M,D),t=isOggi()?new Date():new Date(t0.valueOf()+21*36e5);
    const il=A.moonIllumination(t),[nome]=A.nomeFase(il.phase),mt=A.moonTimes(noonOf(Y,M,D)),pos=A.moonPosition(t);
    $("l-disc").innerHTML=moonSvg(il.phase,180);
    $("l-lab").textContent=isOggi()?"adesso, "+ora(t):"alle 21:00 del "+gg(t);
    $("l-nome").textContent=nome;
    const prev=A.prossimeFasi(new Date(t-32*DAY),10).filter(f=>f.f===0&&f.data<=t).pop(),eta=prev?(t-prev.data)/DAY:null;
    const nx=A.prossimeFasi(t,4),full=nx.find(f=>f.f===0.5),dist=pos.distance;
    const F=[
      ["Illuminata",Math.round(il.fraction*100)+"%",il.phase<0.5?"in crescita":"in calo"],
      ["Età",eta!=null?(Math.round(eta*10)/10).toString().replace(".",",")+" giorni":"—","dalla luna nuova"],
      ["Sorge",mt.sorge?ora(mt.sorge):mt.sempreSu?"sempre su":"—",mt.sorge?"a "+A.direzione(A.moonPosition(mt.sorge).azimuth):"non sorge in questo giorno"],
      ["Tramonta",mt.tramonta?ora(mt.tramonta):mt.sempreGiu?"—":"—",mt.tramonta?"a "+A.direzione(A.moonPosition(mt.tramonta).azimuth):"non tramonta in questo giorno"],
      ["Distanza",num(dist)+" km",dist<362000?"molto vicina: se è piena è una «superluna»":dist>403000?"vicina al punto più lontano":dist<384400?"più vicina della media":"più lontana della media"],
      [full?"Luna piena":"Prossima fase",full?gg(full.data,{day:"numeric",month:"short"}):"—",full?`alle ${ora(full.data)} · tra ${Math.max(0,Math.round((full.data-t)/DAY))} giorni`:""]
    ];
    $("l-facts").innerHTML=F.map(([l,v,s])=>`<div class="f"><div class="lab">${l}</div><b>${v}</b><span>${s}</span></div>`).join("");
    $("l-src").textContent=`${nome.toLowerCase()} · ${Math.round(il.fraction*100)}% illuminata`;
    $("l-phases").innerHTML=A.prossimeFasi(t0,4).map(f=>`<div class="ph">${moonSvg(f.f,34)}<div><b>${f.nome}</b><span>${gg(f.data,{weekday:"short",day:"numeric",month:"short"})} · ${ora(f.data)}</span></div></div>`).join("");
    calendario();
  }
  function calendario(){
    const n=giorniMese(Y,M),first=new Date(Date.UTC(Y,M-1,1)).getUTCDay(),lead=(first+6)%7;
    const t0=midOf(Y,M,1),fasi=A.prossimeFasi(t0,6),[ty,tm,td]=oggi();
    $("cal-title").textContent=`Il calendario lunare di ${MESI[M-1]} ${Y}`;
    let h=["lun","mar","mer","gio","ven","sab","dom"].map(d=>`<div class="dw">${d}</div>`).join("")+"<div></div>".repeat(lead);
    for(let d=1;d<=n;d++){
      const a=midOf(Y,M,d),b=A.mezzanotte(new Date(a.valueOf()+30*36e5)),il=A.moonIllumination(new Date(a.valueOf()+21*36e5));
      const ev=fasi.find(f=>f.data>=a&&f.data<b);
      h+=`<button type="button" data-d="${d}" class="${d===D?"sel":""}${Y===ty&&M===tm&&d===td?" today":""}" aria-label="${d} ${MESI[M-1]}: ${A.nomeFase(il.phase)[0]}, ${Math.round(il.fraction*100)}%">`+
         `<span class="n">${d}</span>${moonSvg(ev?ev.f:il.phase,26)}${ev?`<span class="ev">${ev.nome}<br>${ora(ev.data)}</span>`:`<span class="p">${Math.round(il.fraction*100)}%</span>`}</button>`;
    }
    $("cal").innerHTML=h;
  }

  /* ---------- pianeti ---------- */
  function pianeti(){
    const s=A.sunTimes(noonOf(Y,M,D)),t0=midOf(Y,M,D);
    const T={sera:new Date(s.tramonto.valueOf()+36e5),"23":new Date(t0.valueOf()+23*36e5),mattino:new Date(s.alba.valueOf()-36e5)};
    const pos=t=>A.PIANETI.map(p=>Object.assign({nome:p},A.planetPosition(p,t)));
    const sera=pos(T.sera),matt=pos(T.mattino),notte=pos(T["23"]);
    const cella=p=>p.altitude/rad<0?`<span class="m">sotto l'orizzonte</span>`:`<b>${deg(p.altitude/rad)}</b> <span class="m">a ${A.direzione(p.azimuth)}</span>`;
    $("p-body").innerHTML=sera.map((p,i)=>{const q=matt[i],hs=p.altitude/rad,hm=q.altitude/rad,hn=notte[i].altitude/rad;let c;
      if(p.elongazione<(p.nome==="Mercurio"?10:15))c=`<span class="chip off">vicino al Sole, invisibile</span>`;
      else if((hs>5||hn>10)&&hm>10)c=`<span class="chip ok">tutta la notte</span>`;
      else if(hs>7||hn>10)c=`<span class="chip ok">la sera${Math.max(hs,hn)<15?", basso":""}</span>`;
      else if(hm>7)c=`<span class="chip ok">al mattino${hm<15?", basso":""}</span>`;
      else c=`<span class="chip warn">troppo basso, difficile</span>`;
      return `<tr><td><b>${p.nome}</b></td><td>${cella(p)}</td><td>${cella(q)}</td><td>${deg(p.elongazione)}</td><td>${c}</td></tr>`;}).join("");
    cielo(T[skyT]);
  }
  function cielo(t){
    const el=$("ch-sky"),W=el.clientWidth,H=el.clientHeight,m={l:10,r:10,t:14,b:36},iw=W-m.l-m.r,ih=H-m.t-m.b;
    const O=A.PIANETI.map(p=>{const q=A.planetPosition(p,t);return {nome:p,h:q.altitude/rad,az:A.gradiAz(q.azimuth)};});
    const lp=A.moonPosition(t),il=A.moonIllumination(t);O.push({nome:"Luna",h:lp.altitude/rad,az:A.gradiAz(lp.azimuth),luna:true});
    const sp=A.sunPosition(t);if(sp.altitude>0)O.push({nome:"Sole",h:sp.altitude/rad,az:A.gradiAz(sp.azimuth),sole:true});
    const vis=O.filter(o=>o.h>-1),hmax=Math.max(60,Math.ceil((Math.max(0,...vis.map(o=>o.h))+10)/10)*10);
    const X=az=>m.l+az/360*iw,Yh=h=>m.t+ih-Math.max(0,h)/hmax*ih;
    let g=`<rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="var(--sk-night)" opacity=".9" rx="6"/>`;
    for(let h=30;h<hmax;h+=30)g+=`<line x1="${m.l}" x2="${m.l+iw}" y1="${Yh(h)}" y2="${Yh(h)}" stroke="#fff" stroke-opacity=".14" stroke-dasharray="3 4"/><text class="zl inv" x="${m.l+6}" y="${Yh(h)-4}">${h}°</text>`;
    g+=`<rect class="ground" x="${m.l}" y="${m.t+ih}" width="${iw}" height="8"/>`;
    [["N",0],["NE",45],["E",90],["SE",135],["S",180],["SO",225],["O",270],["NO",315],["N",360]].forEach(([n,a])=>{if(W<520&&n.length>1)return;g+=`<line class="grid" x1="${X(a)}" x2="${X(a)}" y1="${m.t+ih+8}" y2="${m.t+ih+12}"/><text class="axl" x="${X(a)}" y="${H-10}" text-anchor="middle" style="font-weight:600">${n}</text>`;});
    vis.forEach(o=>{const x=X(o.az),y=Yh(o.h);
      if(o.luna){const r=11;g+=`<g transform="translate(${x-r} ${y-r})">${moonG(il.phase,r*2)}</g>`;}
      else if(o.sole)g+=`<circle cx="${x}" cy="${y}" r="9" fill="#f6c453"/>`;
      else g+=`<circle class="pl" cx="${x}" cy="${y}" r="${o.nome==="Venere"||o.nome==="Giove"?6:4.5}" style="fill:#ffe9b8;stroke:none"/>`;
      g+=`<text class="pll" x="${x}" y="${y-(o.luna?16:11)}" text-anchor="${x>W-60?"end":x<60?"start":"middle"}">${o.nome}${o.h<3?" (all'orizzonte)":""}</text>`;});
    if(!vis.length)g+=`<text class="zl inv" x="${W/2}" y="${m.t+ih/2}" text-anchor="middle">nessun pianeta sopra l'orizzonte</text>`;
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Posizione di Luna e pianeti nel cielo">${g}</svg>`;
    $("sky-when").textContent=`${gg(t,{weekday:"long",day:"numeric",month:"long"})}, ore ${ora(t)} · altezza sull'orizzonte e direzione`;
    const svg=el.querySelector("svg"),tip=tipIn(el);
    svg.addEventListener("pointermove",e=>{const rb=svg.getBoundingClientRect(),px=e.clientX-rb.left,py=e.clientY-rb.top;let b=null,bd=24*24;
      vis.forEach(o=>{const d=(X(o.az)-px)**2+(Yh(o.h)-py)**2;if(d<bd){bd=d;b=o;}});if(!b){tip.style.opacity=0;return;}
      tip.innerHTML=`<b>${b.nome}</b><br>altezza <b>${deg(b.h)}</b> · direzione <b>${A.direzione((b.az-180)*rad)}</b> <span class="m">(${deg(b.az)})</span>`+(b.luna?`<br><span class="m">illuminata al ${Math.round(il.fraction*100)}%</span>`:"");place(el,tip,X(b.az),Yh(b.h));});
    svg.addEventListener("pointerleave",()=>{tip.style.opacity=0;});
  }

  /* ---------- eventi ---------- */
  function eventi(){
    const t0=midOf(Y,M,D),E=A.eventi(t0,9);
    $("e-src").textContent=isOggi()?"da oggi":"dal "+gg(t0,{day:"numeric",month:"long",year:"numeric"});
    $("evs").innerHTML=E.map(e=>{
      const gi=Math.round((A.mezzanotte(e.data)-t0)/DAY),quando=gi===0?"oggi":gi===1?"domani":`tra ${gi} giorni`;
      let extra="";
      if(e.tipo==="sciame"){const notte=new Date(A.mezzanotte(e.data).valueOf()+(24+3)*36e5),f=A.moonIllumination(notte).fraction,lh=A.moonPosition(notte).altitude/rad;
        extra=lh<0||f<0.25?"🌑 Luna non di disturbo: buone condizioni":f<0.6?`🌓 Luna al ${Math.round(f*100)}%: disturbo moderato`:`🌕 Luna al ${Math.round(f*100)}%: disturba l'osservazione`;}
      const dt=gg(e.data,{weekday:"short",day:"numeric",month:"short",year:"numeric"})+(e.ora?" · "+ora(e.data):"")+(e.notte?" · notte":"");
      return `<div class="card ev"><div class="ic">${e.ic}</div><div><div class="d">${dt}</div><h3>${e.nome}</h3><p>${e.nota}</p><div class="fra">${quando}${extra?" · "+extra:""}</div></div></div>`;}).join("");
  }

  function disegna(){sole();luna();pianeti();eventi();}

  dataInit();
  $("cal").addEventListener("click",e=>{const b=e.target.closest("button[data-d]");if(b)imposta(Y,M,+b.dataset.d);});
  $("sky-t").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;$("sky-t").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));skyT=b.dataset.t;pianeti();});
  let rt;addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(disegna,150);});
  let ini=oggi();try{const q=new URLSearchParams(location.search).get("d");if(q&&/^\d{4}-\d{2}-\d{2}$/.test(q))ini=q.split("-").map(Number);}catch(e){}
  imposta(...ini,true);
  setInterval(()=>{if(isOggi()){sole();}},5*6e4);
})();
