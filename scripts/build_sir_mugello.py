#!/usr/bin/env python3
"""
Sintesi per la pagina stazioni-mugello.html, dalle serie giornaliere in data/sir/.

Ingresso:  data/sir/stazioni.csv, data/sir/<ID>/{temp,prec99,prec024}.csv  (fetch_sir_storico.py)
Uscita:    data/sir/mugello.json  per ogni stazione: anagrafica, periodi coperti, pioggia annua,
           clima mensile (pioggia, massime, minime) e medie di riferimento.

Regole di qualità:
  - anno "completo" per la pioggia: almeno 350 giorni con dato; per la temperatura almeno 340 giorni
  - mese "completo": almeno il 90% dei giorni; le medie mensili usano solo mesi completi
  - si scartano i giorni con massima < minima
Pioggia: si usa la 9->9 (serie lunga e continua; la 0->24 parte solo dal 2004).
"""
import csv, json, os, datetime as dt, calendar, statistics as S, collections

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(HERE, "data", "sir")
RIF = (1991, 2025)          # periodo di riferimento per i confronti fra stazioni


def leggi(path):
    if not os.path.exists(path):
        return {}
    out = {}
    with open(path, encoding="utf-8") as f:
        r = csv.reader(f, delimiter=";")
        next(r, None)
        for row in r:
            out[row[0]] = row[1:]
    return out


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def pioggia(d):
    return {k: num(v[0]) for k, v in d.items() if num(v[0]) is not None}


def temperature(d):
    mx, mn = {}, {}
    for k, v in d.items():
        a, b = num(v[0]), num(v[1]) if len(v) > 1 else None
        if a is not None and b is not None and a < b:
            continue
        if a is not None:
            mx[k] = a
        if b is not None:
            mn[k] = b
    return mx, mn


def per_anno(serie, minimo):
    """-> {anno: [valori]} solo per anni con almeno `minimo` giorni."""
    g = collections.defaultdict(list)
    for k, v in serie.items():
        g[int(k[:4])].append(v)
    return {a: v for a, v in g.items() if len(v) >= minimo}


def mensile(serie, funz):
    """Media delle sintesi mensili (funz = sum o mean), solo mesi con >= 90% dei giorni."""
    g = collections.defaultdict(list)
    for k, v in serie.items():
        g[(int(k[:4]), int(k[5:7]))].append(v)
    mm = {m: [] for m in range(1, 13)}
    for (a, m), v in g.items():
        if len(v) >= 0.9 * calendar.monthrange(a, m)[1]:
            mm[m].append(funz(v))
    return [round(S.mean(mm[m]), 1) if len(mm[m]) >= 5 else None for m in range(1, 13)], [len(mm[m]) for m in range(1, 13)]


def sintesi(s):
    d = os.path.join(BASE, s["id"])
    p = pioggia(leggi(d + "/prec99.csv"))
    mx, mn = temperature(leggi(d + "/temp.csv"))
    out = {"id": s["id"], "nome": s["nome"], "comune": s["comune"].split(" (")[0].strip(),
           "lat": float(s["lat"]), "lon": float(s["lon"]), "quota": float(s["quota"] or 0),
           "auto": not s["id"].startswith("TOS10")}
    if p:
        anni = per_anno(p, 350)
        tot = {a: round(sum(v), 1) for a, v in anni.items()}
        out["pioggia"] = {"dal": min(k[:4] for k in p), "al": max(k[:4] for k in p),
                          "anni": tot,
                          "mensile": mensile(p, sum)[0],
                          "max_giorno": max((v, k) for k, v in p.items())}
        rif = [t for a, t in tot.items() if RIF[0] <= a <= RIF[1]]
        out["pioggia"]["media_rif"] = round(S.mean(rif), 0) if len(rif) >= 15 else None
        out["pioggia"]["n_rif"] = len(rif)
        tutti = list(tot.values())
        out["pioggia"]["media"] = round(S.mean(tutti), 0) if len(tutti) >= 5 else None
    if mx and mn:
        ax, an = per_anno(mx, 340), per_anno(mn, 340)
        com = sorted(set(ax) & set(an))
        t = {a: [round(S.mean(ax[a]), 2), round(S.mean(an[a]), 2)] for a in com}
        out["temp"] = {"dal": min(k[:4] for k in mx), "al": max(k[:4] for k in mx), "anni": t,
                       "max_mensile": mensile(mx, S.mean)[0], "min_mensile": mensile(mn, S.mean)[0],
                       "record_max": max((v, k) for k, v in mx.items()),
                       "record_min": min((v, k) for k, v in mn.items())}
    return out


def main():
    st = list(csv.DictReader(open(os.path.join(BASE, "stazioni.csv"), encoding="utf-8"), delimiter=";"))
    stazioni = [sintesi(s) for s in st]
    stazioni.sort(key=lambda s: (-s["auto"], s["quota"]))
    json.dump({"fonte": "Regione Toscana - Servizio Idrologico Regionale (SIR), CC BY-SA 4.0",
               "riferimento": list(RIF), "stazioni": stazioni},
              open(os.path.join(BASE, "mugello.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(stazioni), "stazioni")


if __name__ == "__main__":
    main()
