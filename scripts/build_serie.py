#!/usr/bin/env python3
"""
Prepara i dati delle serie storiche (stazioni centenarie) per il sito.

Uso:
  python scripts/build_serie.py <csv giornaliero> <slug>
  es. python scripts/build_serie.py data/serie/milano-brera.csv milano-brera

Formati accettati per il CSV giornaliero:
  - year,month,day,prec,tempMax,tempMin (-99.9 = mancante), es. ARPA Lombardia
  - export NOAA GHCN-Daily (colonne DATE, PRCP, TMAX, TMIN, SNOW in unità
    metriche); i valori con flag di qualità NOAA vengono scartati
  - il formato ripulito prodotto da questo script, data,prec,tmax,tmin[,neve][,tmedia]
    (si può rigenerare).
  - serie omogeneizzata di Padova (Stefanini et al. 2023): separatore ";",
    Date (gg/mm/aaaa);tmin;tmax;tmean;tmin_metadata;tmax_metadata;tmean_metadata
    ("NA" = mancante). Niente pioggia; la temperatura media giornaliera c'è
    anche negli anni senza massima e minima, e il codice tmean_metadata dice
    da quale fonte viene ogni giorno.
Scrive:
  data/serie/<slug>.csv   serie giornaliera ripulita (mancanti = campo vuoto)
  data/serie/<slug>.json  aggregati annuali e mensili, normali, record
                          (e neve per stagione, se la serie ha la neve)

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


def leggi(src):
    """Ritorna [(data, prec, tmax, tmin, neve_mm, tmedia, fonte)] e il numero di valori corretti x1000."""
    giorni, corretti = [], 0
    with open(src, encoding="utf-8-sig") as f:
        sep = ";" if ";" in f.readline() else ","
        f.seek(0)
        for row in csv.DictReader(f, delimiter=sep):
            if "Date" in row and "tmean" in row:          # serie omogeneizzata di Padova
                g_, m_, a_ = map(int, row["Date"].split("/"))
                fonte = row.get("tmean_metadata")
                if fonte == "10":                          # media da max e min: conta la fonte della minima
                    fonte = row.get("tmin_metadata")
                giorni.append([datetime.date(a_, m_, g_), None, val(row["tmax"]), val(row["tmin"]), None,
                               val(row["tmean"]), int(fonte) if fonte not in (None, "", "NA") else None])
                continue
            if "DATE" in row and "TMAX" in row:          # NOAA GHCN-Daily
                def g(k):
                    a = (row.get(k + "_ATTRIBUTES") or "").split(",")
                    return None if len(a) > 1 and a[1].strip() else val(row.get(k))
                d = datetime.date.fromisoformat(row["DATE"])
                giorni.append([d, g("PRCP"), g("TMAX"), g("TMIN"), g("SNOW"), None, None])
                continue
            if "data" in row:                            # formato già ripulito
                row = dict(zip(("year", "month", "day"), row["data"].split("-")),
                           prec=row["prec"], tempMax=row["tmax"], tempMin=row["tmin"], neve=row.get("neve"),
                           tmedia=row.get("tmedia"))
            tx, c1 = pulisci_t(val(row["tempMax"]))
            tn, c2 = pulisci_t(val(row["tempMin"]))
            corretti += c1 + c2
            giorni.append([datetime.date(int(row["year"]), int(row["month"]), int(row["day"])),
                           val(row["prec"]), tx, tn, val(row.get("neve")), val(row.get("tmedia")), None])
    for g in giorni:
        if g[2] is not None and g[3] is not None and g[2] < g[3]:
            g[2] = g[3] = None
    return [tuple(g) for g in giorni], corretti


def main(src, slug):
    giorni, corretti = leggi(src)
    giorni.sort()

    # serie ripulita
    out_csv = os.path.join(HERE, "data", "serie", f"{slug}.csv")
    con_neve = any(g[4] is not None for g in giorni)
    con_tm = any(g[5] is not None for g in giorni)
    with open(out_csv, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["data", "prec", "tmax", "tmin"] + (["neve"] if con_neve else []) + (["tmedia"] if con_tm else []))
        for d, p, tx, tn, sn, tm, _ in giorni:
            vals = (p, tx, tn) + ((sn,) if con_neve else ()) + ((tm,) if con_tm else ())
            w.writerow([d.isoformat()] + ["" if v is None else f"{v:g}" for v in vals])

    # mensili
    per_mese = defaultdict(list)
    for g in giorni:
        per_mese[(g[0].year, g[0].month)].append(g)
    anni = sorted({g[0].year for g in giorni})
    mesi = {}
    for (y, m), gg in per_mese.items():
        tx = [g[2] for g in gg if g[2] is not None]
        tn = [g[3] for g in gg if g[3] is not None]
        pr = [g[1] for g in gg if g[1] is not None]
        tm = [g[5] for g in gg if g[5] is not None]
        ok_t = len(tx) >= MIN_GIORNI_MESE and len(tn) >= MIN_GIORNI_MESE
        mesi[(y, m)] = {
            "tx": media(tx) if ok_t else None,
            "tn": media(tn) if ok_t else None,
            "p": sum(pr) if len(pr) >= MIN_GIORNI_MESE else None,
            "tm": media(tm) if len(tm) >= MIN_GIORNI_MESE else ((media(tx) + media(tn)) / 2 if ok_t else None),
        }

    serie = []
    for y in anni:
        gg = [g for g in giorni if g[0].year == y]
        tx = [g[2] for g in gg if g[2] is not None]
        tn = [g[3] for g in gg if g[3] is not None]
        pr = [g[1] for g in gg if g[1] is not None]
        tmd = [g[5] for g in gg if g[5] is not None]
        ok_t = len(tx) >= MIN_GIORNI_ANNO and len(tn) >= MIN_GIORNI_ANNO
        ok_p = len(pr) >= MIN_GIORNI_ANNO
        if con_tm:
            tm_anno = r2(media(tmd)) if len(tmd) >= MIN_GIORNI_ANNO else None
        else:
            tm_anno = r2((media(tx) + media(tn)) / 2) if ok_t else None
        m = [mesi.get((y, k)) for k in range(1, 13)]
        serie.append({
            "y": y,
            "tx": r2(media(tx)) if ok_t else None,
            "tn": r2(media(tn)) if ok_t else None,
            "tm": tm_anno,
            "p": round(sum(pr)) if ok_p else None,
            "c30": sum(1 for v in tx if v >= 30) if ok_t else None,
            "c35": sum(1 for v in tx if v >= 35) if ok_t else None,
            "g0": sum(1 for v in tn if v < 0) if ok_t else None,
            "tr20": sum(1 for v in tn if v >= 20) if ok_t else None,
            # mensili: [tmax, tmin, prec] x 12 (+ tmedia se la serie ce l'ha)
            "m": [[r2(k["tx"]) if k else None, r2(k["tn"]) if k else None,
                   (round(k["p"], 1) if k and k["p"] is not None else None)]
                  + ([r2(k["tm"]) if k else None] if con_tm else []) for k in m],
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

    def stagioni_neve():
        # stagione invernale da luglio a giugno, indicata con l'anno in cui finisce
        per = defaultdict(list)
        for g in giorni:
            per[g[0].year + (1 if g[0].month >= 7 else 0)].append(g)
        out = []
        for y in sorted(per):
            inv = [g for g in per[y] if g[0].month in (11, 12, 1, 2, 3)]
            v = [g[4] for g in per[y] if g[4] is not None]
            if len([g for g in inv if g[4] is not None]) < 140:   # inverno quasi completo
                continue
            out.append({"y": y, "cm": round(sum(v) / 10, 1),
                        "g25": sum(1 for x in v if x >= 25),     # giorni con almeno 1 pollice
                        "max": round(max(v) / 10, 1) if v else None})
        return out

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
    if con_tm:
        dati["tmedia_dal"] = next(g[0].year for g in giorni if g[5] is not None)
        dati["tmaxmin_dal"] = next((g[0].year for g in giorni if g[2] is not None), None)
    if any(g[6] is not None for g in giorni):
        # fonte prevalente di ogni anno (codice tmean_metadata)
        per_anno = defaultdict(lambda: defaultdict(int))
        for g in giorni:
            if g[6] is not None:
                per_anno[g[0].year][g[6]] += 1
        dati["fonti"] = [[y, max(c, key=c.get)] for y, c in sorted(per_anno.items())]
    if con_neve:
        dati["neve"] = {"stagioni": stagioni_neve(), "record": top(4, 15, True)}
    out_json = os.path.join(HERE, "data", "serie", f"{slug}.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(dati, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{slug}: {len(giorni)} giorni, {len(serie)} anni, {corretti} valori corretti (x1000)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
