'use strict';
/* Genera il blocco statico "Eclissi e congiunzioni" da data/effemeridi-speciali.json.
   Il file HTML resta leggibile dai motori di ricerca; i pulsanti .ics usano il JSON
   incorporato nella pagina. Rieseguire dopo aver aggiornato il dataset. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'data', 'effemeridi-speciali.json');
const htmlPath = path.join(root, 'effemeridi.html');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const now = process.env.EFF_NOW ? new Date(process.env.EFF_NOW) : new Date();

const fmtDate = d => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
const fmtTime = d => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
const fmtIso = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const future = d => new Date(d) >= now;

const eclissi = data.eclissi.filter(e => future(e.massimo)).slice(0, 8);
const congiunzioni = data.congiunzioni.filter(c => c.visibile && future(c.data) && c.corpi[0] !== 'Luna').slice(0, 8);
const lunaPianeti = data.congiunzioni.filter(c => c.visibile && future(c.data) && c.corpi[0] === 'Luna' && c.separazione <= 1.5).slice(0, 6);

const icsData = {
  eclissi: eclissi.map(e => ({ id: e.id, nome: `Eclissi ${e.tipo} ${e.sottotipo}`, data: e.massimo, nota: e.nota, tipo: 'eclissi' })),
  congiunzioni: [...congiunzioni, ...lunaPianeti].map(c => ({ id: c.id, nome: `${c.corpi[0]} e ${c.corpi[1]}`, data: c.data, nota: c.nota, tipo: 'congiunzione' }))
};

function icsButton(kind, id, label) {
  return `<button type="button" class="ics" data-spec-ics="${kind}:${esc(id)}" aria-label="Aggiungi ${esc(label)} al calendario">Aggiungi al calendario</button>`;
}
function eclipseRow(e) {
  const icon = e.tipo === 'solare' ? '☀️' : '🌙';
  const title = `Eclissi ${e.tipo} ${e.sottotipo}`;
  const badge = e.visibilita === 'visibile' ? 'visibile da Borgo' : e.visibilita;
  return `<div class="spec"><div class="ic" aria-hidden="true">${icon}</div><div class="spec-body"><div class="d">${fmtDate(e.massimo)} · ${fmtTime(e.massimo)}</div><h4>${esc(title)}</h4><p>${esc(e.nota)}</p><div class="fra"><span class="badge${e.visibilita === 'visibile' ? '' : ' warn'}">${esc(badge)}</span> ${icsButton('eclissi', e.id, title)}</div></div></div>`;
}
function conjunctionRow(c) {
  const title = `${c.corpi[0]} e ${c.corpi[1]}`;
  return `<div class="spec"><div class="ic" aria-hidden="true">✨</div><div class="spec-body"><div class="d">${fmtDate(c.data)} · ${fmtTime(c.data)}</div><h4>${esc(title)}</h4><p>${esc(c.nota)}</p><div class="fra"><span class="badge">visibile da Borgo</span> ${icsButton('congiunzione', c.id, title)}</div></div></div>`;
}
function moonRow(c) {
  const title = `Luna e ${c.corpi[1]}`;
  return `<li><button type="button" data-date="${fmtIso(c.data)}" class="moon-row"><span><b>${esc(title)}</b> · ${esc(c.nota)}</span><time datetime="${esc(c.data)}">${fmtDate(c.data)} · ${fmtTime(c.data)}</time></button></li>`;
}

const block = `<!-- EFF-SPECIALI:INIZIO -->
    <section id="speciali" aria-labelledby="speciali-title">
      <div class="sh"><h2 id="speciali-title">Eclissi e congiunzioni</h2><span class="src">prossimi eventi visibili da Borgo</span></div>
      <div class="speciali-grid">
        <div class="card speciali-card">
          <h3>Prossime eclissi</h3>
          <p class="note">Date globali confrontate con il catalogo NASA GSFC; orari e visibilità calcolati per l'orizzonte di Borgo San Lorenzo.</p>
          <div class="speciali-list">${eclissi.length ? eclissi.map(eclipseRow).join('') : '<p class="note">Nessuna eclissi visibile nel periodo disponibile.</p>'}</div>
        </div>
        <div class="card speciali-card">
          <h3>Congiunzioni planetarie</h3>
          <p class="note">Distanza angolare minima tra due pianeti, calcolata con le effemeridi geocentriche. Gli orari sono in ora italiana.</p>
          <div class="speciali-list">${congiunzioni.length ? congiunzioni.map(conjunctionRow).join('') : '<p class="note">Nessuna congiunzione visibile nel periodo disponibile.</p>'}</div>
        </div>
      </div>
      <details class="card speciali-altro">
        <summary>Luna vicina ai pianeti</summary>
        <p class="note">Passaggi ravvicinati della Luna accanto a un pianeta, entro 1,5° di distanza apparente.</p>
        <ul class="moon-list">${lunaPianeti.length ? lunaPianeti.map(moonRow).join('') : '<li class="note">Nessun passaggio ravvicinato nel periodo disponibile.</li>'}</ul>
      </details>
      <p class="note speciali-fonte">Fonti: <a href="https://eclipse.gsfc.nasa.gov/SEdecade/SEdecade2021.html" target="_blank" rel="noopener">NASA GSFC, eclissi solari 2021–2030</a> e <a href="https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html" target="_blank" rel="noopener">lunari 2021–2030</a>; circostanze locali con Astronomy Engine 2.1.19. Ultimo aggiornamento: ${fmtDate(now)}.</p>
    </section>
    <script type="application/json" id="eff-speciali-data">${JSON.stringify(icsData).replace(/</g, '\\u003c')}</script>
    <!-- EFF-SPECIALI:FINE -->`;

let html = fs.readFileSync(htmlPath, 'utf8');
const re = /<!-- EFF-SPECIALI:INIZIO -->[\s\S]*?<!-- EFF-SPECIALI:FINE -->/;
if (!re.test(html)) throw new Error('Marker EFF-SPECIALI non trovati in effemeridi.html');
const next = html.replace(re, block);
if (next === html) {
  console.log('Eventi speciali: nessuna variazione.');
} else {
  fs.writeFileSync(htmlPath, next);
  console.log(`Eventi speciali: ${eclissi.length} eclissi, ${congiunzioni.length} congiunzioni, ${lunaPianeti.length} passaggi Luna-pianeta.`);
}
