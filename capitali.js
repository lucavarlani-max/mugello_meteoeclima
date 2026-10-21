/* Capitali del mondo: temperatura attuale (Open-Meteo, richieste a blocchi) su mappa Leaflet, classifiche ed elenco. */
(function(){
  const C=window.CAPITALI, T=new Array(C.length).fill(null), OFF=new Array(C.length).fill(null);
  const BLOCCO=50, TTL=10*60*1000, KEY="mmc-capitali-v1";
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), $=id=>document.getElementById(id);
  const col=v=>v==null?"#c9d2cc":"hsl("+(240-240*clamp((v+30)/75,0,1)).toFixed(0)+",72%,52%)";
  const fmt=v=>v==null?"–":(v>0?"+":"")+Math.round(v)+"°";
  let map,layer,mk=[],ord={k:"t",d:-1},filtro="";
  $("n").textContent=C.length;
  $("leg-bar").style.background="linear-gradient(90deg,"+[-30,-15,0,15,30,45].map(col).join(",")+")";

  function ora(i){
    if(OFF[i]==null) return "–";
    const d=new Date(Date.now()+OFF[i]*1000);
    return String(d.getUTCHours()).padStart(2,"0")+":"+String(d.getUTCMinutes()).padStart(2,"0");
  }
  function iniz(){
    map=L.map("map",{scrollWheelZoom:false,worldCopyJump:true,minZoom:2}).setView([30,10],2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:10,attribution:"© OpenStreetMap"}).addTo(map);
    map.on("click",()=>map.scrollWheelZoom.enable());
    layer=L.layerGroup().addTo(map);
    mk=C.map((c,i)=>L.marker([c[2],c[3]],{icon:icona(i)}).addTo(layer));
  }
  function icona(i){
    const v=T[i], chiaro=v!=null&&v>=-5&&v<=30;
    return L.divIcon({className:"",iconSize:[34,34],iconAnchor:[17,17],
      html:'<div class="bub sm" style="background:'+col(v)+';color:'+(chiaro?"#10241c":"#fff")+'"><b>'+fmt(v).replace("+","")+'</b></div>'});
  }
  function popup(i){ return "<b>"+C[i][0]+"</b><br>"+C[i][1]+"<br>"+(T[i]==null?"dato non disponibile":"<b>"+T[i].toFixed(1)+" °C</b> · ore "+ora(i)+" locali"); }
  function vai(i){ map.setView([C[i][2],C[i][3]],Math.max(map.getZoom(),5)); mk[i].openPopup(); scrollTo({top:0,behavior:"smooth"}); }

  function disegna(){
    mk.forEach((m,i)=>{ m.setIcon(icona(i)); m.bindPopup(()=>popup(i)); });
    const ok=C.map((c,i)=>i).filter(i=>T[i]!=null).sort((a,b)=>T[b]-T[a]);
    const li=i=>'<li data-i="'+i+'"><span>'+C[i][0]+' <small>'+C[i][1]+'</small></span><b>'+fmt(T[i])+'</b></li>';
    $("hot").innerHTML=ok.slice(0,10).map(li).join("");
    $("cold").innerHTML=ok.slice(-10).reverse().map(li).join("");
    tabella();
  }
  function tabella(){
    const q=filtro.trim().toLowerCase(), k=ord.k;
    const val=i=>k==="c"?C[i][0]:k==="p"?C[i][1]:k==="h"?(OFF[i]??-1e9):(T[i]??-1e9);
    const ix=C.map((c,i)=>i).filter(i=>!q||(C[i][0]+" "+C[i][1]).toLowerCase().includes(q))
      .sort((a,b)=>{const x=val(a),y=val(b);return (typeof x==="string"?x.localeCompare(y,"it"):x-y)*ord.d;});
    $("rows").innerHTML=ix.map(i=>'<tr data-i="'+i+'"><td>'+C[i][0]+'</td><td>'+C[i][1]+'</td><td>'+ora(i)+'</td><td class="t">'+(T[i]==null?"–":T[i].toFixed(1)+"°")+'</td></tr>').join("")
      ||'<tr><td colspan="4">Nessun risultato.</td></tr>';
  }
  document.addEventListener("click",e=>{const r=e.target.closest("[data-i]"); if(r) vai(+r.dataset.i);
    const th=e.target.closest("th[data-k]"); if(th){ ord=ord.k===th.dataset.k?{k:ord.k,d:-ord.d}:{k:th.dataset.k,d:th.dataset.k==="c"||th.dataset.k==="p"?1:-1}; tabella(); }});
  $("find").addEventListener("input",e=>{filtro=e.target.value;tabella();});

  function applica(arr,da){ arr.forEach((r,j)=>{ const i=da+j;
    if(r&&r.current&&typeof r.current.temperature_2m==="number"){ T[i]=r.current.temperature_2m; OFF[i]=r.utc_offset_seconds; } }); }
  async function blocco(da){
    const s=C.slice(da,da+BLOCCO);
    const u="https://api.open-meteo.com/v1/forecast?current=temperature_2m&timezone=auto&latitude="+s.map(c=>c[2]).join(",")+"&longitude="+s.map(c=>c[3]).join(",");
    const r=await fetch(u); if(!r.ok) throw new Error(r.status);
    const j=await r.json(); applica(Array.isArray(j)?j:[j],da);
  }
  async function carica(){
    let c=null; try{ c=JSON.parse(localStorage.getItem(KEY)); }catch(e){}
    if(c&&Date.now()-c.t<TTL&&c.T.length===C.length){ c.T.forEach((v,i)=>{T[i]=v;OFF[i]=c.O[i];}); disegna(); stato(c.t,0); return; }
    const falliti=[];
    await Promise.all(Array.from({length:Math.ceil(C.length/BLOCCO)},(_,b)=>blocco(b*BLOCCO).catch(()=>falliti.push(b))));
    disegna();
    const n=T.filter(v=>v!=null).length;
    if(n>0){ stato(Date.now(),C.length-n); try{ localStorage.setItem(KEY,JSON.stringify({t:Date.now(),T:T,O:OFF})); }catch(e){} }
    else $("src").textContent="Dati non disponibili, riprova tra poco.";
  }
  function stato(t,mancano){
    const d=new Date(t);
    $("src").textContent="Aggiornato alle "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")+(mancano?" · "+mancano+" capitali senza dato":"")+" · Open-Meteo";
  }
  iniz(); tabella(); carica();
  setInterval(()=>{ if(!document.hidden) carica(); },TTL);
})();
