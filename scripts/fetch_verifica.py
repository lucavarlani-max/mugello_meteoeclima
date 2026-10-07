#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Archivio per la pagina MeteoGeek «Verifica del modello» (geek-verifica-modello.html).

Ogni esecuzione dell'Action:
  1. archivia le previsioni a 7 giorni dei 9 comuni, da data/previsioni.json (WeatherNext 3, solo se TUTTI i
     comuni vengono da Google: altrimenti i dati sono misti e non si attribuiscono al modello) e da Open-Meteo
     (una chiamata multipunto);
  2. legge da Weather Underground il riepilogo giornaliero degli ultimi 7 giorni della stazione ISCARP2
     (Scarperia) e lo aggiunge alle misure già archiviate.

Uscite:
  data/verifica/log.json      {"v":1,"agg":..,"mod":{"wn"|"om":{comune:{giorno_bersaglio:{anticipo:[tmax,tmin,pp,mm,ora]}}}}}
  data/verifica/iscarp2.json  {"nome":..,"giorni":{data:[tmax,tmin,mm]}}

«anticipo» = giorni tra l'emissione e il giorno previsto (0 = oggi, 1 = domani...). Per ogni coppia (giorno, anticipo)
si tiene la previsione emessa entro le 12 (ora italiana) del giorno di emissione, cioè l'ultima della mattina: così
«domani» vuol dire davvero previsione fatta il giorno prima, non quella di un minuto prima della mezzanotte.
Se la mattina non c'è nulla, si tiene la prima disponibile del giorno.

Uso:
  python scripts/fetch_verifica.py            # giro normale (rete)
  python scripts/fetch_verifica.py --da-git   # una tantum: recupera dalla storia git le previsioni WeatherNext passate
"""
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROMA = ZoneInfo("Europe/Rome")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(HERE, "data", "verifica")
LOG = os.path.join(DIR, "log.json")
OBS = os.path.join(DIR, "iscarp2.json")

COMUNI = [
    ("Firenzuola", 44.1206, 11.3789), ("Palazzuolo sul Senio", 44.1131, 11.5433), ("Marradi", 44.0722, 11.6142),
    ("Barberino di Mugello", 43.9908, 11.2386), ("Scarperia e San Piero", 43.9928, 11.3549),
    ("San Piero a Sieve", 43.9631, 11.3283), ("Borgo San Lorenzo", 43.9547, 11.3861),
    ("Vicchio", 43.9339, 11.4650), ("Dicomano", 43.8917, 11.5222),
]
FONTE_WN = "WeatherNext 3 (Google) · Google Weather API"
MAX_ANTICIPO = 5
CONSERVA_GIORNI = 400
WU_ID = "ISCARP2"
WU_KEY = os.environ.get("WU_KEY", "06ae21018c5f4306ae21018c5f430678")   # chiave pubblica già usata da stazioni.js


def getjson(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteoeclima/verifica"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def carica(path, vuoto):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return vuoto


def salva(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def registra(log, modello, comune, emissione, ora, giorni):
    """Aggiunge a `log` i giorni di una previsione emessa il `emissione` (YYYY-MM-DD) alle `ora` (0-23, ora italiana).
    giorni: lista di dict {iso, tmax, tmin, pp, mm}."""
    em = datetime.strptime(emissione, "%Y-%m-%d").date()
    dst = log["mod"].setdefault(modello, {}).setdefault(comune, {})
    for g in giorni:
        try:
            lead = (datetime.strptime(g["iso"], "%Y-%m-%d").date() - em).days
        except (KeyError, ValueError):
            continue
        if lead < 0 or lead > MAX_ANTICIPO or g.get("tmax") is None or g.get("tmin") is None:
            continue
        voce = [g["tmax"], g["tmin"], int(g.get("pp") or 0), round(float(g.get("mm") or 0), 1), ora]
        slot = dst.setdefault(g["iso"], {})
        prima = slot.get(str(lead))
        # sovrascrive solo se non c'è nulla, o se questa è una previsione della mattina (entro le 12),
        # successiva a quella già salvata e non più tarda di mezzogiorno
        if prima is None or (ora <= 12 and (prima[4] > 12 or ora >= prima[4])):
            slot[str(lead)] = voce


def registra_wn(log, prev):
    if not str(prev.get("fonte", "")).startswith(FONTE_WN):
        print("previsioni non tutte WeatherNext (%s): niente archivio WN" % prev.get("fonte"), file=sys.stderr)
        return 0
    agg = prev["aggiornato"]                      # 2026-10-07T12:59+02:00
    n = 0
    for c in prev.get("comuni", []):
        registra(log, "wn", c["n"], agg[:10], int(agg[11:13]), c.get("giorni", []))
        n += 1
    return n


def registra_om(log, ora_it):
    q = urllib.parse.urlencode({
        "latitude": ",".join(str(c[1]) for c in COMUNI), "longitude": ",".join(str(c[2]) for c in COMUNI),
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum",
        "timezone": "Europe/Rome", "forecast_days": MAX_ANTICIPO + 1,
    })
    dati = getjson("https://api.open-meteo.com/v1/forecast?" + q)
    if not isinstance(dati, list):
        dati = [dati]
    for (nome, _, _), d in zip(COMUNI, dati):
        dl = d.get("daily", {})
        giorni = []
        for i, iso in enumerate(dl.get("time", [])):
            giorni.append({"iso": iso, "tmax": dl["temperature_2m_max"][i], "tmin": dl["temperature_2m_min"][i],
                           "pp": dl["precipitation_probability_max"][i], "mm": dl["precipitation_sum"][i]})
        for g in giorni:
            for k in ("tmax", "tmin"):
                if g[k] is not None:
                    g[k] = round(g[k], 1)
        registra(log, "om", nome, ora_it.strftime("%Y-%m-%d"), ora_it.hour, giorni)


def leggi_wu(riassunti, oggi):
    """riassunti: lista `summaries` di Weather Underground (dailysummary/7day). Restituisce {data:[tmax,tmin,mm]}
    solo per i giorni conclusi (prima di `oggi`) e con valori validi."""
    out = {}
    for s in riassunti or []:
        m = s.get("metric") or {}
        data = str(s.get("obsTimeLocal", ""))[:10]
        if not data or data >= oggi:
            continue
        tx, tn, mm = m.get("tempHigh"), m.get("tempLow"), m.get("precipTotal")
        if tx is None or tn is None or mm is None:
            continue
        out[data] = [round(tx, 1), round(tn, 1), round(mm, 1)]
    return out


def aggiorna_iscarp2(oggi):
    url = ("https://api.weather.com/v2/pws/dailysummary/7day?stationId=%s&format=json&units=m&apiKey=%s" % (WU_ID, WU_KEY))
    nuovi = leggi_wu(getjson(url).get("summaries"), oggi)
    obs = carica(OBS, {"nome": "ISCARP2 · Scarperia (stazione personale, Weather Underground)", "giorni": {}})
    obs["giorni"].update(nuovi)
    taglio = (datetime.now(ROMA) - timedelta(days=CONSERVA_GIORNI)).strftime("%Y-%m-%d")
    obs["giorni"] = {d: v for d, v in obs["giorni"].items() if d >= taglio}
    salva(OBS, obs)
    return len(nuovi)


def pota(log, oggi):
    taglio = (datetime.strptime(oggi, "%Y-%m-%d") - timedelta(days=CONSERVA_GIORNI)).strftime("%Y-%m-%d")
    for comuni in log["mod"].values():
        for giorni in comuni.values():
            for d in [d for d in giorni if d < taglio]:
                del giorni[d]


def da_git():
    log = carica(LOG, {"v": 1, "mod": {}})
    revs = subprocess.run(["git", "log", "--reverse", "--format=%H", "--", "data/previsioni.json"],
                          cwd=HERE, capture_output=True, text=True, check=True).stdout.split()
    n = 0
    for h in revs:
        try:
            prev = json.loads(subprocess.run(["git", "show", h + ":data/previsioni.json"], cwd=HERE,
                                             capture_output=True, text=True, check=True).stdout)
            n += 1 if registra_wn(log, prev) else 0
        except Exception as e:  # noqa: BLE001 - un commit illeggibile non deve fermare gli altri
            print("commit %s saltato: %s" % (h[:7], e), file=sys.stderr)
    log["agg"] = datetime.now(ROMA).isoformat(timespec="minutes")
    salva(LOG, log)
    print("recuperate %d versioni di previsioni.json dalla storia git" % n)


def main():
    if "--da-git" in sys.argv:
        return da_git()
    ora_it = datetime.now(ROMA)
    oggi = ora_it.strftime("%Y-%m-%d")
    log = carica(LOG, {"v": 1, "mod": {}})
    log.setdefault("mod", {})
    try:
        n = registra_wn(log, json.load(open(os.path.join(HERE, "data", "previsioni.json"), encoding="utf-8")))
        print("WeatherNext: %d comuni archiviati" % n)
    except Exception as e:  # noqa: BLE001
        print("WeatherNext: archivio saltato (%s)" % e, file=sys.stderr)
    try:
        registra_om(log, ora_it)
        print("Open-Meteo: archiviato")
    except Exception as e:  # noqa: BLE001
        print("Open-Meteo: archivio saltato (%s)" % e, file=sys.stderr)
    pota(log, oggi)
    log["agg"] = ora_it.isoformat(timespec="minutes")
    log["v"] = 1
    salva(LOG, log)
    try:
        print("ISCARP2: %d giorni letti" % aggiorna_iscarp2(oggi))
    except Exception as e:  # noqa: BLE001
        print("ISCARP2: lettura saltata (%s)" % e, file=sys.stderr)


if __name__ == "__main__":
    main()
