/* Allinea data/previsioni.json alla data di oggi (ora italiana).
   Il file viene aggiornato da una GitHub Action che a volte parte con ore di ritardo,
   e prima delle 7 del mattino Google conta ancora "oggi" il giorno precedente:
   si scartano i giorni già passati e, se il file ha più di 3 ore, anche il valore "adesso". */
window.allineaPrevisioni=function(P){
  if(!P||!P.comuni) return P;
  var oggi=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome'}).format(new Date()); // AAAA-MM-GG
  var a=P.aggiornato||'', t=Date.parse(/[zZ]$|[+-]\d\d:?\d\d$/.test(a)?a:a+'Z'); // senza fuso = UTC (ora del server)
  var vecchio=!isFinite(t)||Date.now()-t>3*3600e3;
  P.comuni.forEach(function(c){
    if(c.giorni) c.giorni=c.giorni.filter(function(d){return d.iso>=oggi;});
    if(vecchio) c.now=null;
  });
  return P;
};
