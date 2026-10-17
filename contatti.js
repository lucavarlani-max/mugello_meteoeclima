/* Mugello Meteo & Clima - sezione «Contatti» in fondo a ogni pagina, subito sopra il piè di pagina.
   Si carica da menu.js (pagine interne) o direttamente (home). I contatti si cambiano solo qui.
   L'indirizzo email non compare intero nel codice: lo si compone al caricamento, così i programmi che
   raccolgono indirizzi dalle pagine fanno più fatica a trovarlo. */
(function(){
  if(document.querySelector(".mmc-contatti")) return;
  const utente="luca.varlani", dominio="gmail.com", email=utente+"@"+dominio;
  const SOCIAL=[
    ["Facebook","https://www.facebook.com/lucava75",
     '<path d="M14 8.5V6.8c0-.8.5-1 .9-1H17V2.1L14 2c-3.3 0-4 2.4-4 4v2.5H8v3.8h2V22h4v-9.7h2.8l.4-3.8H14z"/>'],
    ["Instagram","https://www.instagram.com/lucava75/",
     '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.4" cy="6.6" r="1.3"/>'],
    ["LinkedIn","https://www.linkedin.com/in/luca-varlani-b2b1a018/",
     '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4z"/>'],
    ["Email","mailto:"+email,
     '<rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>']
  ];
  const css=`
  .mmc-contatti{margin:40px auto 0;max-width:1180px;padding:0 20px;font-family:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;box-sizing:border-box}
  .mmc-contatti *{box-sizing:border-box}
  .mmc-contatti .in{background:var(--panel,#fff);border:1px solid var(--line,#e3e8e1);border-radius:16px;padding:20px 22px;
    display:flex;flex-wrap:wrap;align-items:center;gap:14px 26px;box-shadow:0 1px 2px rgba(16,38,31,.05),0 8px 24px -14px rgba(16,38,31,.2)}
  .mmc-contatti .tx{flex:1 1 260px;min-width:0}
  .mmc-contatti h2{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:20px;font-weight:800;letter-spacing:-.01em;margin:0 0 4px;color:var(--ink,#16261f)}
  .mmc-contatti p{margin:0;font-size:14px;line-height:1.5;color:var(--ink-soft,#48584f)}
  .mmc-contatti .lk{display:flex;flex-wrap:wrap;gap:10px}
  .mmc-contatti .lk a{display:inline-flex;align-items:center;gap:8px;min-height:42px;padding:8px 14px;border-radius:999px;
    border:1px solid var(--line,#e3e8e1);background:var(--panel-2,#fbfcfa);color:var(--ink,#16261f);text-decoration:none;font-size:14px;font-weight:600}
  .mmc-contatti .lk a:hover{border-color:var(--pine,#0f6b52);color:var(--pine-deep,#0a4f3c)}
  .mmc-contatti .lk a:focus-visible{outline:2px solid var(--pine,#0f6b52);outline-offset:2px}
  .mmc-contatti .lk svg{width:18px;height:18px;flex:none;fill:currentColor}
  @media (max-width:520px){ .mmc-contatti{padding:0 16px} .mmc-contatti .lk a{flex:1 1 calc(50% - 10px);justify-content:center} }
  @media print{ .mmc-contatti{display:none} }`;
  const st=document.createElement("style"); st.textContent=css; document.head.appendChild(st);
  const sez=document.createElement("section");
  sez.className="mmc-contatti"; sez.id="contatti"; sez.setAttribute("aria-labelledby","mmc-contatti-t");
  sez.innerHTML=`<div class="in"><div class="tx"><h2 id="mmc-contatti-t">Contatti</h2>
    <p>Domande, segnalazioni o dati da condividere? Scrivimi o seguimi sui social. — Luca Varlani</p></div>
    <div class="lk">${SOCIAL.map(([n,u,ic])=>`<a href="${u}"${u.startsWith("mailto:")?"":` target="_blank" rel="noopener me"`} aria-label="${n==="Email"?"Scrivi a "+email:n+" di Luca Varlani"}"><svg viewBox="0 0 24 24" aria-hidden="true">${ic}</svg>${n==="Email"?email:n}</a>`).join("")}</div></div>`;
  function monta(){
    // subito sopra il piè di pagina; se la pagina non ne ha uno, in fondo
    const piede=document.querySelector("body > footer, footer.foot, body > .foot, footer");
    if(piede&&piede.parentNode) piede.parentNode.insertBefore(sez,piede); else document.body.appendChild(sez);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",monta); else monta();
})();
