#!/usr/bin/env python3
"""
Serie storica della stazione CFR/SIR TOS01000999 Borgo S. Lorenzo (196 m) per la
pagina borgo-storico.html.

Ingresso (export dell'archivio SIR, sir.toscana.it, separatore ";"):
  data/bsl/temp_TOS01000999.csv  gg/mm/aaaa;Max;Min            (dal 1951)
  data/bsl/prec_TOS01000999.csv  gg/mm/aaaa;Precipitazione;Tipo (dal 1991, "@" = mancante)
Uscita:
  data/bsl/borgo.json  serie giornaliere dense (null = mancante) + metadati.
I giorni dopo la fine dell'export SIR li aggiunge ogni giorno scripts/fetch_bsl.py
dai dati in tempo reale del CFR (valori provvisori).
Pulizia: si scartano i giorni con massima < minima e i periodi in ESCLUSI
(temperature non affidabili, per esempio per un guasto del sensore).
"""
import json, os, datetime as dt

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(HERE, "data", "bsl")
# periodi di temperatura esclusi: (dal, al, motivo)
ESCLUSI = [
    (dt.date(1951, 9, 14), dt.date(1951, 9, 19), "malfunzionamento del sensore"),
]


def righe(path):
    for l in open(path, encoding="utf-8-sig"):
        c = l.strip().split(";")
        if len(c) >= 2 and len(c[0]) == 10 and c[0][2] == "/" and c[0][5] == "/":
            g, m, a = map(int, c[0].split("/"))
            yield dt.date(a, m, g), c[1:]


def num(x):
    x = (x or "").strip().replace(",", ".")
    try:
        return float(x)
    except ValueError:
        return None


def denso(serie, dal, al):
    n = (al - dal).days + 1
    out = [None] * n
    for d, v in serie.items():
        out[(d - dal).days] = v
    return out


def main():
    tx, tn, scartati = {}, {}, 0
    for d, c in righe(os.path.join(D, "temp_TOS01000999.csv")):
        a, b = num(c[0]), num(c[1] if len(c) > 1 else None)
        if a is not None and b is not None and a < b:
            scartati += 1
            continue
        if any(d0 <= d <= d1 for d0, d1, _ in ESCLUSI):
            continue
        if a is not None: tx[d] = a
        if b is not None: tn[d] = b
    pr = {}
    for d, c in righe(os.path.join(D, "prec_TOS01000999.csv")):
        v = num(c[0])
        if v is not None and (len(c) < 2 or c[1].strip() != "@"):
            pr[d] = v
    t0, t1 = min(tx), max(max(tx), max(tn))
    p0, p1 = min(pr), max(pr)
    out = {
        "stazione": {"id": "TOS01000999", "nome": "Borgo S. Lorenzo", "quota": 196, "lat": 43.958, "lon": 11.391},
        "fonte": "Servizio Idrologico Regionale (SIR) e Centro Funzionale Regione Toscana (CFR)",
        "sir_al": max(t1, p1).isoformat(),
        "t": {"dal": t0.isoformat(), "tx": denso(tx, t0, t1), "tn": denso(tn, t0, t1)},
        "p": {"dal": p0.isoformat(), "mm": denso(pr, p0, p1)},
        "oggi": None,
        "esclusi": [{"dal": a.isoformat(), "al": b.isoformat(), "motivo": m} for a, b, m in ESCLUSI],
    }
    with open(os.path.join(D, "borgo.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"borgo: temperature {t0}–{t1} ({len(tx)} massime, {len(tn)} minime, {scartati} giorni scartati), "
          f"pioggia {p0}–{p1} ({len(pr)} giorni)")


if __name__ == "__main__":
    main()
