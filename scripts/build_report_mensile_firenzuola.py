#!/usr/bin/env python3
"""
Report climatologico mensile di Firenzuola, nello stesso formato di quelli di Borgo San Lorenzo
(reports/clima/AAAA-MM-borgo-san-lorenzo.html): pagina interattiva con Chart.js, stampabile in PDF.

Dati: serie giornaliera Eraclito di ARPAE (cella 01469, griglia di circa 5 km che contiene il capoluogo) in
data/serie/firenzuola.csv (data,prec,tmax,tmin), dal 1961: serve per il confronto di lungo periodo (1961–90 e 1991–2020).
La stazione ARPAE di Firenzuola (simnbo, 476 m: data/arpae/firenzuola/temp.csv e prec024.csv) e l'export Dexter
data/arpae/firenzuola/dexter-AAAA-MM.csv servono per i dettagli (orari degli estremi, picco di pioggia a 30 minuti) e per
un confronto: i valori della stazione e quelli della griglia sono simili ma non identici.
Lo stile e Chart.js sono presi dal report di Borgo San Lorenzo dello stesso mese (che deve già esserci).
I testi di sintesi sono scritti per ottobre 2026: per un altro mese vanno adattati.

Uso:  python3 scripts/build_report_mensile_firenzuola.py [AAAA-MM]      (default: 2026-10)
"""
import csv, datetime as dt, json, math, os, re, statistics as st, sys, zoneinfo
from collections import Counter

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MESE = sys.argv[1] if len(sys.argv) > 1 else "2026-10"
ANNO, M = int(MESE[:4]), int(MESE[5:])
NOMI = ["", "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]
NM = NOMI[M]
GG = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
ND = GG[M - 1]
BASE = range(1961, 1991)   # 1961–90, riferimento OMM
REC = range(1991, 2021)    # 1991–2020, ultimo trentennio

# ---- dati: griglia Eraclito (storico) ----
G = {}
for r in csv.DictReader(open(os.path.join(HERE, "data/serie/firenzuola.csv"))):
    G[r["data"]] = (float(r["prec"]), float(r["tmax"]), float(r["tmin"]))
iso = lambda y, m, d: f"{y}-{m:02d}-{d:02d}"

# ---- stazione e Dexter (dettagli) ----
S, SP = {}, {}
for r in csv.DictReader(open(os.path.join(HERE, "data/arpae/firenzuola/temp.csv")), delimiter=";"):
    S[r["data"]] = (float(r["max"]), float(r["min"]))
for r in csv.DictReader(open(os.path.join(HERE, "data/arpae/firenzuola/prec024.csv")), delimiter=";"):
    SP[r["data"]] = float(r["mm"])
TZ = zoneinfo.ZoneInfo("Europe/Rome")
dex = {}; cur = None
for l in open(os.path.join(HERE, f"data/arpae/firenzuola/dexter-{MESE}.csv"), encoding="utf-8").read().splitlines():
    if l.startswith("Inizio validità"):
        cur = l.split(",", 2)[2].split(" (")[0]; dex[cur] = []
    elif cur and re.match(r"^\d{4}-", l):
        p = l.split(",")
        if len(p) >= 3 and p[2] != "":
            dex[cur].append((dt.datetime.fromisoformat(p[0]), float(p[2])))
utc = lambda n: {a.strftime("%Y-%m-%d"): v for a, v in dex[n]}
dxx = utc("Temperatura dell'aria massima giornaliera a 2 m dal suolo")
dxn = utc("Temperatura dell'aria minima giornaliera a 2 m dal suolo")
dxp = utc("Precipitazione cumulata giornaliera")
for k in dxx:   # la stazione in archivio e l'export Dexter devono coincidere
    if k.startswith(MESE):
        assert abs(dxx[k] - S[k][0]) < .05 and abs(dxn[k] - S[k][1]) < .05 and abs(dxp[k] - SP[k]) < .05, ("Dexter diverso dall'archivio", k)
inst = [(a.astimezone(TZ), v) for a, v in dex["Temperatura dell'aria istantanea a 2 m dal suolo"] if a.astimezone(TZ).strftime("%Y-%m") == MESE]
r30 = [(a.astimezone(TZ), v) for a, v in dex["Precipitazione cumulata su 30 min"] if a.astimezone(TZ).strftime("%Y-%m") == MESE]
DEXTRA = dict(tx=max(inst, key=lambda x: x[1]), tn=min(inst, key=lambda x: x[1]), p30=sorted(r30, key=lambda x: -x[1])[:3])
sm = lambda f: st.mean(f(S[iso(ANNO, M, d)]) for d in range(1, ND + 1))
STAZ = dict(tm=sm(lambda v: (v[0] + v[1]) / 2), tx=sm(lambda v: v[0]), tn=sm(lambda v: v[1]), prec=sum(SP[iso(ANNO, M, d)] for d in range(1, ND + 1)),
            txmax=max(S[iso(ANNO, M, d)][0] for d in range(1, ND + 1)), tnmin=min(S[iso(ANNO, M, d)][1] for d in range(1, ND + 1)))

def it(v, n=1):
    return f"{v:,.{n}f}".replace(",", "X").replace(".", ",").replace("X", ".")
def sg(v, n=1):
    return ("+" if v > 0 else "−" if v < 0 else "") + it(abs(v), n)
def rank_desc(val, vals):
    return 1 + sum(1 for v in vals if v > val)
art = lambda n: "l’" if n in (8, 11, 18) or str(n).startswith("8") else "il "
dmy = lambda k: f"{int(k[8:])}/{k[5:7]}/{k[:4]}"
dm = lambda k: f"{int(k[8:])}/{k[5:7]}"

def theil_sen(xs, ys):
    return st.median((ys[j] - ys[i]) / (xs[j] - xs[i]) for i in range(len(xs)) for j in range(i + 1, len(xs)))
def mk_p(ys):
    n = len(ys); s = sum((ys[j] > ys[i]) - (ys[j] < ys[i]) for i in range(n) for j in range(i + 1, n))
    tie = sum(t * (t - 1) * (2 * t + 5) for t in Counter(ys).values())
    var = (n * (n - 1) * (2 * n + 5) - tie) / 18
    return math.erfc(abs((s - (1 if s > 0 else -1 if s < 0 else 0)) / math.sqrt(var)) / math.sqrt(2))

# ---- anni del mese (griglia) ----
years = {}
for y in range(1961, ANNO + 1):
    ds = [iso(y, M, d) for d in range(1, ND + 1)]
    a = [G[d] for d in ds]
    pr, tx, tn = [x[0] for x in a], [x[1] for x in a], [x[2] for x in a]
    i_tx = max(range(ND), key=lambda i: tx[i]); i_tn = min(range(ND), key=lambda i: tn[i])
    years[y] = dict(tm=st.mean((p + q) / 2 for p, q in zip(tx, tn)), tx=st.mean(tx), tn=st.mean(tn), txmax=max(tx), tnmin=min(tn),
                    dA=sum(v >= 25 for v in tx), dB=sum(v >= 20 for v in tx), n10=sum(v < 10 for v in tn), f5=sum(v <= 5 for v in tn),
                    f0=sum(v <= 0 for v in tn), tr=sum(v >= 20 for v in tn), prec=round(sum(pr), 1), rd=sum(v >= 1 for v in pr),
                    pmax=max(pr), dtx=tx, dtn=tn, txmax_d=ds[i_tx], tnmin_d=ds[i_tn])
Y = years[ANNO]
refv = lambda rng, k: [years[y][k] for y in rng]
mb = lambda k: st.mean(refv(BASE, k))
mr = lambda k: st.mean(refv(REC, k))
prior = [y for y in years if y < ANNO]

# ---- giornaliero con climatologia a 15 giorni (due riferimenti) ----
def finestra(d, rng):
    bx, bn = [], []
    for y in rng:
        for o in range(-7, 8):
            k = (dt.date(y, M, d) + dt.timedelta(days=o)).isoformat()
            if k in G: bx.append(G[k][1]); bn.append(G[k][2])
    return st.mean(bx), st.mean(bn)
daily = []
for d in range(1, ND + 1):
    tx, tn = Y["dtx"][d - 1], Y["dtn"][d - 1]
    bx, bn = finestra(d, BASE); rx, rn = finestra(d, REC)
    daily.append(dict(d=d, tx=tx, tn=tn, tm=round((tx + tn) / 2, 2), bx=round(bx, 2), bn=round(bn, 2), rx=round(rx, 2), rn=round(rn, 2),
                      atm=round((tx + tn) / 2 - (bx + bn) / 2, 2)))
prec_daily = [G[iso(ANNO, M, d)][0] for d in range(1, ND + 1)]
cum = lambda a: [round(sum(a[:i + 1]), 1) for i in range(len(a))]
prec_cum = cum(prec_daily)
prec_cum_clim = [round(st.mean(cum([G[iso(y, M, d)][0] for d in range(1, ND + 1)])[i] for y in REC), 1) for i in range(ND)]

FASI = [("1–12", 0, 12), ("13–22", 12, 22), ("23–31", 22, ND)]
ph_names = ["Inizio mite, con le prime piogge", "Variabile, notti fresche", "Verso il tardo autunno"]
F = []
for _, a, b in FASI:
    s = daily[a:b]
    F.append(dict(tx=st.mean(x["tx"] for x in s), tn=st.mean(x["tn"] for x in s), atm=st.mean(x["atm"] for x in s), p=sum(prec_daily[a:b])))

# giorni asciutti (< 1 mm) più lunghi
dry, run = [], None
for i, v in enumerate(prec_daily + [99]):
    if v < 1: run = (run[0], i) if run else (i, i)
    elif run: dry.append((run[1] - run[0] + 1, run[0] + 1, run[1] + 1)); run = None
dry = sorted(dry, reverse=True)[:3]

# ---- notti tropicali giu-ott (griglia) ----
tr_y = {y: [iso(y, m, d) for m in range(6, 11) for d in range(1, GG[m - 1] + 1) if iso(y, m, d) in G and G[iso(y, m, d)][2] >= 20] for y in years}
tr_month = {m: sum(1 for k in tr_y[ANNO] if int(k[5:7]) == m) for m in range(6, 11)}
tr_top = sorted(((y, len(v)) for y, v in tr_y.items()), key=lambda x: (-x[1], x[0]))
tr_season = len(tr_y[ANNO]); tr_rank = 1 + sum(1 for y, n in tr_top if n > tr_season)
tn_top = sorted(range(ND), key=lambda i: -Y["dtn"][i])[:5]
tx_top = sorted(range(ND), key=lambda i: -Y["dtx"][i])[:5]
tn_low = sorted(range(ND), key=lambda i: Y["dtn"][i])[:5]
dd = lambda i: f"{i + 1:02d}/{M:02d}/{ANNO}"

# ---- pioggia mensile gen-mese ----
mtot = lambda y, m: round(sum(G[iso(y, m, d)][0] for d in range(1, (29 if m == 2 and y % 4 == 0 else GG[m - 1]) + 1) if iso(y, m, d) in G), 1)
prec_month = [dict(m=m, v=mtot(ANNO, m), c=round(st.mean(mtot(y, m) for y in REC), 1)) for m in range(1, M + 1)]
prec_years = {y: years[y]["prec"] for y in years}

# ---- statistiche ----
xs = list(years)
trend = {k: dict(s=theil_sen(xs, [years[y][k] for y in xs]) * 10, p=mk_p([years[y][k] for y in xs])) for k in ("tm", "tx", "tn")}
dec = {}
for y in years: dec.setdefault(f"{y // 10 * 10}s", []).append(years[y])
dec = {k: dict(tx=st.mean(v["tx"] for v in vs), tn=st.mean(v["tn"] for v in vs), tm=st.mean(v["tm"] for v in vs), n=len(vs)) for k, vs in dec.items()}
top_tm = [dict(y=y, v=years[y]["tm"]) for y in sorted(years, key=lambda y: -years[y]["tm"])[:10]]
N = len(years)
R = dict(tm=rank_desc(Y["tm"], [years[y]["tm"] for y in prior]), tx=rank_desc(Y["tx"], [years[y]["tx"] for y in prior]),
         tn=rank_desc(Y["tn"], [years[y]["tn"] for y in prior]), N=N)
p_rank = rank_desc(Y["prec"], [years[y]["prec"] for y in prior])
p_med = st.median(years[y]["prec"] for y in prior)
rec_tx = max(years.items(), key=lambda kv: kv[1]["txmax"]); rec_tn = min(years.items(), key=lambda kv: kv[1]["tnmin"])
warmest = max(prior, key=lambda y: years[y]["tm"])
slope_y = trend["tm"]["s"] / 10
ts_int = st.median(years[y]["tm"] - slope_y * y for y in years)

D = dict(daily=daily, years={y: {k: (round(v, 2) if isinstance(v, float) else v) for k, v in years[y].items()} for y in years},
         base=dict(tm=mb("tm"), tx=mb("tx"), tn=mb("tn")), rec=dict(tm=mr("tm"), tx=mr("tx"), tn=mr("tn")), trend=trend, dec=dec, rank=R, top_tm=top_tm,
         tr_month=tr_month, tr_dates=[dict(d=dm(k)) for k in tr_y[ANNO]], tr_top=[dict(y=y, v=n) for y, n in tr_top[:6]], tr_season=tr_season,
         tr_rank=tr_rank, tn_top=[dict(d=dd(i), tn=Y["dtn"][i]) for i in tn_top], hot=[dict(d=dd(i), tx=Y["dtx"][i]) for i in tx_top],
         cold=[dict(d=dd(i), tn=Y["dtn"][i]) for i in tn_low], prec_daily=prec_daily, prec_cum=prec_cum, prec_cum_clim=prec_cum_clim,
         prec_years=prec_years, prec_clim=mr("prec"), prec_median=p_med, prec_rank=p_rank, rd_clim=mr("rd"),
         pmax_clim=mr("pmax"), prec_month=prec_month, dry=dry, F=F, warmest=warmest, tsIntercept=ts_int,
         rec_tx=dict(v=rec_tx[1]["txmax"], d=rec_tx[1]["txmax_d"]), rec_tn=dict(v=rec_tn[1]["tnmin"], d=rec_tn[1]["tnmin_d"]),
         kpi=dict(dtr=Y["tx"] - Y["tn"], dtr_base=mb("tx") - mb("tn")),
         dex=dict(p30=[[a.strftime("%H:%M"), v] for a, v in DEXTRA["p30"]]))

# ---------------- pagina ----------------
tpl = open(os.path.join(HERE, f"reports/clima/{MESE}-borgo-san-lorenzo.html"), encoding="utf-8").read()
head = tpl[:tpl.index("</style>") + len("</style>")].replace(f"{NM.capitalize()} {ANNO} · Borgo San Lorenzo · Clima Mugello", f"{NM.capitalize()} {ANNO} · Firenzuola · Clima Mugello")
cs = tpl.index("<script>/*!"); chartjs = tpl[cs:tpl.index("</script>", cs) + len("</script>")]

sub = (f"Firenzuola (FI) — un {NM} più mite del 1961–90 ({sg(Y['tm'] - mb('tm'))} °C) ma in linea con l’ultimo trentennio ({sg(Y['tm'] - mr('tm'))} °C), "
       f"con giorni tiepidi, notti fresche e molto meno pioggia: {it(Y['prec'])} mm contro {it(mr('prec'))} mm.")
body = f"""
<body>
<div class="wrap">

<header class="hero">
 <div class="kicker">Clima Mugello · Report climatologico mensile</div>
 <h1>{NM.capitalize()} <em>{ANNO}</em></h1>
 <p class="sub">{sub}</p>
 <div class="meta"><span>Firenzuola, cella ARPAE-Eraclito 01469 (quota media 580 m) · 44,138°N 11,403°E</span><span>Periodo: 01–{ND}/{M:02d}/{ANNO}</span><span>Serie giornaliera dal 1961 · bacino del Santerno</span></div>
</header>

<div class="kpis" id="kpis"></div>

<section>
 <h2><span class="n">01</span>Sintesi del mese</h2>
 <div class="callout" id="sintesi"></div>
</section>

<section>
 <h2><span class="n">02</span>Andamento giornaliero</h2>
 <p class="lead">Temperature massime e minime di ogni giorno, confrontate con la media del periodo di riferimento; sotto le precipitazioni giornaliere.</p>
 <div class="card">
  <div class="controls noprint">
   <span class="seg" id="refSeg"><button data-ref="b" class="on">Rif. 1961–90</button><button data-ref="r">Rif. 1991–2020</button></span>
   <label><input type="checkbox" id="chkBand" checked> mostra media di riferimento</label>
   <label><input type="checkbox" id="chkRain" checked> mostra pioggia</label>
  </div>
  <h3>Tmax, Tmin e pioggia — {NM} {ANNO}</h3>
  <p class="cap">Linee tratteggiate: media giornaliera del periodo di riferimento (smussata su 15 giorni). Barre azzurre: pioggia (asse destro).</p>
  <div class="chart tall"><canvas id="cDaily"></canvas></div>
 </div>
 <div class="card">
  <h3>Scarto giornaliero della temperatura media rispetto al 1961–90</h3>
  <p class="cap">Barre arancio = giorno più caldo della norma, blu = più fresco. Bande: le tre fasi del mese.</p>
  <div class="chart"><canvas id="cAnom"></canvas></div>
  <div id="phases" class="tblwrap" style="margin-top:10px"></div>
 </div>
</section>

<section class="pb">
 <h2><span class="n">03</span>{NM.capitalize()} {ANNO} nella serie storica</h2>
 <p class="lead">Temperatura media di tutti gli ottobri dal 1961. Clicca una barra per confrontare quell’anno con il {ANNO}.</p>
 <div class="card">
  <h3>Temperatura media di {NM}, 1961–{ANNO}</h3>
  <p class="cap">Arancio: sopra la media 1961–90; blu: sotto. Linea tratteggiata: tendenza (Theil–Sen). Il {ANNO} è evidenziato.</p>
  <div class="chart tall"><canvas id="cSeries"></canvas></div>
 </div>
 <div class="grid2">
  <div class="card"><h3>Classifica: i 10 ottobri più caldi</h3><div class="tblwrap" id="topTbl"></div></div>
  <div class="card"><h3>Medie per decennio</h3><div class="tblwrap" id="decTbl"></div></div>
 </div>
 <div class="card">
  <div class="controls noprint"><label>Confronta con l’ottobre del <select id="selYear"></select></label></div>
  <h3 id="cmpTitle">Confronto</h3>
  <p class="cap">Linee continue: {ANNO}. Tratteggiate: anno scelto.</p>
  <div class="chart"><canvas id="cCmp"></canvas></div>
  <div id="cmpSum" class="mono" style="font-size:.82rem;margin-top:8px;color:var(--mute)"></div>
 </div>
</section>

<section>
 <h2><span class="n">04</span>Caldo e fresco: soglie ed estremi</h2>
 <div class="grid2 w15">
  <div class="card"><h3>Indici termici del mese</h3><div class="tblwrap" id="idxTbl"></div></div>
  <div class="card"><h3>Giorni con Tmax ≥ 20 °C per anno</h3><p class="cap">Ultimi 30 ottobri disponibili.</p><div class="chart short"><canvas id="cD30"></canvas></div></div>
 </div>
 <div class="grid2">
  <div class="card"><h3>I 5 giorni più caldi</h3><div class="tblwrap" id="hotTbl"></div></div>
  <div class="card"><h3>Le 5 notti più fresche</h3><div class="tblwrap" id="coldTbl"></div></div>
 </div>
</section>

<section class="pb">
 <h2><span class="n">05</span>Notti tropicali (Tmin ≥ 20 °C)</h2>
 <div class="card">
  <div class="tropo">
   <div class="big0">0<span>notti tropicali<br>a {NM} {ANNO}</span></div>
   <div id="tropoTxt"></div>
  </div>
 </div>
 <div class="grid2">
  <div class="card"><h3>Notti tropicali per mese, {ANNO}</h3><p class="cap">Stagione giugno–ottobre.</p><div class="chart short"><canvas id="cTropoM"></canvas></div></div>
  <div class="card"><h3>Estati con più notti tropicali (giu–ott)</h3><div class="tblwrap" id="tropoTop"></div></div>
 </div>
</section>

<section>
 <h2><span class="n">06</span>Precipitazioni</h2>
 <p class="lead">Pioggia giornaliera della cella ARPAE-Eraclito, serie dal 1961. I dati recenti possono essere rettificati da ARPAE dopo la validazione.</p>
 <div class="grid2">
  <div class="card"><h3>Pioggia cumulata nel mese</h3><p class="cap" id="capCum"></p><div class="chart"><canvas id="cCum"></canvas></div></div>
  <div class="card"><h3>Pioggia mensile {ANNO} vs media 1991–2020</h3><p class="cap">Gennaio–{NM}, mm.</p><div class="chart"><canvas id="cPM"></canvas></div></div>
 </div>
 <div class="card"><h3>Pioggia di {NM} per anno, 1961–{ANNO}</h3><p class="cap">Linea gialla: media 1991–2020.</p><div class="chart short"><canvas id="cPY"></canvas></div></div>
 <div class="callout b" id="precTxt"></div>
</section>

<section class="pb">
 <h2><span class="n">07</span>Tabella statistica completa</h2>
 <div class="card"><div class="tblwrap" id="statTbl"></div></div>
</section>

<section>
 <h2><span class="n">08</span>Note metodologiche e qualità dei dati</h2>
 <ul class="notes" id="notes"></ul>
</section>

<footer>
 <div><b>Elaborato da L.Varlani</b> · Clima Mugello</div>
 <div>Fonte dati: ARPAE Emilia-Romagna (SIMC), dataset Eraclito, cella 01469 di Firenzuola; stazione simnbo per i dettagli</div>
</footer>
</div>
"""

js = r"""
const IT=(v,n=1)=>v==null?'–':Number(v).toLocaleString('it-IT',{minimumFractionDigits:n,maximumFractionDigits:n});
const sg=(v,n=1)=>(v>0?'+':v<0?'−':'')+IT(Math.abs(v),n);
const C={hot:'#D9640F',hot2:'#F5883B',cold:'#2B74C4',ink:'#1B1F2A',mute:'#5E6472',line:'#E4DCCB',gold:'#B8860B',rain:'#5AA9E6'};
const Y=D.years,Y26=Y[__ANNO__],yrs=Object.keys(Y).map(Number).sort((a,b)=>a-b);
const MESI=['','gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
Chart.defaults.font.family='"Instrument Sans",system-ui,sans-serif';Chart.defaults.font.size=12;Chart.defaults.color=C.mute;
if(window.__PRINT__) Chart.defaults.animation=false; else Chart.defaults.animation.duration=500;
Chart.defaults.maintainAspectRatio=false;
Chart.defaults.plugins.legend.labels.usePointStyle=true;Chart.defaults.plugins.legend.labels.boxWidth=8;
const grid={color:'rgba(94,100,114,.15)'};
const ND=__ND__,days=[...Array(ND)].map((_,i)=>i+1);
const mean=a=>{a=a.filter(v=>v!=null);return a.reduce((x,y)=>x+y,0)/a.length};
const baseYrs=yrs.filter(y=>y>=1961&&y<=1990),recYrs=yrs.filter(y=>y>=1991&&y<=2020);
const dTm=Y26.tm-D.base.tm;
const FASI=__FASI__;
const dm=s=>+s.slice(8)+'/'+s.slice(5,7), dmy=s=>dm(s)+'/'+s.slice(0,4);

/* KPI */
(function(){const r=D.rank;
const cl=v=>v>=0?'up':'dn';
const items=[
['Temp. media',IT(Y26.tm)+'<small> °C</small>',`<span class="${cl(dTm)}">${sg(dTm)} °C</span> vs 1961–90 · ${r.tm}° su ${r.N}`,''],
['Tmax media',IT(Y26.tx)+'<small> °C</small>',`<span class="${cl(Y26.tx-D.base.tx)}">${sg(Y26.tx-D.base.tx)} °C</span> · ${r.tx}° su ${r.N}`,''],
['Tmin media',IT(Y26.tn)+'<small> °C</small>',`<span class="${cl(Y26.tn-D.base.tn)}">${sg(Y26.tn-D.base.tn)} °C</span> · ${r.tn}° su ${r.N}`,'c'],
['Massima assoluta',IT(Y26.txmax)+'<small> °C</small>',`${dm(Y26.txmax_d)} · record di ottobre ${IT(D.rec_tx.v)} °C (${dmy(D.rec_tx.d)})`,''],
['Minima assoluta',IT(Y26.tnmin)+'<small> °C</small>',`${dm(Y26.tnmin_d)} · record di ottobre ${IT(D.rec_tn.v)} °C (${dmy(D.rec_tn.d)})`,'c'],
['Pioggia totale',IT(Y26.prec)+'<small> mm</small>',`<span class="dn">${sg((Y26.prec/D.prec_clim-1)*100,0)}%</span> vs media 1991–2020 (${IT(D.prec_clim)} mm)`,'g'],
];
document.getElementById('kpis').innerHTML=items.map(i=>`<div class="kpi ${i[3]}"><div class="l">${i[0]}</div><div class="v">${i[1]}</div><div class="d">${i[2]}</div></div>`).join('');})();

/* Sintesi */
document.getElementById('sintesi').innerHTML=__SINTESI__;

/* phases table */
(function(){const F=D.F;
let h='<table><tr><th>Fase</th><th></th><th>Tmax media</th><th>Tmin media</th><th>Scarto Tmedia</th><th>Pioggia</th></tr>';
FASI.forEach((p,i)=>{const f=F[i];
h+=`<tr><td class="mono">${p[0]} ${MESI[__M__]}</td><td style="text-align:left">${p[1]}</td><td class="m">${IT(f.tx)}</td><td class="m">${IT(f.tn)}</td><td class="m ${f.atm>0?'up':'dn'}">${sg(f.atm)}</td><td class="m">${IT(f.p)} mm</td></tr>`});
document.getElementById('phases').innerHTML=h+'</table>';})();

/* plugins */
const phaseBands={id:'bands',beforeDatasetsDraw(c){const x=c.scales.x,a=c.chartArea,ctx=c.ctx;const P=[[0,11.5,'rgba(217,100,15,.07)'],[11.5,21.5,'rgba(90,100,114,.06)'],[21.5,ND-.5,'rgba(43,116,196,.08)']];
 P.forEach(p=>{const x0=x.getPixelForValue(Math.max(p[0],0)),x1=x.getPixelForValue(Math.min(p[1],ND-1));ctx.fillStyle=p[2];ctx.fillRect(x0-(p[0]==0?x.width/(2*ND):0),a.top,x1-x0+(p[1]>=ND-1?x.width/(2*ND):0),a.bottom-a.top)});}};
const tt={backgroundColor:'#1B1F2A',titleColor:'#fff',bodyColor:'#fff',padding:10,cornerRadius:8,boxPadding:4};
const lbl=days.map(d=>d);
const xAx={grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:15},title:{display:false}};

/* Daily chart */
let ref='b';
const cD=new Chart(document.getElementById('cDaily'),{type:'line',data:{labels:lbl,datasets:[]},options:{interaction:{mode:'index',intersect:false},
 scales:{x:{...xAx,title:{display:true,text:'giorno di __NM__'}},y:{grid,title:{display:true,text:'°C'},suggestedMin:0,suggestedMax:32},yp:{position:'right',grid:{display:false},min:0,max:60,title:{display:true,text:'mm'},ticks:{callback:v=>v<=30?v:''}}},
 plugins:{tooltip:{...tt,callbacks:{title:i=>i[0].label+' __NM__ __ANNO__',label:c=>`${c.dataset.label}: ${IT(c.parsed.y)} ${c.dataset.yAxisID=='yp'?'mm':'°C'}`}}}},plugins:[phaseBands]});
function updDaily(){const band=document.getElementById('chkBand').checked,rain=document.getElementById('chkRain').checked;
 const bx=D.daily.map(d=>ref=='b'?d.bx:d.rx),bn=D.daily.map(d=>ref=='b'?d.bn:d.rn),rl=ref=='b'?'1961–90':'1991–2020';
 const ds=[];
 if(rain)ds.push({type:'bar',label:'Pioggia',data:D.prec_daily,backgroundColor:'rgba(90,169,230,.7)',yAxisID:'yp',order:5,barPercentage:.7});
 ds.push({type:'line',label:'Tmax __ANNO__',data:D.daily.map(d=>d.tx),borderColor:C.hot,backgroundColor:C.hot,tension:.25,pointRadius:3,borderWidth:2.5,order:1});
 ds.push({type:'line',label:'Tmin __ANNO__',data:D.daily.map(d=>d.tn),borderColor:C.cold,backgroundColor:C.cold,tension:.25,pointRadius:3,borderWidth:2.5,order:2});
 if(band){ds.push({type:'line',label:'Tmax media '+rl,data:bx,borderColor:C.hot2,borderDash:[6,4],pointRadius:0,borderWidth:1.6,order:3});
  ds.push({type:'line',label:'Tmin media '+rl,data:bn,borderColor:'#6FA8E0',borderDash:[6,4],pointRadius:0,borderWidth:1.6,order:4});}
 cD.data.datasets=ds;cD.options.scales.yp.display=rain;cD.update();}
document.getElementById('chkBand').onchange=updDaily;document.getElementById('chkRain').onchange=updDaily;
document.querySelectorAll('#refSeg button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#refSeg button').forEach(x=>x.classList.remove('on'));b.classList.add('on');ref=b.dataset.ref;updDaily()});
updDaily();

/* Anomaly */
new Chart(document.getElementById('cAnom'),{type:'bar',data:{labels:lbl,datasets:[{label:'Scarto Tmedia',data:D.daily.map(d=>d.atm),backgroundColor:D.daily.map(d=>d.atm>=0?C.hot:C.cold),borderRadius:2}]},
 options:{scales:{x:xAx,y:{grid,title:{display:true,text:'°C rispetto a 1961–90'}}},plugins:{legend:{display:false},tooltip:{...tt,callbacks:{title:i=>i[0].label+' __NM__',label:c=>`Scarto: ${sg(c.parsed.y)} °C (Tmedia ${IT(D.daily[c.dataIndex].tm)} °C)`}}}},plugins:[phaseBands]});

/* Series */
const slope=D.trend.tm.s/10;
let selYear=D.warmest;
const trendY=yrs.map(y=>D.tsIntercept+slope*y);
const cS=new Chart(document.getElementById('cSeries'),{type:'bar',data:{labels:yrs,datasets:[
 {type:'bar',label:'Tmedia __NM__',data:yrs.map(y=>Y[y].tm),backgroundColor:yrs.map(y=>y==__ANNO__?'#1B1F2A':Y[y].tm>=D.base.tm?'rgba(217,100,15,.78)':'rgba(43,116,196,.7)'),borderRadius:2,order:2},
 {type:'line',label:`Tendenza ${sg(D.trend.tm.s,2)} °C/decennio (p=${IT(D.trend.tm.p,2)})`,data:trendY,borderColor:C.ink,borderDash:[6,4],pointRadius:0,borderWidth:1.5,order:1},
 {type:'line',label:'Media 1961–90',data:yrs.map(()=>D.base.tm),borderColor:C.gold,pointRadius:0,borderWidth:1.5,order:0}]},
 options:{scales:{x:{...xAx,ticks:{autoSkip:true,maxTicksLimit:14,maxRotation:0}},y:{grid,min:9,title:{display:true,text:'°C'}}},
 onClick:(e,els)=>{if(els.length&&els[0].datasetIndex==0){const y=yrs[els[0].index];if(y!=__ANNO__){selYear=y;document.getElementById('selYear').value=y;updCmp();}}},
 onHover:(e,els)=>{e.native.target.style.cursor=els.length?'pointer':'default'},
 plugins:{tooltip:{...tt,callbacks:{title:i=>'__NM_C__ '+i[0].label,label:c=>c.datasetIndex==0?`Tmedia ${IT(c.parsed.y)} °C (${sg(c.parsed.y-D.base.tm)} vs 1961–90)`:c.dataset.label}}}}});

/* tables */
document.getElementById('topTbl').innerHTML='<table><tr><th>#</th><th>Anno</th><th>Tmedia</th><th>Scarto</th></tr>'+D.top_tm.map((r,i)=>`<tr class="${r.y==__ANNO__?'hl':''}"><td class="m">${i+1}</td><td class="m">${r.y}</td><td class="m">${IT(r.v,2)}</td><td class="m">${sg(r.v-D.base.tm,2)}</td></tr>`).join('')+'</table>';
document.getElementById('decTbl').innerHTML='<table><tr><th>Decennio</th><th>Tmax</th><th>Tmin</th><th>Tmedia</th><th>n</th></tr>'+Object.entries(D.dec).map(([k,v])=>`<tr class="${k=='2020s'?'hl':''}"><td class="m">${k}</td><td class="m">${IT(v.tx)}</td><td class="m">${IT(v.tn)}</td><td class="m">${IT(v.tm)}</td><td class="m">${v.n}</td></tr>`).join('')+`</table><p class="cap" style="margin-top:6px">Decennio 2020s: 2020–25 + __ANNO__. n = anni validi.</p>`;

/* compare */
const sel=document.getElementById('selYear');sel.innerHTML=yrs.filter(y=>y!=__ANNO__).reverse().map(y=>`<option value="${y}">${y}</option>`).join('');sel.value=selYear;
const cC=new Chart(document.getElementById('cCmp'),{type:'line',data:{labels:lbl,datasets:[]},options:{interaction:{mode:'index',intersect:false},scales:{x:xAx,y:{grid,title:{display:true,text:'°C'}}},plugins:{tooltip:{...tt,callbacks:{label:c=>`${c.dataset.label}: ${IT(c.parsed.y)} °C`}}}}});
function updCmp(){const y=Y[selYear];document.getElementById('cmpTitle').textContent=`__NM_C__ __ANNO__ vs __NM__ ${selYear}`;
 cC.data.datasets=[{label:'Tmax __ANNO__',data:Y26.dtx,borderColor:C.hot,backgroundColor:C.hot,tension:.25,pointRadius:2,borderWidth:2.4},{label:'Tmin __ANNO__',data:Y26.dtn,borderColor:C.cold,backgroundColor:C.cold,tension:.25,pointRadius:2,borderWidth:2.4},
 {label:'Tmax '+selYear,data:y.dtx,borderColor:C.hot2,borderDash:[6,4],tension:.25,pointRadius:0,borderWidth:1.8},{label:'Tmin '+selYear,data:y.dtn,borderColor:'#6FA8E0',borderDash:[6,4],tension:.25,pointRadius:0,borderWidth:1.8}];cC.update();
 document.getElementById('cmpSum').innerHTML=`Tmedia ${IT(Y26.tm,2)} vs ${IT(y.tm,2)} °C (${sg(Y26.tm-y.tm,2)}) · Tmax ${IT(Y26.tx,2)} vs ${IT(y.tx,2)} (${sg(Y26.tx-y.tx,2)}) · Tmin ${IT(Y26.tn,2)} vs ${IT(y.tn,2)} (${sg(Y26.tn-y.tn,2)}) · giorni ≥20 °C: ${Y26.dB} vs ${y.dB}`;}
sel.onchange=()=>{selYear=+sel.value;updCmp()};updCmp();

/* indices */
(function(){const bm=f=>mean(baseYrs.map(y=>Y[y][f])),rm=f=>mean(recYrs.map(y=>Y[y][f]));
const rows=[['Giorni Tmax ≥25 °C',Y26.dA,bm('dA'),rm('dA')],['Giorni Tmax ≥20 °C',Y26.dB,bm('dB'),rm('dB')],['Notti Tmin <10 °C',Y26.n10,bm('n10'),rm('n10')],['Notti Tmin ≤5 °C',Y26.f5,bm('f5'),rm('f5')],['Notti con gelo (≤0 °C)',Y26.f0,bm('f0'),rm('f0')],['Notti tropicali (≥20 °C)',Y26.tr,bm('tr'),rm('tr')],['Escursione media',IT(D.kpi.dtr)+' °C',IT(D.kpi.dtr_base)+' °C',null]];
document.getElementById('idxTbl').innerHTML='<table><tr><th>Indice</th><th>__ANNO__</th><th>1961–90</th><th>1991–2020</th></tr>'+rows.map(r=>`<tr><td>${r[0]}</td><td class="m"><b>${r[1]}</b></td><td class="m">${typeof r[2]=='string'?r[2]:IT(r[2])}</td><td class="m">${r[3]==null?'–':IT(r[3])}</td></tr>`).join('')+'</table>';
document.getElementById('hotTbl').innerHTML='<table><tr><th>Data</th><th>Tmax</th></tr>'+D.hot.map(r=>`<tr><td class="m">${r.d}</td><td class="m">${IT(r.tx)} °C</td></tr>`).join('')+'</table>';
document.getElementById('coldTbl').innerHTML='<table><tr><th>Data</th><th>Tmin</th></tr>'+D.cold.map(r=>`<tr><td class="m">${r.d}</td><td class="m">${IT(r.tn)} °C</td></tr>`).join('')+'</table>';
const last=yrs.slice(-30);new Chart(document.getElementById('cD30'),{type:'bar',data:{labels:last,datasets:[{data:last.map(y=>Y[y].dB),backgroundColor:last.map(y=>y==__ANNO__?'#1B1F2A':'rgba(217,100,15,.75)'),borderRadius:2}]},options:{scales:{x:{...xAx,ticks:{maxRotation:90,minRotation:90,autoSkip:true,maxTicksLimit:30,font:{size:10}}},y:{grid,beginAtZero:true,ticks:{precision:0}}},plugins:{legend:{display:false},tooltip:{...tt,callbacks:{title:i=>'__NM_C__ '+i[0].label,label:c=>c.parsed.y+' giorni'}}}}});})();

/* tropical */
(function(){const tr=D.tr_dates.map(t=>t.d).join(' e ');
document.getElementById('tropoTxt').innerHTML=__TROPO__;
new Chart(document.getElementById('cTropoM'),{type:'bar',data:{labels:['Giu','Lug','Ago','Set','Ott'],datasets:[{data:[6,7,8,9,10].map(m=>D.tr_month[m]),backgroundColor:[C.hot,C.hot,C.hot,C.cold,C.cold],borderRadius:3}]},options:{scales:{x:{grid:{display:false}},y:{grid,beginAtZero:true,ticks:{precision:0},suggestedMax:4}},plugins:{legend:{display:false},tooltip:{...tt,callbacks:{label:c=>c.parsed.y+' notti'}}}}});
document.getElementById('tropoTop').innerHTML='<table><tr><th>#</th><th>Anno</th><th>Notti (giu–ott)</th></tr>'+D.tr_top.map((r,i)=>`<tr class="${r.y==__ANNO__?'hl':''}"><td class="m">${i+1}</td><td class="m">${r.y}</td><td class="m">${r.v}</td></tr>`).join('')+'</table>';})();

/* precipitation */
(function(){document.getElementById('capCum').textContent=`Linea piena: __ANNO__. Tratteggio: media cumulata 1991–2020 (30 anni).`;
new Chart(document.getElementById('cCum'),{type:'line',data:{labels:lbl,datasets:[{label:'__ANNO__',data:D.prec_cum,borderColor:C.cold,backgroundColor:'rgba(43,116,196,.15)',fill:true,tension:0,pointRadius:0,borderWidth:2.5},{label:'Media 1991–2020',data:D.prec_cum_clim,borderColor:C.mute,borderDash:[6,4],pointRadius:0,borderWidth:1.8}]},options:{interaction:{mode:'index',intersect:false},scales:{x:xAx,y:{grid,beginAtZero:true,title:{display:true,text:'mm cumulati'}}},plugins:{tooltip:{...tt,callbacks:{title:i=>i[0].label+' __NM__',label:c=>`${c.dataset.label}: ${IT(c.parsed.y)} mm`}}}}});
new Chart(document.getElementById('cPM'),{type:'bar',data:{labels:D.prec_month.map(m=>MESI[m.m]),datasets:[{label:'__ANNO__',data:D.prec_month.map(m=>m.v),backgroundColor:C.cold,borderRadius:2},{label:'Media 1991–2020',data:D.prec_month.map(m=>m.c),backgroundColor:'rgba(94,100,114,.45)',borderRadius:2}]},options:{scales:{x:{grid:{display:false}},y:{grid,beginAtZero:true}},plugins:{tooltip:{...tt,callbacks:{label:c=>`${c.dataset.label}: ${IT(c.parsed.y)} mm`}}}}});
const py=Object.keys(D.prec_years).map(Number);new Chart(document.getElementById('cPY'),{type:'bar',data:{labels:py,datasets:[{label:'Pioggia __NM__',data:py.map(y=>D.prec_years[y]),backgroundColor:py.map(y=>y==__ANNO__?'#1B1F2A':'rgba(43,116,196,.7)'),borderRadius:2},{type:'line',label:'Media 1991–2020',data:py.map(()=>D.prec_clim),borderColor:C.gold,pointRadius:0,borderWidth:1.6}]},options:{scales:{x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:14}},y:{grid,beginAtZero:true,title:{display:true,text:'mm'}}},plugins:{legend:{display:false},tooltip:{...tt,callbacks:{title:i=>'__NM_C__ '+i[0].label,label:c=>`${IT(c.parsed.y)} mm`}}}}});
document.getElementById('precTxt').innerHTML=__PREC__;})();

/* stat table */
(function(){const bm=f=>mean(baseYrs.map(y=>Y[y][f])),rm=f=>mean(recYrs.map(y=>Y[y][f]));
const R=[['Temperatura media (°C)','tm',1],['Media delle massime (°C)','tx',1],['Media delle minime (°C)','tn',1],['Massima del mese (°C; media degli ottobri)','txmax',1],['Minima del mese (°C; media degli ottobri)','tnmin',1],['Giorni Tmax ≥ 25 °C','dA',0],['Giorni Tmax ≥ 20 °C','dB',0],['Notti con Tmin < 10 °C','n10',0],['Notti tropicali','tr',0],['Precipitazione totale (mm)','prec',1],['Giorni di pioggia (≥1 mm)','rd',0]];
let h=`<table><tr><th>Indicatore</th><th>__NM_A__ __ANNO__</th><th>Media 1961–90 (${baseYrs.length} anni)</th><th>Scarto</th><th>Media 1991–2020 (${recYrs.length} anni)</th><th>Scarto</th></tr>`;
R.forEach(r=>{const v=Y26[r[1]];h+=`<tr><td>${r[0]}</td><td class="m"><b>${r[2]?IT(v):v}</b></td><td class="m">${IT(bm(r[1]))}</td><td class="m">${sg(v-bm(r[1]))}</td><td class="m">${IT(rm(r[1]))}</td><td class="m">${sg(v-rm(r[1]))}</td></tr>`});
h+=`</table><p class="cap" style="margin-top:8px">Tendenza lineare della Tmedia di __NM__ 1961–__ANNO__ (pendenza di Theil–Sen, test di Mann–Kendall): ${sg(D.trend.tm.s,2)} °C/decennio (p = ${IT(D.trend.tm.p,3)}), Tmax ${sg(D.trend.tx.s,2)} (p = ${IT(D.trend.tx.p,3)}), Tmin ${sg(D.trend.tn.s,2)} (p = ${IT(D.trend.tn.p,3)}): __TRENDTXT__</p>`;
document.getElementById('statTbl').innerHTML=h;})();

/* notes */
document.getElementById('notes').innerHTML=[
`<b>Fonte.</b> ARPAE Emilia-Romagna, SIMC, dataset giornaliero <b>Eraclito</b> (temperatura massima e minima, precipitazione), cella 01469 di circa 5 km che contiene il capoluogo di Firenzuola (centro 44,138° N 11,403° E, quota media 580 m, bacino del Santerno), dal 1961 al __ULTIMO__. Eraclito non è una stazione: sono valori ottenuti interpolando le misure delle stazioni vicine, quindi smussano gli estremi locali. Tmedia giornaliera = (Tmax+Tmin)/2. Notte tropicale: Tmin ≥ 20 °C; giorno di pioggia: ≥ 1 mm; climatologia giornaliera: media su una finestra di 15 giorni centrata sul giorno.`,
`<b>Periodi di riferimento.</b> 1961–90 (30 anni, riferimento OMM) e 1991–2020 (30 anni, ultimo trentennio climatologico): tutti gli ottobri del 1961–__ANNO__ hanno tutti e __ND__ i giorni validi, nessun mese è stato escluso o stimato. Il __ANNO__ non entra nelle medie di riferimento. La classifica è su __NANNI__ anni.`,
`<b>Qualità del dato.</b> I valori recenti sono provvisori: ARPAE li ricalcola quando arrivano nuovi dati di stazione, quindi i totali e le temperature di __NM__ __ANNO__ potrebbero cambiare di qualche decimo. Non ci sono casi di Tmax inferiore a Tmin né precipitazioni negative.`,
`<b>Confronto con la stazione.</b> Nella stessa area la stazione ARPAE di Firenzuola (codice simnbo, 476 m, 44,122° N 11,375° E) ha misurato a __NM__ __ANNO__: Tmedia __S_TM__ °C, Tmax media __S_TX__ °C, Tmin media __S_TN__ °C, pioggia __S_P__ mm (massima __S_TXM__ °C, minima __S_TNM__ °C), cioè valori simili ma non uguali a quelli della griglia: negli ultimi vent’anni la griglia ha in media massime più basse di circa 0,7 °C, minime più alte di circa 0,4 °C e pioggia più bassa del 3%. Il report di settembre 2026 di Firenzuola era invece sulla stazione, con riferimento 2002–2025.`,
`<b>Dettagli dalla stazione.</b> Dall’esportazione Dexter (ARPAE-SIMC) a 30 minuti della stazione: la massima di __NM__ è stata registrata __DEXTX__ ora italiana, la minima __DEXTN__; il picco di pioggia è stato di __DEXP__ mm in 30 minuti. I valori giornalieri della stazione coincidono con l’archivio in tutti i __ND__ giorni. Il giorno ARPAE è il giorno UTC (00–24 UTC), cioè dall’1:00 o dalle 2:00 ora italiana.`,
`<b>Valori storici.</b> I record citati sono quelli della serie 1961–__ANNO__ della cella (massima __RECTX__ °C il __RECTXD__, minima __RECTN__ °C il __RECTND__). I dati degli anni ’60–’70 sono interpolati su poche stazioni e non sono stati sottoposti a verifica di omogeneità. Il confronto con Borgo San Lorenzo, a 196 m, non è diretto: Firenzuola sta più in alto e in una valle più stretta.`
].map(t=>`<li>${t}</li>`).join('');

/* orientation / resize robustness */
function rs(){Object.values(Chart.instances).forEach(c=>c.resize())}
window.addEventListener('orientationchange',()=>setTimeout(rs,250));window.addEventListener('resize',()=>{clearTimeout(window.__t);window.__t=setTimeout(rs,120)});
"""

# ---- testi con i numeri calcolati ----
n10 = Y["n10"]
mx_n10 = max(years[y]["n10"] for y in prior)
if n10 > mx_n10: n10_txt = "il valore più alto della serie"
elif n10 == mx_n10: n10_txt = f"il massimo della serie, a pari merito con {' e '.join(str(y) for y in prior if years[y]['n10'] == n10)}"
else: n10_txt = f"tra i valori più alti: {rank_desc(n10, [years[y]['n10'] for y in prior])}° su {N}"
sint = f"""
<p><b>{NM.capitalize()} {ANNO} è stato più mite del 1961–90 di {it(Y['tm'] - mb('tm'))} °C ma in linea con il trentennio recente</b>: media {it(Y['tm'])} °C contro {it(mb('tm'))} °C del 1961–90 e {it(mr('tm'))} °C del 1991–2020 ({sg(Y['tm'] - mr('tm'))} °C), {art(R['tm'])}{R['tm']}° più caldo di {N} {NM[:-1]}i della serie di Firenzuola. Il bilancio nasconde due andamenti: le massime sono salite a {it(Y['tx'])} °C ({sg(Y['tx'] - mb('tx'))} °C sul 1961–90, {sg(Y['tx'] - mr('tx'))} °C sul 1991–2020; {R['tx']}° posto), mentre le minime, {it(Y['tn'])} °C, sono sotto la norma ({sg(Y['tn'] - mb('tn'))} °C sul 1961–90, {sg(Y['tn'] - mr('tn'))} °C sul 1991–2020; {R['tn']}ª). L’escursione termica media è stata di {it(Y['tx'] - Y['tn'])} °C contro {it(mb('tx') - mb('tn'))} °C del 1961–90. Le notti sotto i 10 °C sono state <b>{n10} su {ND}</b> ({n10_txt}; media 1961–90: {it(mb('n10'))}); nessuna gelata, con una minima di {it(Y['tnmin'])} °C il {int(Y['tnmin_d'][8:])} ({it(STAZ['tnmin'])} °C alla stazione, alle {DEXTRA['tn'][0].strftime('%-H:%M')}).</p>
<p>Tre fasi: <b>1–12 {NM[:3]}</b>, inizio mite (massime fino a {it(Y['txmax'])} °C il {int(Y['txmax_d'][8:])}) con le prime piogge del mese il 7–8 ({it(prec_daily[6] + prec_daily[7])} mm) e il 12; <b>13–22</b>, giorni asciutti con notti fresche (la minima di {it(Y['dtn'][13])} °C il 14) e un breve passaggio piovoso il 20–21 ({it(prec_daily[19] + prec_daily[20])} mm); <b>23–31</b>, scivolata verso condizioni tardo-autunnali, con massime medie di {it(F[2]['tx'])} °C e minime di {it(F[2]['tn'])} °C ({sg(F[2]['atm'])} °C sul 1961–90), dopo il giorno più piovoso del mese, il 23 con {it(prec_daily[22])} mm.</p>
<p>Il mese è stato <b>molto asciutto</b>: {it(Y['prec'])} mm in {Y['rd']} giorni piovosi, il {it((1 - Y['prec'] / mr('prec')) * 100, 0)}% in meno della media 1991–2020 ({it(mr('prec'))} mm), {art(p_rank)}{p_rank}° valore su {N} ({N + 1 - p_rank}° più secco). Nessuna notte tropicale a {NM}; la stagione giugno–ottobre chiude con {tr_season} notti tropicali ({', '.join(dm(k) for k in tr_y[ANNO])}).</p>"""
tropo = f"""`<p>A {NM} {ANNO} la <b>minima più alta è stata ${{IT(D.tn_top[0].tn)}} °C</b> il ${{D.tn_top[0].d}}: ${{IT(20-D.tn_top[0].tn)}} °C sotto la soglia delle notti tropicali. Le notti sono rimaste in gran parte sotto i 10 °C: ${{Y26.n10}} su ${{ND}}.</p>
<p>A ottobre le notti tropicali sono eccezionali: in ${{yrs.length}} ottobri dal 1961 se ne contano ${{yrs.reduce((a,y)=>a+Y[y].tr,0)}} in tutto.</p>
<p>Nel complesso della stagione <b>giugno–ottobre {ANNO}</b> se ne contano <b>${{D.tr_season}}</b> (${{tr}}), tutte tra luglio e agosto: ${{D.tr_rank}}ª posizione nella serie, lontana dalle ${{D.tr_top[0].v}} del ${{D.tr_top[0].y}}.</p>`"""
prec_txt = f"""`<p><b>${{IT(Y26.prec)}} mm in ${{Y26.rd}} giorni piovosi (≥1 mm)</b>: ${{sg((Y26.prec/D.prec_clim-1)*100,0)}}% sulla media 1991–2020 (${{IT(D.prec_clim)}} mm, ${{IT(D.rd_clim)}} giorni), ${{D.prec_rank}}° valore su ${{yrs.length}} anni (mediana 1961–2025: ${{IT(D.prec_median)}} mm). La pioggia è caduta in pochi episodi, tutti modesti: <b>7–8 ottobre</b> (${{IT(D.prec_daily[6]+D.prec_daily[7])}} mm; alla stazione il picco è stato di ${{IT(D.dex.p30[0][1])}} mm in 30 minuti alle ${{D.dex.p30[0][0]}} del 7), il <b>12</b> (${{IT(D.prec_daily[11])}} mm), il <b>20–21</b> (${{IT(D.prec_daily[19]+D.prec_daily[20])}} mm) e il <b>23</b> (${{IT(D.prec_daily[22])}} mm, il giorno più piovoso); il massimo giornaliero medio del 1991–2020 è ${{IT(D.pmax_clim)}} mm. Periodi asciutti (&lt;1 mm): ${{D.dry[0][0]}} giorni (${{D.dry[0][1]}}–${{D.dry[0][2]}}/{M}), ${{D.dry[1][0]}} giorni (${{D.dry[1][1]}}–${{D.dry[1][2]}}/{M}) e ${{D.dry[2][0]}} giorni (${{D.dry[2][1]}}–${{D.dry[2][2]}}/{M}).</p><p>Da gennaio a {NM} {ANNO} sono caduti <b>${{IT(D.prec_month.reduce((a,m)=>a+m.v,0))}} mm</b> contro ${{IT(D.prec_month.reduce((a,m)=>a+m.c,0))}} mm di media 1991–2020 (${{sg((D.prec_month.reduce((a,m)=>a+m.v,0)/D.prec_month.reduce((a,m)=>a+m.c,0)-1)*100,0)}}%): ${{D.prec_month.filter(m=>m.v>m.c).map(m=>MESI[m.m]).join(', ')}} sopra la media, gli altri mesi sotto.</p>`"""
sg_ok = lambda p: p < 0.05
tr_txt = (f"{'tendenza al riscaldamento statisticamente significativa (p &lt; 0,05)' if sg_ok(trend['tm']['p']) else 'nessuna tendenza statisticamente significativa (p ≥ 0,05)'} per la Tmedia; "
          f"{'significativa' if sg_ok(trend['tx']['p']) else 'non significativa'} per la Tmax e {'significativa' if sg_ok(trend['tn']['p']) else 'non significativa'} per la Tmin.")
repl = {"__ANNO__": str(ANNO), "__ND__": str(ND), "__M__": str(M), "__NM__": NM, "__NM_C__": NM.capitalize(), "__NM_A__": NM[:3].capitalize(),
        "__NANNI__": str(N), "__FASI__": json.dumps([[a, n] for (a, _, _), n in zip(FASI, ph_names)], ensure_ascii=False),
        "__SINTESI__": "`" + sint.replace("`", "'") + "`", "__TROPO__": tropo, "__PREC__": prec_txt, "__TRENDTXT__": tr_txt,
        "__ULTIMO__": f"{ND:02d}/{M:02d}/{ANNO}", "__RECTX__": it(rec_tx[1]["txmax"]), "__RECTXD__": dmy(rec_tx[1]["txmax_d"]),
        "__RECTN__": it(rec_tn[1]["tnmin"]), "__RECTND__": dmy(rec_tn[1]["tnmin_d"]),
        "__S_TM__": it(STAZ["tm"]), "__S_TX__": it(STAZ["tx"]), "__S_TN__": it(STAZ["tn"]), "__S_P__": it(STAZ["prec"]),
        "__S_TXM__": it(STAZ["txmax"]), "__S_TNM__": it(STAZ["tnmin"]),
        "__DEXTX__": DEXTRA["tx"][0].strftime("alle %-H:%M del %-d/%m"), "__DEXTN__": DEXTRA["tn"][0].strftime("alle %-H:%M del %-d/%m"),
        "__DEXP__": it(DEXTRA["p30"][0][1])}
for k in sorted(repl, key=len, reverse=True):
    js = js.replace(k, repl[k])

out = head + body + chartjs + "\n<script>const D=" + json.dumps(D, ensure_ascii=False, separators=(",", ":")) + ";" + js + "</script>\n</body>\n</html>\n"
dest = os.path.join(HERE, f"reports/clima/{MESE}-firenzuola.html")
open(dest, "w", encoding="utf-8").write(out)
print("scritto", dest, len(out) // 1024, "KB")
print(f"tm {Y['tm']:.2f} rank {R['tm']}/{N}, tx {Y['tx']:.2f} r{R['tx']}, tn {Y['tn']:.2f} r{R['tn']}, prec {Y['prec']} rank {p_rank}/{N}, n10 {n10}, rd {Y['rd']}, tr {tr_season} r{tr_rank}")
