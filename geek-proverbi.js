/* MeteoGeek · i proverbi del tempo alla prova dei dati, Borgo San Lorenzo e Firenzuola.
   Tutto si calcola nel browser dai file del sito (nessuna libreria, SVG disegnato a mano):
   ogni proverbio ha la sua prova, i suoi numeri e un verdetto che si aggiorna con i dati. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id), NS = "http://www.w3.org/2000/svg", MISS = -32768, G = 864e5;
  const MES = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const MESL = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], NG = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const PIOVE = 1;                                   // giorno piovoso: almeno 1 mm
  const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const testo = (p, s, a) => { const t = el("text", a, p); t.textContent = s; return t; };
  const fmt = (v, d = 1) => v == null || !isFinite(v) ? "–" : v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });
  const sg = (v, d = 1) => (v > 0 ? "+" : "") + fmt(v, d);
  const pc = v => fmt(v, 0) + "%";
  // percentuale con l'articolo giusto: «il 39%», «l'8%», «lo 0,5%» (b = "il", "del", "nel")
  const ap = (b, v, d = 0) => { const n = Math.round(v), z = d > 0 || n === 0, e = !z && (n === 8 || n === 11 || (n >= 80 && n < 90)), A = { il: ["il ", "l'", "lo "], del: ["del ", "dell'", "dello "], nel: ["nel ", "nell'", "nello "] }[b]; return A[z ? 2 : e ? 1 : 0] + fmt(v, d) + "%"; };
  const dn = (y, m, d) => Date.UTC(y, m, d) / G;      // numero del giorno
  const doy = (m, d) => CUM[m] + Math.min(d, NG[m]) - 1;                 // 0..364, il 29 febbraio vale come il 28
  const giorno = x => { x = ((Math.round(x) % 365) + 365) % 365; let m = 11; while (CUM[m] > x) m--; return { m, d: x - CUM[m] + 1 }; };
  const dataIt = x => { const o = giorno(x); return o.d + " " + MESL[o.m]; };
  const dist = (a, b) => { const d = Math.abs(a - b) % 365; return Math.min(d, 365 - d); };
  const media = a => a.reduce((s, v) => s + v, 0) / a.length;
  let ST = "borgo", DATI = {}, DISEGNI = [];

  /* ---------- dati ---------- */
  async function borgo() {
    const [D, txt] = await Promise.all([
      fetch("data/borgo-serie-lunghe.json", { cache: "no-cache" }).then(r => r.json()),
      fetch("data/sir/TOS01000999/prec99.csv", { cache: "no-cache" }).then(r => r.text())]);
    const T = new Map(), P = new Map(), t0 = dn(D.y0, 0, 1);
    for (let i = 0; i < D.n; i++) {
      let x = D.tmax1[i], n = D.tmin1[i];
      if (x === MISS || n === MISS || x == null || n == null) {          // lacuna: seconda stazione corretta per scarto mensile
        const j = i - D.a0; if (j < 0 || j >= D.tmax2.length || D.tmax2[j] === MISS || D.tmin2[j] === MISS) continue;
        const m = new Date((t0 + i) * G).getUTCMonth(); x = D.tmax2[j] - D.off.tmax[m] * 10; n = D.tmin2[j] - D.off.tmin[m] * 10;
      }
      if (x < n) continue;
      T.set(t0 + i, [x / 10, n / 10]);
    }
    txt.trim().split("\n").slice(1).forEach(l => { const c = l.split(";"); if (c[1] === "" || c[1] == null) return; const v = parseFloat(c[1]); if (isFinite(v)) P.set(dn(+c[0].slice(0, 4), +c[0].slice(5, 7) - 1, +c[0].slice(8, 10)), v); });
    return { nome: "Borgo San Lorenzo", T, P, ultimo: D.last, fonteT: "dal 1951", fonteP: "dal 1992" };
  }
  async function firenzuola() {
    const txt = await fetch("data/serie/firenzuola.csv", { cache: "no-cache" }).then(r => r.text()), T = new Map(), P = new Map(); let ultimo = "";
    txt.trim().split("\n").slice(1).forEach(l => {
      const c = l.split(","), k = dn(+c[0].slice(0, 4), +c[0].slice(5, 7) - 1, +c[0].slice(8, 10)), p = parseFloat(c[1]), x = parseFloat(c[2]), n = parseFloat(c[3]);
      if (c[1] !== "" && isFinite(p)) P.set(k, p);
      if (c[2] !== "" && c[3] !== "" && isFinite(x) && isFinite(n) && x >= n) T.set(k, [x, n]);
      ultimo = c[0];
    });
    return { nome: "Firenzuola", T, P, ultimo, fonteT: "dal 1961", fonteP: "dal 1961" };
  }
  function prepara(S) {
    const anni = k => new Date(k * G).getUTCFullYear(), kt = [...S.T.keys()], kp = [...S.P.keys()];
    S.y0 = anni(Math.min(...kt)); S.y1 = anni(Math.max(...kt)); S.p0 = anni(Math.min(...kp));
    S.cl = {}; ["tx", "tn", "tm"].forEach(k => S.cl[k] = clima(S, k));
  }
  const val = (S, k, y, m, d) => { const r = S.T.get(dn(y, m, d)); return r ? (k === "tx" ? r[0] : k === "tn" ? r[1] : (r[0] + r[1]) / 2) : null; };
  // scarto dalla curva stagionale liscia
  const sc = (S, k, y, m, d) => { const v = val(S, k, y, m, d); if (v == null) return null; const t = new Date(Date.UTC(y, m, d)); return v - S.cl[k].liscia[doy(t.getUTCMonth(), t.getUTCDate())]; };
  // media di una grandezza su n giorni consecutivi dal giorno indicato (null se i dati sono meno della quota richiesta)
  function finestra(S, f, y, m, d, n, quota = .9) { let s = 0, c = 0; for (let i = 0; i < n; i++) { const v = f(S, y, m, d + i); if (v != null) { s += v; c++; } } return c >= Math.max(1, Math.ceil(n * quota)) ? s / c : null; }
  const piove = (S, y, m, d) => { const v = S.P.get(dn(y, m, d)); return v == null ? null : (v >= PIOVE ? 1 : 0); };

  /* climatologia giornaliera: media grezza di ogni giorno dell'anno e curva liscia (media + 3 armoniche) */
  function clima(S, k) {
    const s = new Float64Array(365), c = new Float64Array(365), raw = new Float64Array(365), liscia = new Float64Array(365);
    S.T.forEach((r, key) => { const t = new Date(key * G), m = t.getUTCMonth(), d = t.getUTCDate(); if (m === 1 && d === 29) return; const i = doy(m, d); s[i] += k === "tx" ? r[0] : k === "tn" ? r[1] : (r[0] + r[1]) / 2; c[i]++; });
    for (let i = 0; i < 365; i++) raw[i] = s[i] / c[i];
    const a0 = media(Array.from(raw)), co = [];
    for (let h = 1; h <= 3; h++) { let a = 0, b = 0; for (let i = 0; i < 365; i++) { const w = 2 * Math.PI * h * i / 365; a += raw[i] * Math.cos(w); b += raw[i] * Math.sin(w); } co.push([a * 2 / 365, b * 2 / 365]); }
    for (let i = 0; i < 365; i++) { let v = a0; co.forEach(([a, b], h) => { const w = 2 * Math.PI * (h + 1) * i / 365; v += a * Math.cos(w) + b * Math.sin(w); }); liscia[i] = v; }
    let imax = 0, imin = 0; for (let i = 1; i < 365; i++) { if (liscia[i] > liscia[imax]) imax = i; if (liscia[i] < liscia[imin]) imin = i; }
    return { raw, liscia, imax, imin };
  }
  const mod = i => ((i % 365) + 365) % 365;
  // scarto medio grezzo − liscio di una finestra del calendario e posto che occupa fra tutte le finestre uguali dell'anno
  function segnale(C, x0, n) {
    const w = s => { let a = 0; for (let i = 0; i < n; i++) a += C.raw[mod(s + i)] - C.liscia[mod(s + i)]; return a / n; };
    const v = w(x0); let sotto = 0; for (let s = 0; s < 365; s++) if (w(s) < v) sotto++;
    return { v, pct: sotto / 365 * 100, med: (() => { let a = 0; for (let i = 0; i < n; i++) a += C.raw[mod(x0 + i)]; return a / n; })() };
  }

  /* ---------- statistica ---------- */
  function casuale(seme) { let a = seme >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function mescola(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // toglie la tendenza lineare nel tempo a una lista di {y, v}
  function senzaTendenza(P, campo = "v") {
    const n = P.length; if (n < 3) return P;
    const mx = media(P.map(o => o.y)), my = media(P.map(o => o[campo])); let sxy = 0, sxx = 0;
    P.forEach(o => { sxy += (o.y - mx) * (o[campo] - my); sxx += (o.y - mx) ** 2; }); const b = sxx ? sxy / sxx : 0;
    P.forEach(o => o[campo] = o[campo] - my - b * (o.y - mx)); return P;
  }
  // differenza fra le medie di due gruppi e probabilità di ottenerla per caso (test di permutazione a due code)
  function confronto(A, B) {
    if (A.length < 5 || B.length < 5) return null;
    const d = media(A) - media(B), tutti = A.concat(B), rnd = casuale(20261114), N = 5000; let k = 0;
    for (let i = 0; i < N; i++) { mescola(tutti, rnd); let s = 0; for (let j = 0; j < A.length; j++) s += tutti[j]; const ma = s / A.length; let t = 0; for (let j = A.length; j < tutti.length; j++) t += tutti[j]; if (Math.abs(ma - t / B.length) >= Math.abs(d) - 1e-12) k++; }
    return { d, p: (k + 1) / (N + 1), ma: media(A), mb: media(B) };
  }
  function correlazione(P) {
    if (P.length < 12) return null;
    const r = (X, Y) => { const mx = media(X), my = media(Y); let a = 0, b = 0, c = 0; for (let i = 0; i < X.length; i++) { a += (X[i] - mx) * (Y[i] - my); b += (X[i] - mx) ** 2; c += (Y[i] - my) ** 2; } return a / Math.sqrt(b * c); };
    const X = P.map(o => o.x), Y = P.map(o => o.v), r0 = r(X, Y), rnd = casuale(20261114), N = 5000, Z = Y.slice(); let k = 0;
    for (let i = 0; i < N; i++) { mescola(Z, rnd); if (Math.abs(r(X, Z)) >= Math.abs(r0) - 1e-12) k++; }
    const mx = media(X), my = media(Y); let sxy = 0, sxx = 0; for (let i = 0; i < X.length; i++) { sxy += (X[i] - mx) * (Y[i] - my); sxx += (X[i] - mx) ** 2; }
    return { r: r0, p: (k + 1) / (N + 1), b: sxy / sxx, a: my - sxy / sxx * mx, n: P.length };
  }
  const prob = p => p < .001 ? "in meno dello 0,1% dei casi" : (p < .01 ? ap("nel", p * 100, 1) : ap("nel", p * 100)) + " dei casi";
  function pasqua(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), q = h + l - 7 * m + 114; return [Math.floor(q / 31) - 1, q % 31 + 1]; }

  /* ---------- grafici ---------- */
  function passi(lo, hi, n = 4) { const r = (hi - lo) / n || 1, e = Math.pow(10, Math.floor(Math.log10(r))), f = r / e, st = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e, o = []; for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + 1e-9; v += st) o.push(Math.abs(v) < 1e-9 ? 0 : v); return { o, dec: st < 1 ? 1 : 0 }; }
  function tela(box, h, etichetta) { box.querySelectorAll("svg").forEach(e => e.remove()); const W = Math.max(280, Math.min(760, box.clientWidth || 600)), H = typeof h === "function" ? h(W) : h; return { svg: el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": etichetta }, box), W, H }; }
  const ST_ASSE = "fill:var(--ink-faint);font-family:var(--mono);font-size:10.5px", ST_RIGA = "stroke:var(--line);stroke-width:1";

  // andamento nel calendario: punti = media grezza di ogni giorno, linea = curva liscia, fascia = i giorni del proverbio
  function curva(box, o) {
    const { svg, W, H } = tela(box, W => Math.round(Math.min(280, Math.max(210, W * .42))), o.etichetta), ml = 44, mr = 12, mt = 16, mb = 28;
    const xs = []; for (let i = 0; i < o.n; i++) xs.push(o.da + i);
    const vs = []; xs.forEach(x => { const a = o.punti && o.punti(x), b = o.linea && o.linea(x); if (a != null) vs.push(a); if (b != null) vs.push(b); });
    let lo = Math.min(...vs), hi = Math.max(...vs); const pad = (hi - lo) * .08 || 1; lo -= pad; hi += pad;
    const X = x => ml + (x - o.da) / (o.n - 1) * (W - ml - mr), Y = v => mt + (hi - v) / (hi - lo) * (H - mt - mb), tk = passi(lo, hi), fy = o.fy || (v => fmt(v, tk.dec));
    tk.o.forEach(v => { el("line", { x1: ml, x2: W - mr, y1: Y(v), y2: Y(v), style: ST_RIGA }, svg); testo(svg, fy(v), { x: ml - 6, y: Y(v) + 3.5, "text-anchor": "end", style: ST_ASSE }); });
    testo(svg, o.unita, { x: 4, y: 10, style: ST_ASSE });
    (o.bande || []).forEach(b => el("rect", { x: X(b[0] - .5), y: mt, width: X(b[1] + .5) - X(b[0] - .5), height: H - mt - mb, style: "fill:var(--amber);opacity:.2" }, svg));
    const fitti = o.n <= 80; xs.forEach(x => { const g = giorno(x); if (g.d === 1 || (fitti && g.d === 15)) { el("line", { x1: X(x), x2: X(x), y1: H - mb, y2: H - mb + 4, style: "stroke:var(--ink-faint)" }, svg); testo(svg, fitti ? g.d + " " + MES[g.m] : MES[g.m], { x: X(x), y: H - 9, "text-anchor": "middle", style: ST_ASSE }); } });
    if (o.linea) el("path", { d: xs.map((x, i) => (i ? "L" : "M") + X(x).toFixed(1) + " " + Y(o.linea(x)).toFixed(1)).join(""), style: "fill:none;stroke:var(--ink-soft);stroke-width:1.6" }, svg);
    if (o.punti) xs.forEach(x => { const v = o.punti(x); if (v == null) return; const dentro = (o.bande || []).some(b => x >= b[0] && x <= b[1]);
      const c = el("circle", { cx: X(x), cy: Y(v), r: dentro ? 4.2 : (o.n > 200 ? 1.5 : 2.8), style: dentro ? "fill:var(--amber);stroke:var(--panel);stroke-width:1" : "fill:var(--pine);opacity:.75" }, svg);
      el("title", {}, c).textContent = dataIt(x) + ": " + fy(v) + (o.unitaT || "") + (o.linea ? " (curva liscia " + fy(o.linea(x)) + ")" : ""); });
    (o.marchi || []).forEach(k => { el("line", { x1: X(k.x), x2: X(k.x), y1: mt, y2: H - mb, style: "stroke:" + (k.colore || "var(--warm)") + ";stroke-width:1.5;stroke-dasharray:4 3" }, svg);
      const a = X(k.x) > W - 110 ? "end" : "start"; testo(svg, k.testo, { x: X(k.x) + (a === "end" ? -5 : 5), y: (k.basso ? H - mb - 6 : mt + 10), "text-anchor": a, style: "fill:var(--ink-soft);font-family:var(--mono);font-size:10.5px;font-weight:600" }); });
  }

  // due (o più) gruppi di anni a confronto: un punto per anno, tacca verticale = media del gruppo
  function gruppi(box, o) {
    const riga = 74, ml = 12, mr = 12, mt = 8, mb = 30, { svg, W, H } = tela(box, mt + mb + riga * o.g.length, o.etichetta);
    const vs = [].concat(...o.g.map(g => g.pts.map(p => p.v))); let lo = Math.min(...vs), hi = Math.max(...vs); const pad = (hi - lo) * .06 || 1; lo -= pad; hi += pad;
    const X = v => ml + (v - lo) / (hi - lo) * (W - ml - mr), tk = passi(lo, hi, 5);
    tk.o.forEach(v => { el("line", { x1: X(v), x2: X(v), y1: mt, y2: H - mb, style: ST_RIGA }, svg); testo(svg, fmt(v, tk.dec), { x: X(v), y: H - 14, "text-anchor": "middle", style: ST_ASSE }); });
    testo(svg, o.unita, { x: W - mr, y: H - 2, "text-anchor": "end", style: ST_ASSE });
    o.g.forEach((g, i) => {
      const cy = mt + riga * i + riga / 2 + 8, r = 4, messi = [];
      testo(svg, g.nome + " · " + g.pts.length + " anni", { x: ml, y: mt + riga * i + 12, style: "fill:var(--ink-soft);font-size:12px;font-weight:600" });
      g.pts.slice().sort((a, b) => a.v - b.v).forEach(p => { const x = X(p.v); let off = 0;
        for (let k = 0; k < 14; k++) { off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (r * 1.9); if (!messi.some(q => (q[0] - x) ** 2 + (q[1] - off) ** 2 < (r * 2) ** 2)) break; }
        messi.push([x, off]); const c = el("circle", { cx: x, cy: cy + off, r, style: "fill:" + g.colore + ";opacity:.8" }, svg); el("title", {}, c).textContent = p.y + ": " + fmt(p.v, o.dec == null ? 1 : o.dec) + " " + o.unitaT; });
      const m = media(g.pts.map(p => p.v)); el("line", { x1: X(m), x2: X(m), y1: cy - 24, y2: cy + 24, style: "stroke:var(--ink);stroke-width:2.5" }, svg);
      testo(svg, "media " + fmt(m, 1), { x: X(m) + (X(m) > W - 90 ? -6 : 6), y: cy - 16, "text-anchor": X(m) > W - 90 ? "end" : "start", style: "fill:var(--ink);font-family:var(--mono);font-size:10.5px;font-weight:600" });
    });
  }

  // un punto per anno: in orizzontale la «causa» del proverbio, in verticale l'«effetto»; retta = minimi quadrati
  function dispersione(box, o) {
    const { svg, W, H } = tela(box, W => Math.round(Math.min(320, Math.max(240, W * .5))), o.etichetta), ml = 44, mr = 14, mt = 16, mb = 40;
    const ax = k => { const v = o.pts.map(p => p[k]); let lo = Math.min(...v), hi = Math.max(...v); const pad = (hi - lo) * .07 || 1; return [lo - pad, hi + pad]; };
    const [x0, x1] = ax("x"), [y0, y1] = ax("v"), X = v => ml + (v - x0) / (x1 - x0) * (W - ml - mr), Y = v => mt + (y1 - v) / (y1 - y0) * (H - mt - mb);
    const tx = passi(x0, x1, 5), ty = passi(y0, y1, 4);
    tx.o.forEach(v => { el("line", { x1: X(v), x2: X(v), y1: mt, y2: H - mb, style: v === 0 ? "stroke:var(--ink-faint);stroke-width:1" : ST_RIGA }, svg); testo(svg, sg(v, tx.dec), { x: X(v), y: H - mb + 14, "text-anchor": "middle", style: ST_ASSE }); });
    ty.o.forEach(v => { el("line", { x1: ml, x2: W - mr, y1: Y(v), y2: Y(v), style: v === 0 ? "stroke:var(--ink-faint);stroke-width:1" : ST_RIGA }, svg); testo(svg, sg(v, ty.dec), { x: ml - 6, y: Y(v) + 3.5, "text-anchor": "end", style: ST_ASSE }); });
    testo(svg, o.xl, { x: (ml + W - mr) / 2, y: H - 6, "text-anchor": "middle", style: ST_ASSE }); testo(svg, o.yl, { x: 4, y: 10, style: ST_ASSE });
    if (o.retta) el("line", { x1: X(x0), x2: X(x1), y1: Y(o.retta.a + o.retta.b * x0), y2: Y(o.retta.a + o.retta.b * x1), style: "stroke:var(--warm);stroke-width:2;stroke-dasharray:6 4" }, svg);
    o.pts.forEach(p => { const c = el("circle", { cx: X(p.x), cy: Y(p.v), r: 4, style: "fill:var(--pine);opacity:.8" }, svg); el("title", {}, c).textContent = p.et + ": " + sg(p.x) + " → " + sg(p.v) + " °C"; });
  }

  // dodici barre, una per mese, con il mese del proverbio in evidenza
  function barre(box, o) {
    const { svg, W, H } = tela(box, 200, o.etichetta), ml = 8, mr = 8, mt = 30, mb = 24, hi = Math.max(...o.v) * 1.02, bw = (W - ml - mr) / 12;
    testo(svg, o.titolo, { x: ml, y: 11, style: "fill:var(--ink-soft);font-size:12px;font-weight:600" });
    o.v.forEach((v, m) => { const h = v / hi * (H - mt - mb), x = ml + bw * m + bw * .14, su = m === o.mese;
      el("rect", { x, y: H - mb - h, width: bw * .72, height: h, rx: 3, style: "fill:" + (su ? "var(--amber)" : "var(--pine)") + ";opacity:" + (su ? 1 : .55) }, svg);
      testo(svg, fmt(v, o.dec), { x: x + bw * .36, y: H - mb - h - 4, "text-anchor": "middle", style: "fill:var(--ink" + (su ? "" : "-faint") + ");font-family:var(--mono);font-size:" + (W < 420 ? 8.5 : 10.5) + "px;font-weight:" + (su ? 700 : 500) });
      testo(svg, MES[m], { x: x + bw * .36, y: H - 8, "text-anchor": "middle", style: ST_ASSE + (su ? ";fill:var(--ink);font-weight:700" : "") }); });
  }

  /* ---------- i proverbi ---------- */
  const V = { vero: "Vero", parte: "In parte", falso: "Falso", nd: "Dati insufficienti" };
  const posto = (v, i, alto = true) => 1 + v.filter(x => alto ? x > v[i] : x < v[i]).length;
  const ord = n => n + "º", orf = n => n + "ª", ilo = n => (n === 8 || n === 11 || (n >= 80 && n < 90) ? "l'" : "il ") + n + "º", gg = n => n + (n === 1 ? " giorno" : " giorni");
  const anni = S => { const o = []; for (let y = S.y0; y <= S.y1; y++) o.push(y); return o; };
  const leg = (a, b, c) => `<span class="lg"><i class="pt"></i>${a}</span><span class="lg"><i class="ln"></i>${b}</span>` + (c ? `<span class="lg"><i class="bd"></i>${c}</span>` : "");

  const PROVERBI = [
    { id: "sant-antonio", quando: "17 gennaio e 10 agosto · Sant'Antonio e San Lorenzo", detto: "San Lorenzo la gran calura, Sant'Antonio la gran freddura: l'una e l'altra poco dura.",
      prova: "Il colmo del caldo cade davvero intorno al 10 agosto e quello del freddo intorno al 17 gennaio? Cerco il giorno più caldo e il più freddo della curva stagionale.",
      fai(S) {
        const cx = S.cl.tx, cn = S.cl.tn, a = doy(7, 10), b = doy(0, 17), dx = dist(cx.imax, a), dm = dist(cn.imin, b), ok = (dx <= 7) + (dm <= 7);
        const piatto = (C, s) => { const e = s > 0 ? C.liscia[C.imax] : C.liscia[C.imin]; let k = 0; for (let i = 0; i < 365; i++) if (Math.abs(C.liscia[i] - e) <= .5) k++; return k; };
        const px = posto(Array.from(cx.raw), a), pn = posto(Array.from(cn.raw), b, false);
        return { v: ok === 2 ? "vero" : ok === 1 ? "parte" : "falso", riga: "Colmo del caldo il " + dataIt(cx.imax) + ", del freddo il " + dataIt(cn.imin),
          ris: `Nella curva stagionale di ${S.nome} la massima tocca il suo colmo il <b>${dataIt(cx.imax)}</b> (${fmt(cx.liscia[cx.imax])} °C), ${dx === 0 ? "proprio il giorno di San Lorenzo" : gg(dx) + " " + (mod(cx.imax - a) < 180 ? "dopo" : "prima di") + " San Lorenzo"}; la minima tocca il fondo il <b>${dataIt(cn.imin)}</b> (${fmt(cn.liscia[cn.imin])} °C), ${dm === 0 ? "proprio il giorno di Sant'Antonio" : gg(dm) + " " + (mod(cn.imin - b) < 180 ? "dopo" : "prima di") + " Sant'Antonio"}. Guardando le medie grezze, giorno per giorno, il 10 agosto è ${ilo(px)} giorno più caldo dell'anno per la massima e il 17 gennaio ${ilo(pn)} più freddo per la minima. ${ok === 2 ? "Il proverbio indica bene tutti e due i colmi." : ok === 1 ? "Uno dei due santi cade nella settimana giusta, l'altro no." : "Tutti e due i santi cadono a più di una settimana dal colmo."} Quanto a «poco dura»: intorno ai colmi la curva è quasi piatta, e resta entro mezzo grado dal massimo per ${piatto(cx, 1)} giorni e dal minimo per ${piatto(cn, -1)}: la gran calura e la gran freddura non sono poi così brevi.`,
          disegna(box) { curva(box, { da: 0, n: 365, unita: "°C", unitaT: " °C", etichetta: "Massima e minima media di ogni giorno dell'anno a " + S.nome, punti: x => cx.raw[mod(x)], linea: x => cx.liscia[mod(x)], marchi: [{ x: a, testo: "San Lorenzo" }, { x: b, testo: "Sant'Antonio", colore: "var(--cold)", basso: true }] }); },
          legenda: leg("massima media di ogni giorno", "curva stagionale liscia") };
      } },
    { id: "merla", quando: "29–31 gennaio · i giorni della merla", detto: "I giorni della merla sono i tre giorni più freddi dell'anno.",
      prova: "Confronto la temperatura media del 29, 30 e 31 gennaio con il resto dell'inverno, e conto in quanti inverni il giorno più freddo è caduto proprio lì.",
      fai(S) {
        const C = S.cl.tm, x0 = doy(0, 29), s = segnale(C, x0, 3), m3 = []; for (let i = 0; i < 365; i++) m3.push((C.raw[i] + C.raw[mod(i + 1)] + C.raw[mod(i + 2)]) / 3);
        const p3 = posto(m3, x0, false), im = m3.indexOf(Math.min(...m3)); let n = 0, k = 0;
        anni(S).forEach(y => { let best = null, c = 0; for (let i = 0; i < 90; i++) { const t = new Date(Date.UTC(y - 1, 11, 1 + i)), v = val(S, "tm", t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()); if (v == null) continue; c++; if (!best || v < best.v) best = { v, m: t.getUTCMonth(), d: t.getUTCDate() }; } if (c < 81) return; n++; if (best.m === 0 && best.d >= 29) k++; });
        const fr = k / n * 100, att = 3 / 90 * 100, dc = dist(C.imin, x0 + 1);
        const v = dc <= 3 || p3 === 1 ? "vero" : (s.v < 0 && s.pct <= 20) || fr >= att * 2 ? "parte" : "falso";
        return { v, riga: "Il freddo tocca il fondo il " + dataIt(C.imin) + "; la merla è la " + orf(p3) + " terna più fredda",
          ris: `Fra il 29 e il 31 gennaio la temperatura media a ${S.nome} è di <b>${fmt(s.med)} °C</b>: fra tutte le terne di giorni consecutivi dell'anno è la <b>${orf(p3)} più fredda</b>. La terna più fredda in assoluto comincia il ${dataIt(im)} e la curva stagionale tocca il fondo il ${dataIt(C.imin)}, ${gg(dc)} ${mod(C.imin - x0 - 1) < 180 ? "dopo" : "prima"}. Rispetto alla curva liscia i giorni della merla sono a ${sg(s.v, 2)} °C. Il giorno più freddo dell'inverno è caduto nei giorni della merla in <b>${k} inverni su ${n}</b> (${pc(fr)}): se fosse un giorno qualsiasi fra dicembre e febbraio ci si aspetterebbe ${ap("il", att)}.`,
          disegna(box) { curva(box, { da: x0 - 44, n: 90, unita: "°C", unitaT: " °C", etichetta: "Temperatura media giornaliera fra dicembre e febbraio a " + S.nome, punti: x => C.raw[mod(x)], linea: x => C.liscia[mod(x)], bande: [[x0, x0 + 2]], marchi: [{ x: C.imin < 200 ? C.imin : C.imin - 365, testo: "fondo della curva", colore: "var(--cold)", basso: true }] }); },
          legenda: leg("temperatura media di ogni giorno", "curva stagionale liscia", "giorni della merla") };
      } },
    { id: "candelora", quando: "2 febbraio · Candelora", detto: "Per la santa Candelora, se nevica o se plora dell'inverno siamo fora; ma se è sole o solicello siamo sempre a mezzo inverno.",
      prova: "In Italia ne circolano due versioni opposte: in quella qui sopra la pioggia annuncia la fine dell'inverno, nell'altra («se piove o tira vento, dell'inverno siamo dentro») lo prolunga. Divido gli anni fra Candelora bagnata e asciutta e guardo la temperatura dei 40 giorni successivi.",
      fai(S) {
        const P = []; anni(S).forEach(y => { const p = piove(S, y, 1, 2), t = finestra(S, (S, y, m, d) => sc(S, "tm", y, m, d), y, 1, 3, 40); if (p == null || t == null) return; let g = 0; for (let i = 0; i < 40; i++) { const n = val(S, "tn", y, 1, 3 + i); if (n != null && n < 0) g++; } P.push({ y, p, v: t, g }); });
        senzaTendenza(P); const A = P.filter(o => o.p), B = P.filter(o => !o.p), c = confronto(A.map(o => o.v), B.map(o => o.v));
        if (!c) return { v: "nd", riga: "Troppi pochi anni con i dati", ris: "Non ci sono abbastanza anni con pioggia e temperatura per fare il confronto." };
        const sig = c.p < .05;
        return { v: sig ? "vero" : c.p < .1 ? "parte" : "falso", riga: sig ? "Vince la versione «" + (c.d > 0 ? "se plora siamo fora" : "se piove siamo dentro") + "»" : "Nessuna delle due versioni: differenza di " + fmt(Math.abs(c.d), 2) + " °C, compatibile con il caso",
          ris: `Il 2 febbraio ha piovuto (o nevicato) in <b>${A.length} anni su ${P.length}</b>. Nei 40 giorni successivi, dal 3 febbraio a metà marzo, la temperatura è stata in media ${sg(c.ma, 2)} °C rispetto alla norma dopo una Candelora bagnata e ${sg(c.mb, 2)} °C dopo una asciutta: una differenza di <b>${fmt(Math.abs(c.d), 2)} °C</b>, ${c.d > 0 ? "nel verso della versione «se plora siamo fora»" : "nel verso della versione «se piove siamo dentro»"}. Mescolando a caso gli anni fra i due gruppi una differenza così grande esce ${prob(c.p)}: ${sig ? "è difficile attribuirla al caso." : "non si distingue dal caso."} Le gelate nei 40 giorni sono state in media ${fmt(media(A.map(o => o.g)))} dopo la pioggia e ${fmt(media(B.map(o => o.g)))} dopo il sereno. Il vento del proverbio non si può verificare: le serie non lo misurano.`,
          disegna(box) { gruppi(box, { unita: "scarto dalla norma nei 40 giorni dopo (°C)", unitaT: "°C", dec: 2, etichetta: "Temperatura dei 40 giorni dopo la Candelora, anni con pioggia e anni asciutti, " + S.nome, g: [{ nome: "Candelora con pioggia o neve", pts: A, colore: "var(--sky)" }, { nome: "Candelora asciutta", pts: B, colore: "var(--amber)" }] }); },
          legenda: "Ogni punto è un anno; la tacca verticale è la media del gruppo. Scarti dalla curva stagionale, tolta la tendenza al riscaldamento." };
      } },
    { id: "gennaio", quando: "gennaio → marzo", detto: "Se gennaio sta in camicia, marzo scoppia dalle risa.",
      prova: "Dopo un gennaio mite, marzo si prende la rivincita con il freddo? Metto a confronto, anno per anno, lo scarto dalla norma di gennaio con quello di marzo.",
      fai(S) {
        const P = []; anni(S).forEach(y => { const x = finestra(S, (S, y, m, d) => sc(S, "tm", y, m, d), y, 0, 1, 31), v = finestra(S, (S, y, m, d) => sc(S, "tm", y, m, d), y, 2, 1, 31); if (x != null && v != null) P.push({ y, x, v, et: y }); });
        senzaTendenza(P, "x"); senzaTendenza(P, "v"); const c = correlazione(P);
        if (!c) return { v: "nd", riga: "Troppi pochi anni con i dati", ris: "Non ci sono abbastanza anni completi." };
        const miti = P.filter(o => o.x > 1), fr = miti.filter(o => o.v < 0).length;
        return { v: c.r < 0 && c.p < .05 ? "vero" : c.r < 0 && c.p < .1 ? "parte" : "falso", riga: "Correlazione gennaio–marzo " + sg(c.r, 2) + (c.p < .05 ? "" : ": nessun legame"),
          ris: `Su ${c.n} anni la correlazione fra lo scarto di gennaio e quello di marzo è <b>${sg(c.r, 2)}</b> (il proverbio la vorrebbe chiaramente negativa); un valore così lontano da zero si ottiene ${prob(c.p)} anche rimescolando gli anni a caso. ${miti.length ? `Dopo i ${miti.length} gennai più miti (oltre 1 °C sopra la norma) marzo è stato più freddo della norma ${fr} volte e più caldo ${miti.length - fr}.` : ""} ${c.r < 0 && c.p < .05 ? "Il legame c'è, ed è nel verso del proverbio." : c.r > 0 && c.p < .05 ? "Un legame c'è, ma va al contrario del proverbio: a gennaio mite tende a seguire un marzo mite." : "Sapere com'è andato gennaio non dice nulla su marzo."}`,
          disegna(box) { dispersione(box, { pts: P, retta: c, xl: "scarto di gennaio (°C)", yl: "scarto di marzo (°C)", etichetta: "Scarto termico di gennaio e di marzo anno per anno, " + S.nome }); },
          legenda: "Ogni punto è un anno. Scarti della temperatura media dalla norma, tolta la tendenza al riscaldamento; la retta tratteggiata è quella dei minimi quadrati." };
      } },
    { id: "marzo", quando: "marzo", detto: "Marzo pazzerello, guarda il sole e prendi l'ombrello.",
      prova: "Marzo è davvero il mese più capriccioso? Misuro per ogni mese di quanto cambia la massima da un giorno all'altro e quanto spesso si passa dal bagnato all'asciutto o viceversa.",
      fai(S) {
        const s = new Float64Array(12), c = new Float64Array(12), w = new Float64Array(12), n = new Float64Array(12);
        S.T.forEach((r, k) => { const q = S.T.get(k - 1); if (!q) return; const m = new Date(k * G).getUTCMonth(); s[m] += Math.abs(r[0] - q[0]); c[m]++; });
        S.P.forEach((v, k) => { const q = S.P.get(k - 1); if (q == null) return; const m = new Date(k * G).getUTCMonth(); n[m]++; if ((v >= PIOVE) !== (q >= PIOVE)) w[m]++; });
        const dt = Array.from(s, (v, i) => v / c[i]), cb = Array.from(w, (v, i) => v / n[i] * 100), p1 = posto(dt, 2), p2 = posto(cb, 2), best = Math.min(p1, p2);
        const m1 = dt.indexOf(Math.max(...dt)), m2 = cb.indexOf(Math.max(...cb));
        return { v: p1 === 1 && p2 === 1 ? "vero" : best <= 3 ? "parte" : "falso", riga: "Marzo è " + ord(p1) + " per sbalzi di temperatura e " + ord(p2) + " per cambi fra pioggia e asciutto",
          ris: `A marzo la massima di ${S.nome} cambia in media di <b>${fmt(dt[2], 2)} °C</b> da un giorno all'altro: ${p1 === 1 ? `<b>più che in ogni altro mese</b> (il più stabile è ${MESL[dt.indexOf(Math.min(...dt))]}, ${fmt(Math.min(...dt), 2)} °C)` : `è il <b>${ord(p1)} mese</b> su dodici (il più ballerino è ${MESL[m1]}, ${fmt(dt[m1], 2)} °C; il più stabile ${MESL[dt.indexOf(Math.min(...dt))]})`}. Il tempo passa da bagnato ad asciutto, o viceversa, <b>${ap("nel", cb[2])}</b> dei giorni: ${p2 === 1 ? "marzo è primo anche qui" : `qui marzo è ${ord(p2)} (primo ${MESL[m2]}, ${pc(cb[m2])})`}. ${p1 === 1 && p2 === 1 ? "Marzo è davvero il più pazzo, per il termometro e per l'ombrello." : p1 === 1 ? "Pazzerello per il termometro, quindi, ma non per l'ombrello: l'alternanza fra sole e pioggia del proverbio è più frequente in altri mesi." : best <= 3 ? "Marzo è fra i mesi più variabili, ma non è il primo." : "Altri mesi sono più capricciosi di marzo."}`,
          disegna(box) { box.innerHTML = '<div class="pv-due"><div></div><div></div></div>'; const [a, b] = box.firstChild.children;
            barre(a, { v: dt, mese: 2, dec: 1, titolo: "Sbalzo medio della massima da un giorno all'altro (°C)", etichetta: "Sbalzo medio della massima per mese" });
            barre(b, { v: cb, mese: 2, dec: 0, titolo: "Giorni in cui il tempo cambia fra pioggia e asciutto (%)", etichetta: "Frequenza dei cambi fra pioggia e asciutto per mese" }); },
          legenda: `Temperature ${S.fonteT}, pioggia ${S.fonteP}. Giorno piovoso: almeno 1 mm.` };
      } },
    { id: "aprilante", quando: "3 aprile", detto: "Terzo aprilante, quaranta dì durante.",
      prova: "Se piove il 3 aprile, piove per quaranta giorni? Conto i giorni di pioggia nei 40 successivi, separando gli anni in cui il 3 aprile ha piovuto da quelli asciutti.",
      fai(S) { return dopoLaPioggia(S, 3, 3, 40, "3 aprile", "il 4 aprile («quattro aprilanti, giorni quaranta»)", [3, 4]); } },
    { id: "aprile", quando: "aprile", detto: "Aprile, ogni giorno un barile.",
      prova: "Aprile è il mese in cui piove più spesso? Conto i giorni di pioggia e i millimetri medi di ogni mese.",
      fai(S) {
        const gp = [], mm = []; for (let m = 0; m < 12; m++) { const a = [], b = []; for (let y = S.p0; y <= S.y1; y++) { let c = 0, w = 0, t = 0; const nd = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); for (let d = 1; d <= nd; d++) { const v = S.P.get(dn(y, m, d)); if (v == null) continue; c++; t += v; if (v >= PIOVE) w++; } if (c >= nd * .9) { a.push(w / c * nd); b.push(t / c * nd); } } gp.push(media(a)); mm.push(media(b)); }
        const p1 = posto(gp, 3), p2 = posto(mm, 3), m1 = gp.indexOf(Math.max(...gp)), m2 = mm.indexOf(Math.max(...mm));
        return { v: p1 === 1 ? "vero" : p1 <= 3 ? "parte" : "falso", riga: "Aprile è " + ord(p1) + " per giorni di pioggia (" + fmt(gp[3]) + ") e " + ord(p2) + " per millimetri",
          ris: `Ad aprile a ${S.nome} piove in media <b>${fmt(gp[3])} giorni</b>, uno ogni ${fmt(30 / gp[3])}: è il <b>${ord(p1)} mese</b> per numero di giorni piovosi (il primo è ${MESL[m1]} con ${fmt(gp[m1])}) e ${ilo(p2)} per quantità, con ${fmt(mm[3], 0)} mm (il più piovoso è ${MESL[m2]}, ${fmt(mm[m2], 0)} mm). ${p1 === 1 ? "Non piove tutti i giorni, ma nessun mese ha più giorni bagnati." : p1 <= 3 ? "Aprile è fra i mesi in cui piove più spesso, senza essere il primo: piogge frequenti ma non le più abbondanti." : "Altri mesi sono più piovosi, per frequenza e per quantità."}`,
          disegna(box) { box.innerHTML = '<div class="pv-due"><div></div><div></div></div>'; const [a, b] = box.firstChild.children;
            barre(a, { v: gp, mese: 3, dec: 1, titolo: "Giorni di pioggia in media", etichetta: "Giorni di pioggia medi per mese" }); barre(b, { v: mm, mese: 3, dec: 0, titolo: "Pioggia media (mm)", etichetta: "Pioggia media per mese" }); },
          legenda: `Pioggia ${S.fonteP}; giorno piovoso: almeno 1 mm. Solo i mesi con almeno il 90% dei giorni.` };
      } },
    { id: "santi-ghiaccio", quando: "11–14 maggio · i santi di ghiaccio", detto: "San Mamerto, San Pancrazio, San Servazio e San Bonifacio: i santi di ghiaccio.",
      prova: "A metà maggio torna davvero il freddo? Cerco un avvallamento nelle minime dell'11–14 maggio rispetto alla salita regolare della primavera.",
      fai(S) {
        const C = S.cl.tn, x0 = doy(4, 11), s = segnale(C, x0, 4); let n = 0, k = 0, gel = 0, fr = 0, ult = null;
        const f = (S, y, m, d) => val(S, "tn", y, m, d);
        anni(S).forEach(y => { const a = finestra(S, f, y, 4, 11, 4, 1), b = finestra(S, f, y, 4, 7, 4, 1); if (a == null || b == null) return; n++; if (a < b) k++;
          let g = false, c = false; for (let d = 11; d <= 14; d++) { const v = val(S, "tn", y, 4, d); if (v < 0) g = true; if (v <= 3) c = true; } if (g) { gel++; ult = y; } if (c) fr++; });
        const q = k / n * 100, bassa = 100 - s.pct;
        return { v: s.v < 0 && s.pct <= 5 ? "vero" : (s.v < 0 && s.pct <= 20) || q >= 55 ? "parte" : "falso", riga: "Minime dell'11–14 maggio " + sg(s.v, 2) + " °C rispetto alla curva: " + (s.v < 0 && s.pct <= 20 ? "un piccolo avvallamento c'è" : "nessun avvallamento"),
          ris: `La minima media dell'11–14 maggio a ${S.nome} è <b>${fmt(s.med)} °C</b>, ${sg(s.v, 2)} °C rispetto alla curva stagionale liscia: ${s.v >= 0 ? "nessun avvallamento, semmai quei giorni sono un filo più miti di quanto vorrebbe la salita regolare della primavera" : `uno scarto più basso di quello ${ap("del", bassa)} delle finestre di quattro giorni dell'anno` + (s.pct <= 5 ? ", quindi l'avvallamento spicca" : s.pct <= 20 ? ", un avvallamento leggero" : ", niente che spicchi sul rumore")}. I santi di ghiaccio sono stati più freddi dei quattro giorni precedenti (7–10 maggio) in <b>${k} anni su ${n}</b> (${pc(q)}); con la primavera che avanza ci si aspetterebbe un po' meno della metà. In quei quattro giorni la minima è scesa a 3 °C o meno in ${fr === 1 ? "un anno" : fr + " anni"} e sotto zero ${gel ? "in " + (gel === 1 ? "uno" : gel) + " (l'ultima volta nel " + ult + ")" : "mai"}.`,
          disegna(box) { curva(box, { da: x0 - 30, n: 64, unita: "°C", unitaT: " °C", etichetta: "Minima media giornaliera fra aprile e giugno a " + S.nome, punti: x => C.raw[mod(x)], linea: x => C.liscia[mod(x)], bande: [[x0, x0 + 3]] }); },
          legenda: leg("minima media di ogni giorno", "curva stagionale liscia", "santi di ghiaccio") };
      } },
    { id: "san-martino", quando: "11 novembre · San Martino", detto: "L'estate di San Martino dura tre giorni e un pochino.",
      prova: "Intorno all'11 novembre il calo dell'autunno si interrompe? Cerco un rialzo delle massime fra l'11 e il 14 novembre e conto gli anni con almeno tre giorni di fila sopra la norma.",
      fai(S) {
        const C = S.cl.tx, x0 = doy(10, 11), s = segnale(C, x0, 4);
        const episodi = sp => { let n = 0, k = 0; anni(S).forEach(y => { let fila = 0, max = 0, c = 0; for (let i = 0; i < 8; i++) { const v = sc(S, "tx", y, 10, 8 + sp + i); if (v == null) { fila = 0; continue; } c++; fila = v >= 2 ? fila + 1 : 0; if (fila > max) max = fila; } if (c < 8) return; n++; if (max >= 3) k++; }); return { n, k, f: k / n * 100 }; };
        const e = episodi(0), fc = media([-20, -10, 10, 20].map(sp => episodi(sp).f));
        return { v: s.v > 0 && s.pct >= 95 ? "vero" : s.v > 0 && (s.pct >= 80 || e.f > fc * 1.25) ? "parte" : "falso", riga: "Massime dell'11–14 novembre " + sg(s.v, 2) + " °C rispetto alla curva; episodi tiepidi " + ap("nel", e.f) + " degli anni",
          ris: `Fra l'11 e il 14 novembre la massima media a ${S.nome} è <b>${fmt(s.med)} °C</b>, ${sg(s.v, 2)} °C rispetto alla curva stagionale liscia: ${s.v <= 0 ? "nessun rialzo" : `uno scarto più alto di quello ${ap("del", s.pct)} delle finestre di quattro giorni dell'anno` + (s.pct >= 95 ? ", quindi il rialzo spicca" : s.pct >= 80 ? ", un rialzo leggero" : ", troppo poco per spiccare sul rumore")}. Fra l'8 e il 15 novembre c'è stato un episodio di almeno tre giorni di fila con la massima 2 °C sopra la norma in <b>${e.k} anni su ${e.n}</b> (${pc(e.f)}); nelle settimane vicine, dieci e venti giorni prima e dopo, succede ${ap("nel", fc)} degli anni. ${e.f > fc * 1.25 ? "A San Martino i giorni tiepidi sono un po' più frequenti che nel resto del periodo." : "Giorni tiepidi a novembre capitano spesso, ma non più a San Martino che in un'altra settimana."}`,
          disegna(box) { curva(box, { da: x0 - 30, n: 64, unita: "°C", unitaT: " °C", etichetta: "Massima media giornaliera fra ottobre e dicembre a " + S.nome, punti: x => C.raw[mod(x)], linea: x => C.liscia[mod(x)], bande: [[x0, x0 + 3]] }); },
          legenda: leg("massima media di ogni giorno", "curva stagionale liscia", "11–14 novembre") };
      } },
    { id: "bibiana", quando: "2 dicembre · Santa Bibiana", detto: "Se piove per Santa Bibiana, piove quaranta dì e una settimana.",
      prova: "Dopo un 2 dicembre piovoso i 47 giorni successivi sono più bagnati del solito? E ha mai piovuto per 47 giorni di fila?",
      fai(S) { return dopoLaPioggia(S, 11, 2, 47, "2 dicembre", null, null); } },
    { id: "santa-lucia", quando: "13 dicembre · Santa Lucia", detto: "Santa Lucia, il giorno più corto che ci sia.", senzaStazione: true,
      prova: "Qui non servono le stazioni: basta l'astronomia. Calcolo per Borgo San Lorenzo alba, tramonto e ore di luce di ogni giorno fra fine novembre e metà gennaio.",
      fai(S) {
        if (!window.Astro) return { v: "nd", riga: "Calcolo non disponibile", ris: "Il calcolo astronomico non è disponibile." };
        const y = S.y1, g = []; for (let i = 0; i < 56; i++) { const t = new Date(Date.UTC(y, 10, 22 + i, 12)), s = Astro.sunTimes(t), mn = d => (d.getTime() - Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())) / 6e4 + 60; g.push({ x: doy(10, 22) + i, al: mn(s.alba), tr: mn(s.tramonto) }); }
        g.forEach(o => o.lu = o.tr - o.al); const min = k => g.reduce((a, b) => a[k] <= b[k] ? a : b), max = k => g.reduce((a, b) => a[k] >= b[k] ? a : b);
        const corto = min("lu"), pr = min("tr"), ta = max("al"), luc = g.find(o => mod(o.x) === doy(11, 13)), hm = v => Math.floor(v / 60) + ":" + String(Math.round(v % 60)).padStart(2, "0"), ore = v => Math.floor(v / 60) + " ore e " + Math.round(v % 60) + " minuti";
        const vic = dist(mod(pr.x), doy(11, 13)) <= 4;
        return { v: vic ? "parte" : "falso", riga: "Il giorno più corto è il " + dataIt(corto.x) + "; ma il tramonto più precoce è il " + dataIt(pr.x),
          ris: `A Borgo San Lorenzo il giorno più corto del ${y} è il <b>${dataIt(corto.x)}</b>, nei giorni del solstizio, con ${ore(corto.lu)} di luce; il 13 dicembre ne ha ${ore(luc.lu)}, cioè ${fmt(luc.lu - corto.lu, 0)} minuti in più. Il proverbio però coglie una cosa vera: <b>il tramonto più precoce dell'anno cade il ${dataIt(pr.x)}</b> (alle ${hm(pr.tr)}), a ridosso di Santa Lucia, e da lì le sere tornano ad allungarsi, mentre l'alba continua a ritardare fino al ${dataIt(ta.x)} (${hm(ta.al)}). C'è anche una ragione storica: prima della riforma gregoriana del 1582 il calendario era sfasato di una decina di giorni e il solstizio cadeva intorno al 12–13 dicembre.`,
          disegna(box) { curva(box, { da: g[0].x, n: g.length, unita: "ora del tramonto", fy: hm, etichetta: "Ora del tramonto a Borgo San Lorenzo fra novembre e gennaio", linea: x => g[x - g[0].x].tr, bande: [[doy(11, 13), doy(11, 13)]], marchi: [{ x: corto.x, testo: "solstizio", colore: "var(--cold)" }, { x: pr.x, testo: "tramonto più precoce", basso: true }] }); },
          legenda: `<span class="lg"><i class="ln"></i>ora del tramonto (ora solare)</span><span class="lg"><i class="bd"></i>Santa Lucia</span>` };
      } },
    { id: "natale", quando: "25 dicembre → Pasqua", detto: "Natale al sole, Pasqua al tizzone.",
      prova: "A un Natale mite segue una Pasqua fredda? Confronto lo scarto dalla norma della massima a Natale (24–26 dicembre) con quello dei tre giorni di Pasqua dell'anno dopo, da sabato a lunedì.",
      fai(S) {
        const f = (S, y, m, d) => sc(S, "tx", y, m, d), P = [];
        anni(S).forEach(y => { const [pm, pd] = pasqua(y + 1), x = finestra(S, f, y, 11, 24, 3, .6), v = finestra(S, f, y + 1, pm, pd - 1, 3, .6); if (x != null && v != null) P.push({ y, x, v, et: "Natale " + y + " / Pasqua " + (y + 1) }); });
        senzaTendenza(P, "x"); senzaTendenza(P, "v"); const c = correlazione(P);
        if (!c) return { v: "nd", riga: "Troppi pochi anni con i dati", ris: "Non ci sono abbastanza anni completi." };
        const miti = P.filter(o => o.x > 0), fr = miti.filter(o => o.v < 0).length;
        return { v: c.r < 0 && c.p < .05 ? "vero" : c.r < 0 && c.p < .1 ? "parte" : "falso", riga: "Natale mite, Pasqua fredda in " + fr + " casi su " + miti.length + "; correlazione " + sg(c.r, 2),
          ris: `Su ${c.n} coppie Natale–Pasqua, dopo un Natale più mite della norma la Pasqua è stata più fredda della norma <b>${fr} volte su ${miti.length}</b> (${pc(fr / miti.length * 100)}): ${Math.abs(fr / miti.length - .5) < .1 ? "in pratica testa o croce" : fr / miti.length > .5 ? "un po' più della metà" : "meno della metà"}. La correlazione fra i due scarti è <b>${sg(c.r, 2)}</b> (il proverbio la vorrebbe negativa) e un valore così si ottiene ${prob(c.p)} anche rimescolando gli anni a caso. ${c.r < 0 && c.p < .05 ? "Il legame c'è, nel verso del proverbio." : "Fra Natale e Pasqua passano tre o quattro mesi: l'atmosfera non ha una memoria così lunga."} Il «sole» del proverbio è reso con la temperatura massima, perché le serie non misurano il soleggiamento.`,
          disegna(box) { dispersione(box, { pts: P, retta: c, xl: "scarto della massima a Natale (°C)", yl: "scarto a Pasqua (°C)", etichetta: "Scarto termico di Natale e della Pasqua successiva, " + S.nome }); },
          legenda: "Ogni punto è un Natale con la Pasqua successiva. Scarti dalla curva stagionale, tolta la tendenza al riscaldamento." };
      } }
  ];

  // proverbi del tipo «se piove il giorno X, piove per N giorni»
  function dopoLaPioggia(S, m, d, n, nomeG, altro, altroG) {
    const conta = (mm, dd) => { const P = []; for (let y = S.p0; y <= S.y1; y++) { const p = piove(S, y, mm, dd); if (p == null) continue; let c = 0, w = 0; for (let i = 1; i <= n; i++) { const v = piove(S, y, mm, dd + i); if (v == null) continue; c++; w += v; } if (c >= n * .9) P.push({ y, p, v: w / c * n }); } return P; };
    const P = conta(m, d), A = P.filter(o => o.p), B = P.filter(o => !o.p), c = confronto(A.map(o => o.v), B.map(o => o.v));
    if (!c) return { v: "nd", riga: "Troppi pochi anni con i dati", ris: "Non ci sono abbastanza anni con pioggia in questa data per fare il confronto (" + A.length + " anni piovosi su " + P.length + ")." };
    // la serie più lunga di giorni piovosi consecutivi di tutto l'archivio
    let best = 0, fine = 0, fila = 0, prec = null; [...S.P.keys()].sort((a, b) => a - b).forEach(k => { fila = S.P.get(k) >= PIOVE ? (prec === k - 1 ? fila + 1 : 1) : 0; prec = k; if (fila > best) { best = fila; fine = k; } });
    const t1 = new Date((fine - best + 1) * G), maxA = A.reduce((a, b) => a.v >= b.v ? a : b), sig = c.d > 0 && c.p < .05;
    let extra = ""; if (altro) { const Q = conta(altroG[0], altroG[1]), c2 = confronto(Q.filter(o => o.p).map(o => o.v), Q.filter(o => !o.p).map(o => o.v)); if (c2) extra = ` Con ${altro} il risultato è simile: ${fmt(c2.ma)} giorni di pioggia dopo una giornata bagnata contro ${fmt(c2.mb)} dopo una asciutta.`; }
    return { v: sig ? "parte" : "falso", riga: "Dopo la pioggia " + fmt(c.ma) + " giorni bagnati su " + n + ", dopo l'asciutto " + fmt(c.mb) + (sig ? "" : ": nessuna differenza reale"),
      ris: `Il ${nomeG} ha piovuto in <b>${A.length} anni su ${P.length}</b>. Nei ${n} giorni successivi i giorni di pioggia sono stati in media <b>${fmt(c.ma)}</b> dopo una giornata bagnata e <b>${fmt(c.mb)}</b> dopo una asciutta: una differenza di ${sg(c.d)} giorni, che mescolando a caso gli anni esce ${prob(c.p)}${sig ? ", quindi difficilmente casuale" : ", quindi compatibile con il caso"}. Il massimo dopo un ${nomeG} piovoso è di ${fmt(maxA.v, 0)} giorni di pioggia su ${n} (${maxA.y}). Preso alla lettera il proverbio è impossibile: la serie più lunga di giorni piovosi consecutivi di tutto l'archivio di ${S.nome} è di <b>${best} giorni</b> (dal ${t1.getUTCDate()} ${MESL[t1.getUTCMonth()]} ${t1.getUTCFullYear()}).${extra}`,
      disegna(box) { gruppi(box, { unita: "giorni di pioggia nei " + n + " successivi", unitaT: "giorni di pioggia", dec: 0, etichetta: "Giorni di pioggia nei " + n + " giorni dopo il " + nomeG + ", " + S.nome, g: [{ nome: nomeG + " con pioggia", pts: A, colore: "var(--sky)" }, { nome: nomeG + " asciutto", pts: B, colore: "var(--amber)" }] }); },
      legenda: `Ogni punto è un anno; la tacca verticale è la media del gruppo. Pioggia ${S.fonteP}; giorno piovoso: almeno 1 mm.` };
  }

  /* ---------- pagina ---------- */
  const chip = v => `<span class="vd vd-${v}">${V[v]}</span>`;
  function mostra() {
    const S = DATI[ST], box = $("pv-lista"); if (!S) return; DISEGNI = [];
    const R = PROVERBI.map(p => { let r; try { r = p.fai(S); } catch (e) { console.error(p.id, e); r = { v: "nd", riga: "Calcolo non riuscito", ris: "Il calcolo non è riuscito con i dati disponibili." }; } return Object.assign({ p }, r); });
    const cnt = k => R.filter(r => r.v === k).length;
    $("pv-conto").innerHTML = `<div><b>${cnt("vero")}</b>${chip("vero")}</div><div><b>${cnt("parte")}</b>${chip("parte")}</div><div><b>${cnt("falso")}</b>${chip("falso")}</div>`;
    $("agg").textContent = S.nome + " · temperature " + S.fonteT + ", pioggia " + S.fonteP + " · dati fino al " + +S.ultimo.slice(8, 10) + "/" + +S.ultimo.slice(5, 7) + "/" + S.ultimo.slice(0, 4);
    $("pv-pagella").innerHTML = "<tr><th>QUANDO</th><th>PROVERBIO</th><th>VERDETTO</th><th class=\"pv-r\">IN UNA RIGA</th></tr>" + R.map(r => `<tr><td class="pv-q">${r.p.quando.split(" · ")[0]}</td><td><a href="#pv-${r.p.id}">${r.p.detto}</a></td><td>${chip(r.v)}</td><td class="pv-r">${r.riga}</td></tr>`).join("");
    box.innerHTML = R.map(r => `<article class="card pv" id="pv-${r.p.id}"><div class="pv-top"><span class="lab">${r.p.quando}</span>${chip(r.v)}</div><blockquote>«${r.p.detto}»</blockquote><p class="pv-prova"><b>La prova.</b> ${r.p.prova}</p><div class="pv-g" id="g-${r.p.id}"></div>${r.legenda ? `<p class="pv-leg">${r.legenda}</p>` : ""}<p class="pv-ris">${r.ris}</p></article>`).join("");
    R.forEach(r => { if (r.disegna) DISEGNI.push(() => r.disegna($("g-" + r.p.id))); });
    DISEGNI.forEach(f => { try { f(); } catch (e) { console.error(e); } });
    if (location.hash && !mostra.fatto) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
    mostra.fatto = true;
  }
  async function avvia() {
    try { const [b, f] = await Promise.all([borgo(), firenzuola()]); [b, f].forEach(prepara); DATI.borgo = b; DATI.firenzuola = f; mostra(); }
    catch (e) { $("pv-lista").innerHTML = '<div class="card"><div class="loading">Dati non disponibili al momento.</div></div>'; console.error(e); }
  }
  document.querySelectorAll("#pv-st button").forEach(b => b.addEventListener("click", () => { ST = b.dataset.s; document.querySelectorAll("#pv-st button").forEach(x => x.setAttribute("aria-pressed", x === b)); mostra(); }));
  let tm, lw = window.innerWidth; window.addEventListener("resize", () => { if (window.innerWidth === lw) return; lw = window.innerWidth; clearTimeout(tm); tm = setTimeout(() => DISEGNI.forEach(f => { try { f(); } catch (e) { } }), 180); });
  avvia();
})();
