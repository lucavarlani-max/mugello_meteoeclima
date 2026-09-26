#!/usr/bin/env python3
"""
Scarica i campi per le carte sinottiche della pagina Radar e dati e scrive
data/sinottica.json: geopotenziale a 500 hPa (dam), temperatura a 850 hPa (°C) e
pressione al livello del mare (hPa) sulla griglia di data/sinottica-mappa.json,
ogni 12 ore (00 e 12 UTC) fino a 5 giorni, più l'ora attuale.

Fonte: Open-Meteo (modello ECMWF IFS 0,25°, con GFS come riserva).
Gira nell'Action ogni 30 minuti ma scarica solo se i dati hanno più di 6 ore:
la griglia ha ~1000 punti e Open-Meteo gratuito conta ogni punto come una
chiamata (limiti: 600 al minuto, 10.000 al giorno), quindi si scarica a blocchi
distanziati.
"""
import json, os, sys, time, datetime, urllib.request, urllib.parse, urllib.error

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPPA = os.path.join(HERE, "data", "sinottica-mappa.json")
OUT = os.path.join(HERE, "data", "sinottica.json")
MODELLI = [("ecmwf_ifs025", "ECMWF IFS 0,25°"), ("gfs_seamless", "NOAA GFS")]
VAR = "geopotential_height_500hPa,temperature_850hPa,pressure_msl"
BLOCCO = 260          # punti per richiesta
PAUSA = 35            # secondi tra un blocco e l'altro
ORE = 126
ETA_MAX = datetime.timedelta(hours=6)


def adesso():
    return datetime.datetime.now(datetime.timezone.utc)


def recente():
    try:
        d = json.load(open(OUT, encoding="utf-8"))
        t = datetime.datetime.fromisoformat(d["aggiornato"].replace("Z", "+00:00"))
        return adesso() - t < ETA_MAX
    except Exception:
        return False


def scarica(punti, modello):
    lat = ",".join(f"{p[0]:g}" for p in punti)
    lon = ",".join(f"{p[1]:g}" for p in punti)
    q = urllib.parse.urlencode({"latitude": lat, "longitude": lon, "hourly": VAR, "models": modello,
                                "forecast_hours": ORE, "timezone": "GMT", "cell_selection": "nearest"}, safe=",")
    req = urllib.request.Request("https://api.open-meteo.com/v1/forecast?" + q, headers={"User-Agent": "mugello-meteo/1.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        d = json.loads(r.read().decode("utf-8"))
    return d if isinstance(d, list) else [d]


def main():
    if recente() and "--forza" not in sys.argv:
        print("sinottica: dati recenti, niente da scaricare")
        return
    g = json.load(open(MAPPA, encoding="utf-8"))
    punti = [(la, lo) for la in g["lats"] for lo in g["lons"]]

    for modello, nome in MODELLI:
        try:
            ris = []
            for i in range(0, len(punti), BLOCCO):
                if i:
                    time.sleep(PAUSA)
                ris += scarica(punti[i:i + BLOCCO], modello)
            if len(ris) != len(punti):
                raise ValueError(f"{len(ris)} risposte per {len(punti)} punti")
            h = ris[0]["hourly"]
            if all(v is None for v in h["geopotential_height_500hPa"][:24]):
                raise ValueError("geopotenziale assente")
            break
        except Exception as e:
            print(f"sinottica: {modello} non disponibile ({e})", file=sys.stderr)
            ris = None
    if not ris:
        print("sinottica: nessun modello disponibile, tengo i dati precedenti", file=sys.stderr)
        return

    tempi = ris[0]["hourly"]["time"]
    idx = [0] + [i for i, t in enumerate(tempi) if i > 0 and t[11:13] in ("00", "12") and i <= 121]

    def campo(nome_var, i, fn):
        out = []
        for r in ris:
            v = r["hourly"][nome_var][i]
            out.append(None if v is None else fn(v))
        return out

    passi = [{
        "t": tempi[i] + "Z",
        "z500": campo("geopotential_height_500hPa", i, lambda v: round(v / 10, 1)),
        "t850": campo("temperature_850hPa", i, lambda v: round(v, 1)),
        "mslp": campo("pressure_msl", i, lambda v: round(v, 1)),
    } for i in idx]

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"aggiornato": adesso().isoformat(timespec="minutes").replace("+00:00", "Z"),
                   "modello": nome, "fonte": "Open-Meteo", "passi": passi}, f, separators=(",", ":"))
    print(f"sinottica: {nome}, {len(passi)} scadenze su {len(punti)} punti")


if __name__ == "__main__":
    main()
