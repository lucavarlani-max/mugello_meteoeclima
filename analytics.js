/* Contatore visite con GoatCounter (gratuito, senza cookie: non serve il banner del consenso).
   Per attivarlo: crea un account su https://www.goatcounter.com/signup scegliendo un codice
   (es. "mugellometeo") e scrivilo qui sotto tra le virgolette. Le statistiche si vedono su
   https://CODICE.goatcounter.com */
(function(){
  var CODICE = "mugellometeoeclima";
  if(!CODICE || location.protocol === "file:" || /^(localhost|127\.)/.test(location.hostname)) return;
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.setAttribute("data-goatcounter", "https://" + CODICE + ".goatcounter.com/count");
  document.head.appendChild(s);
})();
