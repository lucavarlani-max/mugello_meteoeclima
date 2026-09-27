/* Pagina "Webcam Panomax": elenco e mappa delle webcam da data/panomax.json
   (riga = [nome, paese, bandiera, lat, lon, id, nave]); l'id apre https://<id>.panomax.com */
(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const MUG=[43.99,11.39], PASSO=300;
  let C=[], st={q:"",cty:"",typ:"all",ord:"km"}, shown=PASSO, map=null, cluster=null, markers={}, sel=null;
  const url=id=>"https://"+id+".panomax.com";
  const rad=x=>x*Math.PI/180;
  const km=(la,lo)=>{const a=Math.sin(rad(la-MUG[0])/2)**2+Math.cos(rad(MUG[0]))*Math.cos(rad(la))*Math.sin(rad(lo-MUG[1])/2)**2;return 2*6371*Math.asin(Math.sqrt(a));};
  const fkm=k=>Math.round(k).toLocaleString("it-IT")+" km";

  fetch("./data/panomax.json").then(r=>r.json()).then(d=>{
    C=d.webcam.map(c=>({nome:c[0],paese:c[1],flag:c[2],lat:c[3],lon:c[4],id:c[5],nave:!!c[6],km:km(c[3],c[4])}));
    tiles(); filtri(); mappa(); render(); fit();
  }).catch(()=>{$("tiles").innerHTML='<div class="loading">Elenco delle webcam non disponibile.</div>';});

  function tiles(){
    const paesi=new Set(C.map(c=>c.paese)), it=C.filter(c=>c.paese==="Italia").length, fisse=C.filter(c=>!c.nave), v=[...fisse].sort((a,b)=>a.km-b.km)[0];
    const t=(l,b,w)=>`<div class="tile"><div class="lab">${l}</div><div class="big">${b}</div><div class="who">${w}</div></div>`;
    $("tiles").innerHTML=t("Webcam",C.length.toLocaleString("it-IT"),`${C.filter(c=>c.nave).length} a bordo di navi`)+t("Paesi",paesi.size,"soprattutto Austria, Italia e Germania")+
      t("In Italia",it,"dalle Dolomiti alle coste")+t("La più vicina",fkm(v.km),esc(v.nome));
  }
  function filtri(){
    const n={}; C.forEach(c=>n[c.paese]=(n[c.paese]||0)+1);
    $("cty").innerHTML=`<option value="">Tutti i paesi (${C.length})</option>`+Object.keys(n).sort((a,b)=>a.localeCompare(b,"it")).map(p=>`<option value="${esc(p)}">${esc(p)} (${n[p]})</option>`).join("");
    let t; $("q").addEventListener("input",e=>{clearTimeout(t);t=setTimeout(()=>{st.q=e.target.value.trim().toLowerCase();shown=PASSO;render();},150);});
    $("cty").addEventListener("change",e=>{st.cty=e.target.value;shown=PASSO;render();fit();});
    seg("typ","t",v=>{st.typ=v;shown=PASSO;render();fit();});
    seg("ord","o",v=>{st.ord=v;shown=PASSO;render();});
    $("reset").addEventListener("click",()=>{st={q:"",cty:"",typ:"all",ord:"km"};$("q").value="";$("cty").value="";
      ["typ","ord"].forEach(id=>$(id).querySelectorAll("button").forEach((b,i)=>b.setAttribute("aria-pressed",i===0)));shown=PASSO;render();fit();});
    $("list").addEventListener("click",e=>{if(e.target.closest("a"))return;const m=e.target.closest(".more");if(m){shown+=PASSO;render(false);return;}
      const r=e.target.closest(".row");if(r)scegli(+r.dataset.id,true);});
  }
  function seg(id,k,cb){$(id).addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;$(id).querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));cb(b.dataset[k]);});}
  const ok=c=>(!st.cty||c.paese===st.cty)&&(st.typ==="all"||(st.typ==="ship")===c.nave)&&(!st.q||(c.nome+" "+c.paese).toLowerCase().includes(st.q));
  function vis(){const v=C.filter(ok);return st.ord==="km"?v.sort((a,b)=>(a.nave-b.nave)||(a.km-b.km)):v.sort((a,b)=>a.nome.localeCompare(b.nome,"it"));}  // le navi si spostano: in fondo

  function mappa(){
    if(!window.L){$("map").innerHTML='<div class="empty">Mappa non disponibile.</div>';return;}
    map=L.map("map",{zoomControl:true,scrollWheelZoom:true}).setView([46,11],5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap"}).addTo(map);
    cluster=L.markerClusterGroup?L.markerClusterGroup({maxClusterRadius:45,spiderfyOnMaxZoom:true}):L.layerGroup();
    map.addLayer(cluster);
    L.marker(MUG,{icon:L.divIcon({className:"",html:'<div class="me"></div>',iconSize:[14,14]}),title:"Mugello",zIndexOffset:1000}).addTo(map).bindTooltip("Mugello");
  }
  let ICO=null;
  function render(full=true){
    if(!ICO&&window.L) ICO={fissa:L.divIcon({className:"pm",html:'<i></i>',iconSize:[14,14]}),nave:L.divIcon({className:"pm nave",html:'<i></i>',iconSize:[14,14]})};
    const v=vis();
    $("cnt").textContent=`${v.length.toLocaleString("it-IT")} webcam${v.length!==C.length?" su "+C.length.toLocaleString("it-IT"):""}`;
    $("list").innerHTML=v.length?v.slice(0,shown).map(c=>`<div class="row${c.id===sel?" sel":""}" data-id="${c.id}">
        <div class="nm">${esc(c.nome)}</div>
        <div class="meta"><span>${c.flag} ${esc(c.paese)}</span>${c.nave?'<span class="tag ship">⚓ nave</span>':`<span class="km">${fkm(c.km)} dal Mugello</span>`}</div>
        <a class="live" href="${url(c.id)}" target="_blank" rel="noopener">Apri ↗</a></div>`).join("")+(v.length>shown?`<div class="more"><button type="button" class="reset">Mostra altre ${Math.min(PASSO,v.length-shown)}</button></div>`:"")
      :'<div class="empty">Nessuna webcam trovata. Prova con un altro nome o paese.</div>';
    if(!full||!cluster) return;
    cluster.clearLayers(); markers={};
    v.forEach(c=>{const m=L.marker([c.lat,c.lon],{title:c.nome,icon:c.nave?ICO.nave:ICO.fissa});
      m.bindPopup(`<div class="pop"><b>${esc(c.nome)}</b><br><span class="c">${c.flag} ${esc(c.paese)}${c.nave?" · ⚓ nave, posizione indicativa":" · "+fkm(c.km)+" dal Mugello"}</span><br><a href="${url(c.id)}" target="_blank" rel="noopener">▶ Apri la webcam in diretta</a></div>`);
      m.on("click",()=>scegli(c.id,false)); markers[c.id]=m; cluster.addLayer(m);});
  }
  function fit(){if(!map)return;const v=C.filter(ok);if(!v.length)return;map.fitBounds(L.latLngBounds(v.map(c=>[c.lat,c.lon])).pad(0.08),{maxZoom:9});}
  function scegli(id,pan){
    sel=id; document.querySelectorAll("#list .row").forEach(r=>r.classList.toggle("sel",+r.dataset.id===id));
    const m=markers[id]; if(m&&cluster.zoomToShowLayer) cluster.zoomToShowLayer(m,()=>m.openPopup()); else if(m){map.setView(m.getLatLng(),10);m.openPopup();}
    if(!pan){const r=document.querySelector("#list .row.sel");if(r)r.scrollIntoView({block:"nearest"});}
  }
})();
