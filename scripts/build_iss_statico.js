'use strict';
/* Genera la sezione statica "Passaggi della ISS" da data/iss-passaggi.json.
   Il blocco è leggibile senza JavaScript; il JSON incorporato serve ai pulsanti .ics. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'data', 'iss-passaggi.json');
const htmlPath = path.join(root, 'effemeridi.html');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const now = process.env.ISS_NOW ? new Date(process.env.ISS_NOW) : new Date();

const fmtDate = d => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d));
const fmtTime = d => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const future = p => new Date(p.fine) >= now;
const passes = (data.passaggi || []).filter(future).slice(0, 8);

const icsPasses = passes.map(p => ({
  id: p.id,
  inizio: p.inizio,
  fine: p.fine,
  nota: p.nota
}));

function row(p) {
  const quality = p.qualita === 'radente' ? 'radente' : 'alto';
  const badge = quality === 'radente' ? 'passaggio radente' : 'visibile a occhio nudo';
  const direction = p.direzione.charAt(0).toUpperCase() + p.direzione.slice(1);
  const mins = Math.max(1, Math.round(p.durata));
  return `<li class="iss-pass" data-iss-inizio="${esc(p.inizio)}" data-iss-fine="${esc(p.fine)}" data-iss-id="${esc(p.id)}">
        <div class="iss-date"><span>${fmtDate(p.inizio)}</span><b>${fmtTime(p.inizio)}–${fmtTime(p.fine)}</b></div>
        <div class="iss-info"><h3>${esc(direction)}</h3><p>Massimo <b>${Math.round(p.altezza)}°</b> alle ${fmtTime(p.massimo)} · ${mins} minuti</p><span class="badge${quality === 'radente' ? ' warn' : ''}">${badge}</span></div>
        <button type="button" class="ics" data-iss-ics="${esc(p.id)}" aria-label="Aggiungi il passaggio del ${esc(fmtDate(p.inizio))} alle ${esc(fmtTime(p.inizio))} al calendario">Aggiungi al calendario</button>
      </li>`;
}

const next = passes[0];
const nextText = next
  ? `Prossimo passaggio: ${fmtDate(next.inizio)}, ${fmtTime(next.inizio)}–${fmtTime(next.fine)}, massimo ${Math.round(next.altezza)}°.`
  : 'Nessun passaggio visibile nei prossimi giorni.';
const updated = data.generato ? fmtDate(data.generato) + ' alle ' + fmtTime(data.generato) : 'non disponibile';

const block = `<!-- EFF-ISS:INIZIO -->
    <section id="iss" aria-labelledby="iss-title">
      <div class="sh"><h2 id="iss-title"><span aria-hidden="true">🛰️</span> Passaggi della ISS</h2><span class="src">Borgo San Lorenzo · aggiornato ${esc(updated)}</span></div>
      <div class="card iss-card">
        <p class="note">La Stazione Spaziale Internazionale attraversa il cielo come un punto molto luminoso, senza lampeggiare. Questi sono i prossimi passaggi visibili a occhio nudo da Borgo San Lorenzo: non serve un telescopio, basta un orizzonte libero.</p>
        <p class="iss-next" id="iss-prossimo">${esc(nextText)}</p>
        <ol class="iss-list">${passes.length ? passes.map(row).join('') : '<li class="note">Nessun passaggio visibile nel periodo disponibile. La pagina viene aggiornata ogni giorno.</li>'}</ol>
        <p class="note iss-fonte">Dati TLE: <a href="https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&amp;FORMAT=TLE" target="_blank" rel="noopener">Celestrak, NORAD 25544</a>; calcoli con <a href="https://rhodesmill.org/skyfield/" target="_blank" rel="noopener">Skyfield</a>. Sono elencati solo i passaggi con ISS sopra 10°, Sole sotto −6° e ISS illuminata. Nel resto del Mugello gli orari cambiano di pochi secondi; in montagna un orizzonte libero può nascondere i passaggi più bassi. <a href="https://spotthestation.nasa.gov/" target="_blank" rel="noopener">NASA Spot the Station</a>.</p>
      </div>
    </section>
    <script type="application/json" id="eff-iss-data">${JSON.stringify({ passaggi: icsPasses }).replace(/</g, '\\u003c')}</script>
    <!-- EFF-ISS:FINE -->`;

let html = fs.readFileSync(htmlPath, 'utf8');
const re = /<!-- EFF-ISS:INIZIO -->[\s\S]*?<!-- EFF-ISS:FINE -->/;
if (!re.test(html)) throw new Error('Marker EFF-ISS non trovati in effemeridi.html');
const out = html.replace(re, block);
if (out === html) console.log('ISS: nessuna variazione.');
else {
  fs.writeFileSync(htmlPath, out);
  console.log(`ISS: ${passes.length} passaggi inseriti nell'HTML.`);
}
