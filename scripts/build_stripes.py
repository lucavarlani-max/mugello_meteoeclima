#!/usr/bin/env python3
"""Prepara data/geek/stripes.json per la sperimentazione MeteoGeek «Warming stripes».

Per ogni stazione: temperatura media annua (°C) degli anni completi.
 - serie lunghe: campo `tm` di data/serie/<slug>.json (anni con almeno 330 giorni validi, vedi build_serie.py)
 - Borgo San Lorenzo: media di (massima+minima)/2 dai dati giornalieri data/bsl/borgo.json, solo anni con
   almeno 330 giorni con massima e minima valide (gli anni con meno dati restano buchi, non vengono stimati).
Riferimento delle anomalie: media 1961-1990 della stazione (se ha almeno 20 anni validi in quel periodo),
altrimenti media dell'intera serie (indicato nel campo `rif`).

Uso: python scripts/build_stripes.py
"""
import datetime as dt
import json
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERIE = os.path.join(HERE, "data", "serie")
MIN_GIORNI = 330
REF0, REF1, REF_MIN_ANNI = 1961, 1990, 20

# (id, nome, area, file o None per Borgo, nota)
STAZIONI = [
    ("borgo", "Borgo San Lorenzo", "Mugello", None, "SIR Toscana; buco 1989-2000 per dati mancanti"),
    ("firenzuola", "Firenzuola", "Mugello", "firenzuola", "Appennino, 1961-oggi"),
    ("genova", "Genova", "Italia", "genova", "dal 1833"),
    ("padova", "Padova", "Italia", "padova", "dal 1725, una delle serie più lunghe del mondo"),
    ("milano-brera", "Milano Brera", "Italia", "milano-brera", "dal 1763"),
    ("moncalieri", "Moncalieri", "Italia", "moncalieri", "Osservatorio Collegio Carlo Alberto, dal 1865"),
    ("domodossola", "Domodossola", "Italia", "domodossola", "dal 1872, fino al 2013"),
    ("oxford", "Oxford", "Mondo", "oxford", "Radcliffe Observatory, dal 1815"),
    ("de-bilt", "De Bilt", "Mondo", "de-bilt", "Paesi Bassi, dal 1901"),
    ("mont-aigoual", "Mont Aigoual", "Mondo", "mont-aigoual", "Cévennes, 1.567 m"),
    ("new-york", "New York Central Park", "Mondo", "new-york-central-park", "dal 1869"),
    ("san-francisco", "San Francisco", "Mondo", "san-francisco", "dal 1921"),
    ("bangalore", "Bangalore", "Mondo", "bangalore", "India, anni con dati completi"),
]


def da_borgo():
    b = json.load(open(os.path.join(HERE, "data", "bsl", "borgo.json"), encoding="utf-8"))
    d0 = dt.date.fromisoformat(b["t"]["dal"])
    n, somma = defaultdict(int), defaultdict(float)
    for i, (x, m) in enumerate(zip(b["t"]["tx"], b["t"]["tn"])):
        if x is None or m is None:
            continue
        y = (d0 + dt.timedelta(i)).year
        n[y] += 1
        somma[y] += (x + m) / 2
    return {y: round(somma[y] / n[y], 2) for y in n if n[y] >= MIN_GIORNI}


def da_serie(slug):
    d = json.load(open(os.path.join(SERIE, slug + ".json"), encoding="utf-8"))
    return {a["y"]: a["tm"] for a in d["anni"] if a.get("tm") is not None}


def main():
    out = []
    for sid, nome, area, slug, nota in STAZIONI:
        anni = da_borgo() if slug is None else da_serie(slug)
        ref = [v for y, v in anni.items() if REF0 <= y <= REF1]
        if len(ref) >= REF_MIN_ANNI:
            rif, periodo = sum(ref) / len(ref), f"{REF0}-{REF1}"
        else:
            rif, periodo = sum(anni.values()) / len(anni), "intera serie"
        ys = sorted(anni)
        out.append({
            "id": sid, "nome": nome, "area": area, "nota": nota,
            "dal": ys[0], "al": ys[-1], "n": len(ys),
            "rif": {"periodo": periodo, "tm": round(rif, 2)},
            "anni": [[y, round(anni[y], 2)] for y in ys],
        })
        print(f"{sid}: {ys[0]}-{ys[-1]}, {len(ys)} anni, riferimento {periodo} = {rif:.2f} °C")
    with open(os.path.join(HERE, "data", "geek", "stripes.json"), "w", encoding="utf-8") as f:
        json.dump({"agg": dt.date.today().isoformat(), "stazioni": out}, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
