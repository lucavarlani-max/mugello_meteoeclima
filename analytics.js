/* Statistiche delle visite.
   1) GoatCounter (gratuito, senza cookie): conta sempre tutte le visite.
   2) Google Analytics 4 (facoltativo): si attiva scrivendo l'ID di misurazione in GA_ID qui sotto.
      Usa cookie, quindi viene caricato SOLO se il visitatore accetta nel banner; la scelta resta
      salvata nel browser e si cambia con il link "Preferenze cookie" in fondo alla pagina. */
var GA_ID = "";   // es. "G-AB12CD34EF" (Google Analytics > Amministrazione > Stream di dati)

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

/* Google Analytics 4 con consenso */
(function(){
  if(!GA_ID || location.protocol === "file:") return;
  var CHIAVE = "mmc-consenso-ga";
  var locale = /^(localhost|127\.)/.test(location.hostname);
  function leggi(){ try{ return localStorage.getItem(CHIAVE); }catch(e){ return null; } }
  function scrivi(v){ try{ localStorage.setItem(CHIAVE, v); }catch(e){} }

  function attiva(){
    if(window.__mmcGa || locale) return; window.__mmcGa = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ dataLayer.push(arguments); };
    gtag("js", new Date());
    gtag("config", GA_ID, { anonymize_ip: true });
    var s = document.createElement("script"); s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
  }
  function togliCookie(){   // se il consenso viene revocato, si cancellano i cookie _ga del sito
    document.cookie.split(";").forEach(function(c){ var n = c.split("=")[0].trim();
      if(/^_ga/.test(n)) [location.hostname, "." + location.hostname, ""].forEach(function(d){
        document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + (d ? "; domain=" + d : ""); }); });
  }

  var css = ".mmc-ck{position:fixed;left:12px;right:12px;bottom:12px;z-index:5000;max-width:560px;margin:0 auto;" +
    "background:var(--panel,#fff);color:var(--ink,#16261f);border:1px solid var(--line,#e3e8e1);border-radius:14px;" +
    "box-shadow:0 12px 40px -12px rgba(0,0,0,.35);padding:14px 16px;font:14px/1.45 'IBM Plex Sans',system-ui,sans-serif}" +
    ".mmc-ck p{margin:0 0 10px} .mmc-ck a{color:var(--pine,#0f6b52)}" +
    ".mmc-ck .b{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}" +
    ".mmc-ck button{font:inherit;font-weight:600;font-size:13.5px;border-radius:999px;padding:8px 16px;cursor:pointer;border:1px solid var(--pine,#0f6b52)}" +
    ".mmc-ck .si{background:var(--pine,#0f6b52);color:#fff} .mmc-ck .no{background:transparent;color:var(--pine,#0f6b52)}" +
    ".mmc-pref{cursor:pointer;text-decoration:underline;color:inherit;background:none;border:0;font:inherit;padding:0}" +
    "@media print{.mmc-ck{display:none}}";
  function banner(){
    if(document.querySelector(".mmc-ck")) return;
    if(!document.getElementById("mmc-ck-css")){ var st = document.createElement("style"); st.id = "mmc-ck-css"; st.textContent = css; document.head.appendChild(st); }
    var b = document.createElement("div"); b.className = "mmc-ck"; b.setAttribute("role", "dialog"); b.setAttribute("aria-label", "Consenso ai cookie statistici");
    b.innerHTML = "<p>Vorremmo usare <b>Google Analytics</b> per capire quante persone usano il sito e quali pagine sono più utili. " +
      "Google Analytics usa cookie statistici e i dati sono trattati da Google. Le visite sono già contate in forma anonima, senza cookie; " +
      "il sito funziona allo stesso modo anche se rifiuti. <a href=\"https://policies.google.com/technologies/partner-sites?hl=it\" target=\"_blank\" rel=\"noopener\">Come Google usa i dati</a>.</p>" +
      "<div class=\"b\"><button class=\"no\" type=\"button\">Rifiuta</button><button class=\"si\" type=\"button\">Accetta</button></div>";
    document.body.appendChild(b);
    b.querySelector(".si").onclick = function(){ scrivi("si"); b.remove(); attiva(); };
    b.querySelector(".no").onclick = function(){ var prima = leggi(); scrivi("no"); b.remove(); togliCookie(); if(prima === "si") location.reload(); };
  }
  function linkPreferenze(){
    var dove = document.querySelector(".foot-bar > span") || document.querySelector("footer .wrap") || [].slice.call(document.querySelectorAll("footer")).pop();
    if(!dove || document.querySelector(".mmc-pref")) return;
    var sep = document.createTextNode(" · "), x = document.createElement("button");
    x.type = "button"; x.className = "mmc-pref"; x.textContent = "Preferenze cookie"; x.onclick = banner;
    dove.appendChild(sep); dove.appendChild(x);
  }
  function avvio(){
    if(!document.getElementById("mmc-ck-css")){ var st = document.createElement("style"); st.id = "mmc-ck-css"; st.textContent = css; document.head.appendChild(st); }
    var c = leggi();
    if(c === "si") attiva(); else if(c !== "no") banner();
    linkPreferenze();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", avvio); else avvio();
})();
