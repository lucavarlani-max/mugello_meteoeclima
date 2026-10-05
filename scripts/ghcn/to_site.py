#!/usr/bin/env python3
"""Porta nel sito una pagina generata da ghcn_climatology_chart.py.

Estrae la riga "const DATA=..." dall'HTML generato e la scrive in data/geek/ghcn-climatologia.js:
la pagina del sito (geek-ghcn-climatologia.html) la legge da lì, quindi per aggiornare i grafici
basta rigenerare questo file.

Esempio:
  python3 scripts/ghcn/ghcn_climatology_chart.py --monthly climatologie/climatologia_monthly.csv \\
      --annual climatologie/climatologia_annual.csv --output climatologia_confronto.html
  python3 scripts/ghcn/to_site.py climatologia_confronto.html
"""
import os, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(HERE, "data", "geek", "ghcn-climatologia.js")

html = open(sys.argv[1], encoding="utf-8").read()
i = html.index("const DATA=")
j = html.index("\n", i)
with open(OUT, "w", encoding="utf-8") as f:
    f.write("/* Climatologie GHCN-Daily generate da scripts/ghcn (vedi scripts/ghcn/README.md) */\n" + html[i:j] + "\n")
print("scritto", OUT)
