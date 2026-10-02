/* Pagina Mappe: carte di previsione ECMWF (OpenCharts). I link alle immagini sono in
   data/ecmwf.json, raccolti dall'Action con scripts/fetch_ecmwf.py; le immagini restano
   su charts.ecmwf.int (© ECMWF, CC BY 4.0). */
(function(){
  const $=id=>document.getElementById(id);
  if(!$("ecmwf")) return;
  const MM=["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  const roma=d=>{const p={};new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",weekday:"short",day:"numeric",month:"numeric",hour:"2-digit",hourCycle:"h23"})
    .formatToParts(d).forEach(x=>p[x.type]=x.value);return p;};
  const quando=d=>{const p=roma(d);return `${p.weekday} ${p.day} ${MM[+p.month-1]}, ore ${p.hour}`;};
  let D=null, prod=null, passi=[], i=0, timer=null;
  const base=()=>new Date(D.corrente.base);

  fetch("./data/ecmwf.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw 0;return r.json();}).then(d=>{
    D=d; const P=(D.corrente||{}).prodotti||{};
    const lista=Object.keys(D.nomi||{}).filter(p=>P[p]&&Object.values(P[p]).some(Boolean));
    if(!lista.length) throw 0;
    const sel=$("ec-prod");
    sel.innerHTML=lista.map(p=>`<option value="${p}">${D.nomi[p]}</option>`).join("");
    const q=new URLSearchParams(location.search).get("carta"); prod=lista.includes(q)?q:lista[0]; sel.value=prod;
    sel.addEventListener("change",()=>{const v=passi[i]; prod=sel.value; carica(v);});
    const b=base(); $("ec-run").textContent=`Corsa del modello: ${quando(b)} (${String(b.getUTCHours()).padStart(2,"0")} UTC)`;
    carica(0);
  }).catch(()=>{$("ec-img").innerHTML='<div class="msg">Le carte ECMWF non sono ancora disponibili: arrivano con il prossimo aggiornamento automatico.</div>';});

  function carica(passo){
    const P=D.corrente.prodotti[prod];
    passi=Object.keys(P).filter(k=>P[k]).map(Number).sort((a,b)=>a-b);
    // stessa ora di prima, se c'è, altrimenti la più vicina
    i=passi.reduce((best,k,j)=>Math.abs(k-passo)<Math.abs(passi[best]-passo)?j:best,0);
    const r=$("ec-range"); r.max=passi.length-1;
    $("ec-steps").innerHTML=passi.map((k,j)=>`<button data-j="${j}">+${k}h</button>`).join("");
    $("ec-steps").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{ferma();vai(+b.dataset.j);}));
    $("ec-link").href=`https://charts.ecmwf.int/products/${prod}`;
    vai(i);
  }

  function vai(j){
    i=(j+passi.length)%passi.length;
    const k=passi[i], url=D.corrente.prodotti[prod][String(k)], v=new Date(base().getTime()+k*3600e3);
    $("ec-range").value=i;
    $("ec-when").innerHTML=`<b>${quando(v)}</b> · +${k} ore`;
    $("ec-steps").querySelectorAll("button").forEach((b,j2)=>b.classList.toggle("on",j2===i));
    const box=$("ec-img"); let img=box.querySelector("img");
    if(!img){box.innerHTML="";img=new Image();img.decoding="async";box.appendChild(img);
      img.onerror=()=>{box.innerHTML='<div class="msg">Immagine non disponibile in questo momento. <a href="'+$("ec-link").href+'" target="_blank" rel="noopener">Apri la carta sul sito ECMWF</a>.</div>';};}
    img.alt=`${D.nomi[prod]}, previsione ECMWF per ${quando(v)}`;
    img.src=url;
    // precarica le due successive per l'animazione
    [1,2].forEach(n=>{const u=D.corrente.prodotti[prod][String(passi[(i+n)%passi.length])]; if(u){const p=new Image();p.src=u;}});
  }

  function ferma(){ if(timer){clearInterval(timer);timer=null;} $("ec-play").textContent="▶"; $("ec-play").classList.remove("on"); }
  $("ec-play").addEventListener("click",()=>{ if(timer) return ferma();
    $("ec-play").textContent="❚❚"; $("ec-play").classList.add("on"); timer=setInterval(()=>vai(i+1),1100); });
  $("ec-prev").addEventListener("click",()=>{ferma();vai(i-1);});
  $("ec-next").addEventListener("click",()=>{ferma();vai(i+1);});
  $("ec-range").addEventListener("input",e=>{ferma();vai(+e.target.value);});
  $("ecmwf").addEventListener("keydown",e=>{ if(e.target.tagName==="SELECT"||e.target.tagName==="INPUT") return;
    if(e.key==="ArrowRight"){ferma();vai(i+1);e.preventDefault();} if(e.key==="ArrowLeft"){ferma();vai(i-1);e.preventDefault();} });
})();
