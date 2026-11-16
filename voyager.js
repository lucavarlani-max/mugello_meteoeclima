/* Cielo · Voyager 1 a un giorno-luce dalla Terra (sezione di effemeridi.html).
   Tutto calcolato nel browser, senza servizi esterni, a partire dai dati ufficiali del JPL.
   Posizione e velocità eliocentriche della sonda vengono da JPL Horizons (soluzione Voyager_1_ST+refit2022, eclittica
   J2000, epoca 1° gennaio 2027): lontano dal Sole il moto è praticamente rettilineo, quindi basta prolungarle.
   La distanza dalla Terra tiene conto del tempo di viaggio della luce (vediamo la sonda dov'era un giorno prima).
   Confronto con Horizons, un punto al giorno da settembre 2026 a dicembre 2027: scarto massimo 0,3 secondi-luce.
   Una correzione costante K (15 km) porta il sorpasso del giorno-luce sull'istante di Horizons: 19 novembre 2026,
   02:17 UT, cioè le 03:17 in Italia e la sera del 18 novembre in California. La Terra è sull'orbita ellittica media. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id); if (!$("voyager")) return;
  const NS = "http://www.w3.org/2000/svg", RAD = Math.PI / 180, UA = 149597870.7, C = 299792.458, GL = C * 86400 / UA;   // un giorno-luce in UA
  const P0 = [-32.27297982113355, -137.5478303570665, 99.51762401924661], V0 = [-1.194816646505571e-3, -7.861270873580961e-3, 5.677905497949306e-3];   // UA e UA/giorno
  const T0 = Date.UTC(2027, 0, 1), K = .000098, J2000 = Date.UTC(2000, 0, 1, 12);
  const LUOGO = { lat: 43.955, lon: 11.386 }, TZ = "Europe/Rome", EPS = 23.4393 * RAD;
  const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const testo = (p, s, a) => { const t = el("text", a, p); t.textContent = s; return t; };
  const n = (v, d = 0) => v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });
  const due = v => String(Math.floor(v)).padStart(2, "0");
  const quando = (t, o) => new Intl.DateTimeFormat("it-IT", Object.assign({ timeZone: TZ }, o)).format(t);

  /* ---------- geometria ---------- */
  function terra(ms) {                                // posizione eliocentrica della Terra, eclittica J2000 (UA)
    const d = (ms - J2000) / 864e5, g = (357.528 + .9856003 * d) * RAD;
    const lam = (280.460 + .9856474 * d + 1.915 * Math.sin(g) + .020 * Math.sin(2 * g) - .0000382 * d) * RAD, r = 1.00014 - .01671 * Math.cos(g) - .00014 * Math.cos(2 * g);
    return [-r * Math.cos(lam), -r * Math.sin(lam), 0];
  }
  const sonda = ms => { const g = (ms - T0) / 864e5; return [P0[0] + V0[0] * g, P0[1] + V0[1] * g, P0[2] + V0[2] * g]; };   // posizione eliocentrica (UA)
  function stato(ms) {
    const E = terra(ms), r = Math.hypot(...sonda(ms)); let x, y, z, d = 173;
    for (let i = 0; i < 3; i++) { const p = sonda(ms - d / GL * 864e5); x = p[0] - E[0]; y = p[1] - E[1]; z = p[2] - E[2]; d = Math.hypot(x, y, z); }   // la sonda dov'era quando è partita la luce
    d += K;
    // eclittiche → equatoriali → altezza e azimut a Borgo San Lorenzo
    const ye = y * Math.cos(EPS) - z * Math.sin(EPS), ze = y * Math.sin(EPS) + z * Math.cos(EPS), ra = Math.atan2(ye, x), dec = Math.asin(ze / d);
    const gg = (ms - J2000) / 864e5, H = (280.46061837 + 360.98564736629 * gg + LUOGO.lon) * RAD - ra, f = LUOGO.lat * RAD;
    const alt = Math.asin(Math.sin(f) * Math.sin(dec) + Math.cos(f) * Math.cos(dec) * Math.cos(H));
    const az = (Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(f) - Math.tan(dec) * Math.cos(f)) / RAD + 180 + 360) % 360;
    return { r, d, km: d * UA, luce: d * UA / C, ra: ((ra / RAD + 360) % 360) / 15, dec: dec / RAD, alt: alt / RAD, az };
  }
  // l'istante in cui la distanza dalla Terra supera per la prima volta un giorno-luce
  const TRAGUARDO = (() => { let a = Date.UTC(2026, 8, 1), b = Date.UTC(2027, 0, 15); for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (stato(m).d < GL) a = m; else b = m; } return b; })();
  const VENTI = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ovest", "ovest", "nord-ovest"];
  const hms = s => due(s / 3600) + ":" + due(s % 3600 / 60) + ":" + due(s % 60);

  /* ---------- contatore ---------- */
  function contatore() {
    const ora = Date.now(), S = stato(ora), dopo = ora >= TRAGUARDO, vel = (stato(ora + 36e5).km - stato(ora - 36e5).km) / 7200;
    $("vy-luce").textContent = hms(S.luce);
    if ($("vy-luce-b")) $("vy-luce-b").textContent = hms(S.luce).replace(/^(\d+):(\d+):(\d+)$/, "$1 h $2 min $3 s");
    $("vy-luce-n").textContent = dopo ? "oltre un giorno-luce: +" + n(S.luce - 86400) + " secondi" : "al giorno-luce mancano " + n(86400 - S.luce) + " secondi";
    $("vy-km").textContent = n(S.km);
    $("vy-ua").textContent = n(S.d, 3) + " UA · " + n(S.r, 2) + " dal Sole";
    $("vy-vel").textContent = (vel >= 0 ? "+" : "−") + n(Math.abs(vel), 1) + " km/s";
    $("vy-vel-n").textContent = vel >= 0 ? "si allontana dalla Terra; dal Sole a 16,9 km/s" : "in questi mesi la Terra le corre dietro più veloce";
    const g = Math.abs(ora - TRAGUARDO) / 864e5, data = quando(TRAGUARDO, { day: "numeric", month: "long", year: "numeric" }) + ", alle " + quando(TRAGUARDO, { hour: "2-digit", minute: "2-digit" }) + " ora italiana";
    $("vy-stato").innerHTML = dopo ? `<b>Traguardo superato.</b> Voyager 1 è a più di un giorno-luce dalla Terra dal ${data} (in California era ancora la sera del 18): ${g < 1 ? "da meno di un giorno" : "da " + n(Math.floor(g)) + (Math.floor(g) === 1 ? " giorno" : " giorni")}. È il primo oggetto costruito dall'uomo ad arrivarci.`
      : `<b>Traguardo in vista.</b> Voyager 1 arriverà a un giorno-luce dalla Terra il ${data} (in California sarà ancora la sera del 18): ${g < 1 ? "fra poche ore" : g < 1.5 ? "domani" : "fra " + n(Math.round(g)) + " giorni"}. Sarà il primo oggetto costruito dall'uomo ad arrivarci.`;
    // il segnale: parte adesso, arriva fra «luce» secondi; la risposta torna dopo altrettanto
    const arr = new Date(ora + S.luce * 1000), rit = new Date(ora + 2 * stato(ora + S.luce * 1000).luce * 1000), f = { weekday: "long", hour: "2-digit", minute: "2-digit" };
    $("vy-segnale").innerHTML = `Un segnale radio inviato <b>adesso</b> da Borgo San Lorenzo, alla velocità della luce, raggiungerebbe Voyager 1 <b>${quando(arr, f)}</b>. La risposta tornerebbe <b>${quando(rit, f)}</b>: quasi due giorni per un «pronto?» e un «sì, ci sono».`;
    return S;
  }
  function dove() {
    const S = stato(Date.now()), su = S.alt > 0, v = VENTI[Math.round(S.az / 45) % 8];
    $("vy-dove").innerHTML = `In questo momento il punto del cielo dove si trova Voyager 1 è <b>${su ? n(S.alt, 0) + "° sopra l'orizzonte, verso " + v : "sotto l'orizzonte (" + n(-S.alt, 0) + "°), in direzione " + v}</b>, visto da Borgo San Lorenzo. È nella costellazione di <b>Ofiuco</b>, poco sopra la testa del Serpentario (ascensione retta ${Math.floor(S.ra)}h ${due((S.ra % 1) * 60)}m, declinazione ${S.dec >= 0 ? "+" : "−"}${n(Math.abs(S.dec), 1)}°). La sonda è grande come un'utilitaria e non riflette quasi nulla: nessun telescopio può vederla, la si ascolta soltanto, con le antenne da 70 metri della rete Deep Space Network.`;
  }

  /* ---------- la scala del Mugello: 1 UA = 100 metri, il Sole in piazza a Borgo ---------- */
  function scala() {
    const S = stato(Date.now()), m = ua => ua * 100, f = v => v < 1000 ? n(v, v < 10 ? 1 : 0) + " m" : n(v / 1000, v < 1e5 ? 1 : 0) + " km";
    const R = [["☀️ Sole", 0, "in piazza Dante, a Borgo San Lorenzo: una palla di 93 centimetri"], ["🌍 Terra", 1, "una biglia di 8 millimetri, a un isolato di distanza"], ["♃ Giove", 5.2, "un'arancia, ancora in paese"], ["♆ Nettuno", 30.07, "appena fuori dall'abitato"],
      ["🛰️ Voyager 1", S.r, "quasi a Firenzuola, che in linea d'aria è a 18,6 km: oltre il crinale", 1], ["✨ Proxima Centauri", 268770, "la stella più vicina: a questa scala è a due terzi del giro del mondo"]];
    $("vy-scala").innerHTML = "<thead><tr><th>Oggetto</th><th>Distanza vera dal Sole</th><th>Nel Mugello in scala</th><th>Dove</th></tr></thead><tbody>" + R.map(r =>
      `<tr${r[3] ? ' class="vy-io"' : ""}><td>${r[0]}</td><td>${r[1] ? n(r[1], r[1] < 100 ? 1 : 0) + " UA" : "–"}</td><td><b>${r[1] ? f(m(r[1])) : "0"}</b></td><td>${r[2]}</td></tr>`).join("") + "</tbody>";
  }

  /* ---------- grafici ---------- */
  const ASSE = "fill:var(--ink-faint);font-family:var(--mono);font-size:10.5px";
  function tela(box, H, et) { box.querySelectorAll("svg").forEach(e => e.remove()); const W = Math.max(280, box.clientWidth || 600); return { svg: el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": et, style: "display:block;max-width:100%;height:auto;overflow:visible" }, box), W, H }; }
  // la scala della luce: quanto impiega la luce ad arrivare fin lì (asse logaritmico)
  function luce() {
    const S = stato(Date.now()), hh = Math.floor(S.luce / 3600), mm = Math.floor(S.luce % 3600 / 60), stretto = ($("vy-luce-g").clientWidth || 600) < 520;
    const L = [["Luna", 1.28, "1,3 secondi", "1,3 s"], ["Sole", 499, "8 minuti e 19 secondi", "8 min"], ["Giove", 2595, "43 minuti in media", "43 min"], ["Nettuno", 15000, "4 ore e 10 minuti", "4 h 10 min"], ["Voyager 1", S.luce, hh + " ore e " + mm + " minuti", hh + " h " + mm + " min", 1], [stretto ? "Proxima Cen." : "Proxima Centauri", 4.2465 * 365.25 * 86400, "4 anni e 3 mesi", "4,2 anni"]];
    const riga = 34, { svg, W, H } = tela($("vy-luce-g"), L.length * riga + 30, "Tempo impiegato dalla luce per raggiungere Luna, Sole, Giove, Nettuno, Voyager 1 e Proxima Centauri"), ml = W < 520 ? 96 : 130, mr = 14, lo = Math.log10(.5), hi = Math.log10(3e8), X = s => ml + (Math.log10(s) - lo) / (hi - lo) * (W - ml - mr);
    [[1, "1 s"], [60, "1 min"], [3600, "1 ora"], [86400, "1 giorno"], [31557600, "1 anno"]].forEach(([s, t]) => { el("line", { x1: X(s), x2: X(s), y1: 4, y2: H - 24, style: "stroke:" + (s === 86400 ? "var(--amber)" : "var(--line)") + ";stroke-width:" + (s === 86400 ? 1.5 : 1) + (s === 86400 ? ";stroke-dasharray:4 3" : "") }, svg); if (!(stretto && s === 3600)) testo(svg, t, { x: X(s), y: H - 8, "text-anchor": "middle", style: ASSE + (s === 86400 ? ";fill:var(--amber);font-weight:600" : "") }); });
    L.forEach((o, i) => { const y = 8 + i * riga;
      testo(svg, o[0], { x: ml - 8, y: y + 15, "text-anchor": "end", style: "fill:var(--ink);font-size:12.5px;font-weight:" + (o[4] ? 700 : 500) });
      el("rect", { x: ml, y: y + 3, width: Math.max(2, X(o[1]) - ml), height: 16, rx: 4, style: "fill:" + (o[4] ? "var(--amber)" : "var(--pine)") + ";opacity:" + (o[4] ? 1 : .55) }, svg);
      const et = stretto ? o[3] : o[2], lung = et.length * 7 + 14, fine = X(o[1]) + lung > W - mr && X(o[1]) - ml > lung; testo(svg, et, { x: X(o[1]) + (fine ? -7 : 7), y: y + 15, "text-anchor": fine ? "end" : "start", style: "font-family:var(--mono);font-size:11px;fill:" + (fine ? "#fff" : "var(--ink-soft)") + ";font-weight:600" }); });
  }
  // la distanza in ore-luce da settembre 2026 a dicembre 2027: la rincorsa annuale della Terra
  function anno() {
    const a = Date.UTC(2026, 8, 1), b = Date.UTC(2027, 11, 31), P = []; for (let t = a; t <= b; t += 864e5) P.push([t, stato(t).luce / 3600]);
    const { svg, W, H } = tela($("vy-anno-g"), 250, "Distanza di Voyager 1 dalla Terra in ore-luce da settembre 2026 a dicembre 2027"), ml = 52, mr = 14, mt = 14, mb = 28, lo = 23.8, hi = 24.6;
    const X = t => ml + (t - a) / (b - a) * (W - ml - mr), Y = v => mt + (hi - v) / (hi - lo) * (H - mt - mb), oreMin = v => Math.floor(v) + "h " + due(Math.round(v % 1 * 60)) + "m";
    for (let v = 23.8; v <= 24.61; v += .2) { el("line", { x1: ml, x2: W - mr, y1: Y(v), y2: Y(v), style: "stroke:var(--line);stroke-width:1" }, svg); testo(svg, oreMin(v + 1e-9), { x: ml - 6, y: Y(v) + 3.5, "text-anchor": "end", style: ASSE }); }
    const MES = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
    for (let y = 2026, m = 8; y < 2028; m++) { if (m > 11) { m = 0; y++; if (y > 2027) break; } const t = Date.UTC(y, m, 1); if (W < 520 && m % 4) continue; el("line", { x1: X(t), x2: X(t), y1: H - mb, y2: H - mb + 4, style: "stroke:var(--ink-faint)" }, svg); testo(svg, MES[m] + (m === 0 || (y === 2026 && m === 8) ? " " + y : ""), { x: X(t), y: H - 9, "text-anchor": "middle", style: ASSE }); }
    el("line", { x1: ml, x2: W - mr, y1: Y(24), y2: Y(24), style: "stroke:var(--amber);stroke-width:1.5;stroke-dasharray:5 4" }, svg); testo(svg, "un giorno-luce", { x: W - mr, y: Y(24) + 14, "text-anchor": "end", style: ASSE + ";fill:var(--amber);font-weight:600" });
    el("path", { d: P.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join(""), style: "fill:none;stroke:var(--pine);stroke-width:2.4;stroke-linejoin:round" }, svg);
    el("circle", { cx: X(TRAGUARDO), cy: Y(24), r: 5.5, style: "fill:var(--amber);stroke:var(--panel);stroke-width:2" }, svg);
    testo(svg, quando(TRAGUARDO, { day: "numeric", month: "short" }), { x: X(TRAGUARDO) + 10, y: Y(24) + 17, style: "fill:var(--ink);font-size:12px;font-weight:700" });
    const ora = Date.now(); if (ora > a && ora < b) { el("line", { x1: X(ora), x2: X(ora), y1: mt, y2: H - mb, style: "stroke:var(--ink);stroke-width:1.2;stroke-dasharray:3 3" }, svg); testo(svg, "oggi", { x: X(ora) + 5, y: mt + 10, style: ASSE + ";fill:var(--ink)" }); }
    // massimo d'inverno e minimo di primavera dopo il traguardo
    const D = P.filter(p => p[0] > TRAGUARDO), gm = { day: "numeric", month: "long" }; let i = 1; while (i < D.length - 1 && D[i + 1][1] >= D[i][1]) i++; const mx = D[i]; while (i < D.length - 1 && D[i + 1][1] <= D[i][1]) i++; const mn = D[i];
    $("vy-anno-t").innerHTML = `La sonda si allontana dal Sole a velocità quasi costante, ma la Terra gira: per metà dell'anno le va incontro e per l'altra metà le sfugge. Così la curva sale a scalini. Dopo il traguardo la distanza cresce fino al <b>${quando(mx[0], gm)}</b> (${oreMin(mx[1])}), poi per tre mesi <b>diminuisce</b>, perché la Terra corre verso la sonda a 30 km/s, più veloce di quanto lei scappi, fino al <b>${quando(mn[0], gm)}</b> (${oreMin(mn[1])}). Il minimo resta comunque sopra le 24 ore: una volta superato, il giorno-luce non si perde più.`;
  }

  function tutto() { scala(); luce(); anno(); dove(); }
  contatore(); tutto(); setInterval(contatore, 1000); setInterval(dove, 60000);
  let tm, lw = window.innerWidth; window.addEventListener("resize", () => { if (window.innerWidth === lw) return; lw = window.innerWidth; clearTimeout(tm); tm = setTimeout(() => { luce(); anno(); }, 180); });
})();
