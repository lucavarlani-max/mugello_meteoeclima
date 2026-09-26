/* Pagina "Curiosità e notizie": numeri di Terra & Cielo da data/notizie.json, foto da data/notizie-foto.json. */
(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const CAT={
    clima:{c:"var(--amber)",ic:"🌡️"}, oceani:{c:"var(--sky)",ic:"🌊"}, vulcani:{c:"var(--warm)",ic:"🌋"},
    terremoti:{c:"#8b6a3e",ic:"📈"}, uragani:{c:"var(--indigo)",ic:"🌀"}, ghiacci:{c:"var(--cold)",ic:"🧊"},
    ozono:{c:"var(--indigo)",ic:"🛰️"}, cielo:{c:"var(--indigo)",ic:"🌅"}, temporali:{c:"var(--indigo)",ic:"⚡"}, mugello:{c:"var(--pine)",ic:"🌳"}
  };
  const RUB={
    mugello:{nome:"Focus Mugello",ic:"🏞️",c:"var(--pine)"},
    storia:{nome:"Accadde oggi",ic:"📜",c:"var(--sky)"},
    curiosita:{nome:"Numero e curiosità",ic:"💡",c:"var(--amber)"},
    almanacco:{nome:"Almanacco del cielo",ic:"🌙",c:"var(--indigo)"},
    parole:{nome:"Parole della scienza",ic:"📖",c:"var(--ink-soft)"}
  };
  let N=[], F={foto:{},categorie:{}}, filtro="", testo="";

  Promise.all([fetch("./data/notizie.json").then(r=>r.json()),fetch("./data/notizie-foto.json").then(r=>r.json()).catch(()=>F)])
    .then(([n,f])=>{N=[...n.numeri].sort((a,b)=>b.data.localeCompare(a.data));F=f;oggi();chips();archivio();apriDaHash();})
    .catch(()=>{$("meta").textContent="Notizie non disponibili al momento.";});
  addEventListener("hashchange",apriDaHash);

  const dt=iso=>{const [y,m,d]=iso.split("-").map(Number);return new Date(y,m-1,d);};
  const dLunga=iso=>dt(iso).toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const dBreve=iso=>dt(iso).toLocaleDateString("it-IT",{day:"numeric",month:"long"});
  const nomeCat=k=>(F.categorie[k]&&F.categorie[k].nome)||k;
  const col=k=>(CAT[k]||CAT.clima).c;
  const hash=s=>{let h=0;for(const ch of s)h=(h*31+ch.charCodeAt(0))|0;return Math.abs(h);};

  /* sceglie una foto per ogni articolo, senza ripetere la stessa nello stesso numero */
  function assegna(arts){
    const usate=new Set();
    arts.forEach(a=>{
      let id=a.foto&&F.foto[a.foto]?a.foto:null;
      if(!id){const L=((F.categorie[a.cat]||{}).foto||[]).filter(x=>F.foto[x]);
        if(L.length){const i0=hash(a.titolo)%L.length;id=L.map((_,k)=>L[(i0+k)%L.length]).find(x=>!usate.has(x))||L[i0];}}
      a._f=id; if(id)usate.add(id);
    });
    return arts;
  }
  function foto(a,w,cls){
    const f=a._f&&F.foto[a._f], c=CAT[a.cat]||CAT.clima;
    const fb=`<div class="fb" style="background:linear-gradient(135deg,color-mix(in srgb,${c.c} 30%,var(--panel)),color-mix(in srgb,${c.c} 70%,var(--ink)))" aria-hidden="true">${c.ic}</div>`;
    if(!f)return `<figure class="ph ko ${cls||""}">${fb}</figure>`;
    const src="https://commons.wikimedia.org/wiki/Special:FilePath/"+encodeURIComponent(f.file)+"?width="+w;
    return `<figure class="ph ${cls||""}"><img src="${src}" alt="${esc(f.desc)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('ko')">${fb}`+
      `<figcaption>${esc(f.desc)} · <a href="${esc(f.pagina)}" target="_blank" rel="noopener">${esc(f.autore)}, ${esc(f.licenza)}</a></figcaption></figure>`;
  }
  const fonte=a=>a.url?`<div class="src-l">Fonte: <a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.fonte||"link")} ↗</a></div>`:"";
  const chip=(a,extra)=>`<span class="chip" style="--c:${col(a.cat)}">${esc(a.tag||nomeCat(a.cat))}${extra?` <span class="ap">· ${extra}</span>`:""}</span>`;

  function storie(n){
    return `<div class="grid">`+n.storie.map(a=>`<article class="st">${foto(a,640)}<div class="bd">${chip(a)}<h3><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.titolo)}</a></h3><p>${esc(a.testo)}</p>${fonte(a)}</div></article>`).join("")+`</div>`;
  }
  function rubriche(n,oggi){
    return `<div class="rub">`+(n.rubriche||[]).map(r=>{const m=RUB[r.tipo]||{nome:r.tipo,ic:"•",c:"var(--ink-soft)"};
      const nome=r.tipo==="storia"?(oggi?"Accadde oggi":"Accadde un "+dBreve(n.data)):m.nome;
      return `<div class="rb" style="--c:${m.c}"><div class="hd"><span class="ic" aria-hidden="true">${m.ic}</span>${esc(nome)}</div><p>${esc(r.testo)}</p>${r.url?fonte(r):""}</div>`;}).join("")+`</div>`;
  }
  function numero(n){
    if(!n.numero)return "";
    return `<div class="ndg"><div class="v">${esc(n.numero.valore)}</div><div><div class="l">Il numero del giorno</div><p>${esc(n.numero.testo)}</p></div></div>`;
  }

  function oggi(){
    const n=N[0]; assegna([n.apertura,...n.storie]); const a=n.apertura;
    $("meta").innerHTML=`Ultimo numero: <b>${esc(dLunga(n.data))}</b> · ${n.storie.length+1} notizie · ${N.length} numeri in archivio`;
    $("oggi").innerHTML=
      `<div class="lead-art">${foto(a,1200)}<div>${chip(a,"in apertura")}<h2><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.titolo)}</a></h2><p>${esc(a.testo)}</p>${fonte(a)}${numero(n)}</div></div>`+
      `<div class="sh" style="margin-top:34px"><h2>Le notizie del giorno</h2><span class="src">${esc(dLunga(n.data))}</span></div>${storie(n)}`+
      `<div class="sh" style="margin-top:34px"><h2>Le rubriche</h2></div>${rubriche(n,true)}`;
  }

  /* ---------- archivio ---------- */
  function tutte(){return N.flatMap(n=>[{...n.apertura,_n:n,_ap:1},...n.storie.map(s=>({...s,_n:n}))]);}
  function chips(){
    const cnt={};tutte().forEach(a=>{cnt[a.cat]=(cnt[a.cat]||0)+1;});
    const keys=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]);
    $("chips").innerHTML=`<button type="button" data-k="" aria-pressed="true">Tutte</button>`+keys.map(k=>`<button type="button" data-k="${k}" aria-pressed="false">${esc(nomeCat(k))}<s>${cnt[k]}</s></button>`).join("");
    $("chips").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;filtro=b.dataset.k;
      $("chips").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));archivio();});
    let t;$("q").addEventListener("input",e=>{clearTimeout(t);t=setTimeout(()=>{testo=e.target.value.trim().toLowerCase();archivio();},150);});
  }
  function archivio(){
    const el=$("ar-list");
    if(filtro||testo){
      N.forEach(n=>assegna([n.apertura,...n.storie]));
      const R=tutte().filter(a=>(!filtro||a.cat===filtro)&&(!testo||(a.titolo+" "+a.testo+" "+(a.fonte||"")).toLowerCase().includes(testo)));
      $("ar-cnt").textContent=`${R.length} notizie trovate in tutti i numeri`;
      el.innerHTML=R.length?`<div class="flat">`+R.map(a=>{return `<article class="fl">${foto(a,300)}<div>${chip(a,dBreve(a._n.data))}<h4><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.titolo)}</a></h4><p>${esc(a.testo)}</p>${fonte(a)}</div></article>`;}).join("")+`</div>`
        :`<div class="empty">Nessuna notizia trovata. Prova con un'altra parola.</div>`;
      return;
    }
    const V=N.slice(1);
    $("ar-cnt").textContent=V.length?`${V.length} numeri precedenti`:"";
    if(!V.length){el.innerHTML=`<div class="empty">L'archivio si riempirà con i prossimi numeri.</div>`;return;}
    let mese="",h="";
    V.forEach(n=>{
      const m=dt(n.data).toLocaleDateString("it-IT",{month:"long",year:"numeric"});
      if(m!==mese){h+=`<div class="mese">${esc(m)}</div>`;mese=m;}
      assegna([n.apertura,...n.storie]);
      const d=dt(n.data), a=n.apertura;
      h+=`<article class="ar" id="n-${n.data}"><div class="ar-row">
        <div class="ar-d"><b>${d.getDate()}</b><span>${d.toLocaleDateString("it-IT",{weekday:"short"})}</span></div>
        ${foto(a,400)}
        <div>${chip(a,"in apertura")}<div class="ar-lead"><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.titolo)}</a></div>
          <ul class="ar-t">${n.storie.slice(0,4).map(s=>`<li style="--c:${col(s.cat)}">${esc(s.titolo)}</li>`).join("")}${n.storie.length>4?`<li style="--c:var(--ctx)">e altre ${n.storie.length-4}</li>`:""}</ul></div>
        <button type="button" class="ar-btn" aria-expanded="false" aria-controls="m-${n.data}">Apri il numero</button>
      </div><div class="ar-more" id="m-${n.data}" hidden></div></article>`;
    });
    el.innerHTML=h;
    el.querySelectorAll(".ar-btn").forEach(b=>b.addEventListener("click",()=>apri(b.closest(".ar").id.slice(2),b.getAttribute("aria-expanded")!=="true")));
  }
  function apri(data,on,scroll){
    const n=N.find(x=>x.data===data), box=$("m-"+data), b=box&&box.parentNode.querySelector(".ar-btn"); if(!n||!box)return;
    if(on&&!box.innerHTML){assegna([n.apertura,...n.storie]);box.innerHTML=`<p style="margin:0 0 12px;color:var(--ink-soft)">${esc(n.apertura.testo)} ${fonte(n.apertura).replace("div","span").replace("</div>","</span>")}</p>`+numero(n)+storie(n)+rubriche(n,false);}
    box.hidden=!on; b.setAttribute("aria-expanded",on); b.textContent=on?"Chiudi":"Apri il numero";
    if(on&&scroll)box.parentNode.scrollIntoView({behavior:"smooth",block:"start"});
  }
  function apriDaHash(){const m=location.hash.match(/^#n-(\d{4}-\d\d-\d\d)$/);if(m)apri(m[1],true,true);}
})();
