'use strict';
/* Genera la sezione statica "Passaggi di ISS e Tiangong" da data/passaggi-stazioni.json.
   Il blocco è leggibile senza JavaScript; il JSON incorporato serve ai pulsanti .ics. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'data', 'passaggi-stazioni.json');
const htmlPath = path.join(root, 'effemeridi.html');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const now = process.env.STAZIONI_NOW ? new Date(process.env.STAZIONI_NOW) : new Date();

const fmtDate = d => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d));
const fmtTime = d => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const future = p => new Date(p.fine) >= now;
const stations = (data.stazioni || []).map(st => ({
  ...st,
  passaggi: (st.passaggi || []).filter(future).slice(0, 8)
}));
const icsStations = stations.map(st => ({
  id: st.id,
  nome: st.nome,
  passaggi: st.passaggi.map(p => ({
    id: p.id,
    inizio: p.inizio,
    fine: p.fine,
    massimo: p.massimo,
    altezza: p.altezza,
    direzione: p.direzione,
    durata: p.durata,
    qualita: p.qualita,
    nota: p.nota,
    punti: p.punti || []
  }))
}));

function row(p, station) {
  const quality = p.qualita === 'radente' ? 'radente' : 'alto';
  const badge = quality === 'radente' ? 'passaggio radente' : 'visibile a occhio nudo';
  const direction = p.direzione.charAt(0).toUpperCase() + p.direzione.slice(1);
  const mins = Math.max(1, Math.round(p.durata));
  return `<li class="iss-pass" data-station="${esc(station.id)}" data-iss-inizio="${esc(p.inizio)}" data-iss-fine="${esc(p.fine)}" data-iss-id="${esc(p.id)}">
        <div class="iss-date"><span>${fmtDate(p.inizio)}</span><b>${fmtTime(p.inizio)}–${fmtTime(p.fine)}</b></div>
        <div class="iss-info"><h3>${esc(direction)}</h3><p>Massimo <b>${Math.round(p.altezza)}°</b> alle ${fmtTime(p.massimo)} · ${mins} minuti</p><span class="badge${quality === 'radente' ? ' warn' : ''}">${badge}</span></div>
        <button type="button" class="ics" data-iss-ics="${esc(p.id)}" aria-label="Aggiungi il passaggio di ${esc(station.nome)} del ${esc(fmtDate(p.inizio))} alle ${esc(fmtTime(p.inizio))} al calendario">Aggiungi al calendario</button>
      </li>`;
}

function stationBlock(station) {
  const next = station.passaggi[0];
  const nextText = next
    ? `Prossimo passaggio: ${fmtDate(next.inizio)}, ${fmtTime(next.inizio)}–${fmtTime(next.fine)}, massimo ${Math.round(next.altezza)}°.`
    : 'Nessun passaggio visibile nei prossimi giorni.';
  return `<div class="sat-block" data-station="${esc(station.id)}">
        <div class="sat-head"><h3>${esc(station.nome)}</h3><span>NORAD ${esc(station.norad)}</span></div>
        <p class="iss-next" id="${esc(station.id)}-prossimo">${esc(nextText)}</p>
        <ol class="iss-list">${station.passaggi.length ? station.passaggi.map(p => row(p, station)).join('') : '<li class="note">Nessun passaggio visibile nel periodo disponibile. La pagina viene aggiornata ogni giorno.</li>'}</ol>
      </div>`;
}

const updated = data.generato ? fmtDate(data.generato) + ' alle ' + fmtTime(data.generato) : 'non disponibile';
const block = `<!-- EFF-STAZIONI:INIZIO -->
    <section id="iss" aria-labelledby="iss-title">
      <div class="sh"><h2 id="iss-title"><span aria-hidden="true">🛰️</span> Passaggi di ISS e Tiangong</h2><span class="src">Borgo San Lorenzo · aggiornato ${esc(updated)}</span></div>
      <div class="card iss-card">
        <p class="note">ISS e Tiangong sono le due stazioni spaziali abitate. Attraversano il cielo come punti luminosi, senza lampeggiare: questi sono i prossimi passaggi visibili a occhio nudo da Borgo San Lorenzo. Tiangong può risultare meno luminosa dell'ISS, soprattutto nei passaggi radenti; non serve un telescopio, basta un orizzonte libero.</p>
        <div class="pass-map-wrap" id="pass-map-wrap" hidden>
          <div class="pass-map-head"><h3>Mappa del cielo</h3><label for="pass-map-select">Passaggio <select id="pass-map-select" aria-label="Scegli il passaggio da mostrare sulla mappa"></select></label></div>
          <div class="pass-map-layout"><div class="pass-map-svg" id="pass-map"></div><div class="pass-map-info" id="pass-map-info"></div></div>
        </div>
        ${stations.map(stationBlock).join('')}
        <details class="hubble-note"><summary>Perché non c'è Hubble?</summary><p>Il telescopio Hubble ha un'inclinazione orbitale di 28,5°: da Borgo San Lorenzo non supera circa 9° di altezza sull'orizzonte, sotto la soglia di 10° usata qui. Resta quindi troppo basso e immerso nell'atmosfera per una sezione di passaggi visibili; non lo elenchiamo.</p></details>
        <p class="note iss-fonte">Dati TLE: <a href="https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&amp;FORMAT=TLE" target="_blank" rel="noopener">Celestrak, ISS NORAD 25544</a> e <a href="https://celestrak.org/NORAD/elements/gp.php?CATNR=48274&amp;FORMAT=TLE" target="_blank" rel="noopener">Tiangong NORAD 48274</a>; calcoli con <a href="https://rhodesmill.org/skyfield/" target="_blank" rel="noopener">Skyfield</a>. Sono elencati solo i passaggi con oggetto sopra 10°, Sole sotto −6° e oggetto illuminato. Nel resto del Mugello gli orari cambiano di pochi secondi; in montagna un orizzonte libero può nascondere i passaggi più bassi. <a href="https://spotthestation.nasa.gov/" target="_blank" rel="noopener">NASA Spot the Station</a>.</p>
      </div>
    </section>
    <script type="application/json" id="eff-stazioni-data">${JSON.stringify({ stazioni: icsStations }).replace(/</g, '\\u003c')}</script>
    <!-- EFF-STAZIONI:FINE -->`;

let html = fs.readFileSync(htmlPath, 'utf8');
const re = /<!-- EFF-STAZIONI:INIZIO -->[\s\S]*?<!-- EFF-STAZIONI:FINE -->/;
if (!re.test(html)) throw new Error('Marker EFF-STAZIONI non trovati in effemeridi.html');
const out = html.replace(re, block);
if (out === html) console.log('Stazioni: nessuna variazione.');
else {
  fs.writeFileSync(htmlPath, out);
  console.log(`Stazioni: ${stations.map(s => `${s.nome} ${s.passaggi.length}`).join(', ')} passaggi inseriti nell'HTML.`);
}
