#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dati per la pagina MeteoGeek «Ricerca analoghi» (geek-analoghi.html): i giorni del passato che somigliano a oggi.

Un «analogo» è un giorno dell'archivio in cui la situazione meteorologica era simile a quella di oggi: stessa
disposizione di alte e basse pressioni sull'Europa, stesso vento, temperatura e pioggia vicine. Guardare che cosa
è successo nei giorni successivi a quegli analoghi è il più vecchio metodo di previsione, usato ancora oggi come
controllo dei modelli.

Che cosa si scarica (Open-Meteo, gratuito e senza chiave):
  * la pressione media giornaliera al livello del mare su una griglia di 12 punti intorno all'Italia
    (longitudini -5, 5, 15, 25 °E; latitudini 52, 44, 36 °N): descrive la circolazione, cioè dove stanno
    depressioni e anticicloni;
  * per Borgo San Lorenzo: temperatura media, pioggia, umidità, vento medio e direzione prevalente.
Le medie sono sui giorni UTC.

Due uscite:
  data/geek/analoghi-archivio.json   la rianalisi ERA5 dal 1951 (Archive API). È grande (circa 2 MB) e cambia
                                     poco: si crea la prima volta e poi si allunga solo quando è indietro di più
                                     di 40 giorni. Contiene anche le misure della stazione SIR di Borgo San
                                     Lorenzo (massima, minima, pioggia) lette da data/sir/TOS01000999/.
  data/analoghi-oggi.json            gli ultimi 92 giorni e i prossimi 4 dal modello di previsione (Forecast
                                     API), con le stesse variabili: serve per il giorno di riferimento («oggi»)
                                     e per confrontare la previsione con quello che successe dopo gli analoghi.
                                     Si rifà al massimo ogni 3 ore.

Formato comune: colonne di interi (valore × scala, null = mancante).
  "p": 12 serie, una per punto della griglia nell'ordine di "griglia" (hPa - 1000, × 10)
  "t" temperatura media (°C × 10), "pr" pioggia (mm × 10), "rh" umidità (%), "u" e "v" componenti del vento
  verso est e verso nord (km/h × 10).
  Solo archivio: "ox", "on" massima e minima misurate a Borgo (°C × 10), "op" pioggia misurata (mm × 10).

Uso:  python scripts/build_analoghi.py            aggiorna ciò che serve
      python scripts/build_analoghi.py --forza    rifà oggi.json anche se recente
      python scripts/build_analoghi.py --archivio ricostruisce l'archivio da capo
"""
import csv
import datetime
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCH = os.path.join(HERE, "data", "geek", "analoghi-archivio.json")
OGGI = os.path.join(HERE, "data", "analoghi-oggi.json")
SIR = os.path.join(HERE, "data", "sir", "TOS01000999")

BORGO = (43.955, 11.386)
LAT = [52, 44, 36]
LON = [-5, 5, 15, 25]
GRIGLIA = [(la, lo) for la in LAT for lo in LON]          # righe da nord a sud, colonne da ovest a est
VARS_B = ["temperature_2m_mean", "precipitation_sum", "relative_humidity_2m_mean",
          "wind_speed_10m_mean", "wind_direction_10m_dominant"]
INIZIO = datetime.date(1951, 1, 1)
RITARDO_ERA5 = 7            # giorni: la rianalisi arriva con qualche giorno di ritardo
ARRETRATO_MAX = 40          # l'archivio si allunga solo se è indietro di più di così
ETA_OGGI = datetime.timedelta(hours=3)
ANNI_PER_RICHIESTA = 15
PAUSA = 8                   # secondi fra le richieste, per restare sotto i limiti di Open-Meteo


def getjson(url, tentativi=6):
    err = None
    for k in range(tentativi):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteoeclima/analoghi"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err = e
            corpo = e.read().decode("utf-8", "replace")[:200]
            if e.code == 429 and "Daily" in corpo:
                raise RuntimeError("limite giornaliero di Open-Meteo raggiunto: " + corpo)
            if e.code not in (429, 500, 502, 503, 504):
                raise RuntimeError("HTTP %s: %s" % (e.code, corpo))
            time.sleep(65 if e.code == 429 else 15)
        except Exception as e:  # noqa: BLE001  (rete instabile: si riprova)
            err = e
            time.sleep(10 * (k + 1))
    raise RuntimeError("richiesta fallita: %s" % err)


def interi(valori, scala, base=0.0):
    return [None if x is None else int(round((x - base) * scala)) for x in valori]


def vento(vel, dire):
    """Componenti verso est (u) e verso nord (v) del vento, da velocità e direzione di provenienza."""
    u, v = [], []
    for s, d in zip(vel, dire):
        if s is None or d is None:
            u.append(None); v.append(None)
        else:
            r = math.radians(d)
            u.append(-s * math.sin(r)); v.append(-s * math.cos(r))
    return u, v


def chiedi(base, punti, daily, extra):
    q = {"latitude": ",".join(str(p[0]) for p in punti), "longitude": ",".join(str(p[1]) for p in punti),
         "daily": ",".join(daily), "timezone": "GMT"}
    q.update(extra)
    d = getjson(base + "?" + urllib.parse.urlencode(q))
    return d if isinstance(d, list) else [d]


def colonne(giorni_attesi, griglia, borgo):
    """Mette in colonne le risposte dell'API, controllando che i giorni coincidano."""
    for r in griglia + [borgo]:
        if r["daily"]["time"] != giorni_attesi:
            raise RuntimeError("giorni non allineati nella risposta")
    b = borgo["daily"]
    u, v = vento(b["wind_speed_10m_mean"], b["wind_direction_10m_dominant"])
    return {"p": [interi(r["daily"]["pressure_msl_mean"], 10, 1000.0) for r in griglia],
            "t": interi(b["temperature_2m_mean"], 10), "pr": interi(b["precipitation_sum"], 10),
            "rh": interi(b["relative_humidity_2m_mean"], 1), "u": interi(u, 10), "v": interi(v, 10)}


def scarica_archivio(dal, al):
    """Rianalisi ERA5 fra due date (comprese), a blocchi di anni."""
    out = {"p": [[] for _ in GRIGLIA], "t": [], "pr": [], "rh": [], "u": [], "v": []}
    a = dal
    while a <= al:
        b = min(al, datetime.date(a.year + ANNI_PER_RICHIESTA - 1, 12, 31))
        extra = {"start_date": a.isoformat(), "end_date": b.isoformat(), "models": "era5"}
        url = "https://archive-api.open-meteo.com/v1/archive"
        griglia = []
        for i in range(0, len(GRIGLIA), 4):
            griglia += chiedi(url, GRIGLIA[i:i + 4], ["pressure_msl_mean"], extra)
            time.sleep(PAUSA)
        borgo = chiedi(url, [BORGO], VARS_B, extra)[0]
        time.sleep(PAUSA)
        c = colonne(borgo["daily"]["time"], griglia, borgo)
        if len(c["t"]) != (b - a).days + 1:
            raise RuntimeError("blocco %s-%s incompleto" % (a, b))
        for i in range(len(GRIGLIA)):
            out["p"][i] += c["p"][i]
        for k in ("t", "pr", "rh", "u", "v"):
            out[k] += c[k]
        print("  archivio %s → %s: %d giorni" % (a, b, len(c["t"])), flush=True)
        a = b + datetime.timedelta(days=1)
    return out


def taglia_coda(col):
    """Toglie in fondo i giorni che la rianalisi non ha ancora (valori mancanti)."""
    n = len(col["t"])
    def pieno(i):
        return col["t"][i] is not None and all(s[i] is not None for s in col["p"])
    while n and not pieno(n - 1):
        n -= 1
    for k in ("t", "pr", "rh", "u", "v"):
        col[k] = col[k][:n]
    col["p"] = [s[:n] for s in col["p"]]
    return n


def misure_borgo(n):
    """Massima, minima e pioggia misurate dalla stazione SIR di Borgo San Lorenzo, allineate ai giorni dell'archivio."""
    ox, on, op = [None] * n, [None] * n, [None] * n

    def leggi(nome):
        try:
            with open(os.path.join(SIR, nome), encoding="utf-8") as f:
                righe = list(csv.reader(f, delimiter=";"))[1:]
        except OSError:
            return []
        return righe

    def indice(s):
        try:
            i = (datetime.date.fromisoformat(s) - INIZIO).days
        except ValueError:
            return -1
        return i if 0 <= i < n else -1

    def num(s):
        try:
            return int(round(float(s) * 10))
        except (ValueError, TypeError):
            return None

    for r in leggi("temp.csv"):
        i = indice(r[0])
        if i >= 0 and len(r) >= 3:
            ox[i], on[i] = num(r[1]), num(r[2])
    for nome in ("prec99.csv", "prec024.csv"):          # il secondo (pluviometro attuale) prevale dove c'è
        for r in leggi(nome):
            i = indice(r[0])
            if i >= 0 and len(r) >= 2 and num(r[1]) is not None:
                op[i] = num(r[1])
    return ox, on, op


def scrivi(percorso, d):
    os.makedirs(os.path.dirname(percorso), exist_ok=True)
    with open(percorso, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")


def aggiorna_archivio(da_capo):
    oggi = datetime.datetime.now(datetime.timezone.utc).date()
    fine = oggi - datetime.timedelta(days=RITARDO_ERA5)
    vecchio = None
    if not da_capo:
        try:
            vecchio = json.load(open(ARCH, encoding="utf-8"))
        except (OSError, ValueError):
            vecchio = None
    if vecchio:
        ultimo = INIZIO + datetime.timedelta(days=vecchio["n"] - 1)
        if (fine - ultimo).days <= ARRETRATO_MAX:
            print("archivio aggiornato al %s: non serve allungarlo" % ultimo)
            return
        nuovo = scarica_archivio(ultimo + datetime.timedelta(days=1), fine)
        taglia_coda(nuovo)
        col = {k: vecchio[k] + nuovo[k] for k in ("t", "pr", "rh", "u", "v")}
        col["p"] = [vecchio["p"][i] + nuovo["p"][i] for i in range(len(GRIGLIA))]
    else:
        col = scarica_archivio(INIZIO, fine)
        taglia_coda(col)
    n = len(col["t"])
    ox, on, op = misure_borgo(n)
    d = {"fonte": "Rianalisi ERA5 (Copernicus/ECMWF) via Open-Meteo Archive API; misure: Servizio Idrologico "
                  "Regionale della Toscana, stazione di Borgo San Lorenzo (TOS01000999), CC BY-SA 4.0",
         "inizio": INIZIO.isoformat(), "n": n,
         "fine": (INIZIO + datetime.timedelta(days=n - 1)).isoformat(),
         "griglia": {"lat": LAT, "lon": LON}, "luogo": {"nome": "Borgo San Lorenzo", "lat": BORGO[0], "lon": BORGO[1]},
         "scala": {"p": 10, "p_base": 1000, "t": 10, "pr": 10, "rh": 1, "u": 10, "v": 10, "ox": 10, "on": 10, "op": 10}}
    d.update(col)
    d.update({"ox": ox, "on": on, "op": op})
    scrivi(ARCH, d)
    print("scritto %s: %d giorni fino al %s" % (os.path.relpath(ARCH, HERE), n, d["fine"]))


def aggiorna_oggi(forza):
    adesso = datetime.datetime.now(datetime.timezone.utc)
    if not forza:
        try:
            v = json.load(open(OGGI, encoding="utf-8"))
            if adesso - datetime.datetime.fromisoformat(v["aggiornato"].replace("Z", "+00:00")) < ETA_OGGI:
                print("oggi.json recente: salto")
                return
        except (OSError, ValueError, KeyError):
            pass
    url = "https://api.open-meteo.com/v1/forecast"
    extra = {"past_days": 92, "forecast_days": 5}
    griglia = []
    for i in range(0, len(GRIGLIA), 6):
        griglia += chiedi(url, GRIGLIA[i:i + 6], ["pressure_msl_mean"], extra)
        time.sleep(2)
    borgo = chiedi(url, [BORGO], VARS_B, extra)[0]
    giorni = borgo["daily"]["time"]
    col = colonne(giorni, griglia, borgo)
    d = {"aggiornato": adesso.strftime("%Y-%m-%dT%H:%MZ"),
         "fonte": "Modelli di previsione via Open-Meteo Forecast API (analisi dei giorni passati e previsione)",
         "inizio": giorni[0], "n": len(giorni), "oggi": adesso.date().isoformat(),
         "griglia": {"lat": LAT, "lon": LON},
         "scala": {"p": 10, "p_base": 1000, "t": 10, "pr": 10, "rh": 1, "u": 10, "v": 10}}
    d.update(col)
    scrivi(OGGI, d)
    print("scritto %s: %s → %s" % (os.path.relpath(OGGI, HERE), giorni[0], giorni[-1]))


def main():
    arg = sys.argv[1:]
    esito = 0
    try:
        aggiorna_archivio("--archivio" in arg)
    except Exception as e:  # noqa: BLE001
        print("archivio non aggiornato: %s" % e, file=sys.stderr)
        esito = 1
    try:
        aggiorna_oggi("--forza" in arg or "--archivio" in arg)
    except Exception as e:  # noqa: BLE001
        print("oggi.json non aggiornato: %s" % e, file=sys.stderr)
        esito = 1
    return esito


if __name__ == "__main__":
    sys.exit(main())
