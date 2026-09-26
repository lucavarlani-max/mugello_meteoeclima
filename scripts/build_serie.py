#!/usr/bin/env python3
"""
Prepara i dati delle serie storiche (stazioni centenarie) per il sito.

Uso:
  python scripts/build_serie.py <csv giornaliero> <slug>
  es. python scripts/build_serie.py data/serie/milano-brera.csv milano-brera

Il CSV ha colonne year,month,day,prec,tempMax,tempMin (-99.9 = mancante),
oppure è già nel formato ripulito data,prec,tmax,tmin (si può rigenerare).
Scrive:
  data/serie/<slug>.csv   serie giornaliera ripulita (mancanti = campo vuoto)
  data/serie/<slug>.json  aggregati annuali e mensili, normali, record

Pulizia: alcuni valori di temperatura arrivano moltiplicati per 1000
(es. 38301 invece di 38.3, errore del separatore delle migliaia): se
|valore| >= 1000 lo si divide per 1000 e si arrotonda al decimo.
"""
import csv, json, os, sys, datetime
from collections import defaultdict

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIN_GIORNI_MESE = 25      # un mese conta se ha almeno 25 giorni validi
MIN_GIORNI_ANNO = 330     # un anno conta se ha almeno 330 giorni validi


def val(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    if v <= -99:
        return None
    return v


def pulisci_t(v):
    if v is not None and abs(v) >= 1000:
        return round(v / 1000, 1), True
    return v, False


def media(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def r2(x):
    return None if x is None else round(x, 2)


def main(src, slug):
    giorni, corretti = [], 0
    with open(src, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if "data" in row:   # formato già ripulito: data,prec,tmax,tmin
                row = dict(zip(("year", "month", "day"), row["data"].split("-")),
                           prec=row["prec"], tempMax=row["tmax"], tempMin=row["tmin"])
            tx, c1 = pulisci_t(val(row["tempMax"]))
            tn, c2 = pulisci_t(val(row["tempMin"]))
            corretti += c1 + c2
            if tx is not None and tn is not None and tx < tn:
                tx = tn = None
            giorni.append((datetime.date(int(row["year"]), int(row["month"]), int(row["day"])),
                           val(row["prec"]), tx, tn))
    giorni.sort()

    # serie ripulita
    out_csv = os.path.join(HERE, "data", "serie", f"{slug}.csv")
    with open(out_csv, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["data", "prec", "tmax", "tmin"])
        for d, p, tx, tn in giorni:
            w.writerow([d.isoformat()] + ["" if v is None else f"{v:g}" for v in (p, tx, tn)])

    # mensili
    per_mese = defaultdict(list)
    for g in giorni:
        per_mese[(g[0].year, g[0].month)].append(g)
    anni = sorted({d.year for d, *_ in giorni})
    mesi = {}
    for (y, m), gg in per_mese.items():
        tx = [g[2] for g in gg if g[2] is not None]
        tn = [g[3] for g in gg if g[3] is not None]
        pr = [g[1] for g in gg if g[1] is not None]
        ok_t = len(tx) >= MIN_GIORNI_MESE and len(tn) >= MIN_GIORNI_MESE
        mesi[(y, m)] = {
            "tx": media(tx) if ok_t else None,
            "tn": media(tn) if ok_t else None,
            "p": sum(pr) if len(pr) >= MIN_GIORNI_MESE else None,
        }

    serie = []
    for y in anni:
        gg = [g for g in giorni if g[0].year == y]
        tx = [g[2] for g in gg if g[2] is not None]
        tn = [g[3] for g in gg if g[3] is not None]
        pr = [g[1] for g in gg if g[1] is not None]
        ok_t = len(tx) >= MIN_GIORNI_ANNO and len(tn) >= MIN_GIORNI_ANNO
        ok_p = len(pr) >= MIN_GIORNI_ANNO
        m = [mesi.get((y, k)) for k in range(1, 13)]
        serie.append({
            "y": y,
            "tx": r2(media(tx)) if ok_t else None,
            "tn": r2(media(tn)) if ok_t else None,
            "tm": r2((media(tx) + media(tn)) / 2) if ok_t else None,
            "p": round(sum(pr)) if ok_p else None,
            "c30": sum(1 for v in tx if v >= 30) if ok_t else None,
            "c35": sum(1 for v in tx if v >= 35) if ok_t else None,
            "g0": sum(1 for v in tn if v < 0) if ok_t else None,
            "tr20": sum(1 for v in tn if v >= 20) if ok_t else None,
            # mensili: [tmax, tmin, prec] x 12
            "m": [[r2(k["tx"]) if k else None, r2(k["tn"]) if k else None,
                   (round(k["p"], 1) if k and k["p"] is not None else None)] for k in m],
        })

    def normale(a, b):
        out = []
        for k in range(1, 13):
            v = [mesi[(y, k)] for y in range(a, b + 1) if (y, k) in mesi]
            out.append([r2(media([x["tx"] for x in v])), r2(media([x["tn"] for x in v])),
                        r2(media([x["p"] for x in v]))])
        return out

    def top(key, n, rev):
        v = [g for g in giorni if g[key] is not None]
        v.sort(key=lambda g: g[key], reverse=rev)
        return [{"d": g[0].isoformat(), "v": g[key]} for g in v[:n]]

    dati = {
        "slug": slug,
        "dal": giorni[0][0].isoformat(), "al": giorni[-1][0].isoformat(),
        "giorni": len(giorni),
        "prec_dal": next((s["y"] for s in serie if s["p"] is not None), None),
        "valori_corretti": corretti,
        "normali": {"1961-1990": normale(1961, 1990), "1991-2020": normale(1991, 2020)},
        "record": {"tmax": top(2, 15, True), "tmin": top(3, 15, False), "prec": top(1, 15, True)},
        "anni": serie,
    }
    out_json = os.path.join(HERE, "data", "serie", f"{slug}.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(dati, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{slug}: {len(giorni)} giorni, {len(serie)} anni, {corretti} valori corretti (x1000)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
