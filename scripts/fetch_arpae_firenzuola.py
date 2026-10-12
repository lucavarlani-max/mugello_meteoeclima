#!/usr/bin/env python3
"""
Aggiorna la serie di Firenzuola (firenzuola.html) con gli ultimi dati del dataset ARPAE Emilia-Romagna Eraclito.

Eraclito non è una stazione: è un dataset giornaliero su griglia di circa 5 km (temperatura massima e minima,
precipitazione, dal 1961), ottenuto da ARPAE interpolando le misure delle stazioni. La serie del sito è la cella 01469
(centro 44,1375 N 11,4033 E, quota media 580 m), quella che contiene il capoluogo (fino all'ottobre 2026 era la 01429,
la cella a ovest, quota media 681 m). ARPAE ricalcola i valori recenti quando arrivano nuovi dati di
stazione, quindi si riscaricano l'anno in corso e quello precedente e si sostituiscono i giorni già presenti.

Scarica https://dati-simc.arpae.it/opendata/eraclito/timeseries/01469/01469_<anno>.zip (CSV
PragaDate,DAILY_TMIN,DAILY_TMAX,DAILY_PREC), aggiorna data/serie/firenzuola.csv (data,prec,tmax,tmin)
e rigenera data/serie/firenzuola.json con scripts/build_serie.py.
"""
import datetime as dt, io, os, subprocess, sys, urllib.request, zipfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = os.path.join(HERE, "data", "serie", "firenzuola.csv")
CELLA = "01469"
URL = "https://dati-simc.arpae.it/opendata/eraclito/timeseries/{c}/{c}_{a}.zip"


def anno(a):
    req = urllib.request.Request(URL.format(c=CELLA, a=a), headers={"User-Agent": "mugello-meteo/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        z = zipfile.ZipFile(io.BytesIO(r.read()))
    nome = next(n for n in z.namelist() if n.endswith(".csv"))
    righe = z.read(nome).decode("utf-8").splitlines()
    if righe[0].strip() != "PragaDate,DAILY_TMIN,DAILY_TMAX,DAILY_PREC":
        raise ValueError("intestazione inattesa: " + righe[0])
    out = {}
    for r in righe[1:]:
        d, tn, tx, p = (x.strip() for x in r.split(","))
        out[d] = (p, tx, tn)
    return out


def main():
    righe = open(CSV, encoding="utf-8").read().splitlines()
    testa, serie = righe[0], {}
    for r in righe[1:]:
        c = r.split(",")
        serie[c[0]] = tuple(c[1:4])
    oggi = dt.date.today()
    nuovi, cambiati = 0, 0
    for a in (oggi.year - 1, oggi.year):
        try:
            for d, v in anno(a).items():
                if d not in serie:
                    nuovi += 1
                elif tuple(float(x) if x else None for x in serie[d]) != tuple(float(x) if x else None for x in v):
                    cambiati += 1
                serie[d] = v
        except Exception as e:
            print(f"arpae-firenzuola: {a} non scaricato", e, file=sys.stderr)
    if not nuovi and not cambiati:
        print("arpae-firenzuola: nessuna variazione")
        return
    with open(CSV, "w", encoding="utf-8") as f:
        f.write(testa + "\n")
        for d in sorted(serie):
            f.write(",".join((d,) + tuple(serie[d])) + "\n")
    subprocess.run([sys.executable, os.path.join(HERE, "scripts", "build_serie.py"), CSV, "firenzuola"], check=True)
    print(f"arpae-firenzuola: {nuovi} giorni nuovi, {cambiati} ricalcolati da ARPAE, fino al {max(serie)}")


if __name__ == "__main__":
    main()
