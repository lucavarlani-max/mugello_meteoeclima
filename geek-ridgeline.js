/* MeteoGeek · ridgeline (crinali) delle distribuzioni di Borgo San Lorenzo: temperature (geek-ridgeline-temperature.html) e
   precipitazioni (geek-ridgeline-precipitazioni.html). Un solo script, scelto da <body data-grafico="temperature|precipitazioni">.
   Niente librerie esterne: SVG disegnato a mano, come le altre pagine del sito. I dati si leggono dai file del sito e il grafico
   si aggiorna da solo quando un anno si completa.
   - temperature: data/borgo-serie-lunghe.json, solo la stazione di Borgo S. Lorenzo (senza Borgo 2), anni con almeno 300 giorni
   - precipitazioni: data/sir/TOS01000999/prec99.csv (giornata pluviometrica 9→9, dal novembre 1991)
   Ogni crinale è la densità (stima a nucleo gaussiano) dei valori di un anno. Si usano solo gli anni già conclusi. */
(function () {
  "use strict";
  const TIPO = document.body.dataset.grafico;
  const $ = id => document.getElementById(id), NS = "http://www.w3.org/2000/svg";
  const fmt = (v, d = 1) => v == null || !isFinite(v) ? "–" : v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });
  const el = (tag, at, par) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (par) par.appendChild(e); return e; };
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const rgb = h => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  const mix = (a, b, t) => "rgb(" + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",") + ")";

  // curva B-spline cubica uniforme (la stessa di d3.curveBasis) per una polilinea di punti [x, y]
  function basis(p) {
    const n = p.length; if (n < 3) return p.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join("");
    const f = v => v.toFixed(1);
    let d = "M" + f(p[0][0]) + " " + f(p[0][1]);
    d += "L" + f((5 * p[0][0] + p[1][0]) / 6) + " " + f((5 * p[0][1] + p[1][1]) / 6);
    const seg = (a, b, c) => "C" + f((2 * a[0] + b[0]) / 3) + " " + f((2 * a[1] + b[1]) / 3) + " " + f((a[0] + 2 * b[0]) / 3) + " " + f((a[1] + 2 * b[1]) / 3) +
      " " + f((a[0] + 4 * b[0] + c[0]) / 6) + " " + f((a[1] + 4 * b[1] + c[1]) / 6);
    for (let i = 2; i < n; i++) d += seg(p[i - 2], p[i - 1], p[i]);
    d += seg(p[n - 2], p[n - 1], p[n - 1]) + "L" + f(p[n - 1][0]) + " " + f(p[n - 1][1]);
    return d;
  }
  // densità con nucleo gaussiano (larghezza h) sui centri dei bin; con riflessione in 0 se i valori non possono essere negativi
  function kde(vals, centri, h, rifl) {
    const k = 1 / (h * Math.sqrt(2 * Math.PI)), out = new Array(centri.length).fill(0);
    for (let j = 0; j < centri.length; j++) {
      let s = 0; const c = centri[j];
      for (let i = 0; i < vals.length; i++) {
        const z = (c - vals[i]) / h; s += Math.exp(-0.5 * z * z);
        if (rifl) { const w = (c + vals[i]) / h; s += Math.exp(-0.5 * w * w); }
      }
      out[j] = s * k / vals.length;
    }
    return out;
  }
  const scuro = () => { const t = document.documentElement.dataset.theme; return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;

  // ---------- configurazioni ----------
  const MISS = -32768;
  const CONF = {
    temperature: {
      vars: { tm: "Media giornaliera", tx: "Massime", tn: "Minime" }, v0: "tm", unit: "°C", guida: 5,
      carica: async () => {
        const D = await (await fetch("data/borgo-serie-lunghe.json", { cache: "no-cache" })).json();
        const t0 = Date.UTC(D.y0, 0, 1), per = {}, ultimo = new Date(t0 + (D.n - 1) * 864e5), yL = ultimo.getUTCFullYear();
        const completo = ultimo.getUTCMonth() === 11 && ultimo.getUTCDate() === 31;
        for (let i = 0; i < D.n; i++) {
          const x = D.tmax1[i], n = D.tmin1[i]; if (x == null || n == null || x === MISS || n === MISS) continue;   // solo Borgo S. Lorenzo
          const y = new Date(t0 + i * 864e5).getUTCFullYear(), a = per[y] || (per[y] = { tx: [], tn: [], tm: [] });
          a.tx.push(x / 10); a.tn.push(n / 10); a.tm.push((x + n) / 20);
        }
        const anni = Object.keys(per).map(Number).filter(y => per[y].tm.length >= 300 && (y < yL || completo)).sort((a, b) => a - b);
        return { anni, per, ultimo: ultimo.toISOString().slice(0, 10), nota: "anni con almeno 300 giorni di misure" };
      },
      ridge: (dati, v) => {
        const a = dati.per, tutti = [].concat(...dati.anni.map(y => a[y][v]));
        const lo = Math.floor(Math.min(...tutti) - 2), hi = Math.ceil(Math.max(...tutti) + 2);
        const centri = []; for (let c = lo + 0.25; c < hi; c += 0.5) centri.push(c);
        return { centri, passo: 0.5, righe: dati.anni.map(y => ({ y, n: a[y][v].length, media: mean(a[y][v]), dens: kde(a[y][v], centri, 0.8, false) })) };
      },
      colore: () => { const c0 = rgb(css("--cold") || "#2a64a8"), c1 = rgb(css("--ctx") || "#b9c2bc"), c2 = rgb(css("--warm") || "#b8431f"); return t => t < .5 ? mix(c0, c1, t * 2) : mix(c1, c2, (t - .5) * 2); },
      chiave: r => r.media, guide: (lo, hi) => { const g = []; for (let t = Math.ceil(lo / 5) * 5; t <= hi; t += 5) g.push(t); return g; }, etichetta: t => t + "°",
      tip: (r, v) => "<b>" + r.y + "</b><br>media " + fmt(r.media, 1) + " °C<br><span class='m'>" + r.n + " giorni di misure</span>",
      titolo: v => ({ tm: "Temperatura media giornaliera", tx: "Temperatura massima giornaliera", tn: "Temperatura minima giornaliera" })[v] + " · distribuzione dei valori di ogni anno",
      asse: "°C", soglia: () => 0.012
    },
    precipitazioni: {
      vars: { mensile: "Totali mensili", giorni_umidi: "Giorni umidi" }, v0: "mensile", unit: "mm", guida: 0,
      carica: async () => {
        const txt = await (await fetch("data/sir/TOS01000999/prec99.csv", { cache: "no-cache" })).text();
        const per = {}; let ultimo = "";
        txt.split("\n").slice(1).forEach(r => {
          const [d, m] = r.split(";"); if (!d || m === "" || m == null) return;
          const v = parseFloat(m); if (!isFinite(v)) return;
          const y = +d.slice(0, 4), a = per[y] || (per[y] = { g: [], mese: {} });
          a.g.push(v); const k = +d.slice(5, 7), o = a.mese[k] || (a.mese[k] = { s: 0, n: 0 }); o.s += v; o.n++; if (d > ultimo) ultimo = d;
        });
        const yL = +ultimo.slice(0, 4), completo = ultimo.slice(5) === "12-31";
        const anni = Object.keys(per).map(Number).filter(y => (y < yL || completo) && per[y].g.length >= 300).sort((a, b) => a - b);
        return { anni, per, ultimo, nota: "anni con almeno 300 giorni di misure; un mese conta se ha almeno 25 giorni" };
      },
      ridge: (dati, v) => {
        const a = dati.per, centri = [], passo = v === "mensile" ? 5 : 1, N = v === "mensile" ? 80 : 80, h = v === "mensile" ? 22 : 2.2;
        for (let i = 0; i < N; i++) centri.push((i + 0.5) * passo);
        const righe = dati.anni.map(y => {
          const ann = a[y].g.reduce((s, q) => s + q, 0);
          if (v === "mensile") {
            const mesi = Object.values(a[y].mese).filter(o => o.n >= 25).map(o => o.s);
            if (mesi.length < 8) return null;
            return { y, n: mesi.length, media: mean(mesi), ann, dens: kde(mesi, centri, h, true) };
          }
          const umidi = a[y].g.filter(q => q >= 0.3);
          if (umidi.length < 20) return null;
          return { y, n: umidi.length, media: mean(umidi), ann, secchi: 100 * (1 - umidi.length / a[y].g.length), dens: kde(umidi, centri, h, true) };
        }).filter(Boolean);
        return { centri, passo, righe };
      },
      colore: () => { const sc = scuro(), c0 = rgb(sc ? "#b4d4f2" : "#a8c8ea"), c1 = rgb(sc ? "#4a90e2" : "#2a64a8"); return t => mix(c0, c1, t); },
      chiave: r => r.ann, guide: (lo, hi, v) => { const g = [], s = v === "mensile" ? 50 : 10; for (let t = 0; t <= hi; t += s) g.push(t); return g; }, etichetta: t => t,
      tip: (r, v) => v === "mensile" ? "<b>" + r.y + "</b><br>totale annuo <b>" + Math.round(r.ann) + " mm</b><br>media mensile " + fmt(r.media, 0) + " mm<br><span class='m'>" + r.n + " mesi</span>"
        : "<b>" + r.y + "</b><br>totale annuo <b>" + Math.round(r.ann) + " mm</b><br>" + r.n + " giorni umidi · " + fmt(r.media, 1) + " mm in media<br><span class='m'>giorni asciutti " + fmt(r.secchi, 0) + "%</span>",
      titolo: v => v === "mensile" ? "Pioggia totale di ogni mese · distribuzione dei valori di ogni anno" : "Pioggia nei giorni umidi (almeno 0,3 mm) · distribuzione dei valori di ogni anno",
      asse: "mm", soglia: v => v === "mensile" ? 0.04 : 0.08
    }
  }[TIPO];
  if (!CONF) return;

  // ---------- disegno ----------
  let DATI = null, VAR = CONF.v0, SOVR = true, SEL = null;
  const host = $("rg"), tip = $("rg-tip");

  function disegna() {
    if (!DATI) return;
    const R = CONF.ridge(DATI, VAR), righe = R.righe, n = righe.length;
    if (!n) { host.innerHTML = '<div class="loading">Dati insufficienti.</div>'; return; }
    host.querySelectorAll("svg,.loading").forEach(e => e.remove());
    const W = Math.max(300, host.clientWidth), ml = W < 520 ? 34 : 44, mr = 14, mt = 8, mb = 28;
    const rowH = SOVR ? (W < 520 ? 12 : 14) : (W < 520 ? 22 : 28), amp = SOVR ? rowH * 2.3 : rowH * 0.85;
    const plotW = W - ml - mr, plotH = n * rowH + 10, H = mt + amp + plotH + mb;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": CONF.titolo(VAR) + ", " + righe[0].y + "–" + righe[n - 1].y });
    // dominio X: dal primo bin all'ultimo con densità visibile
    let ult = 0, max = 0; righe.forEach(r => r.dens.forEach(q => { if (q > max) max = q; }));
    righe.forEach(r => r.dens.forEach((q, j) => { if (q > max * CONF.soglia(VAR)) ult = Math.max(ult, j); }));
    const xlo = R.centri[0] - R.passo / 2, xhi = R.centri[Math.min(R.centri.length - 1, ult + 3)] + R.passo / 2;
    const x = t => ml + (t - xlo) / (xhi - xlo) * plotW, hy = d => d / max * amp;
    const colore = CONF.colore(), chi = righe.map(CONF.chiave), cmin = Math.min(...chi), cmax = Math.max(...chi);
    const col = r => colore(cmax > cmin ? (CONF.chiave(r) - cmin) / (cmax - cmin) : .5);
    const ink = css("--ink-faint") || "#6f7c74", gl = css("--line") || "#e3e8e1";
    CONF.guide(xlo, xhi, VAR).forEach(t => {
      el("line", { x1: x(t), x2: x(t), y1: mt, y2: mt + amp + plotH, stroke: gl, "stroke-width": 1 }, svg);
      const tx = el("text", { x: x(t), y: H - 10, "text-anchor": "middle", fill: ink, "font-size": 11 }, svg); tx.textContent = CONF.etichetta(t);
    });
    const u = el("text", { x: ml - 6, y: H - 10, "text-anchor": "end", fill: ink, "font-size": 11 }, svg); u.textContent = CONF.asse;
    const g = el("g", {}, svg);
    righe.forEach((r, i) => {
      const base = mt + amp + i * rowH + rowH * 0.5;
      const pts = r.dens.map((q, j) => [x(R.centri[j]), base - hy(q)]).filter((_, j) => j <= ult + 3);
      const top = basis(pts), a = pts[0][0], b = pts[pts.length - 1][0];
      const area = el("path", { d: top + `L${b.toFixed(1)} ${base.toFixed(1)}L${a.toFixed(1)} ${base.toFixed(1)}Z`, fill: col(r), "fill-opacity": SEL === r.y ? .95 : .55, class: "rg-a", "data-y": r.y }, g);
      el("path", { d: top, fill: "none", stroke: col(r), "stroke-width": SEL === r.y ? 2 : 1, "pointer-events": "none" }, g);
      if (r.y % 5 === 0 || i === 0 || i === n - 1) { const t = el("text", { x: ml - 6, y: base - 1, "text-anchor": "end", fill: SEL === r.y ? css("--ink") : ink, "font-size": 11, "dominant-baseline": "middle" }, g); t.textContent = r.y; }
      const mostra = ev => {
        const rc = host.getBoundingClientRect(); tip.innerHTML = CONF.tip(r, VAR); tip.style.opacity = 1;
        const px = ev.clientX - rc.left, py = ev.clientY - rc.top;
        tip.style.left = Math.max(4, Math.min(rc.width - tip.offsetWidth - 4, px + 14)) + "px"; tip.style.top = Math.max(4, py - tip.offsetHeight - 10) + "px";
      };
      area.addEventListener("pointermove", mostra); area.addEventListener("pointerenter", mostra);
      area.addEventListener("pointerleave", () => { tip.style.opacity = 0; });
      area.addEventListener("click", () => { SEL = SEL === r.y ? null : r.y; disegna(); leggi(righe); });
    });
    host.insertBefore(svg, tip);
    $("rg-tit").textContent = CONF.titolo(VAR);
    $("rg-info").textContent = n + " anni · " + righe[0].y + "–" + righe[n - 1].y + " · " + DATI.nota;
    leggi(righe);
  }
  function leggi(righe) {   // lettura sotto il grafico: serve soprattutto al tocco, dove non c'è il passaggio del mouse
    const r = righe.find(q => q.y === SEL), box = $("rg-sel");
    box.innerHTML = r ? CONF.tip(r, VAR).replace(/<br>/g, " · ").replace(/<\/?b>/g, "") : "Tocca o clicca un crinale per leggere i valori di quell'anno.";
  }

  document.querySelectorAll("#rg-var button").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll("#rg-var button").forEach(x => x.setAttribute("aria-pressed", x === b)); VAR = b.dataset.v; disegna();
  }));
  $("rg-sov").addEventListener("change", e => { SOVR = e.target.checked; disegna(); });
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(disegna, 150); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", disegna);
  new MutationObserver(disegna).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  CONF.carica().then(d => { DATI = d; $("agg").textContent = "dati fino al " + d.ultimo.slice(8, 10).replace(/^0/, "") + "/" + d.ultimo.slice(5, 7) + "/" + d.ultimo.slice(0, 4); disegna(); })
    .catch(e => { host.innerHTML = '<div class="loading">I dati non sono disponibili in questo momento (' + e.message + ').</div>'; });
})();
