/* Mugello Meteo & Clima - scelta tema chiaro/scuro.
   Applica subito il tema salvato (se l'utente lo ha scelto) ed espone window.mmTemaBtn(contenitore, prima_di)
   che inserisce il pulsante sole/luna. Senza scelta si segue il tema del dispositivo. */
(function(){
  var K="mmc-tema", R=document.documentElement;
  function leggi(){ try{ var v=localStorage.getItem(K); return v==="dark"||v==="light"?v:null; }catch(e){ return null; } }
  function scuro(){ var t=R.getAttribute("data-theme"); return t? t==="dark" : matchMedia("(prefers-color-scheme:dark)").matches; }
  function applica(t){ if(t) R.setAttribute("data-theme",t); else R.removeAttribute("data-theme");
    var m=document.querySelector('meta[name="theme-color"]'); if(m&&t) m.setAttribute("content",t==="dark"?"#0e1613":"#0f6b52"); }
  applica(leggi());
  if(window.mmTemaBtn) return;
  var css=".mm-tema{flex:none;width:36px;height:36px;border-radius:50%;border:1px solid var(--line,#e3e8e1);background:var(--panel,#fff);color:var(--ink,#16261f);font-size:16px;line-height:1;cursor:pointer;display:inline-grid;place-items:center;margin-left:4px;padding:0}"+
    ".mm-tema:hover{background:var(--pine-tint,#e3f1eb)}.mm-tema:focus-visible{outline:2px solid var(--pine,#0f6b52);outline-offset:2px}"+
    "@media (max-width:1180px){.mm-tema{margin-left:auto}.mm-tema+.menu-btn,.mm-tema+.mm-btn{margin-left:8px}}@media print{.mm-tema{display:none}}";
  var st=document.createElement("style"); st.textContent=css; document.head.appendChild(st);
  window.mmTemaBtn=function(box,prima){
    if(!box||box.querySelector(".mm-tema")) return;
    var b=document.createElement("button"); b.type="button"; b.className="mm-tema";
    function agg(){ var s=scuro(); b.textContent=s?"☀️":"🌙"; b.title=s?"Passa al tema chiaro":"Passa al tema scuro"; b.setAttribute("aria-label",b.title); b.setAttribute("aria-pressed",String(s)); }
    b.addEventListener("click",function(){ var t=scuro()?"light":"dark"; applica(t); try{ localStorage.setItem(K,t); }catch(e){} agg(); });
    matchMedia("(prefers-color-scheme:dark)").addEventListener&&matchMedia("(prefers-color-scheme:dark)").addEventListener("change",agg);
    agg(); box.insertBefore(b,prima||null);
  };
  function monta(){ var h=document.querySelector(".mm-top .mm-in"); if(h) window.mmTemaBtn(h,h.querySelector(".mm-btn")); }
  if(document.readyState==="complete") monta(); else addEventListener("load",monta);
})();
