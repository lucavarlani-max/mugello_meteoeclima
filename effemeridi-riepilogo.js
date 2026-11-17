/* Riepilogo "Stasera in breve" condiviso tra la pagina e il generatore statico.
   Riceve l'oggetto Astro (astro.js) e restituisce dati e HTML; non fa calcoli propri. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  else root.EffemeridiRiepilogo=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const rad=Math.PI/180;
  const pad=n=>String(n).padStart(2,"0");
  const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const deg=v=>Math.round(v)+"°";

  function sintesi(A,noon,luogo){
    luogo=luogo||A.LUOGO;
    const s=A.sunTimes(noon,luogo.lat,luogo.lon);
    const sera=new Date(s.tramonto.valueOf()+36e5); // un'ora dopo il tramonto
    const il=A.moonIllumination(sera);
    const [fase]=A.nomeFase(il.phase);
    const mt=A.moonTimes(noon,luogo.lat,luogo.lon);
    const mp=A.moonPosition(sera,luogo.lat,luogo.lon);
    const altLuna=mp.altitude/rad;
    let testoLuna;
    if(altLuna>0) testoLuna=`in cielo a ${deg(altLuna)} verso ${A.direzione(mp.azimuth)}`;
    else if(mt.sorge&&sera<mt.sorge) testoLuna=`sorge alle ${A.ora(mt.sorge)}`;
    else if(mt.tramonta&&sera>=mt.tramonta) testoLuna=`tramonta alle ${A.ora(mt.tramonta)}`;
    else testoLuna="sotto l'orizzonte";
    const pianeti=A.PIANETI.map(nome=>{
      const p=A.planetPosition(nome,sera,luogo.lat,luogo.lon);
      return {nome,altezza:p.altitude/rad,az:p.azimuth,elongazione:p.elongazione};
    }).filter(p=>p.altezza>0).sort((a,b)=>b.altezza-a.altezza);
    const [y,m,d]=A.partiRoma(noon);
    return {data:noon,y,m,d,luogo:{nome:luogo.nome||A.LUOGO.nome,lat:luogo.lat,lon:luogo.lon},alba:s.alba,tramonto:s.tramonto,buio:s.civileFine,sera,
      luna:{nome:fase,frazione:il.fraction,altezza:altLuna,az:mp.azimuth,sorge:mt.sorge,tramonta:mt.tramonta,testo:testoLuna},pianeti};
  }

  function nomiPianeti(s){
    if(!s.pianeti.length)return "Nessuno";
    const base=s.pianeti.slice(0,3).map(p=>p.nome).join(", "),extra=s.pianeti.length-3;
    return base+(extra===1?" e un altro":extra>1?` e altri ${extra}`:"");
  }

  function testoPianeti(A,s){
    if(!s.pianeti.length)return "Nessun pianeta sopra l'orizzonte";
    return s.pianeti.slice(0,3).map(p=>`${p.nome} a ${deg(p.altezza)} verso ${A.direzione(p.az)}`).join(" · ");
  }

  function titoloPer(A,s){
    const [y,m,d]=A.partiRoma(new Date());
    return y===s.y&&m===s.m&&d===s.d?"Stasera in breve":`La sera del ${A.giorno(s.data,{day:"numeric",month:"long"})} in breve`;
  }

  function contenuto(A,s,opts){
    opts=opts||{};
    const titolo=opts.titolo||titoloPer(A,s);
    const iso=`${s.y}-${pad(s.m)}-${pad(s.d)}`;
    const dataLunga=A.giorno(s.data,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    const buio=s.buio?`crepuscolo civile fino alle ${A.ora(s.buio)}`:"crepuscolo non calcolabile";
    const lunaBig=`${s.luna.nome} · ${Math.round(s.luna.frazione*100)}%`;
    return `<div class="eff-oggi-head"><h2 id="eff-oggi-title">${esc(titolo)}</h2><span class="eff-oggi-date"><time datetime="${iso}">${esc(dataLunga)}</time></span></div>
      <div class="eff-oggi-grid">
        <div class="eff-oggi-item"><span class="lab">Tramonto</span><b>${esc(A.ora(s.tramonto))}</b><span>${esc(buio)}</span></div>
        <div class="eff-oggi-item"><span class="lab">Luna</span><b>${esc(lunaBig)}</b><span>${esc(s.luna.testo)}</span></div>
        <div class="eff-oggi-item"><span class="lab">Pianeti visibili</span><b>${esc(nomiPianeti(s))}</b><span>${esc(testoPianeti(A,s))}</span></div>
      </div>
      <p class="eff-oggi-nota">Un'ora dopo il tramonto, per ${esc(s.luogo.nome)}, in ora italiana. <a href="#pianeti">Tabella completa dei pianeti</a>.</p>`;
  }

  function sezione(A,s,opts){
    const iso=`${s.y}-${pad(s.m)}-${pad(s.d)}`;
    return `<section class="card eff-oggi" id="eff-oggi" aria-labelledby="eff-oggi-title" data-aggiornato="${iso}"><div id="eff-oggi-contenuto">${contenuto(A,s,opts)}</div></section>`;
  }

  return {sintesi,contenuto,sezione,titoloPer};
});
