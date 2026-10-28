#!/usr/bin/env python3
"""
Massimi annui di precipitazione per durata, per la pagina MeteoGeek «Tempi di ritorno delle precipitazioni intense»
(geek-tempi-ritorno.html), che vi adatta la distribuzione di Gumbel.

Due fonti, con durate diverse:
  ARPAE  pioggia oraria delle stazioni della rete idro-meteo di ARPAE Emilia-Romagna nell'alto Mugello toscano, dall'archivio
         mensile delle osservazioni https://dati-simc.arpae.it/opendata/osservati/meteo/storico/AAAA-MM.json.gz (dal 2006),
         timerange [1,0,3600] livello 1, variabile B13011 (mm nell'ora che termina all'istante indicato, UTC).
         Durate 1, 3, 6, 12 e 24 ore: massimo annuo della somma di D ore consecutive tutte presenti.
  SIR    pioggia giornaliera «9-9» delle stazioni del Servizio Idrologico Regionale nel Mugello (data/sir/<id>/prec99.csv,
         già nell'archivio del sito): durate 1, 2, 3 e 5 giorni, massimo annuo della somma di D giorni consecutivi.

Per tutte le stazioni si aggiungono le linee segnalatrici di possibilità pluviometrica ufficiali della Regione Toscana
(LSPP, aggiornamento 2012, https://www.sir.toscana.it/lspp-2012): per i tempi di ritorno 2, 5, 10, 20, 30, 50, 100, 150,
200 e 500 anni, i parametri a e n di h = a·d^n (h in mm, d in ore da 1 a 24) nel punto della stazione, letti dal servizio
lspp/ajax_lspp_2012.php con le coordinate Gauss-Boaga dell'elenco delle stazioni della stessa pagina. Non cambiano:
si scaricano solo se mancano. Per le stazioni SIR della valle sono l'unica fonte pubblica per le durate da 1 a 24 ore.

Un anno vale se ha almeno il 90% di ore (ARPAE) o di giorni (SIR) con dato; l'anno in corso è segnato come parziale.

Controllo di coerenza spaziale (dati orari ARPAE): un'ora con almeno 20 mm vale solo se almeno una stazione entro 15 km,
nelle 3 ore prima e dopo, ha misurato almeno il 15% di quella pioggia (e almeno 3 mm). Se nessuna vicina ha misurato
ma qualcuna aveva dati, l'ora si scarta (tipico di un pluviometro che rilascia di colpo neve o acqua accumulata) e
finisce nell'elenco "scartati". Se le vicine non avevano dati, l'ora resta.

Scrive data/piogge-intense.json:
  {"agg","fonti",
   "stazioni":[{"id","nome","quota","lat","lon","rete":"ARPAE"|"SIR","durate":[..],"unita":"h"|"g",
                "anni":{"AAAA":{"cop":0..1,"max":{"D":[mm,"istante"]}}}}]}

Uso:
  python scripts/build_piogge_intense.py             ARPAE: solo l'anno in corso (e dicembre precedente per la continuità); SIR: tutto
  python scripts/build_piogge_intense.py --tutto     ARPAE dal 2006 (circa 230 file mensili, mezz'ora abbondante)
"""
import csv, datetime as dt, gzip, io, json, math, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "piogge-intense.json")
URL = "https://dati-simc.arpae.it/opendata/osservati/meteo/storico/{m}.json.gz"
DAL = (2006, 1)
re_lspp = re.compile(r'"(TOS\w+)": \{"stat_name":"TOS\w+ - ([^"]*?) \(\w\w\)","lat":([\d.]+),"lon":([\d.]+)\}')
SOGLIA = 0.9
# stazioni ARPAE nell'alto Mugello toscano: (id, rete, lat, lon arrotondate a 3 decimali, nome, quota)
ARPAE = [("firenzuola", "simnbo", 44.122, 11.375, "Firenzuola", 476),
         ("barco", "simnbo", 44.061, 11.398, "Barco", 720),
         ("palazzuolo", "simnbo", 44.116, 11.546, "Palazzuolo sul Senio", 500),
         ("faggiola", "simnbo", 44.144, 11.497, "Monte Faggiola", 929),
         ("bibbiana", "spdsra", 44.130, 11.514, "Bibbiana", 858),
         ("marradi", "spdsra", 44.077, 11.614, "Marradi", 350),
         ("casaglia", "spdsra", 44.038, 11.518, "Casaglia", 750)]
ORE = [1, 3, 6, 12, 24]
# pluviometri SIR con serie 9-9 lunghe e aggiornate (gli stessi della pagina dei percentili)
SIR = ["TOS01000999", "TOS01004621", "TOS01001029", "TOS01000911", "TOS01000941", "TOS01000961", "TOS01001011",
       "TOS01000991", "TOS01000926", "TOS01000931", "TOS01000921", "TOS01000979", "TOS01000916"]
GIORNI = [1, 2, 3, 5]


def mesi(dal, al):
    y, m = dal
    while (y, m) <= al:
        yield f"{y:04d}-{m:02d}"
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)


def scarica(m):
    for t in range(4):
        try:
            req = urllib.request.Request(URL.format(m=m), headers={"User-Agent": "mugello-meteo/1.0"})
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read()
        except Exception as e:
            print(f"  {m}: tentativo {t + 1} fallito ({e})", file=sys.stderr)
            time.sleep(15 * (t + 1))
    return None


def ore_arpae(m, ore):
    """aggiunge a ore[id] {istante UTC (ore dal 1970): mm} dell'archivio del mese m."""
    dati = scarica(m)
    if dati is None:
        print(f"arpae: {m} non scaricato", file=sys.stderr)
        return False
    chiavi = {(rete, la, lo): sid for sid, rete, la, lo, *_ in ARPAE}
    with gzip.open(io.BytesIO(dati), "rt", encoding="utf-8") as f:
        for riga in f:
            if '"simnbo"' not in riga and '"spdsra"' not in riga:
                continue
            r = json.loads(riga)
            sid = chiavi.get((r["network"], round(r["lat"] / 1e5, 3), round(r["lon"] / 1e5, 3)))
            if not sid:
                continue
            for d in r["data"]:
                v = d.get("vars", {})
                if "B13011" in v and d.get("timerange") == [1, 0, 3600]:
                    mm = v["B13011"]["v"]
                    if mm is not None and 0 <= mm < 200:
                        q = dt.datetime.fromisoformat(r["date"].replace("Z", "+00:00"))
                        ore[sid][int(q.timestamp() // 3600)] = mm
    return True


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    return 6371 * math.acos(min(1, math.sin(la1) * math.sin(la2) + math.cos(la1) * math.cos(la2) * math.cos(lo1 - lo2)))


def coerenza(ore):
    """toglie le ore >= 20 mm non confermate dalle stazioni vicine; restituisce l'elenco degli scarti."""
    pos = {sid: (la, lo) for sid, _, la, lo, *_ in ARPAE}
    scartati = []
    for sid, serie in ore.items():
        vicine = [v for v in ore if v != sid and km(pos[sid], pos[v]) <= 15]
        for k, mm in sorted(serie.items()):
            if mm < 20:
                continue
            somme = [sum(ore[v].get(k + j, 0) for j in range(-3, 4)) for v in vicine
                     if any(k + j in ore[v] for j in range(-3, 4))]
            if somme and max(somme) < max(3.0, 0.15 * mm):
                scartati.append({"id": sid, "ora": dt.datetime.fromtimestamp(k * 3600, dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
                                 "mm": mm, "vicine_max": round(max(somme), 1)})
    for x in scartati:
        k = int(dt.datetime.fromisoformat(x["ora"].replace("Z", "+00:00")).timestamp() // 3600)
        ore[x["id"]].pop(k, None)
        print(f"coerenza: scartato {x['id']} {x['ora']} {x['mm']} mm (vicine al massimo {x['vicine_max']} mm)", file=sys.stderr)
    return scartati


def massimi(serie, passo, durate, anni, chiave_anno, istante):
    """{anno: {"cop", "max": {D: [mm, istante]}}} dalla serie {indice: mm} a passo costante."""
    out = {}
    for a in anni:
        idx = [k for k in serie if chiave_anno(k) == a]
        attesi = (8784 if a % 4 == 0 else 8760) if passo == "h" else (366 if a % 4 == 0 else 365)
        rec = {"cop": round(len(idx) / attesi, 3), "max": {}}
        for D in durate:
            best = None
            for k in idx:
                # finestra delle D unità che terminano in k, tutte presenti
                s = 0.0
                for j in range(D):
                    v = serie.get(k - j)
                    if v is None:
                        s = None
                        break
                    s += v
                if s is not None and (best is None or s > best[0]):
                    best = (s, k)
            if best:
                rec["max"][str(D)] = [round(best[0], 1), istante(best[1])]
        out[str(a)] = rec
    return out


def sir():
    anag = {r["id"]: r for r in csv.DictReader(open(os.path.join(HERE, "data", "sir", "stazioni.csv"), encoding="utf-8"), delimiter=";")}
    out = []
    for sid in SIR:
        p = os.path.join(HERE, "data", "sir", sid, "prec99.csv")
        if not os.path.exists(p):
            continue
        serie = {}
        for r in csv.reader(open(p, encoding="utf-8"), delimiter=";"):
            if len(r) < 2 or not r[1] or r[0] == "data":
                continue
            try:
                v = float(r[1])
            except ValueError:
                continue
            if 0 <= v < 600:
                serie[dt.date.fromisoformat(r[0]).toordinal()] = v
        anni = sorted({dt.date.fromordinal(k).year for k in serie})
        a = anag.get(sid, {})
        out.append({"id": sid, "nome": a.get("nome", sid), "quota": round(float(a.get("quota") or 0)),
                    "lat": float(a.get("lat") or 0), "lon": float(a.get("lon") or 0), "rete": "SIR", "unita": "g", "durate": GIORNI,
                    "anni": massimi(serie, "g", GIORNI, anni, lambda k: dt.date.fromordinal(k).year,
                                    lambda k: dt.date.fromordinal(k).isoformat())})
        print(f"sir: {out[-1]['nome']} {len(anni)} anni", file=sys.stderr)
    return out


LSPP_T = [2, 5, 10, 20, 30, 50, 100, 150, 200, 500]
# nome nell'elenco della pagina LSPP delle stazioni ARPAE (le SIR si trovano per codice)
LSPP_NOMI = {"firenzuola": "Firenzuola", "barco": "Barco", "palazzuolo": "Palazzuolo sul Senio", "faggiola": "Monte Faggiola",
             "bibbiana": "Bibbiana", "marradi": "Marradi", "casaglia": "Casaglia"}


def lspp(stazioni, gia):
    """aggiunge a ogni stazione "lspp": {T: [a, n]} (ufficiali, Regione Toscana 2012)."""
    def get(u):
        req = urllib.request.Request("https://www.sir.toscana.it/" + u, headers={"User-Agent": "mugello-meteoeclima/1.0 (uso non commerciale)"})
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.read().decode("utf-8", "replace")
    elenco = None
    for s in stazioni:
        if gia.get(s["id"]):
            s["lspp"] = gia[s["id"]]
            continue
        try:
            if elenco is None:
                t = get("lspp-2012")
                elenco = {}
                for cod, nome, n, e in re_lspp.findall(t):
                    elenco[cod] = (nome.strip(), float(n), float(e))
            cod = s["id"] if s["rete"] == "SIR" else next((c for c, v in elenco.items()
                                                        if v[0].lower() == LSPP_NOMI.get(s["id"], "").lower()), None)
            if cod not in elenco:
                print(f"lspp: {s['nome']} non trovata nell'elenco", file=sys.stderr)
                continue
            _, n, e = elenco[cod]
            par = {}
            for T in LSPP_T:
                d = json.loads(get(f"lspp/ajax_lspp_2012.php?years={T}&lat={n}&lon={e}"))
                a, nn = d.get("res_a", {}).get("mean"), d.get("res_n", {}).get("mean")
                if a is not None and nn is not None:
                    par[str(T)] = [round(a, 3), round(nn, 5)]
                time.sleep(0.5)
            if len(par) == len(LSPP_T):
                s["lspp"] = par
                s["lspp_staz"] = cod
                print(f"lspp: {s['nome']} ({cod}) T=10 a={par['10'][0]} n={par['10'][1]}", file=sys.stderr)
        except Exception as ex:
            print(f"lspp: {s['nome']} non letta ({ex})", file=sys.stderr)


def main():
    oggi = dt.date.today()
    prima = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
    vecchie = {s["id"]: s for s in prima.get("stazioni", []) if s.get("rete") == "ARPAE"}
    tutto = "--tutto" in sys.argv or not vecchie
    dal = DAL if tutto else (oggi.year - 1, 12)
    ore = {sid: {} for sid, *_ in ARPAE}
    letti = 0
    for m in mesi(dal, (oggi.year, oggi.month)):
        letti += ore_arpae(m, ore)
        print(f"arpae: {m}", file=sys.stderr)
    if not letti:
        raise SystemExit("piogge-intense: nessun mese ARPAE letto, file non toccato")
    anni_nuovi = range(DAL[0] if tutto else oggi.year, oggi.year + 1)
    scartati = [x for x in prima.get("scartati", []) if not tutto and x["ora"][:4] not in {str(a) for a in anni_nuovi}]
    scartati += coerenza(ore)
    stazioni = []
    for sid, rete, la, lo, nome, quota in ARPAE:
        anni = dict(vecchie.get(sid, {}).get("anni", {}))
        anni.update(massimi(ore[sid], "h", ORE, anni_nuovi, lambda k: dt.datetime.fromtimestamp(k * 3600, dt.timezone.utc).year,
                            lambda k: dt.datetime.fromtimestamp(k * 3600, dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")))
        stazioni.append({"id": sid, "nome": nome, "quota": quota, "lat": la, "lon": lo, "rete": "ARPAE", "unita": "h",
                         "durate": ORE, "anni": dict(sorted(anni.items()))})
    stazioni += sir()
    lspp(stazioni, {s["id"]: s.get("lspp") for s in prima.get("stazioni", []) if s.get("lspp")})
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"agg": oggi.isoformat(), "soglia_copertura": SOGLIA,
                   "fonti": {"ARPAE": "ARPAE Emilia-Romagna, Servizio IdroMeteoClima, archivio delle osservazioni (dati aperti)",
                             "SIR": "Regione Toscana, Servizio Idrologico Regionale (CC BY-SA 4.0)"},
                   "scartati": sorted(scartati, key=lambda x: x["ora"]), "stazioni": stazioni}, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"piogge-intense: {len(stazioni)} stazioni", file=sys.stderr)


if __name__ == "__main__":
    main()
