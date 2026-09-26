/* Contatore visite con GoatCounter (gratuito, senza cookie: non serve il banner del consenso).
   Le statistiche complete si vedono su https://mugellometeoeclima.goatcounter.com
   In fondo a ogni pagina compare il totale delle visite del sito: per mostrarlo GoatCounter
   deve avere attiva l'opzione "Allow adding visitor counts on your website" (Settings). */
(function(){
  var CODICE = "mugellometeoeclima";
  if(!CODICE || location.protocol === "file:") return;
  var BASE = "https://" + CODICE + ".goatcounter.com";
  var locale = /^(localhost|127\.)/.test(location.hostname);

  // conteggio della visita (non in locale)
  if(!locale){
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://gc.zgo.at/count.js";
    s.setAttribute("data-goatcounter", BASE + "/count");
    document.head.appendChild(s);
  }

  // totale delle visite in fondo alla pagina
  function mostra(n){
    var dove = document.querySelector(".foot-bar > span") || document.querySelector("footer .wrap") || [].slice.call(document.querySelectorAll("footer")).pop();
    if(!dove || document.querySelector(".gc-visite")) return;
    var el = document.createElement("span");
    el.className = "gc-visite";
    el.title = "Visite al sito conteggiate con GoatCounter, senza cookie";
    el.innerHTML = " · 👁 <b>" + n.toLocaleString("it-IT") + "</b> visite";
    dove.appendChild(el);
  }
  function carica(){
    fetch(BASE + "/counter/TOTAL.json", {cache: "no-store"})
      .then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(function(d){ var n = parseInt(String(d.count).replace(/\D/g, ""), 10); if(!isNaN(n)) setTimeout(function(){ mostra(n); }, 300); })
      .catch(function(){});
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", carica); else carica();
})();
