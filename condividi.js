/* Mugello Meteo & Clima - blocco «Condividi» e invito a installare l'app, sopra i «Contatti» in fondo a ogni pagina.
   Si carica da menu.js (pagine interne) o direttamente (home).
   - WhatsApp, Facebook e «Copia link» con parametri UTM (utm_source = canale), così in GoatCounter e GA4
     si vede quanto portano le condivisioni dei lettori; sui telefoni anche «Altro…» (menu di condivisione del sistema).
   - «Installa l'app»: pulsante vero su Chrome/Edge/Android (evento beforeinstallprompt); su iPhone/iPad
     (Safari non ha l'evento) una breve istruzione. Non compare se l'app è già installata o se il visitatore
     ha scelto «Non ora» (se ne riparla dopo 30 giorni). Niente popup: è solo un blocco in fondo alla pagina. */
(function(){
  if(document.querySelector(".mmc-condividi")) return;
  var CHIAVE="mmc-installa-no", GIORNI30=30*864e5;
  function leggi(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function scrivi(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function conta(nome){ // evento GoatCounter, se presente
    try{ if(window.goatcounter&&window.goatcounter.count) window.goatcounter.count({path:"evento/"+nome,title:nome,event:true}); }catch(e){}
  }

  // ---- installazione ----
  var standalone=(window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||window.navigator.standalone===true;
  var ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  var rimandata=parseInt(leggi(CHIAVE)||"0",10), nascondi=standalone||(rimandata&&Date.now()-rimandata<GIORNI30);
  var evento=window.__mmcInstalla||null;
  window.addEventListener("beforeinstallprompt",function(e){ e.preventDefault(); evento=window.__mmcInstalla=e; aggiornaInstalla(); });
  window.addEventListener("appinstalled",function(){ evento=window.__mmcInstalla=null; nascondi=true; aggiornaInstalla(); conta("app-installata"); });

  // ---- link con UTM ----
  function url(canale){
    var c=document.querySelector('link[rel="canonical"]'), u;
    try{ u=new URL(c?c.href:location.href.split("#")[0]); }catch(e){ return location.href; }
    if(!c&&location.search) u.search=location.search;       // pagine senza canonical (comune.html?c=…)
    u.hash=location.hash&&/^#n-/.test(location.hash)?location.hash:"";  // i numeri di Terra & Cielo si aprono dal #
    u.searchParams.set("utm_source",canale);
    u.searchParams.set("utm_medium","social");
    u.searchParams.set("utm_campaign","condividi-pagina");
    return u.toString();
  }
  function titolo(){ return (document.title||"Mugello Meteo & Clima").replace(/\s*[|·]\s*Mugello Meteo.*$/i,""); }

  var css=
  ".mmc-condividi{margin:40px auto 0;max-width:1180px;padding:0 20px;font-family:\"IBM Plex Sans\",system-ui,-apple-system,\"Segoe UI\",sans-serif;box-sizing:border-box}"+
  ".mmc-condividi *{box-sizing:border-box}"+
  ".mmc-condividi .in{background:var(--panel,#fff);border:1px solid var(--line,#e3e8e1);border-radius:16px;padding:20px 22px;display:flex;flex-wrap:wrap;align-items:center;gap:14px 26px;box-shadow:0 1px 2px rgba(16,38,31,.05),0 8px 24px -14px rgba(16,38,31,.2)}"+
  ".mmc-condividi .tx{flex:1 1 260px;min-width:0}"+
  ".mmc-condividi h2{font-family:\"Bricolage Grotesque\",system-ui,sans-serif;font-size:20px;font-weight:800;letter-spacing:-.01em;margin:0 0 4px;color:var(--ink,#16261f)}"+
  ".mmc-condividi p{margin:0;font-size:14px;line-height:1.5;color:var(--ink-soft,#48584f)}"+
  ".mmc-condividi .lk{display:flex;flex-wrap:wrap;gap:10px}"+
  ".mmc-condividi .lk a,.mmc-condividi .lk button{display:inline-flex;align-items:center;gap:8px;min-height:42px;padding:8px 14px;border-radius:999px;border:1px solid var(--line,#e3e8e1);background:var(--panel-2,#fbfcfa);color:var(--ink,#16261f);text-decoration:none;font:600 14px \"IBM Plex Sans\",system-ui,sans-serif;cursor:pointer}"+
  ".mmc-condividi .lk a:hover,.mmc-condividi .lk button:hover{border-color:var(--pine,#0f6b52);color:var(--pine-deep,#0a4f3c)}"+
  ".mmc-condividi .lk a:focus-visible,.mmc-condividi .lk button:focus-visible{outline:2px solid var(--pine,#0f6b52);outline-offset:2px}"+
  ".mmc-condividi .lk svg{width:18px;height:18px;flex:none;fill:currentColor}"+
  ".mmc-condividi .app{flex:1 1 100%;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;border-top:1px solid var(--line,#e3e8e1);padding-top:14px}"+
  ".mmc-condividi [hidden]{display:none!important}"+
  ".mmc-condividi .app p{flex:1 1 240px}"+
  ".mmc-condividi .app .inst{background:var(--pine,#0f6b52);color:#fff;border-color:var(--pine,#0f6b52)}"+
  ".mmc-condividi .app .inst:hover{background:var(--pine-deep,#0a4f3c);color:#fff}"+
  ".mmc-condividi .app .no{background:transparent;border-color:transparent;color:var(--ink-faint,#7d8a82);font-weight:500}"+
  "@media (max-width:520px){.mmc-condividi{padding:0 16px}.mmc-condividi .lk a,.mmc-condividi .lk button{flex:1 1 calc(50% - 10px);justify-content:center}}"+
  "@media print{.mmc-condividi{display:none}}";
  var st=document.createElement("style"); st.textContent=css; document.head.appendChild(st);

  var WA='<path d="M12 3a9 9 0 0 0-7.700 13.600L3 21l4.500-1.200A9 9 0 1 0 12 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9.200 8c-.4.400-.6 1-.2 1.900.700 1.600 2.300 3.200 3.900 3.900.900.400 1.500.2 1.900-.2l.2-.8-1.600-.8-.8.600c-.8-.4-1.500-1.100-1.900-1.900l.6-.8-.8-1.600z"/>';
  var FB='<path d="M14 8.5V6.8c0-.8.5-1 .9-1H17V2.1L14 2c-3.300 0-4 2.400-4 4v2.500H8v3.800h2V22h4v-9.700h2.800l.4-3.800H14z"/>';
  var LK='<path d="M10.600 13.400a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1 1.400 1.400 1-1a2 2 0 0 1 2.900 2.900l-3 3a2 2 0 0 1-2.900 0zM13.400 10.600a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1-1.400-1.400-1 1a2 2 0 0 1-2.900-2.900l3-3a2 2 0 0 1 2.900 0z"/>';
  var SH='<path d="M18 16a3 3 0 0 0-2.200 1l-6.400-3.200a3 3 0 0 0 0-1.600L15.800 9a3 3 0 1 0-.8-1.800L8.600 10.400a3 3 0 1 0 0 3.200L15 16.800A3 3 0 1 0 18 16z"/>';
  var DL='<path d="M12 3v11.200l3.600-3.600L17 12l-5 5-5-5 1.400-1.400L11 14.200V3zM5 19h14v2H5z"/>';

  var sez=document.createElement("section");
  sez.className="mmc-condividi"; sez.id="condividi"; sez.setAttribute("aria-labelledby","mmc-condividi-t");
  sez.innerHTML='<div class="in"><div class="tx"><h2 id="mmc-condividi-t">Ti è stata utile?</h2>'+
    '<p>Mandala a chi vive o viaggia in Mugello: una previsione condivisa aiuta un vicino a organizzarsi.</p></div>'+
    '<div class="lk">'+
      '<a class="wa" href="#" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true">'+WA+'</svg>WhatsApp</a>'+
      '<a class="fb" href="#" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true">'+FB+'</svg>Facebook</a>'+
      '<button type="button" class="cp"><svg viewBox="0 0 24 24" aria-hidden="true">'+LK+'</svg><span>Copia link</span></button>'+
      '<button type="button" class="nt" hidden><svg viewBox="0 0 24 24" aria-hidden="true">'+SH+'</svg>Altro…</button>'+
    '</div>'+
    '<div class="app" hidden><p class="apt"></p><div class="lk">'+
      '<button type="button" class="inst"><svg viewBox="0 0 24 24" aria-hidden="true">'+DL+'</svg>Installa l\'app</button>'+
      '<button type="button" class="no">Non ora</button></div></div></div>';

  var q=function(s){ return sez.querySelector(s); };
  function aggiornaLink(){
    q(".wa").href="https://wa.me/?text="+encodeURIComponent(titolo()+" — Mugello Meteo & Clima\n"+url("whatsapp"));
    q(".fb").href="https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(url("facebook"));
  }
  function aggiornaInstalla(){
    var box=q(".app"); if(!box) return;
    var apt=q(".apt"), inst=q(".inst");
    if(nascondi){ box.hidden=true; return; }
    if(evento){
      apt.textContent="Aggiungi Mugello Meteo alla schermata Home: si apre con un tocco, come un'app, e funziona anche con poca rete.";
      inst.hidden=false; q(".no").hidden=false; box.hidden=false;
    }else if(ios){
      apt.innerHTML="Per averlo come app su iPhone o iPad: tocca <b>Condividi</b> (il quadrato con la freccia) e poi <b>Aggiungi alla schermata Home</b>.";
      inst.hidden=true; q(".no").hidden=false; box.hidden=false;
    }else box.hidden=true;
  }

  q(".wa").addEventListener("click",function(){ aggiornaLink(); conta("condividi-whatsapp"); });
  q(".fb").addEventListener("click",function(){ aggiornaLink(); conta("condividi-facebook"); });
  q(".cp").addEventListener("click",function(){
    var b=q(".cp span"), u=url("link");
    function ok(){ b.textContent="Copiato ✓"; setTimeout(function(){ b.textContent="Copia link"; },1800); conta("condividi-copia"); }
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(ok,function(){ window.prompt("Copia il link:",u); });
    else window.prompt("Copia il link:",u);
  });
  if(navigator.share){
    var nt=q(".nt"); nt.hidden=false;
    nt.addEventListener("click",function(){
      navigator.share({title:titolo(),text:titolo()+" — Mugello Meteo & Clima",url:url("share")}).then(function(){ conta("condividi-sistema"); },function(){});
    });
  }
  q(".inst").addEventListener("click",function(){
    if(!evento) return;
    var e=evento; evento=window.__mmcInstalla=null; aggiornaInstalla();
    e.prompt(); e.userChoice.then(function(r){ conta(r&&r.outcome==="accepted"?"installa-si":"installa-no"); },function(){});
  });
  q(".no").addEventListener("click",function(){ scrivi(CHIAVE,String(Date.now())); nascondi=true; aggiornaInstalla(); conta("installa-non-ora"); });

  function monta(){
    // sopra i «Contatti» (contatti.js); se non ci sono ancora, subito sopra il piè di pagina
    var c=document.getElementById("contatti");
    var piede=document.querySelector("body > footer, footer.foot, body > .foot, footer");
    if(c&&c.parentNode) c.parentNode.insertBefore(sez,c);
    else if(piede&&piede.parentNode) piede.parentNode.insertBefore(sez,piede);
    else document.body.appendChild(sez);
    aggiornaLink(); aggiornaInstalla();
  }
  function avvia(){ monta(); }
  // contatti.js può arrivare dopo: si monta a pagina caricata per finire sopra i «Contatti»
  if(document.readyState==="complete") setTimeout(avvia,0); else window.addEventListener("load",function(){ setTimeout(avvia,0); });
})();
