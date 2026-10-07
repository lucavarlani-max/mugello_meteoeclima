#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dati per la pagina MeteoGeek «Spaghetti plot» (geek-ensemble.html): i membri dell'ensemble ECMWF.

Un ensemble è un insieme di previsioni dello stesso modello partendo da condizioni iniziali leggermente diverse:
l'ECMWF IFS ne calcola 51 (un controllo + 50 membri perturbati) fino a 15 giorni. Se i 51 «futuri possibili» restano
vicini la previsione è affidabile, se si aprono a ventaglio è incerta.

Fonte: Open-Meteo Ensemble API (gratuita, senza chiave), modello ecmwf_ifs025; se non disponibile ripiega su
NOAA GFS 0,25° (31 membri). Per due punti: Borgo San Lorenzo (fondovalle) e Firenzuola (Appennino).
Variabili: temperatura a 2 m, pioggia (cumulata dall'inizio, mm), pressione al livello del mare (hPa) e temperatura a
850 e 500 hPa (circa 1,5 e 5,5 km di quota).

Uscita: data/ensemble.json
  {"aggiornato":.., "modello":.., "membri":N, "t":[ora locale ISO ogni 3 ore],
   "scala":{variabile: fattore}, "punti":[{"id","nome","lat","lon","dati":{variabile:[[valori interi/fattore]...]}}]}
  La serie 0 di ogni variabile è il controllo, le altre i membri perturbati. null = valore mancante.

Come sinottica, scarica solo se i dati hanno più di 6 ore (l'ECMWF aggiorna 4 volte al giorno): l'Action gira ogni 30
minuti ma qui si esce subito. `--forza` scarica comunque.
"""
import datetime
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "ensemble.json")
PUNTI = [("borgo", "Borgo San Lorenzo", 43.9547, 11.3861), ("firenzuola", "Firenzuola", 44.1206, 11.3789)]
VARS = ["temperature_2m", "precipitation", "pressure_msl", "temperature_850hPa", "temperature_500hPa"]
SCALA = {v: 10 for v in VARS}
MODELLI = [("ecmwf_ifs025", "ECMWF IFS 0,25° ensemble"), ("gfs025", "NOAA GFS 0,25° ensemble")]
GIORNI = [15, 10, 7]            # si prova dal più lungo: se l'API rifiuta (400) si accorcia
MIN_MEMBRI = 10
ETA_MAX = datetime.timedelta(hours=6)


def adesso():
    return datetime.datetime.now(datetime.timezone.utc)


def recente():
    try:
        d = json.load(open(OUT, encoding="utf-8"))
        t = datetime.datetime.fromisoformat(d["aggiornato"].replace("Z", "+00:00"))
        completo = all(v in d["punti"][0]["dati"] for v in VARS)      # un file senza le variabili nuove va rifatto subito
        return completo and adesso() - t < ETA_MAX
    except Exception:  # noqa: BLE001
        return False


def getjson(url, timeout=90):
    req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteoeclima/ensemble"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def scarica(modello, giorni):
    q = urllib.parse.urlencode({
        "latitude": ",".join(f"{p[2]:g}" for p in PUNTI), "longitude": ",".join(f"{p[3]:g}" for p in PUNTI),
        "hourly": ",".join(VARS), "models": modello, "timezone": "Europe/Rome", "forecast_days": giorni,
    }, safe=",")
    d = getjson("https://ensemble-api.open-meteo.com/v1/ensemble?" + q)
    return d if isinstance(d, list) else [d]


def serie_membri(hourly, var):
    """Controllo (chiave senza suffisso) + membri `var_memberNN` in ordine numerico."""
    rx = re.compile(r"^%s_member(\d+)$" % re.escape(var))
    membri = sorted((int(m.group(1)), k) for k in hourly for m in [rx.match(k)] if m)
    out = []
    if isinstance(hourly.get(var), list):
        out.append(hourly[var])
    out += [hourly[k] for _, k in membri]
    return out


def elabora(risposta, tempi_ok):
    """Da una risposta di un punto a {variabile: [serie scalate intere]}, già sfoltite alle ore `tempi_ok` (indici)."""
    h = risposta["hourly"]
    dati = {}
    for var in VARS:
        fattore = SCALA[var]
        ris = []
        for s in serie_membri(h, var):
            if not any(v is not None for v in s):
                continue
            if var == "precipitation":                      # cumulata sull'intera serie, poi si sfoltisce
                tot, cum = 0.0, []
                for v in s:
                    tot += v or 0.0
                    cum.append(tot)
                s = cum
            ris.append([None if s[i] is None else round(s[i] * fattore) for i in tempi_ok])
        dati[var] = ris
    return dati


def main():
    if recente() and "--forza" not in sys.argv:
        print("ensemble: dati recenti, niente da scaricare")
        return
    ris = nome = None
    for modello, nm in MODELLI:
        for giorni in GIORNI:
            try:
                r = scarica(modello, giorni)
                if len(r) != len(PUNTI):
                    raise ValueError("%d risposte per %d punti" % (len(r), len(PUNTI)))
                tempi = r[0]["hourly"]["time"]
                ok = [i for i, t in enumerate(tempi) if int(t[11:13]) % 3 == 0]       # una riga ogni 3 ore
                dati = [elabora(x, ok) for x in r]
                if any(len(d[v]) < MIN_MEMBRI for d in dati for v in VARS):
                    raise ValueError("pochi membri (%s)" % [len(d[v]) for d in dati for v in VARS])
                ris, nome = (dati, [tempi[i] for i in ok]), nm
                break
            except urllib.error.HTTPError as e:
                print("ensemble: %s %d giorni -> HTTP %s" % (modello, giorni, e.code), file=sys.stderr)
            except Exception as e:  # noqa: BLE001
                print("ensemble: %s %d giorni non disponibile (%s)" % (modello, giorni, e), file=sys.stderr)
                break                                       # errore non legato alla durata: prossimo modello
        if ris:
            break
    if not ris:
        print("ensemble: nessun modello disponibile, tengo i dati precedenti", file=sys.stderr)
        return
    dati, t = ris
    out = {
        "aggiornato": adesso().isoformat(timespec="minutes").replace("+00:00", "Z"),
        "modello": nome, "fonte": "Open-Meteo Ensemble API", "membri": len(dati[0]["temperature_2m"]),
        "t": t, "scala": SCALA,
        "punti": [{"id": p[0], "nome": p[1], "lat": p[2], "lon": p[3], "dati": d} for p, d in zip(PUNTI, dati)],
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("ensemble: %s, %d membri, %d scadenze, %d punti" % (nome, out["membri"], len(t), len(PUNTI)))


if __name__ == "__main__":
    main()
