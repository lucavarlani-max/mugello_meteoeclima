#!/usr/bin/env python3
"""
Serie storica di Kremsmünster (Alta Austria), dati mensili di GeoSphere Austria.

Due stazioni dello stesso osservatorio:
  5010  stazione storica, dicembre 1767 – dicembre 2008 (data/serie/kremsmuenster-5010.csv, dall'archivio
        «Stationsdaten v2.1 monatlich» di GeoSphere Austria)
  5012  stazione automatica, dal 1988 a oggi: scaricata qui dall'API di GeoSphere
        https://dataset.api.hub.geosphere.at/v1/station/historical/klima-v2-1m
La serie unita usa la 5010 fino al 2008 e la 5012 dal 2009. Nei 21 anni in comune (1988–2008) si calcola lo
scarto medio fra le due stazioni, mese per mese, e lo si scrive nel JSON: non si corregge niente, si documenta.

Scrive:
  data/serie/kremsmuenster-5012.csv   mensili della stazione automatica
  data/serie/kremsmuenster.json       aggregati annuali e mensili, normali, record mensili, confronto 1988–2008

Uso: python scripts/fetch_kremsmuenster.py [--offline]
  scarica al massimo una volta al giorno (campo "scaricato" del JSON); --offline: niente download, usa i CSV salvati
"""
import csv, datetime as dt, io, json, os, sys, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(HERE, "data", "serie")
API = "https://dataset.api.hub.geosphere.at/v1/station/historical/klima-v2-1m"
# colonne del CSV ripulito e parametri GeoSphere corrispondenti
COL = [("tm", "tl_mittel"), ("txm", "tlmax_mittel"), ("tnm", "tlmin_mittel"), ("tx", "tlmax"), ("tn", "tlmin"),
       ("rr", "rr"), ("rr_max", "rr_max"), ("sommer", "tage_sommer"), ("g_rr1", "tage_rr_1"), ("neve", "shneu_manu"),
       # neve: giorni con neve al suolo, giorni con nevicata, altezza massima del manto (cm), precipitazione solida (mm)
       ("gneve", "tage_schdecke"), ("gnevic", "tage_schfall"), ("hneve", "sh_manu_max"), ("nfest", "tage_festrr")]
NEVE = ["gneve", "gnevic", "hneve", "nfest"]
TESTA = "mese," + ",".join(c for c, _ in COL)


def leggi(p):
    out = {}
    if not os.path.exists(p):
        return out
    righe = [r for r in open(p, encoding="utf-8").read().splitlines() if r and not r.startswith("#")]
    for r in csv.DictReader(io.StringIO("\n".join(righe))):
        out[r["mese"]] = {c: (float(r[c]) if r.get(c) not in (None, "") else None) for c, _ in COL}
    return out


def chiedi(stazione, parametri, dal, al):
    url = (f"{API}?parameters={','.join(parametri)}&station_ids={stazione}&start={dal}-01T00:00"
           f"&end={al}-01T00:00&output_format=csv")
    req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteo/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return list(csv.DictReader(io.StringIO(r.read().decode("utf-8"))))


def completa_5010():
    """Il CSV della stazione storica viene dall'archivio senza le colonne della neve: le si aggiunge una volta sola."""
    p = os.path.join(DIR, "kremsmuenster-5010.csv")
    righe = open(p, encoding="utf-8").read().splitlines()
    i = next(k for k, r in enumerate(righe) if r.startswith("mese,"))
    if righe[i] == TESTA:
        return
    nomi = righe[i].split(",")
    dati = {r.split(",")[0]: dict(zip(nomi, r.split(","))) for r in righe[i + 1:] if r}
    for r in chiedi(5010, [p for c, p in COL if c in NEVE], "1767-12", "2009-01"):
        m = r["time"][:7]
        if m in dati:
            for c, q in COL:
                if c in NEVE:
                    dati[m][c] = "" if r.get(q, "") in ("", "-999", None) else r[q]
    with open(p, "w", encoding="utf-8") as f:
        f.write("\n".join(righe[:i]) + "\n" + TESTA + "\n")
        f.write("".join(",".join([m] + [d.get(c, "") for c, _ in COL]) + "\n" for m, d in sorted(dati.items())))
    print("kremsmuenster: 5010 completata con la neve")


def scarica_5012():
    oggi = dt.date.today()
    righe = []
    for r in chiedi(5012, [p for _, p in COL], "1988-01", f"{oggi.year}-{oggi.month:02d}"):
        v = []
        for c, p in COL:
            x = r.get(p, "")
            v.append("" if x in ("", "-999", None) else x)
        if any(v):
            righe.append([r["time"][:7]] + v)
    p = os.path.join(DIR, "kremsmuenster-5012.csv")
    with open(p, "w", encoding="utf-8") as f:
        f.write("# Kremsmünster (GeoSphere Austria, stazione automatica 5012, 382 m), medie e somme mensili. "
                "Fonte: GeoSphere Austria, API klima-v2-1m, licenza CC BY 4.0\n" + TESTA + "\n")
        f.write("".join(",".join(r) + "\n" for r in righe))
    print("kremsmuenster: 5012", len(righe), "mesi", righe[0][0] if righe else "", "→", righe[-1][0] if righe else "")


def media(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def r2(x):
    return None if x is None else round(x, 2)


def main():
    oggi = dt.date.today().isoformat()
    pj = os.path.join(DIR, "kremsmuenster.json")
    if "--offline" not in sys.argv and os.path.exists(pj) and json.load(open(pj, encoding="utf-8")).get("scaricato") == oggi:
        print("kremsmuenster: già aggiornato oggi")
        return
    if "--offline" not in sys.argv:
        for f in (completa_5010, scarica_5012):
            try:
                f()
            except Exception as e:
                print("kremsmuenster:", f.__name__, "non riuscito", e, file=sys.stderr)
    S10 = leggi(os.path.join(DIR, "kremsmuenster-5010.csv"))
    S12 = leggi(os.path.join(DIR, "kremsmuenster-5012.csv"))
    # serie unita: 5010 fino al 2008, poi 5012
    M = {m: dict(v, fonte=5010) for m, v in S10.items()}
    for m, v in S12.items():
        if m >= "2009-01":
            M[m] = dict(v, fonte=5012)
    mesi = sorted(M)
    a0, a1 = int(mesi[0][:4]), int(mesi[-1][:4])

    anni = []
    for a in range(a0, a1 + 1):
        mm = [M.get(f"{a}-{m:02d}") for m in range(1, 13)]
        def tot(k, somma=False):
            v = [x[k] if x else None for x in mm]
            if any(x is None for x in v):
                return None
            return round(sum(v), 1) if somma else r2(sum(v) / 12)
        def estr(k, f):
            v = [(x[k], i + 1) for i, x in enumerate(mm) if x and x[k] is not None]
            return list(f(v)) if len(v) == 12 else None
        rec = {"y": a, "tm": tot("tm"), "txm": tot("txm"), "tnm": tot("tnm"), "p": tot("rr", True),
               "sommer": tot("sommer", True), "neve": tot("neve", True),
               "tx": estr("tx", max), "tn": estr("tn", min),
               "fonte": 5012 if a >= 2009 else 5010,
               "m": [[(x or {}).get(k) for k in ("tm", "txm", "tnm", "rr")] for x in mm]}
        if rec["sommer"] is not None:
            rec["sommer"] = int(rec["sommer"])
        anni.append(rec)

    # neve per stagione invernale: la stagione «y» va da luglio dell'anno y-1 a giugno dell'anno y; conta solo se
    # i mesi da ottobre ad aprile ci sono tutti (gli altri, se mancano, valgono zero)
    neve = []
    for y in range(a0 + 1, a1 + 1):
        ms = [f"{y-1}-{m:02d}" for m in range(7, 13)] + [f"{y}-{m:02d}" for m in range(1, 7)]
        cuore = ms[3:10]
        rec = {"y": y}
        for k, nome in (("gneve", "gn"), ("gnevic", "gf"), ("hneve", "h"), ("neve", "cm")):
            if any(M.get(m, {}).get(k) is None for m in cuore):
                rec[nome] = None
                continue
            v = [M.get(m, {}).get(k) or 0 for m in ms]
            rec[nome] = max(v) if k == "hneve" else round(sum(v))
        # controllo: zero giorni di neve al suolo con almeno 10 giorni di nevicata è un dato mancante scritto come zero
        # (succede nell'inverno 1896/97: 29 giorni di nevicata, gennaio a −2 °C, manto «assente» tutto l'inverno)
        if rec["gn"] == 0 and (rec["gf"] or 0) >= 10:
            rec["gn"] = rec["h"] = None
            rec["scartato"] = "neve al suolo zero con %d giorni di nevicata" % rec["gf"]
        if any(rec[n] is not None for n in ("gn", "gf", "h", "cm")):
            rec["fonte"] = 5012 if y >= 2010 else 5010
            neve.append(rec)

    def norm(da, a):
        out = []
        for m in range(12):
            r = []
            for k in ("tm", "txm", "tnm", "rr"):
                r.append(r2(media([M[f"{y}-{m+1:02d}"][k] for y in range(da, a + 1) if f"{y}-{m+1:02d}" in M])))
            out.append(r)
        return out

    # record mensili: massima e minima assolute di ogni mese, pioggia del mese e massimo in un giorno
    # (tmax e tmin, solo il primo, servono alle schede di serie-storiche.html)
    def classifica(k, alto=True, n=12):
        v = [(M[m][k], m) for m in mesi if M[m][k] is not None]
        v.sort(key=lambda x: -x[0] if alto else x[0])
        return [{"m": m, "v": x} for x, m in v[:n]]

    # confronto delle due stazioni negli anni in comune (1988–2008)
    comuni = [m for m in S10 if m in S12]
    conf = {}
    for k in ("tm", "txm", "tnm", "rr", "gneve", "gnevic"):
        d = [S12[m][k] - S10[m][k] for m in comuni if S12[m][k] is not None and S10[m][k] is not None]
        if d:
            conf[k] = {"n": len(d), "media": r2(media(d)),
                       "mesi": [r2(media([S12[m][k] - S10[m][k] for m in comuni if int(m[5:]) == i + 1
                                          and S12[m][k] is not None and S10[m][k] is not None])) for i in range(12)]}
    prima = json.load(open(pj, encoding="utf-8")).get("scaricato") if os.path.exists(pj) else None
    out = {"slug": "kremsmuenster", "dal": mesi[0], "al": mesi[-1], "mesi": len(mesi),
           "scaricato": prima if "--offline" in sys.argv else oggi,
           "stazioni": {"5010": [min(S10), max(S10)] if S10 else None, "5012": [min(S12), max(S12)] if S12 else None},
           "confronto": {"periodo": [min(comuni), max(comuni)] if comuni else None, "scarti": conf},
           "normali": {"1961-1990": norm(1961, 1990), "1991-2020": norm(1991, 2020)},
           "record": {"tmax": classifica("tx", n=1), "tmin": classifica("tn", False, n=1), "tx": classifica("tx"), "tn": classifica("tn", False), "rr": classifica("rr"),
                      "rr_max": classifica("rr_max"), "tm_alto": classifica("tm"), "tm_basso": classifica("tm", False)},
           "anni": anni, "neve": neve}
    json.dump(out, open(pj, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("kremsmuenster:", out["dal"], "→", out["al"], len(mesi), "mesi; scarti 5012−5010:",
          {k: v["media"] for k, v in conf.items()})


if __name__ == "__main__":
    main()
