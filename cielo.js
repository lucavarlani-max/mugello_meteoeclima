/* Box "Cielo di stasera" della home: Sole, Luna, pianeti ed eventi calcolati
   in locale con astro.js, in ora italiana. */
(function(){
  if(!window.Astro)return;
  const A=window.Astro,set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  const durata=m=>Math.floor(m/60)+"h "+String(Math.round(m%60)).padStart(2,"0")+"m";
  function aggiorna(){
    const now=new Date(),[y,m,d]=A.partiRoma(now),noon=A.mezzogiorno(y,m,d),s=A.sunTimes(noon);
    set("sun-rise",A.ora(s.alba));set("sun-set",A.ora(s.tramonto));
    const len=(s.tramonto-s.alba)/6e4,ieri=A.sunTimes(new Date(noon-864e5)),dif=Math.round(len-(ieri.tramonto-ieri.alba)/6e4);
    set("sun-len",durata(len));set("sun-diff",(dif>0?"+":dif<0?"−":"±")+Math.abs(dif)+" min rispetto a ieri");
    // Luna
    const il=A.moonIllumination(now),[nome,ic]=A.nomeFase(il.phase),mt=A.moonTimes(noon);
    set("moon-ic",ic);set("moon-fase",nome+" "+Math.round(il.fraction*100)+"%");
    set("moon-rise",mt.sorge?A.ora(mt.sorge):mt.sempreSu?"sempre su":"non sorge");
    set("moon-set",mt.tramonta?"tramonta alle "+A.ora(mt.tramonta):"non tramonta oggi");
    const nx=A.prossimeFasi(now,1)[0];
    if(nx){set("moon-next-n",nx.nome);set("moon-next",A.giorno(nx.data,{day:"numeric",month:"short"})+" "+A.ora(nx.data));}
    // pianeti visibili alle 22 (sopra 10° di altezza)
    set("sky-buio",s.astroFine?A.ora(s.astroFine):"—");
    const t22=new Date(A.mezzanotte(now).valueOf()+22*36e5);
    const vis=A.PIANETI.map(p=>Object.assign({nome:p},A.planetPosition(p,t22))).filter(p=>p.altitude/A.rad>10);
    set("sky-pl",vis.length?vis.map(p=>p.nome).join(", "):"nessuno");
    set("sky-pl-dir",vis.length?vis.map(p=>p.nome+" a "+A.direzione(p.azimuth)).join(" · "):"sopra i 10° di altezza");
    const ev=A.eventi(now,1)[0];
    if(ev){set("sky-ev-n",ev.nome);set("sky-ev-d",ev.nota.split(" · ")[0]);set("sky-ev",A.giorno(ev.data,{day:"numeric",month:"short"})+(ev.ora?" "+A.ora(ev.data):""));}
  }
  aggiorna();setInterval(aggiorna,10*6e4);
})();
