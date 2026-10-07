#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dati per la pagina MeteoGeek «Skew-T» (geek-skewt.html): profili verticali di atmosfera previsti sul Mugello.

Per Borgo San Lorenzo (fondovalle) e Firenzuola (Appennino) scarica da Open-Meteo, ogni 3 ore fino a 5 giorni,
temperatura, umidità relativa, quota geopotenziale e vento sui livelli di pressione da 1000 a 200 hPa, più i dati
di superficie (temperatura e punto di rugiada a 2 m, pressione al suolo, vento a 10 m) e il CAPE calcolato dal
modello (per confronto con quello che la pagina ricalcola dal profilo).

Modello: ECMWF IFS 0,25°; se non fornisce abbastanza livelli ripiega su NOAA GFS (gfs_seamless).
Uscita: data/skewt.json  (orari in UTC)
  {"aggiornato":.., "modello":.., "t":[..], "livelli":[hPa..],
   "punti":[{"id","nome","lat","lon","quota",
             "sup":{"t","td","ps","v","d","cape"},
             "liv":{"850":{"t":[..],"rh":[..],"z":[..],"v":[..],"d":[..]}, ...}}]}
  v = km/h, d = gradi da cui soffia, z = metri geopotenziali; null = mancante.

Come le carte sinottiche, scarica solo se i dati hanno più di 6 ore; `--forza` scarica comunque.
"""
import datetime
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "skewt.json")
PUNTI = [("borgo", "Borgo San Lorenzo", 43.9547, 11.3861), ("firenzuola", "Firenzuola", 44.1206, 11.3789)]
LIVELLI = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200]
CAMPI = [("t", "temperature"), ("rh", "relative_humidity"), ("z", "geopotential_height"),
         ("v", "wind_speed"), ("d", "wind_direction")]
SUP = [("t", "temperature_2m"), ("td", "dew_point_2m"), ("ps", "surface_pressure"),
       ("v", "wind_speed_10m"), ("d", "wind_direction_10m")]
MODELLI = [("ecmwf_ifs025", "ECMWF IFS 0,25°"), ("gfs_seamless", "NOAA GFS")]
ORE = 120
MIN_LIVELLI = 6
ETA_MAX = datetime.timedelta(hours=6)


def adesso():
    return datetime.datetime.now(datetime.timezone.utc)


def recente():
    try:
        d = json.load(open(OUT, encoding="utf-8"))
        t = datetime.datetime.fromisoformat(d["aggiornato"].replace("Z", "+00:00"))
        return adesso() - t < ETA_MAX
    except Exception:  # noqa: BLE001
        return False


def getjson(url, timeout=90):
    req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteoeclima/skewt"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def richiedi(modello, variabili):
    q = urllib.parse.urlencode({
        "latitude": ",".join(f"{p[2]:g}" for p in PUNTI), "longitude": ",".join(f"{p[3]:g}" for p in PUNTI),
        "hourly": ",".join(variabili), "models": modello, "timezone": "GMT", "forecast_hours": ORE,
    }, safe=",")
    d = getjson("https://api.open-meteo.com/v1/forecast?" + q)
    d = d if isinstance(d, list) else [d]
    if len(d) != len(PUNTI):
        raise ValueError("%d risposte per %d punti" % (len(d), len(PUNTI)))
    return d


def tondo(serie, ok, nd=1):
    return [None if serie[i] is None else round(serie[i], nd) for i in ok]


def elabora(resp, ok):
    """Da una risposta di un punto a ({sup}, {livello: {campo: serie}}) già sfoltita agli indici `ok`."""
    h = resp["hourly"]
    liv = {}
    for L in LIVELLI:
        o = {k: tondo(h[f"{nome}_{L}hPa"], ok) for k, nome in CAMPI if isinstance(h.get(f"{nome}_{L}hPa"), list)}
        # un livello serve solo con temperatura e umidità: senza (o tutto nullo) si scarta
        if all(isinstance(o.get(k), list) and any(v is not None for v in o[k]) for k in ("t", "rh")):
            liv[str(L)] = o
    sup = {k: tondo(h[nome], ok) for k, nome in SUP if isinstance(h.get(nome), list)}
    return sup, liv


def main():
    if recente() and "--forza" not in sys.argv:
        print("skewt: dati recenti, niente da scaricare")
        return
    vars_liv = [f"{nome}_{L}hPa" for L in LIVELLI for _, nome in CAMPI] + [nome for _, nome in SUP]
    risultato = None
    for modello, nome in MODELLI:
        try:
            r = richiedi(modello, vars_liv)
            tempi = r[0]["hourly"]["time"]
            ok = [i for i, t in enumerate(tempi) if int(t[11:13]) % 3 == 0]
            elab = [elabora(x, ok) for x in r]
            if any(len(l) < MIN_LIVELLI or not s.get("t") for s, l in elab):
                raise ValueError("pochi livelli (%s)" % [len(l) for _, l in elab])
            risultato = (nome, [tempi[i] for i in ok], elab, [x.get("elevation") for x in r], modello)
            break
        except Exception as e:  # noqa: BLE001
            print("skewt: %s non disponibile (%s)" % (modello, e), file=sys.stderr)
    if not risultato:
        print("skewt: nessun modello disponibile, tengo i dati precedenti", file=sys.stderr)
        return
    nome, t, elab, quote, modello = risultato
    try:                                    # CAPE del modello: facoltativo, per confronto
        for (s, _), x in zip(elab, richiedi(modello, ["cape"])):
            s["cape"] = tondo(x["hourly"]["cape"], [i for i, tt in enumerate(x["hourly"]["time"]) if int(tt[11:13]) % 3 == 0])
    except Exception as e:  # noqa: BLE001
        print("skewt: CAPE del modello non disponibile (%s)" % e, file=sys.stderr)
    livelli = sorted({int(k) for _, l in elab for k in l}, reverse=True)
    out = {
        "aggiornato": adesso().isoformat(timespec="minutes").replace("+00:00", "Z"),
        "modello": nome, "fonte": "Open-Meteo", "t": t, "livelli": livelli,
        "punti": [{"id": p[0], "nome": p[1], "lat": p[2], "lon": p[3], "quota": q, "sup": s, "liv": l}
                  for p, (s, l), q in zip(PUNTI, elab, quote)],
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("skewt: %s, %d livelli, %d scadenze, %d punti" % (nome, len(livelli), len(t), len(PUNTI)))


if __name__ == "__main__":
    main()
