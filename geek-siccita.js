/* MeteoGeek · siccità e serie secche nel Mugello.
   Indice SPI (Standardized Precipitation Index) e serie di giorni consecutivi senza pioggia,
   calcolati nel browser dalle serie giornaliere del sito. Nessuna libreria: SVG disegnato a mano. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id), NS = "http://www.w3.org/2000/svg", G = 864e5;
  const MES = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const MESL = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const PIOVE = 1;                                    // giorno piovoso: almeno 1 mm
  const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const testo = (p, s, a) => { const t = el("text", a, p); t.textContent = s; return t; };
  const fmt = (v, d = 1) => v == null || !isFinite(v) ? "–" : v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });
  const sg = (v, d = 1) => (v > 0 ? "+" : "") + fmt(v, d);
  const ss = v => v <= -3 ? "−3 o meno" : v >= 3 ? "+3 o più" : sg(v, 2);   // lo SPI è limitato fra −3 e +3
  const dn = (y, m, d) => Date.UTC(y, m, d) / G;
  const dt = k => new Date(k * G);
  const dataIt = (k, anno = true) => { const t = dt(k); return t.getUTCDate() + " " + MESL[t.getUTCMonth()] + (anno ? " " + t.getUTCFullYear() : ""); };
  const dataBr = k => { const t = dt(k); return t.getUTCDate() + " " + MES[t.getUTCMonth()] + " " + t.getUTCFullYear(); };
  const media = a => a.reduce((s, v) => s + v, 0) / a.length;
  const ST_ASSE = "fill:var(--ink-faint);font-family:var(--mono);font-size:10.5px", ST_RIGA = "stroke:var(--line);stroke-width:1";
  const STAZIONI = [{ id: "TOS01000999", nome: "Borgo San Lorenzo", tipo: "sir" }, { id: "firenzuola", nome: "Firenzuola (griglia ARPAE, dal 1961)", breve: "Firenzuola", tipo: "arpae" }];
  let ST = STAZIONI[0], SCALA = 6, S = null; const CACHE = {};

  /* ---------- funzioni statistiche per lo SPI ---------- */
  function lnGamma(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, .1208650973866179e-2, -.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + .5) * Math.log(t); let s = 1.000000000190015; for (let j = 0; j < 6; j++) s += c[j] / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
  // gamma incompleta regolarizzata P(a, x): serie per x piccoli, frazione continua per gli altri
  function gammaP(a, x) {
    if (x <= 0) return 0;
    if (x < a + 1) { let ap = a, s = 1 / a, d = s; for (let n = 0; n < 300; n++) { ap++; d *= x / ap; s += d; if (Math.abs(d) < Math.abs(s) * 1e-12) break; } return s * Math.exp(-x + a * Math.log(x) - lnGamma(a)); }
    let b = x + 1 - a, c = 1e300, d = 1 / b, h = d; for (let i = 1; i < 300; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const de = d * c; h *= de; if (Math.abs(de - 1) < 1e-12) break; }
    return 1 - Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
  }
  // inversa della normale standard (approssimazione razionale di Acklam)
  function invNorm(p) {
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572],
      c = [-.007784894002430293, -.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [.007784695709041462, .3224671290700398, 2.445134137142996, 3.754408661907416];
    if (p < .02425) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - .02425) return -invNorm(1 - p);
    const q = p - .5, r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  // adatta una distribuzione gamma ai totali (metodo di Thom) e restituisce la funzione totale → SPI
  function adatta(V) {
    const pos = V.filter(v => v > 0), n = V.length; if (n < 15 || pos.length < 10) return null;
    const q = (n - pos.length) / n, m = media(pos), A = Math.max(1e-6, Math.log(m) - media(pos.map(Math.log))), alfa = (1 + Math.sqrt(1 + 4 * A / 3)) / (4 * A), beta = m / alfa;
    return x => { const H = x > 0 ? q + (1 - q) * gammaP(alfa, x / beta) : q / 2; return Math.max(-3, Math.min(3, invNorm(Math.max(1e-4, Math.min(1 - 1e-4, H))))); };
  }
  const CLASSI = [[-2, "siccità estrema", "s3"], [-1.5, "siccità severa", "s2"], [-1, "siccità moderata", "s1"], [1, "nella norma", "n"], [1.5, "moderatamente piovoso", "u1"], [2, "molto piovoso", "u2"], [Infinity, "estremamente piovoso", "u3"]];
  const classe = s => CLASSI.find((c, i) => i < 3 ? s <= c[0] : s < c[0]) || CLASSI[6];
  const colore = s => s < 0 ? "var(--warm)" : "var(--cold)", forza = s => { const a = Math.abs(s); return a >= 2 ? 1 : a >= 1.5 ? .82 : a >= 1 ? .62 : .32; };

  /* ---------- dati ---------- */
  async function carica(st) {
    if (CACHE[st.id]) return CACHE[st.id];
    const P = new Map(); let k0 = Infinity, k1 = -Infinity;
    const metti = (iso, s) => { if (s === "" || s == null) return; const v = parseFloat(s); if (!isFinite(v)) return; const k = dn(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)); P.set(k, v); if (k < k0) k0 = k; if (k > k1) k1 = k; };
    if (st.tipo === "arpae") (await (await fetch("data/serie/firenzuola.csv", { cache: "no-cache" })).text()).trim().split("\n").slice(1).forEach(l => { const c = l.split(","); metti(c[0], c[1]); });
    else { const r = await fetch("data/sir/" + st.id + "/prec99.csv", { cache: "no-cache" }); if (!r.ok) throw new Error("HTTP " + r.status); (await r.text()).trim().split("\n").slice(1).forEach(l => { const c = l.split(";"); metti(c[0], c[1]); }); }
    const v = new Float64Array(k1 - k0 + 1).fill(NaN); P.forEach((x, k) => v[k - k0] = x);
    return CACHE[st.id] = prepara({ st, nome: st.breve || st.nome, k0, k1, v });
  }
  function prepara(D) {
    // totali mensili (solo mesi con almeno il 90% dei giorni, riportati al mese intero); il mese in corso resta fuori
    const mesi = {}; for (let i = 0; i < D.v.length; i++) { const t = dt(D.k0 + i), k = t.getUTCFullYear() * 12 + t.getUTCMonth(), o = mesi[k] || (mesi[k] = { s: 0, c: 0 }); if (!isNaN(D.v[i])) { o.s += D.v[i]; o.c++; } }
    const t0 = dt(D.k0), t1 = dt(D.k1 + 1), ka = t0.getUTCFullYear() * 12 + t0.getUTCMonth() + (t0.getUTCDate() > 1 ? 1 : 0), kb = t1.getUTCFullYear() * 12 + t1.getUTCMonth() - 1;
    D.M = []; for (let k = ka; k <= kb; k++) { const y = Math.floor(k / 12), m = k % 12, nd = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), o = mesi[k]; D.M.push({ y, m, tot: o && o.c >= nd * .9 ? o.s / o.c * nd : null }); }
    D.y0 = t0.getUTCFullYear(); D.y1 = dt(D.k1).getUTCFullYear();
    serieSecche(D); D.ora = adesso(D); return D;
  }
  // SPI alla fine di ogni mese sulla scala di k mesi: una distribuzione per ogni mese del calendario
  function spiMensile(D, k) {
    const R = D.M.map((o, i) => { if (i < k - 1) return { y: o.y, m: o.m, tot: null }; let s = 0; for (let j = i - k + 1; j <= i; j++) { if (D.M[j].tot == null) return { y: o.y, m: o.m, tot: null }; s += D.M[j].tot; } return { y: o.y, m: o.m, tot: s }; });
    for (let m = 0; m < 12; m++) { const g = R.filter(o => o.m === m && o.tot != null), f = adatta(g.map(o => o.tot)), md = g.length ? media(g.map(o => o.tot)) : null; g.forEach(o => { o.spi = f ? f(o.tot) : null; o.norma = md; }); }
    return R;
  }
  // pioggia degli ultimi N giorni confrontata con la stessa finestra di tutti gli altri anni
  function adesso(D) {
    const fine = dt(D.k1), m = fine.getUTCMonth(), d = fine.getUTCDate();
    const somma = (k, n) => { let s = 0, c = 0; for (let i = 0; i < n; i++) { const j = k - i - D.k0; if (j < 0) return null; const v = D.v[j]; if (!isNaN(v)) { s += v; c++; } } return c >= n * .95 ? s / c * n : null; };
    const fin = [30, 90, 180, 365].map(n => {
      const A = []; for (let y = D.y0; y <= D.y1; y++) { const k = dn(y, m, Math.min(d, new Date(Date.UTC(y, m + 1, 0)).getUTCDate())), t = somma(k, n); if (t != null) A.push({ y, t }); }
      const io = A.find(o => o.y === D.y1), f = adatta(A.map(o => o.t)); if (!io || !f) return { n, nd: true };
      const altri = A.filter(o => o.y !== D.y1).map(o => o.t), norma = media(A.map(o => o.t));
      return { n, tot: io.t, norma, perc: io.t / norma * 100, spi: f(io.t), posto: 1 + altri.filter(t => t < io.t).length, su: A.length };
    });
    let secchi = 0, i = D.v.length - 1; while (i >= 0 && D.v[i] < PIOVE) { secchi++; i--; }
    return { fin, secchi, ultima: i >= 0 && !isNaN(D.v[i]) ? { k: D.k0 + i, mm: D.v[i] } : null };
  }
  // serie di giorni consecutivi con meno di 1 mm; ogni serie conta per l'anno in cui finisce (convenzione ETCCDI)
  function serieSecche(D) {
    const R = []; let da = -1;
    const chiudi = (a, in_corso) => { if (da < 0) return; const n = a - da + 1; if (n >= 5) R.push({ da: D.k0 + da, a: D.k0 + a, n, y: dt(D.k0 + a).getUTCFullYear(), in_corso }); da = -1; };
    for (let i = 0; i < D.v.length; i++) { if (D.v[i] < PIOVE) { if (da < 0) da = i; } else chiudi(i - 1, false); }
    chiudi(D.v.length - 1, true);
    const pieno = {}; for (let i = 0; i < D.v.length; i++) if (!isNaN(D.v[i])) { const y = dt(D.k0 + i).getUTCFullYear(); pieno[y] = (pieno[y] || 0) + 1; }
    D.secche = R; D.anni = [];
    for (let y = D.y0; y <= D.y1; y++) { if ((pieno[y] || 0) < 329 && y !== D.y1) continue; const g = R.filter(o => o.y === y); if (!g.length) continue; D.anni.push(Object.assign({ parziale: y === D.y1 }, g.reduce((a, b) => a.n >= b.n ? a : b))); }
  }
  // episodi di siccità (McKee): SPI sempre negativo, sceso almeno una volta a −1; finisce quando l'indice torna positivo
  function episodi(R) {
    const E = []; let c = null;
    const chiudi = aperto => { if (c && c.min <= -1) { c.aperto = aperto; E.push(c); } c = null; };
    R.forEach((o, i) => { if (o.spi == null || o.spi >= 0) return chiudi(false); if (!c) c = { da: o, n: 0, min: 0, forza: 0 }; c.n++; c.a = o; c.forza -= o.spi; if (o.spi < c.min) { c.min = o.spi; c.quando = o; } if (i === R.length - 1) chiudi(true); });
    return E;
  }

  /* ---------- grafici ---------- */
  function tela(box, h, etichetta) { box.querySelectorAll("svg").forEach(e => e.remove()); const W = Math.max(280, box.clientWidth || 600), H = typeof h === "function" ? h(W) : h; return { svg: el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": etichetta }, box), W, H }; }
  function suggerimento(box, svg, trova, html) {
    const tip = box.querySelector(".tip"), nascondi = () => { tip.style.opacity = 0; };
    const muovi = e => { const r = svg.getBoundingClientRect(), o = trova(e.clientX - r.left); if (!o) return nascondi(); tip.innerHTML = html(o); tip.style.opacity = 1; const w = tip.offsetWidth; tip.style.left = Math.max(2, Math.min(r.width - w - 2, e.clientX - r.left - w / 2)) + "px"; tip.style.top = "0px"; };
    svg.addEventListener("pointermove", muovi); svg.addEventListener("pointerdown", muovi); svg.addEventListener("pointerleave", nascondi);
  }
  function graficoSpi(R) {
    const box = $("sc-spi"), V = R.filter(o => o.spi != null); if (!V.length) { box.querySelectorAll("svg").forEach(e => e.remove()); return; }
    const { svg, W, H } = tela(box, W => Math.round(Math.min(340, Math.max(240, W * .36))), "Indice SPI a " + SCALA + " mesi, " + S.nome), ml = 34, mr = 8, mt = 34, mb = 26;
    const i0 = R.indexOf(V[0]), n = R.length - i0, X = i => ml + (i - i0) / n * (W - ml - mr), Y = v => mt + (3 - v) / 6 * (H - mt - mb), bw = Math.max(.6, (W - ml - mr) / n);
    [[2, "molto piovoso"], [1, ""], [0, ""], [-1, ""], [-2, "siccità estrema"]].forEach(([v, s]) => { el("line", { x1: ml, x2: W - mr, y1: Y(v), y2: Y(v), style: v === 0 ? "stroke:var(--ink-faint);stroke-width:1" : ST_RIGA + (Math.abs(v) === 1 ? ";stroke-dasharray:3 3" : "") }, svg); testo(svg, sg(v, 0), { x: ml - 6, y: Y(v) + 3.5, "text-anchor": "end", style: ST_ASSE }); if (s) testo(svg, s, { x: W - mr, y: Y(v) + (v > 0 ? -4 : 12), "text-anchor": "end", style: ST_ASSE }); });
    const passo = n / 12 > 45 ? 10 : n / 12 > 18 ? 5 : 2; R.forEach((o, i) => { if (i >= i0 && o.m === 0 && o.y % passo === 0) { el("line", { x1: X(i), x2: X(i), y1: H - mb, y2: H - mb + 4, style: "stroke:var(--ink-faint)" }, svg); testo(svg, o.y, { x: X(i), y: H - 8, "text-anchor": "middle", style: ST_ASSE }); } });
    R.forEach((o, i) => { if (o.spi == null) return; const y0 = Y(0), y1 = Y(o.spi); el("rect", { x: X(i), y: Math.min(y0, y1), width: bw + .3, height: Math.max(.5, Math.abs(y1 - y0)), style: "fill:" + colore(o.spi) + ";opacity:" + forza(o.spi) }, svg); });
    const cur = el("line", { y1: mt, y2: H - mb, style: "stroke:var(--ink);stroke-width:1;opacity:0" }, svg);
    suggerimento(box, svg, x => { const i = Math.floor(i0 + (x - ml) / (W - ml - mr) * n), o = R[i]; if (!o || o.spi == null) { cur.style.opacity = 0; return null; } cur.setAttribute("x1", X(i) + bw / 2); cur.setAttribute("x2", X(i) + bw / 2); cur.style.opacity = .5; return o; },
      o => `<b>${MESL[o.m]} ${o.y}</b> · SPI ${ss(o.spi)} · ${classe(o.spi)[1]}<br><span class="m">${fmt(o.tot, 0)} mm in ${SCALA} ${SCALA === 1 ? "mese" : "mesi"}, norma ${fmt(o.norma, 0)} mm</span>`);
    svg.addEventListener("pointerleave", () => cur.style.opacity = 0);
  }
  function graficoSecche() {
    const box = $("sc-cdd"), A = S.anni; const { svg, W, H } = tela(box, W => Math.round(Math.min(320, Math.max(230, W * .34))), "Serie secca più lunga di ogni anno, " + S.nome), ml = 34, mr = 8, mt = 34, mb = 26;
    const y0 = A[0].y, y1 = A[A.length - 1].y, na = y1 - y0 + 1, hi = Math.ceil(Math.max(...A.map(o => o.n)) / 10) * 10, bw = (W - ml - mr) / na, X = y => ml + (y - y0) * bw, Y = v => mt + (hi - v) / hi * (H - mt - mb);
    for (let v = 0; v <= hi; v += hi > 60 ? 20 : 10) { el("line", { x1: ml, x2: W - mr, y1: Y(v), y2: Y(v), style: ST_RIGA }, svg); testo(svg, v, { x: ml - 6, y: Y(v) + 3.5, "text-anchor": "end", style: ST_ASSE }); }
    testo(svg, "giorni", { x: 2, y: mt - 10, style: ST_ASSE });
    const passo = na > 45 ? 10 : na > 18 ? 5 : 2; for (let y = Math.ceil(y0 / passo) * passo; y <= y1; y += passo) testo(svg, y, { x: X(y) + bw / 2, y: H - 8, "text-anchor": "middle", style: ST_ASSE });
    const rec = A.reduce((a, b) => a.n >= b.n ? a : b);
    A.forEach(o => el("rect", { x: X(o.y) + bw * .12, y: Y(o.n), width: Math.max(1, bw * .76), height: Y(0) - Y(o.n), rx: Math.min(3, bw * .2), style: "fill:" + (o === rec ? "var(--warm)" : "var(--amber)") + ";opacity:" + (o === rec ? 1 : o.parziale ? .4 : .75) }, svg));
    const T = tendenza(A.filter(o => !o.parziale)); if (T) el("line", { x1: X(y0) + bw / 2, x2: X(y1) + bw / 2, y1: Y(T.a + T.b * y0), y2: Y(T.a + T.b * y1), style: "stroke:var(--ink);stroke-width:1.6;stroke-dasharray:6 4" }, svg);
    suggerimento(box, svg, x => A.find(o => o.y === y0 + Math.floor((x - ml) / bw)), o => `<b>${o.y}</b> · ${o.n} giorni senza pioggia<br><span class="m">dal ${dataBr(o.da)} al ${dataBr(o.a)}${o.in_corso ? " (in corso)" : ""}</span>`);
    return { rec, T };
  }
  function tendenza(P) { if (P.length < 10) return null; const mx = media(P.map(o => o.y)), my = media(P.map(o => o.n)); let sxy = 0, sxx = 0; P.forEach(o => { sxy += (o.y - mx) * (o.n - my); sxx += (o.y - mx) ** 2; }); const b = sxy / sxx; return { b, a: my - b * mx }; }

  /* ---------- pagina ---------- */
  const chip = s => { const c = classe(s); return `<span class="cs cs-${c[2]}">${c[1]}</span>`; };
  const PER = { 30: "30 giorni", 90: "3 mesi", 180: "6 mesi", 365: "12 mesi" };
  function mostraAdesso() {
    const o = S.ora, rec = S.secche.reduce((a, b) => a.n >= b.n ? a : b, { n: 0 });
    $("agg").textContent = "dati fino al " + dataIt(S.k1) + " · archivio dal " + dataIt(S.k0);
    $("sc-ora").innerHTML = `<div class="tl"><span class="lab">Giorni dall'ultima pioggia</span><b>${o.secchi}</b><span class="tn">${o.ultima ? "ultima: " + fmt(o.ultima.mm) + " mm il " + dataIt(o.ultima.k, false) : "dato mancante"}<br>record dell'archivio: ${rec.n} giorni</span></div>` +
      o.fin.map(f => f.nd ? `<div class="tl"><span class="lab">Ultimi ${PER[f.n]}</span><b>–</b><span class="tn">dati insufficienti</span></div>` :
        `<div class="tl"><span class="lab">Ultimi ${PER[f.n]}</span><b>${fmt(f.tot, 0)}<small> mm</small></b>${chip(f.spi)}<span class="tn">${fmt(f.perc, 0)}% della norma (${fmt(f.norma, 0)} mm) · SPI ${ss(f.spi)}<br>${f.posto === 1 ? "il più secco" : f.posto === f.su ? "il più piovoso" : f.posto <= f.su / 2 ? f.posto + "º più secco" : (f.su - f.posto + 1) + "º più piovoso"} su ${f.su} anni</span></div>`).join("");
    const peggio = o.fin.filter(f => !f.nd).reduce((a, b) => a.spi <= b.spi ? a : b, { spi: 9 });
    $("sc-frase").innerHTML = peggio.spi === 9 ? "" : peggio.spi <= -1 ? `Sulla finestra degli ultimi ${PER[peggio.n]} a ${S.nome} c'è una <b>${classe(peggio.spi)[1]}</b>: sono caduti ${fmt(peggio.tot, 0)} mm contro una norma di ${fmt(peggio.norma, 0)}.` :
      `In questo momento a ${S.nome} <b>non c'è siccità</b> su nessuna delle quattro finestre: l'indice più basso è ${ss(peggio.spi)} (ultimi ${PER[peggio.n]}).`;
  }
  function mostraSpi() {
    const R = spiMensile(S, SCALA), V = R.filter(o => o.spi != null); graficoSpi(R);
    const E = episodi(R).sort((a, b) => b.forza - a.forza), mm = o => MES[o.m] + " " + o.y, inizio = o => { let k = o.y * 12 + o.m - SCALA + 1; return MES[((k % 12) + 12) % 12] + " " + Math.floor(k / 12); };
    $("sc-spi-info").textContent = V.length ? "SPI a " + SCALA + (SCALA === 1 ? " mese" : " mesi") + " · " + mm(V[0]) + " – " + mm(V[V.length - 1]) + " · ogni barra è la fine di un mese" : "Serie troppo corta per questa scala.";
    $("sc-ep-tit").textContent = "Le siccità più pesanti a " + S.nome + " · scala " + SCALA + (SCALA === 1 ? " mese" : " mesi");
    $("sc-ep").innerHTML = E.length ? "<tr><th>#</th><th>PERIODO</th><th>DURATA</th><th>SPI MINIMO</th><th class=\"sc-n\">PIOGGIA NEL MESE PEGGIORE</th></tr>" + E.slice(0, 10).map((e, i) =>
      `<tr><td>${i + 1}</td><td>${mm(e.da)} – ${e.aperto ? "<b>in corso</b>" : mm(e.a)}</td><td>${e.n} ${e.n === 1 ? "mese" : "mesi"}</td><td><b>${ss(e.min)}</b> <span class="m">${mm(e.quando)}</span></td><td class="sc-n">${fmt(e.quando.tot, 0)} mm in ${SCALA} ${SCALA === 1 ? "mese" : "mesi"} (norma ${fmt(e.quando.norma, 0)})</td></tr>`).join("") : "<tr><td>Nessun episodio su questa scala.</td></tr>";
    const sec = V.filter(o => o.spi <= -1).length, met = Math.floor(V.length / 2), q = a => a.filter(o => o.spi <= -1).length / a.length * 100;
    $("sc-spi-testo").innerHTML = !V.length ? "" : `Su ${V.length} mesi l'indice è stato a −1 o meno, cioè in siccità almeno moderata, in <b>${sec}</b> (${fmt(sec / V.length * 100, 0)}%; per costruzione ci si aspetta circa il 16%). Nella prima metà della serie i mesi in siccità sono stati il ${fmt(q(V.slice(0, met)), 0)}%, nella seconda il ${fmt(q(V.slice(met)), 0)}%. ` +
      (E.length ? `L'episodio più pesante ${E[0].aperto ? "è quello in corso, cominciato a " + MESL[E[0].da.m] + " " + E[0].da.y : "è quello fra " + MESL[E[0].da.m] + " " + E[0].da.y + " e " + MESL[E[0].a.m] + " " + E[0].a.y}: ${E[0].n} mesi di fila sotto zero, con il minimo di ${ss(E[0].min)} a ${MESL[E[0].quando.m]} ${E[0].quando.y}, quando nei ${SCALA === 1 ? "30 giorni" : SCALA + " mesi"} precedenti erano caduti ${fmt(E[0].quando.tot, 0)} mm invece di ${fmt(E[0].quando.norma, 0)}.` : "");
  }
  function mostraSecche() {
    const { rec, T } = graficoSecche(), A = S.anni.filter(o => !o.parziale), n10 = Math.min(10, Math.floor(A.length / 2)), pr = A.slice(0, n10), ul = A.slice(-n10);
    const estive = S.secche.filter(o => { const m = dt(o.da + Math.floor(o.n / 2)).getUTCMonth(); return m >= 5 && m <= 8; }), top = S.secche.slice().sort((a, b) => b.n - a.n || a.da - b.da).slice(0, 10);
    $("sc-cdd-kpi").innerHTML = `<div>Record<b>${rec.n} giorni</b><span>${dataBr(rec.da)} – ${dataBr(rec.a)}</span></div><div>Media della più lunga dell'anno<b>${fmt(media(A.map(o => o.n)), 0)} giorni</b><span>${A.length} anni completi</span></div>` +
      `<div>Primi ${n10} anni → ultimi ${n10}<b>${fmt(media(pr.map(o => o.n)), 0)} → ${fmt(media(ul.map(o => o.n)), 0)} giorni</b><span>${pr[0].y}–${pr[n10 - 1].y} e ${ul[0].y}–${ul[n10 - 1].y}</span></div><div>Tendenza<b>${T ? sg(T.b * 10) + " giorni/decennio" : "–"}</b><span>retta dei minimi quadrati</span></div>`;
    $("sc-cdd-info").textContent = "Ogni barra è la serie più lunga di giorni consecutivi sotto 1 mm finita in quell'anno · in rosso il record · tratteggio = tendenza lineare" + (S.anni.some(o => o.parziale) ? " · barra chiara: anno in corso" : "");
    $("sc-top").innerHTML = "<tr><th>#</th><th>DAL</th><th>AL</th><th>GIORNI</th></tr>" + top.map((o, i) => `<tr><td>${i + 1}</td><td>${dataBr(o.da)}</td><td>${o.in_corso ? "<b>in corso</b>" : dataBr(o.a)}</td><td><b>${o.n}</b></td></tr>`).join("");
    const inTop = top.filter(o => estive.includes(o)).length;
    $("sc-cdd-testo").innerHTML = `Delle dieci serie secche più lunghe di ${S.nome}, <b>${inTop}</b> cadono in estate (centro della serie fra giugno e settembre)${inTop < 10 ? ": le altre sono siccità invernali o primaverili, meno frequenti ma capaci di durare altrettanto" : ""}. ` +
      (T ? `La serie più lunga dell'anno ${Math.abs(T.b * 10) < 1 ? "non mostra una tendenza apprezzabile" : (T.b > 0 ? "si è allungata" : "si è accorciata") + " in media di " + fmt(Math.abs(T.b * 10)) + " giorni ogni dieci anni"}, ma varia molto da un anno all'altro (da ${Math.min(...A.map(o => o.n))} a ${Math.max(...A.map(o => o.n))} giorni), quindi la retta va letta con prudenza.` : "");
  }
  async function mostra() {
    try { S = await carica(ST); } catch (e) { console.error(e); $("sc-frase").textContent = "Dati non disponibili per questa stazione."; return; }
    document.querySelectorAll(".loading").forEach(e => e.remove()); mostraAdesso(); mostraSpi(); mostraSecche();
  }
  // elenco delle stazioni: i pluviometri del Mugello con una serie che arriva a oggi e parte entro il 1995
  async function stazioni() {
    try { const d = await (await fetch("data/sir/mugello.json")).json(), anno = new Date().getFullYear();
      d.stazioni.filter(s => s.pioggia && +s.pioggia.dal <= 1995 && +s.pioggia.al >= anno - 1 && s.id !== "TOS01000999").sort((a, b) => a.nome.localeCompare(b.nome)).forEach(s => STAZIONI.push({ id: s.id, nome: s.nome + (s.quota ? " (" + Math.round(s.quota) + " m)" : ""), breve: s.nome, tipo: "sir" }));
    } catch (e) { console.error(e); }
    const sel = $("sc-st"); sel.innerHTML = STAZIONI.map((s, i) => `<option value="${i}">${s.nome}</option>`).join("");
    sel.addEventListener("change", () => { ST = STAZIONI[+sel.value]; mostra(); });
  }
  document.querySelectorAll("#sc-scala button").forEach(b => b.addEventListener("click", () => { SCALA = +b.dataset.k; document.querySelectorAll("#sc-scala button").forEach(x => x.setAttribute("aria-pressed", x === b)); if (S) mostraSpi(); }));
  let tm, lw = window.innerWidth; window.addEventListener("resize", () => { if (window.innerWidth === lw) return; lw = window.innerWidth; clearTimeout(tm); tm = setTimeout(() => { if (S) { graficoSpi(spiMensile(S, SCALA)); graficoSecche(); } }, 180); });
  stazioni(); mostra();
})();
