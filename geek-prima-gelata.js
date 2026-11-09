/* MeteoGeek · prima gelata d'autunno e ultima di primavera, Borgo San Lorenzo e Firenzuola.
   Si calcola nel browser dai file del sito, senza librerie: SVG disegnato a mano. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id), NS = "http://www.w3.org/2000/svg", MISS = -32768;
  const MES = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const MESL = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const fmt = (v, d = 1) => v == null || !isFinite(v) ? "–" : v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });
  const doy = (m, d) => Math.round((Date.UTC(2001, m, d) - Date.UTC(2001, 0, 1)) / 864e5);   // anno non bisestile
  const dataIt = o => o.d + " " + MESL[o.m];
  let ST = "borgo", TP = "aut", SEL = null, DATI = {}, R = null;

  async function borgo() {
    const D = await (await fetch("data/borgo-serie-lunghe.json", { cache: "no-cache" })).json();
    const t0 = Date.UTC(D.y0, 0, 1), righe = [];
    for (let i = 0; i < D.n; i++) {
      let x = D.tmax1[i], n = D.tmin1[i]; const dt = new Date(t0 + i * 864e5), m = dt.getUTCMonth();
      if (x === MISS || n === MISS || x == null || n == null) {
        const j = i - D.a0;
        if (j >= 0 && j < D.tmax2.length && D.tmax2[j] !== MISS && D.tmin2[j] !== MISS) { x = D.tmax2[j] - D.off.tmax[m] * 10; n = D.tmin2[j] - D.off.tmin[m] * 10; } else continue;
      }
      if (x < n) continue;
      righe.push([dt.getUTCFullYear(), m, dt.getUTCDate(), n / 10]);
    }
    return { righe, ultimo: D.last, y0: 1951, nome: "Borgo San Lorenzo" };
  }
  async function firenzuola() {
    const txt = await (await fetch("data/serie/firenzuola.csv", { cache: "no-cache" })).text(), righe = []; let ultimo = "";
    txt.trim().split("\n").slice(1).forEach(l => { const c = l.split(","); if (c[3] === "" || c[3] == null || c[2] === "") return;
      const n = parseFloat(c[3]); if (!isFinite(n)) return; righe.push([+c[0].slice(0, 4), +c[0].slice(5, 7) - 1, +c[0].slice(8, 10), n]); ultimo = c[0]; });
    return { righe, ultimo, y0: 1961, nome: "Firenzuola" };
  }

  function calcola(S) {
    const per = {};
    S.righe.forEach(([y, m, d, n]) => { (per[y] || (per[y] = [])).push([m, d, n]); });
    S.y1 = +S.ultimo.slice(0, 4); const uy = S.y1, um = +S.ultimo.slice(5, 7) - 1, ud = +S.ultimo.slice(8, 10), ufine = doy(um, ud);
    const aut = [], pri = [];
    for (let y = S.y0; y <= uy; y++) {
      const g = per[y] || [];
      // autunno: agosto–dicembre (153 giorni)
      const ga = g.filter(r => r[0] >= 7), fa = ga.filter(r => r[2] < 0);
      const copA = ga.length / 153, fineA = y < uy || (um === 11 && ud === 31);
      if (fa.length) { const r = fa.reduce((a, b) => doy(a[0], a[1]) <= doy(b[0], b[1]) ? a : b); aut.push({ y, m: r[0], d: r[1], v: r[2], x: doy(r[0], r[1]) }); }
      else if (fineA && copA >= .9) aut.push({ y, senza: true });
      // primavera: gennaio–giugno (181 giorni), valida solo a periodo concluso
      const gp = g.filter(r => r[0] <= 5), fp = gp.filter(r => r[2] < 0);
      const fineP = y < uy || um >= 6, copP = gp.length / 181;
      if (fineP && copP >= .9) { if (fp.length) { const r = fp.reduce((a, b) => doy(a[0], a[1]) >= doy(b[0], b[1]) ? a : b); pri.push({ y, m: r[0], d: r[1], v: r[2], x: doy(r[0], r[1]) }); } else pri.push({ y, senza: true }); }
    }
    return { aut, pri };
  }
  function trend(P) {
    const p = P.filter(o => !o.senza); if (p.length < 10) return null;
    const n = p.length, mx = p.reduce((s, o) => s + o.y, 0) / n, my = p.reduce((s, o) => s + o.x, 0) / n;
    let sxy = 0, sxx = 0; p.forEach(o => { sxy += (o.y - mx) * (o.x - my); sxx += (o.y - mx) ** 2; });
    const b = sxy / sxx; return { b, a: my - b * mx, n, dec: b * 10 };
  }
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  function disegna() {
    const box = $("gl"); box.querySelectorAll("svg,.loading").forEach(e => e.remove());
    const S = DATI[ST]; if (!S) return;
    const P = S.res[TP], V = P.filter(o => !o.senza), tip = $("gl-tip");
    $("gl-tit").textContent = S.nome + " · " + (TP === "aut" ? "prima notte sotto 0 °C (da agosto)" : "ultima notte sotto 0 °C (fino a giugno)");
    $("agg").textContent = "dati fino al " + S.ultimo.slice(8, 10).replace(/^0/, "") + "/" + S.ultimo.slice(5, 7).replace(/^0/, "") + "/" + S.ultimo.slice(0, 4);
    const W = Math.max(300, box.clientWidth), H = Math.min(440, Math.max(300, W * .55)), ml = 62, mr = 14, mt = 12, mb = 34;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": $("gl-tit").textContent }, box);
    const xs = V.map(o => o.x), lo0 = Math.min(...xs), hi0 = Math.max(...xs);
    // limiti arrotondati al mese: tick sul 1° e sul 15 di ogni mese
    const lo = Math.max(0, Math.floor((lo0 - 6) / 15) * 15), hi = Math.min(364, Math.ceil((hi0 + 6) / 15) * 15);
    const y0 = S.y0, y1 = P[P.length - 1].y, X = y => ml + (y - y0) / (y1 - y0 || 1) * (W - ml - mr), Y = v => mt + (v - lo) / (hi - lo) * (H - mt - mb);
    const ink = css("--ink-faint"), line = css("--line");
    for (let m = 0; m < 12; m++) for (const g of [1, 15]) {
      const v = doy(m, g); if (v < lo || v > hi) continue;
      el("line", { x1: ml, x2: W - mr, y1: Y(v), y2: Y(v), stroke: line, "stroke-width": 1 }, svg);
      const t = el("text", { x: ml - 8, y: Y(v) + 3.5, "text-anchor": "end", "font-size": 10.5, fill: ink }, svg); t.textContent = g + " " + MES[m];
    }
    for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) { const t = el("text", { x: X(y), y: H - 12, "text-anchor": "middle", "font-size": 10.5, fill: ink }, svg); t.textContent = y; }
    const T = trend(P);
    if (T) el("line", { x1: X(V[0].y), x2: X(V[V.length - 1].y), y1: Y(T.a + T.b * V[0].y), y2: Y(T.a + T.b * V[V.length - 1].y), stroke: css("--warm"), "stroke-width": 2, "stroke-dasharray": "6 4" }, svg);
    const ext = TP === "aut" ? Math.min(...xs) : Math.max(...xs);
    P.forEach(o => {
      if (o.senza) { const c = el("circle", { cx: X(o.y), cy: Y(hi) - 3, r: 4, fill: "none", stroke: css("--cold"), "stroke-width": 1.5, class: "pt" }, svg);
        const f = () => { SEL = o.y; leggi(P); }; c.addEventListener("click", f);
        c.addEventListener("pointermove", e => mostra(e, "<b>" + o.y + "</b>nessuna gelata nel periodo")); c.addEventListener("pointerleave", () => tip.style.opacity = 0); return; }
      const c = el("circle", { cx: X(o.y), cy: Y(o.x), r: SEL === o.y ? 6.5 : (o.x === ext ? 6 : 4.2), fill: o.x === ext ? css("--warm") : (o.y === SEL ? css("--ink") : css("--pine")), "fill-opacity": .85, class: "pt", "data-y": o.y }, svg);
      c.addEventListener("click", () => { SEL = SEL === o.y ? null : o.y; disegna(); leggi(P); });
      c.addEventListener("pointermove", e => mostra(e, "<b>" + o.y + "</b>" + dataIt(o) + "<br><span style=\"font-family:var(--mono)\">minima " + fmt(o.v) + " °C</span>"));
      c.addEventListener("pointerleave", () => tip.style.opacity = 0);
    });
    function mostra(e, h) { const r = box.getBoundingClientRect(); tip.innerHTML = h; tip.style.opacity = 1;
      tip.style.left = Math.min(r.width - 150, Math.max(4, e.clientX - r.left + 12)) + "px"; tip.style.top = Math.max(0, e.clientY - r.top - 54) + "px"; }
    // riepilogo
    const rec = V.reduce((a, b) => (TP === "aut" ? a.x <= b.x : a.x >= b.x) ? a : b);
    const med = V.reduce((s, o) => s + o.x, 0) / V.length, md = Math.round(med), mm = (() => { let m = 0; while (m < 11 && doy(m + 1, 1) <= md) m++; return { m, d: md - doy(m, 1) + 1 }; })();
    const rec10 = V.filter(o => o.y >= y1 - 29), m10 = rec10.length ? rec10.reduce((s, o) => s + o.x, 0) / rec10.length : null;
    const dd = x => { x = Math.round(x); let m = 0; while (m < 11 && doy(m + 1, 1) <= x) m++; return (x - doy(m, 1) + 1) + " " + MES[m]; };
    $("gl-kpi").innerHTML = `<div>Più ${TP === "aut" ? "precoce" : "tardiva"}<b>${dataIt(rec)} ${rec.y}</b></div><div>Data media (${V.length} anni)<b>${dd(med)}</b></div>` +
      `<div>Ultimi 30 anni<b>${m10 == null ? "–" : dd(m10)}</b></div><div>Tendenza<b>${T ? (T.dec > 0 ? "+" : "") + fmt(T.dec) + " giorni/decennio" : "–"}</b></div>`;
    const senza = P.filter(o => o.senza).length;
    $("gl-info").textContent = V.length + " anni con gelata" + (senza ? " · " + senza + " senza gelata nel periodo (cerchio vuoto in alto)" : "") + " · retta tratteggiata = tendenza lineare" + (S.y1 - S.y0 + 1 - P.length > 0 ? " · " + (S.y1 - S.y0 + 1 - P.length) + " anni esclusi per dati insufficienti o periodo non concluso" : "");
    const ord = V.slice().sort((a, b) => TP === "aut" ? a.x - b.x : b.x - a.x), est = ord.slice(0, 5), ult = ord.slice(-1)[0];
    $("gl-tab").innerHTML = "<tr><th>#</th><th>ANNO</th><th>DATA</th><th>MINIMA</th></tr>" + est.map((o, i) => `<tr><td>${i + 1}</td><td>${o.y}</td><td>${dataIt(o)}</td><td>${fmt(o.v)} °C</td></tr>`).join("") +
      `<tr><td colspan="4" style="color:var(--ink-faint);font-size:12px">All'estremo opposto: ${dataIt(ult)} ${ult.y}</td></tr>`;
    leggi(P);
  }
  function leggi(P) { const o = P.find(p => p.y === SEL), s = $("gl-sel");
    s.textContent = !o ? "Tocca o clicca un punto per leggere l'anno." : o.senza ? o.y + " · nessuna notte sotto 0 °C nel periodo." : o.y + " · " + dataIt(o) + " · minima " + fmt(o.v) + " °C"; }

  async function avvia() {
    try {
      const [b, f] = await Promise.all([borgo(), firenzuola()]);
      DATI.borgo = b; DATI.firenzuola = f; [b, f].forEach(S => S.res = calcola(S)); disegna();
    } catch (e) { $("gl").innerHTML = '<div class="loading">Dati non disponibili al momento.</div>'; console.error(e); }
  }
  document.querySelectorAll("#gl-st button").forEach(b => b.addEventListener("click", () => { ST = b.dataset.s; SEL = null; document.querySelectorAll("#gl-st button").forEach(x => x.setAttribute("aria-pressed", x === b)); disegna(); }));
  document.querySelectorAll("#gl-tp button").forEach(b => b.addEventListener("click", () => { TP = b.dataset.t; SEL = null; document.querySelectorAll("#gl-tp button").forEach(x => x.setAttribute("aria-pressed", x === b)); disegna(); }));
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(disegna, 150); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", disegna);
  avvia();
})();
