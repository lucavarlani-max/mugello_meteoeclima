#!/usr/bin/env python3
"""Porta nel sito una pagina generata da ghcn_climatology_chart.py.

Estrae la riga "const DATA=..." dall'HTML generato e la scrive in data/geek/ghcn-climatologia.js:
la pagina del sito (geek-ghcn-climatologia.html) la legge da lì, quindi per aggiornare i grafici
basta rigenerare questo file.

Esempio:
  python3 scripts/ghcn/ghcn_climatology_chart.py --monthly climatologie/climatologia_monthly.csv \\
      --annual climatologie/climatologia_annual.csv --output climatologia_confronto.html
  python3 scripts/ghcn/to_site.py climatologia_confronto.html --stations ghcnd-stations.txt \\
      --default ITM00016158 --default IT000016134

Opzioni:
  --stations FILE   ghcnd-stations.txt: aggiunge i nomi delle stazioni (mostrati al posto dei codici)
  --default ID      stazione selezionata all'apertura della pagina; ripetibile (senza: le prime due)
"""
import os, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(HERE, "data", "geek", "ghcn-climatologia.js")

import argparse, json, re
ap = argparse.ArgumentParser()
ap.add_argument("html")
ap.add_argument("--stations")
ap.add_argument("--default", action="append", default=[])
a = ap.parse_args()

html = open(a.html, encoding="utf-8").read()
i = html.index("const DATA=")
j = html.index("\n", i)
data = html[i:j]
extra = ""
if a.stations:
    ids = set(re.findall(r'"station_id":"([^"]+)"', data))
    names = {}
    for riga in open(a.stations, encoding="utf-8"):
        if riga[:11] in ids:
            names[riga[:11]] = riga[41:71].strip().title()
    extra += "const NAMES=" + json.dumps(names, ensure_ascii=False) + ";\n"
if a.default:
    extra += "const DEFAULTS=" + json.dumps(a.default) + ";\n"
with open(OUT, "w", encoding="utf-8") as f:
    f.write("/* Climatologie GHCN-Daily generate da scripts/ghcn (vedi scripts/ghcn/README.md) */\n" + extra + data + "\n")
print("scritto", OUT)
