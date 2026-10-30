#!/usr/bin/env python3
"""
Estremi giornalieri di temperatura di otto stazioni di montagna intorno al Mugello, per la pagina
«Stazioni in montagna» (stazioni-montagna.html).

Le stazioni pubblicano solo i valori del momento e gli estremi del giorno in corso: lo storico degli ultimi giorni lo
costruisce questo script, che gira con update-data.yml ogni mezz'ora e conserva per ogni giorno la massima più alta
e la minima più bassa lette. Fonti:
  futa       Passo della Futa (Firenzuola, 963 m), Davis Vantage Pro2 dell'Associazione Il Filo, rete Meteo Project
             https://stazioni.meteoproject.it/dati/passofuta/index-vuoto.php (la pagina incorporata da ilfilo.net)
             «Dati aggiornati il 18/10/26 alle ore 19.00», «Estremi Oggi» con l'ora della massima e della minima
  montegiovi Montegiovi (Monte Giovi, Vicchio), stazione Froggit 2000 della rete toscana-meteo.it
             https://www.toscana-meteo.it/localita/vicchio1/ (la pagina si compone da sola con JavaScript: i dati
             vengono da due API JSON del sito, lette direttamente)
             /api/v1/network  -> localities[slug=vicchio1].values: temp, lowtemp e hitemp (minima e massima del giorno),
                                 rain (pioggia del giorno, mm), hiwind (raffica massima del giorno, km/h), observedAt
             /api/history/vicchio1?metric=temp&period=24h -> temperatura ogni 15 minuti, da cui si ricava l'ora degli estremi
  colla      Passo della Colla (971 m), Davis Pro della rete Meteo Pedemontana Forlivese
             https://meteo-pedemontanaforlivese.it/index.php#stazioni
             scheda «Passo della Colla · Media montagna · 971 m», «min 12,8° · max 17,9°», «Online · 3 min fa»
             (nessuna data: l'istante della misura è l'ora della lettura meno i minuti indicati)

  giogo      Passo del Giogo (Firenzuola, 880 m),
  consuma    Consuma (Pelago, 955 m),
  montedifo  Monte di Fò (820 m, bacino della Sieve),
  bibbiana   Bibbiana (786 m, bacino del Reno) e
  barco      Barco (780 m, bacino del Santerno), stazioni del Centro Funzionale Regione Toscana
             (TOS11000108, TOS01001041, TOS01000916, TOS30248000, TOS30287500). Le ultime tre hanno temperatura e pioggia,
             senza vento, con una lettura ogni 5, 30 e 15 minuti (la serie dei grafici si riduce a un punto ogni 15).
             Le pagine di dettaglio del CFR danno i valori ogni 15 minuti da ieri a mezzanotte:
             https://www.cfr.toscana.it/monitoraggio/dettaglio.php?id=<id>&title=<id>_termo&type=termo  (temperatura)
             ... type=pluvio (pioggia nei 15 minuti), type=anemo (vento medio/raffica in m/s, solo Giogo),
             ... type=pluvio_men (pioggia giornaliera degli ultimi 30 giorni, per il totale del mese).
             Gli orari del CFR sono in ora solare (UTC+1) e si riportano all'ora italiana. Estremi, pioggia e raffica
             di ieri e di oggi si calcolano dalle letture ogni 15 minuti; il primo giorno della finestra comincia
             all'01:00 quando c'è l'ora legale, e resta «parziale» finché le letture successive non lo completano.

Oltre agli estremi di temperatura si tengono, quando la stazione li pubblica, la pioggia del giorno (mm, la più
alta letta: il pluviometro si azzera a mezzanotte) e la raffica massima del giorno (km/h, Futa e Montegiovi), e per il
momento attuale la pioggia del mese e dell'anno.

Controlli: una lettura vale solo se la misura è di oggi o di ieri (ora italiana), non più vecchia di 3 ore, e con la
minima non più alta della massima; gli estremi con un'ora successiva all'ultimo aggiornamento (residui del giorno
prima subito dopo la mezzanotte) si scartano. Si tengono gli ultimi 10 giorni.

Per i grafici si conserva anche la temperatura di ogni lettura (serie degli ultimi 4 giorni, un punto ogni mezz'ora;
per Montegiovi si aggiungono i punti ogni 15 minuti del grafico della stazione).

Scrive data/montagna.json.
"""
import datetime as dt, html, json, os, re, sys, urllib.request
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "montagna.json")
ROMA = ZoneInfo("Europe/Rome")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 mugello-meteo/1.0"
GIORNI = 10
ORE_SERIE = 96

CFR_DETT = "https://www.cfr.toscana.it/monitoraggio/dettaglio.php?id={id}&title={id}_{ty}&type={ty}"
CET = dt.timezone(dt.timedelta(hours=1))   # gli orari del CFR sono in ora solare

STAZIONI = [
    {"id": "futa", "nome": "Passo della Futa", "comune": "Firenzuola", "quota": 963,
     "rete": "Associazione Il Filo · Meteo Project", "pagina": "https://www.ilfilo.net/stazione-meteo-del-passo-della-futa/",
     "url": "https://stazioni.meteoproject.it/dati/passofuta/index-vuoto.php", "referer": "https://www.ilfilo.net/"},
    {"id": "montegiovi", "nome": "Montegiovi", "comune": "Vicchio", "quota": 722,
     "rete": "toscana-meteo.it", "pagina": "https://www.toscana-meteo.it/localita/vicchio1/",
     "url": "https://www.toscana-meteo.it/api/", "referer": "https://www.toscana-meteo.it/localita/vicchio1/"},
    {"id": "colla", "nome": "Passo della Colla", "comune": "Borgo San Lorenzo · Marradi", "quota": 971,
     "rete": "Meteo Pedemontana Forlivese", "pagina": "https://meteo-pedemontanaforlivese.it/index.php#stazioni",
     "url": "https://meteo-pedemontanaforlivese.it/index.php", "referer": "https://meteo-pedemontanaforlivese.it/"},
    {"id": "giogo", "nome": "Passo del Giogo", "comune": "Firenzuola", "quota": 880, "cfr": "TOS11000108",
     "rete": "Centro Funzionale Regione Toscana", "pagina": CFR_DETT.format(id="TOS11000108", ty="termo"),
     "url": None, "referer": None},
    {"id": "consuma", "nome": "Consuma", "comune": "Pelago", "quota": 955, "cfr": "TOS01001041",
     "rete": "Centro Funzionale Regione Toscana", "pagina": CFR_DETT.format(id="TOS01001041", ty="termo"),
     "url": None, "referer": None},
    {"id": "montedifo", "nome": "Monte di Fò", "comune": "Barberino di Mugello", "quota": 820, "cfr": "TOS01000916",
     "rete": "Centro Funzionale Regione Toscana", "pagina": CFR_DETT.format(id="TOS01000916", ty="termo"),
     "url": None, "referer": None},
    {"id": "bibbiana", "nome": "Bibbiana", "comune": "bacino del Reno", "quota": 786, "cfr": "TOS30248000",
     "rete": "Centro Funzionale Regione Toscana", "pagina": CFR_DETT.format(id="TOS30248000", ty="termo"),
     "url": None, "referer": None},
    {"id": "barco", "nome": "Barco", "comune": "bacino del Santerno", "quota": 780, "cfr": "TOS30287500",
     "rete": "Centro Funzionale Regione Toscana", "pagina": CFR_DETT.format(id="TOS30287500", ty="termo"),
     "url": None, "referer": None},
]


def scarica(url, referer, cod="utf-8"):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": referer})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode(cod, "replace")


def testo(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s)))


def num(s):
    return float(s.replace(".", "").replace(",", ".")) if "," in s else float(s)


def futa(s):
    m = re.search(r"Dati aggiornati il.*?(\d\d)/(\d\d)/(\d\d)\s*</strong>.*?alle ore\s*</span>\s*<strong[^>]*>\s*(\d\d)\.(\d\d)", s, re.S)
    g, me, a, hh, mm = (int(x) for x in m.groups())
    quando = dt.datetime(2000 + a, me, g, hh, mm, tzinfo=ROMA)
    t = re.search(r"thermometer\.php\?t=(-?[\d.]+)", s)
    e = s[s.index("Estremi Oggi"):]
    mx = re.search(r'class="max"><strong>(-?[\d.]+)</strong>.*?maxpiccolo">\(<strong>(\d\d)\.(\d\d)</strong>', e, re.S)
    mn = re.search(r'class="blu"><strong>(-?[\d.]+)</strong>.*?minpiccolo">\(<strong>(\d\d)\.(\d\d)</strong>', e, re.S)
    x = testo(s)
    out = {"quando": quando, "t": float(t.group(1)) if t else None,
           "max": float(mx.group(1)), "hmax": f"{mx.group(2)}:{mx.group(3)}",
           "min": float(mn.group(1)), "hmin": f"{mn.group(2)}:{mn.group(3)}"}
    for k, rx in (("pioggia", r"Pioggia giorno: (-?[\d.]+) mm"), ("raffica", r"Raffica giornaliera: ([\d.]+) Km/h"),
                  ("p_mese", r"Pioggia Mese: ([\d.]+) mm"), ("p_anno", r"Pioggia Anno: ([\d.]+) mm")):
        m = re.search(rx, x)
        if m:
            out[k] = float(m.group(1))
    m = re.search(r"Ora Raffica: (\d\d)\.(\d\d)", x)
    if m and "raffica" in out:
        out["hraffica"] = f"{m.group(1)}:{m.group(2)}"
    return out


def montegiovi(st):
    """Montegiovi dalle API JSON di toscana-meteo.it (la pagina della stazione è composta da JavaScript)."""
    rete = json.loads(scarica(st["url"] + "v1/network", st["referer"]))
    loc = next(l for l in rete["localities"] if l.get("slug") == "vicchio1")
    v, qual = loc["values"], loc.get("quality", {})
    quando = dt.datetime.fromisoformat(loc["observedAt"]).astimezone(ROMA).replace(second=0, microsecond=0)

    def val(k):
        return v.get(k) if v.get(k) is not None and qual.get(k, "ok") == "ok" else None
    # hitemp, lowtemp e hiwind sono gli estremi del giorno (la pagina li presenta come tali)
    if val("hitemp") is None or val("lowtemp") is None:
        raise ValueError("estremi di temperatura non disponibili")
    out = {"quando": quando, "t": val("temp"), "max": val("hitemp"), "min": val("lowtemp")}
    if val("rain") is not None:
        out["pioggia"] = val("rain")      # pioggia del giorno, mm
    if val("hiwind") is not None:
        out["raffica"] = val("hiwind")    # raffica massima del giorno, km/h
    # ora degli estremi dal grafico della temperatura (un punto ogni 15 minuti), se arriva a un valore vicino
    # a quello della stazione (i punti sono campioni: la massima vera può essere un po' più alta)
    storia = json.loads(scarica(st["url"] + "history/vicchio1?metric=temp&period=24h", st["referer"]))
    punti = [(dt.datetime.fromtimestamp(ms / 1000, ROMA).replace(second=0, microsecond=0), t)
             for ms, t in storia.get("points", []) if t is not None and -40 < t < 45]
    punti = [(q, t) for q, t in punti if q <= quando]
    out["punti"] = punti
    oggi = [(q, t) for q, t in punti if q.date() == quando.date()]
    if oggi:
        qx, vx = max(oggi, key=lambda p: p[1])
        qn, vn = min(oggi, key=lambda p: p[1])
        if abs(vx - out["max"]) <= 0.5:
            out["hmax"] = qx.strftime("%H:%M")
        if abs(vn - out["min"]) <= 0.5:
            out["hmin"] = qn.strftime("%H:%M")
    return out


def colla(s, adesso):
    i = next(m.start() for m in re.finditer(r">Passo della Colla</div>", s) if "montagna" in s[m.start():m.start() + 1500])
    j = s.find("rounded-xl p-3.5", i)
    c = s[i:j if j > 0 else i + 8000]
    x = testo(c)
    stato = re.search(r"(Online|Offline) · (?:(\d+) (min|ora|ore) fa|adesso|ora)", x)
    if not stato or stato.group(1) != "Online":
        raise ValueError("stazione non in linea: " + (stato.group(0) if stato else x[-80:]))
    n = int(stato.group(2) or 0) * (60 if stato.group(3) in ("ora", "ore") else 1)
    t = re.search(r"m (-?[\d.,]+) ?°C", x)
    e = re.search(r"min (-?[\d.,]+)° · max (-?[\d.,]+)°", x)
    out = {"quando": (adesso - dt.timedelta(minutes=n)).replace(second=0, microsecond=0),
           "t": num(t.group(1)) if t else None, "max": num(e.group(2)), "min": num(e.group(1))}
    p = re.search(r"oggi (-?[\d.,]+) · mese ([\d.,]+) · anno ([\d.,]+) mm", x)
    if p:
        # numeri all'italiana: «1.250» è milleduecentocinquanta, «41,6» quarantuno e sei
        out["pioggia"], out["p_mese"], out["p_anno"] = (float(v.replace(".", "").replace(",", ".")) for v in p.groups())
    return out


def cfr_righe(sid, ty):
    """righe [istante in ora italiana, colonne...] della pagina di dettaglio del CFR."""
    s = scarica(CFR_DETT.format(id=sid, ty=ty), "https://www.cfr.toscana.it/")
    nome = re.search(r"var (\w+) = new Array\(\);", s).group(1)
    out = []
    for a in re.findall(nome + r"\[\d+\] = new Array\(([^)]*)\)", s):
        c = re.findall(r'"([^"]*)"', a)
        m = re.fullmatch(r"(\d\d)/(\d\d)/(\d{4})(?: (\d\d)\.(\d\d))?", c[1].strip())
        if not m:
            continue
        g, me, a_, hh, mm = (int(x) if x else 0 for x in m.groups())
        out.append([dt.datetime(a_, me, g, hh, mm, tzinfo=CET).astimezone(ROMA)] + c[2:])
    return out


def fnum(x):
    try:
        return float(x.replace(",", "."))
    except (AttributeError, ValueError):
        return None


def cfr(st, adesso):
    """estremi di ieri e di oggi, pioggia, raffica e serie dalle letture ogni 15 minuti del CFR."""
    sid = st["cfr"]
    temp = [(q, fnum(c[0])) for q, *c in cfr_righe(sid, "termo")]
    temp = [(q, v) for q, v in temp if v is not None and -40 < v < 45 and q <= adesso]
    if not temp:
        raise ValueError("nessuna temperatura")
    giorni = {}
    for q, v in temp:
        g = giorni.setdefault(q.date().isoformat(), {})
        h = q.strftime("%H:%M")
        if "max" not in g or v > g["max"]:
            g["max"], g["hmax"] = v, h
        if "min" not in g or v < g["min"]:
            g["min"], g["hmin"] = v, h
        g["prima"] = min(g.get("prima", h), h)
        g["ultima"] = max(g.get("ultima", h), h)
    # pioggia nei 15 minuti: l'intervallo che finisce a mezzanotte appartiene al giorno prima
    for q, *c in cfr_righe(sid, "pluvio"):
        v = fnum(c[1]) if len(c) > 1 else None
        d = (q - dt.timedelta(minutes=1)).date().isoformat()
        if d in giorni:
            giorni[d]["pioggia"] = round(giorni[d].get("pioggia", 0.0) + (v if v and 0 <= v < 200 else 0.0), 1)
    if sid == "TOS11000108":
        for q, *c in cfr_righe(sid, "anemo"):
            m = re.fullmatch(r"([\d.]+)/([\d.]+)", (c[0] if c else "").strip())
            d = q.date().isoformat()
            if not m or d not in giorni:
                continue
            r = round(float(m.group(2)) * 3.6, 1)
            if r < 300 and r > giorni[d].get("raffica", -1):
                giorni[d]["raffica"], giorni[d]["hraffica"] = r, q.strftime("%H:%M")
    q, t = temp[-1]
    out = {k: v for k, v in giorni[q.date().isoformat()].items() if k not in ("prima", "ultima")}
    # la serie dei grafici ha un punto ogni 15 minuti (alcune stazioni ne danno uno ogni 5), più l'ultima lettura
    punti = [(qq, v) for qq, v in temp if qq.minute % 15 == 0 or qq == q]
    out.update({"quando": q, "t": t, "giorni": giorni, "punti": punti})
    # pioggia del mese: giorni passati dalla pagina dei 30 giorni più quella di oggi
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from fetch_pluvio_mugello import giornaliera
        mese = q.strftime("%Y-%m")
        out["p_mese"] = round(sum(v for d, v in giornaliera(sid).items() if d.startswith(mese) and d < q.date().isoformat())
                              + giorni[q.date().isoformat()].get("pioggia", 0.0), 1)
    except Exception as e:
        print(f"montagna: {st['nome']} pioggia del mese non letta: {e}", file=sys.stderr)
    return out


def main():
    adesso = dt.datetime.now(ROMA)
    prima = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
    vecchie = {s["id"]: s for s in prima.get("stazioni", [])}
    ok = 0
    stazioni = []
    for st in STAZIONI:
        rec = dict(st)
        rec.pop("referer")
        v = vecchie.get(st["id"], {})
        rec["giorni"] = dict(v.get("giorni", {}))
        rec["ora"] = v.get("ora")
        serie = {q: t for q, t in v.get("serie", [])}
        if st["quota"] is None and v.get("quota"):
            rec["quota"] = v["quota"]
        try:
            if st.get("cfr"):
                l = cfr(st, adesso)
            elif st["id"] == "montegiovi":
                l = montegiovi(st)
            else:
                s = scarica(st["url"], st["referer"])
                l = futa(s) if st["id"] == "futa" else colla(s, adesso)
            q = l["quando"]
            if adesso - q > dt.timedelta(hours=3) or q - adesso > dt.timedelta(minutes=30):
                raise ValueError(f"misura non recente: {q:%Y-%m-%d %H:%M}")
            if not (-40 < l["min"] <= l["max"] < 45):
                raise ValueError(f"estremi non validi: {l['min']} / {l['max']}")
            giorno = q.date().isoformat()
            g = dict(rec["giorni"].get(giorno, {}))
            for k, piu in (("max", True), ("min", False)):
                h = l.get("h" + k)
                if h and h > q.strftime("%H:%M"):
                    continue   # estremo con un'ora dopo l'aggiornamento: residuo del giorno prima
                if k not in g or (l[k] > g[k] if piu else l[k] < g[k]):
                    g[k] = l[k]
                    if h:
                        g["h" + k] = h
                    else:
                        g.pop("h" + k, None)
            for k in ("pioggia", "raffica"):
                h = l.get("h" + k)
                if l.get(k) is None or not (0 <= l[k] < (600 if k == "pioggia" else 300)) or (h and h > q.strftime("%H:%M")):
                    continue
                if k not in g or l[k] > g[k]:
                    g[k] = l[k]
                    if h:
                        g["h" + k] = h
                    else:
                        g.pop("h" + k, None)
            g["ultima"] = q.strftime("%H:%M")
            g["letture"] = g.get("letture", 0) + 1
            rec["giorni"][giorno] = g
            # CFR: anche ieri, dalle letture ogni 15 minuti (si tengono gli estremi più ampi fra una lettura e l'altra)
            for gg, n in l.get("giorni", {}).items():
                g = dict(rec["giorni"].get(gg, {}))
                if gg != giorno:
                    for k, piu in (("max", True), ("min", False), ("pioggia", True), ("raffica", True)):
                        if k in n and (k not in g or (n[k] > g[k] if piu else n[k] < g[k])):
                            g[k] = n[k]
                            if "h" + k in n:
                                g["h" + k] = n["h" + k]
                    g["ultima"] = max(g.get("ultima", n["ultima"]), n["ultima"])
                    g["letture"] = g.get("letture", 0) + 1
                g["prima"] = min(g.get("prima", n["prima"]), n["prima"])
                rec["giorni"][gg] = g
            rec["ora"] = {"t": l["t"], "quando": q.isoformat(timespec="minutes")}
            for qq, tt in l.get("punti", []) + ([(q, l["t"])] if l["t"] is not None and -40 < l["t"] < 45 else []):
                serie[qq.isoformat(timespec="minutes")] = tt
            for k in ("p_mese", "p_anno"):
                if l.get(k) is not None:
                    rec["ora"][k] = l[k]
            ok += 1
            print(f"montagna: {st['nome']} {q:%d/%m %H:%M} t={l['t']} max={l['max']} {l.get('hmax','')} min={l['min']} {l.get('hmin','')} pioggia={l.get('pioggia')} raffica={l.get('raffica')} {l.get('hraffica','')}")
        except Exception as e:
            print(f"montagna: {st['nome']} non letta: {e}", file=sys.stderr)
        # controllo con la serie ogni 15 minuti (Montegiovi, CFR): se il giorno è coperto quasi per intero e un estremo
        # si discosta di oltre 1 °C dai valori della serie, è un residuo del giorno prima (la stazione non aveva ancora
        # azzerato gli «Estremi Oggi» quando è stata letta): si sostituisce con l'estremo della serie
        per_giorno = {}
        for qq, tt in serie.items():
            per_giorno.setdefault(qq[:10], []).append((qq[11:16], tt))
        for gg, pts in per_giorno.items():
            g = rec["giorni"].get(gg)
            if not g or len(pts) < 80:
                continue
            hx, vx = max(pts, key=lambda p: p[1])
            hn, vn = min(pts, key=lambda p: p[1])
            if g.get("max") is not None and g["max"] - vx > 1.0:
                print(f"montagna: {st['nome']} {gg} massima {g['max']} corretta con la serie ({vx} alle {hx})", file=sys.stderr)
                g["max"], g["hmax"] = vx, hx
            if g.get("min") is not None and vn - g["min"] > 1.0:
                print(f"montagna: {st['nome']} {gg} minima {g['min']} corretta con la serie ({vn} alle {hn})", file=sys.stderr)
                g["min"], g["hmin"] = vn, hn
        rec["giorni"] = dict(sorted(rec["giorni"].items())[-GIORNI:])
        limite = adesso - dt.timedelta(hours=ORE_SERIE)
        rec["serie"] = [[q, t] for q, t in sorted(serie.items(), key=lambda x: dt.datetime.fromisoformat(x[0]))
                        if dt.datetime.fromisoformat(q) >= limite]
        stazioni.append(rec)
    if not ok:
        print("montagna: nessuna stazione letta, file invariato", file=sys.stderr)
        return
    json.dump({"aggiornato": adesso.isoformat(timespec="minutes"), "stazioni": stazioni},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
