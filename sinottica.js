/* Carte sinottiche della pagina Radar e dati.
   Disegna su canvas i campi di data/sinottica.json sulla base di data/sinottica-mappa.json
   (proiezione conica conforme di Lambert, griglia 2,5°): riempimento a bande colorate,
   isolinee calcolate con marching squares, centri di alta (A) e bassa (B) pressione.
   Uso: Sinottica.mount(elementoContenitore) */
(function(){
  const CARTE={
    z500:{nome:"Geopotenziale 500 hPa e pressione al suolo",corto:"500 hPa",fill:"z500",fillStep:4,fillMid:552,fillSpan:36,unit:"dam",
      lines:"mslp",lineStep:5,lineUnit:"hPa",centri:true,
      nota:"Colori: altezza della superficie di 500 hPa (circa 5.500 m), blu nelle saccature fredde, arancio-rosso nei promontori caldi. Linee: isobare al suolo ogni 5 hPa, A = alta pressione, B = bassa pressione."},
    t850:{nome:"Temperatura a 850 hPa e geopotenziale 500 hPa",corto:"850 hPa",fill:"t850",fillStep:2,fillMid:0,fillSpan:24,unit:"°C",
      lines:"z500",lineStep:6,lineUnit:"dam",zero:true,
      nota:"Colori: temperatura a circa 1.500 m di quota, la linea più spessa è lo zero termico a 850 hPa. Linee: geopotenziale a 500 hPa ogni 6 dam, che mostra le correnti in quota."},
    mslp:{nome:"Pressione al suolo",corto:"Suolo",fill:null,lines:"mslp",lineStep:4,lineUnit:"hPa",centri:true,
      nota:"Isobare al livello del mare ogni 4 hPa: più sono fitte, più vento. A = alta pressione (anticiclone), B = bassa pressione (depressione)."},
  };
  const GIORNI=["dom","lun","mar","mer","gio","ven","sab"], MESI=["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const fmt=(v,d=0)=>v==null?"—":v.toFixed(d).replace(".",",").replace("-","−");
  const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function palette(forza){
    const dark=forza!=="chiaro"&&matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches&&document.documentElement.dataset.theme!=="light"||document.documentElement.dataset.theme==="dark";
    return dark
      ? {dark:true,stops:["#1b3566","#2f63a8","#6f9fd4","#2c3833","#d9975c","#c8552c","#8a2a17"],coast:"#e8efe9",border:"rgba(232,239,233,.35)",grid:"rgba(232,239,233,.12)",line:"#f4f7f4",halo:"#0e1613",land:"#26332c",sea:"#16211c"}
      : {stops:["#1d3f7a","#2f6fb8","#8fb6e0","#f4f1ea","#eaa36a","#c8552c","#8a2a17"],coast:"#1b2a22",border:"rgba(27,42,34,.35)",grid:"rgba(27,42,34,.10)",line:"#15251d",halo:"#ffffff",land:"#e7ece4",sea:"#f7f9f6"};
  }
  function hex(c){c=c.replace("#","");return [0,2,4].map(i=>parseInt(c.slice(i,i+2),16));}
  function colore(t,P){ // t in [-1,1]
    const s=P.stops.map(hex), x=(Math.max(-1,Math.min(1,t))+1)/2*(s.length-1), i=Math.min(s.length-2,Math.floor(x)), f=x-i;
    return "rgb("+s[i].map((v,k)=>Math.round(v+(s[i+1][k]-v)*f)).join(",")+")";
  }

  function mount(root){
    root.innerHTML=`<div class="sn-bar">
        <div class="seg" role="group" aria-label="Tipo di carta">${Object.entries(CARTE).map(([k,c],i)=>`<button data-k="${k}" aria-pressed="${i===0}">${c.nome.split(" e ")[0].replace("Geopotenziale","Geopotenziale")}</button>`).join("")}</div>
      </div>
      <div class="sn-map"><canvas role="img" aria-label="Carta sinottica dell'Europa"></canvas><div class="sn-tip"></div><div class="sn-empty loading" hidden></div></div>
      <div class="sn-time">
        <button type="button" class="sn-play" aria-label="Avvia animazione"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2 L13 8 L4 14 Z" fill="currentColor"/></svg></button>
        <input type="range" min="0" max="0" value="0" step="1" aria-label="Scadenza della previsione">
        <span class="sn-when"></span>
      </div>
      <div class="sn-leg"></div>
      <p class="sn-nota"></p>`;
    const cv=root.querySelector("canvas"), tip=root.querySelector(".sn-tip"), rng=root.querySelector("input"), when=root.querySelector(".sn-when"), leg=root.querySelector(".sn-leg"), nota=root.querySelector(".sn-nota"), play=root.querySelector(".sn-play"), empty=root.querySelector(".sn-empty");
    let G=null, D=null, k="z500", step=0, timer=null, land=null, borders=null, NI=0, NJ=0;

    Promise.all([fetch("./data/sinottica-mappa.json").then(r=>r.json()),fetch("./data/sinottica.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null)]).then(([g,d])=>{
      G=g; D=d; NI=g.lats.length; NJ=g.lons.length; land=new Path2D(g.land); borders=new Path2D(g.borders);
      if(!D||!D.passi||!D.passi.length){empty.hidden=false;empty.textContent="Le carte saranno disponibili dopo il prossimo aggiornamento automatico dei dati.";return;}
      rng.max=D.passi.length-1; draw();
    }).catch(()=>{empty.hidden=false;empty.textContent="Carte non disponibili al momento.";});

    root.querySelector(".seg").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;root.querySelectorAll(".seg button").forEach(x=>x.setAttribute("aria-pressed",x===b));k=b.dataset.k;draw();});
    rng.addEventListener("input",()=>{step=+rng.value;draw();});
    play.addEventListener("click",()=>{if(timer){clearInterval(timer);timer=null;play.setAttribute("aria-label","Avvia animazione");play.classList.remove("on");return;}
      play.setAttribute("aria-label","Ferma animazione");play.classList.add("on");timer=setInterval(()=>{step=(step+1)%D.passi.length;rng.value=step;draw();},900);});
    let rt; addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(draw,150);});
    if(window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change",draw);

    const V=(arr,i,j)=>arr[i*NJ+j];
    function pos(fi,fj){ // coordinate mappa di un punto frazionario della griglia
      const i=Math.min(NI-2,Math.floor(fi)), j=Math.min(NJ-2,Math.floor(fj)), a=fi-i, b=fj-j, xy=G.xy;
      const p00=xy[i*NJ+j],p01=xy[i*NJ+j+1],p10=xy[(i+1)*NJ+j],p11=xy[(i+1)*NJ+j+1];
      return [(1-a)*((1-b)*p00[0]+b*p01[0])+a*((1-b)*p10[0]+b*p11[0]), (1-a)*((1-b)*p00[1]+b*p01[1])+a*((1-b)*p10[1]+b*p11[1])];
    }
    function val(arr,fi,fj){const i=Math.min(NI-2,Math.floor(fi)),j=Math.min(NJ-2,Math.floor(fj)),a=fi-i,b=fj-j;
      const v=[V(arr,i,j),V(arr,i,j+1),V(arr,i+1,j),V(arr,i+1,j+1)]; if(v.some(x=>x==null))return null;
      return (1-a)*((1-b)*v[0]+b*v[1])+a*((1-b)*v[2]+b*v[3]);}

    function contours(arr,level){ // marching squares: segmenti [[fi,fj],[fi,fj]]
      const segs=[];
      for(let i=0;i<NI-1;i++)for(let j=0;j<NJ-1;j++){
        const a=V(arr,i,j),b=V(arr,i,j+1),c=V(arr,i+1,j+1),d=V(arr,i+1,j); if(a==null||b==null||c==null||d==null)continue;
        const code=(a>=level?8:0)|(b>=level?4:0)|(c>=level?2:0)|(d>=level?1:0); if(code===0||code===15)continue;
        const t=(p,q)=>(level-p)/(q-p);
        const top=[i,j+t(a,b)], right=[i+t(b,c),j+1], bottom=[i+1,j+t(d,c)], left=[i+t(a,d),j];
        const L={1:[[left,bottom]],2:[[bottom,right]],3:[[left,right]],4:[[top,right]],5:[[left,top],[bottom,right]],6:[[top,bottom]],7:[[left,top]],
          8:[[left,top]],9:[[top,bottom]],10:[[left,bottom],[top,right]],11:[[top,right]],12:[[left,right]],13:[[bottom,right]],14:[[left,bottom]]}[code];
        L.forEach(s=>segs.push(s));
      }
      return segs;
    }
    function centri(arr){
      const out=[], R=3;
      for(let i=R;i<NI-R;i++)for(let j=R;j<NJ-R;j++){
        const v=V(arr,i,j); if(v==null)continue; let mx=true,mn=true;
        for(let di=-R;di<=R&&(mx||mn);di++)for(let dj=-R;dj<=R;dj++){if(!di&&!dj)continue;const w=V(arr,i+di,j+dj);if(w==null)continue;if(w>=v)mx=false;if(w<=v)mn=false;}
        if(mx&&v>=1015)out.push({i,j,v,t:"A"}); else if(mn&&v<=1010)out.push({i,j,v,t:"B"});
      }
      return out;
    }

    function draw(){
      if(!G||!D) return;
      const C=CARTE[k], P=palette(C.fill?"chiaro":null), S=D.passi[step], dpr=window.devicePixelRatio||1;
      const W=cv.clientWidth, H=Math.round(W*G.h/G.w); cv.style.height=H+"px"; cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
      const g=cv.getContext("2d"), s=W/G.w*dpr; g.setTransform(s,0,0,s,0,0);
      const u=G.w/W;   // unità della mappa per pixel dello schermo: testi e linee restano leggibili a ogni larghezza
      g.fillStyle=P.sea; g.fillRect(0,0,G.w,G.h);
      if(C.fill){
        const arr=S[C.fill], n=Math.max(4,Math.min(7,Math.round(W/170)));
        for(let i=0;i<NI-1;i++)for(let j=0;j<NJ-1;j++)for(let a=0;a<n;a++)for(let b=0;b<n;b++){
          const fi=i+(a+.5)/n, fj=j+(b+.5)/n, v=val(arr,fi,fj); if(v==null)continue;
          g.fillStyle=colore((v-C.fillMid)/C.fillSpan,P);
          const p1=pos(i+a/n,j+b/n),p2=pos(i+a/n,j+(b+1)/n),p3=pos(i+(a+1)/n,j+(b+1)/n),p4=pos(i+(a+1)/n,j+b/n);
          g.beginPath();g.moveTo(p1[0],p1[1]);g.lineTo(p2[0],p2[1]);g.lineTo(p3[0],p3[1]);g.lineTo(p4[0],p4[1]);g.closePath();g.fill();g.strokeStyle=g.fillStyle;g.lineWidth=.6;g.stroke();
        }
      } else { g.fillStyle=P.land; g.fill(land); }
      g.strokeStyle=P.grid; g.lineWidth=1*u; G.meridiani.concat(G.paralleli).forEach(m=>g.stroke(new Path2D(m.d)));
      g.strokeStyle=P.border; g.lineWidth=.7*u; g.stroke(borders);
      g.strokeStyle=P.coast; g.lineWidth=1.1*u; g.stroke(land);
      // isolinee
      const arr=S[C.lines], vals=arr.filter(v=>v!=null), lo=Math.ceil(Math.min(...vals)/C.lineStep)*C.lineStep, hi=Math.max(...vals);
      const labels=[];
      for(let L=lo;L<=hi;L+=C.lineStep){
        const segs=contours(arr,L); if(!segs.length)continue;
        g.strokeStyle=P.line; g.lineWidth=(C.lines==="mslp"?1.5:1.1)*u; g.globalAlpha=C.fill?.85:1;
        g.beginPath(); segs.forEach(([p,q])=>{const A=pos(p[0],p[1]),B=pos(q[0],q[1]);g.moveTo(A[0],A[1]);g.lineTo(B[0],B[1]);}); g.stroke(); g.globalAlpha=1;
        [[.3,.35],[.72,.6]].forEach(([fx,fy])=>{let best=null,bd=1e9;segs.forEach(([p,q])=>{const A=pos((p[0]+q[0])/2,(p[1]+q[1])/2);if(A[0]<30||A[0]>G.w-30||A[1]<20||A[1]>G.h-20)return;const d=(A[0]-fx*G.w)**2+((A[1]-fy*G.h)*0.3)**2;if(d<bd){bd=d;best=A;}});
          if(best&&!labels.some(l=>Math.hypot(l[0]-best[0],l[1]-best[1])<48))labels.push([best[0],best[1],String(L)]);});
      }
      if(C.zero){const segs=contours(S.t850,0);g.strokeStyle=P.line;g.lineWidth=2.8*u;g.beginPath();segs.forEach(([p,q])=>{const A=pos(p[0],p[1]),B=pos(q[0],q[1]);g.moveTo(A[0],A[1]);g.lineTo(B[0],B[1]);});g.stroke();}
      const cc=C.centri?centri(S.mslp).map(c=>({...c,xy:pos(c.i,c.j)})):[];
      g.font=`600 ${11*u}px 'IBM Plex Mono',monospace`; g.textAlign="center"; g.textBaseline="middle";
      labels.filter(([x,y])=>!cc.some(c=>Math.hypot(c.xy[0]-x,c.xy[1]-y)<42*u)).forEach(([x,y,t])=>{g.lineWidth=3*u;g.strokeStyle=P.halo;g.strokeText(t,x,y);g.fillStyle=P.line;g.fillText(t,x,y);});
      cc.forEach(c=>{const [x,y]=c.xy;if(x<12*u||x>G.w-12*u||y<14*u||y>G.h-14*u)return;const col=c.t==="A"?"#b3261e":(P.dark?"#8fb6e0":"#1d4f9c");
        g.font=`800 ${22*u}px 'Bricolage Grotesque',sans-serif`;g.lineWidth=4*u;g.strokeStyle=P.halo;g.strokeText(c.t,x,y-6*u);g.fillStyle=col;g.fillText(c.t,x,y-6*u);
        g.font=`600 ${10.5*u}px 'IBM Plex Mono',monospace`;g.lineWidth=3*u;g.strokeText(Math.round(c.v),x,y+11*u);g.fillStyle=P.line;g.fillText(Math.round(c.v),x,y+11*u);});
      // Mugello
      const [mx,my]=G.mugello; g.beginPath();g.arc(mx,my,4.5*u,0,7);g.fillStyle="#0f6b52";g.fill();g.lineWidth=2*u;g.strokeStyle=P.halo;g.stroke();
      g.font=`700 ${11.5*u}px 'IBM Plex Sans',sans-serif`;g.textAlign="left";g.lineWidth=3*u;g.strokeStyle=P.halo;g.strokeText("Mugello",mx+8*u,my);g.fillStyle=P.line;g.fillText("Mugello",mx+8*u,my);
      // tempo e legenda
      const t=new Date(S.t), h0=new Date(D.passi[0].t), ore=Math.round((t-h0)/36e5);
      when.innerHTML=`<b>${GIORNI[t.getDay()]} ${t.getDate()} ${MESI[t.getMonth()]} ore ${String(t.getHours()).padStart(2,"0")}</b> <span class="faint">${step===0?"ora":"+"+ore+" h"} · ${esc(D.modello)}</span>`;
      if(C.fill){const bands=[];for(let v=C.fillMid-C.fillSpan;v<=C.fillMid+C.fillSpan;v+=C.fillStep)bands.push(v);
        leg.innerHTML=`<span class="faint">${C.fill==="z500"?"Geopotenziale 500 hPa":"Temperatura 850 hPa"} (${C.unit})</span><span class="sn-scale"><span class="sn-bands" style="background:linear-gradient(90deg,${bands.map(v=>colore((v-C.fillMid)/C.fillSpan,P)).join(",")})"></span><span class="sn-ticks"><span>${fmt(bands[0])}</span><span>${fmt(C.fillMid)}</span><span>${fmt(bands[bands.length-1])}</span></span></span>`;}
      else leg.innerHTML=`<span class="faint">Isobare ogni ${C.lineStep} hPa · <b style="color:#b3261e">A</b> alta pressione · <b style="color:#1d4f9c">B</b> bassa pressione</span>`;
      nota.textContent=C.nota;
    }

    // valori sotto il puntatore
    cv.addEventListener("pointermove",e=>{
      if(!G||!D)return; const r=cv.getBoundingClientRect(), x=(e.clientX-r.left)/r.width*G.w, y=(e.clientY-r.top)/r.height*G.h;
      let bi=0,bd=1e9; G.xy.forEach((p,i)=>{const d=(p[0]-x)**2+(p[1]-y)**2;if(d<bd){bd=d;bi=i;}});
      const S=D.passi[step], la=G.lats[Math.floor(bi/NJ)], lo=G.lons[bi%NJ];
      tip.innerHTML=`<span class="faint mono">${fmt(Math.abs(la),1)}° ${la>=0?"N":"S"} · ${fmt(Math.abs(lo),1)}° ${lo>=0?"E":"O"}</span><br>500 hPa <b>${fmt(S.z500[bi])} dam</b><br>850 hPa <b>${fmt(S.t850[bi])} °C</b><br>Suolo <b>${fmt(S.mslp[bi])} hPa</b>`;
      tip.style.opacity=1; const px=e.clientX-r.left, py=e.clientY-r.top, tw=tip.offsetWidth;
      tip.style.left=(px+14+tw>r.width?px-tw-14:px+14)+"px"; tip.style.top=Math.max(0,py-tip.offsetHeight-10)+"px";
    });
    cv.addEventListener("pointerleave",()=>{tip.style.opacity=0;});
  }
  window.Sinottica={mount};
})();
