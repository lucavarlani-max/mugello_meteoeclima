#!/usr/bin/env python3
"""
Legge la stazione meteo Netatmo del proprietario del sito e scrive data/netatmo.json
per la pagina stazioni.html: dati attuali dei moduli esterni (temperatura e umidità,
pioggia, vento) e l'andamento delle ultime 24 ore. I moduli interni (temperatura di casa,
CO2, rumore) e la posizione esatta NON vengono pubblicati.

Serve un'app su https://dev.netatmo.com (gratuita) e quattro segreti del repository
(Settings > Secrets and variables > Actions):
  NETATMO_CLIENT_ID, NETATMO_CLIENT_SECRET  dati dell'app
  NETATMO_REFRESH_TOKEN                     token con permesso read_station, generato
                                            nella pagina dell'app ("Token generator")
  NETATMO_KEY                               una frase lunga a piacere, usata per cifrare
Netatmo rinnova il refresh token a ogni accesso: il token nuovo viene salvato CIFRATO
(AES-GCM con chiave derivata da NETATMO_KEY) in data/netatmo-token.enc, così le
esecuzioni successive lo ritrovano senza esporlo. Senza segreti lo script non fa nulla.
"""
import base64, hashlib, json, os, sys, time, datetime, urllib.request, urllib.parse, urllib.error

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "netatmo.json")
TOKEN_FILE = os.path.join(HERE, "data", "netatmo-token.enc")
API = "https://api.netatmo.com"
ENV = {k: os.environ.get(k, "").strip() for k in
       ("NETATMO_CLIENT_ID", "NETATMO_CLIENT_SECRET", "NETATMO_REFRESH_TOKEN", "NETATMO_KEY")}


def chiave():
    return hashlib.sha256(ENV["NETATMO_KEY"].encode()).digest()


def cifra(testo):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = os.urandom(12)
    return base64.b64encode(nonce + AESGCM(chiave()).encrypt(nonce, testo.encode(), None)).decode()


def decifra(dato):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    raw = base64.b64decode(dato)
    return AESGCM(chiave()).decrypt(raw[:12], raw[12:], None).decode()


def post(url, campi):
    req = urllib.request.Request(url, data=urllib.parse.urlencode(campi).encode(),
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def get(percorso, token, **q):
    req = urllib.request.Request(f"{API}{percorso}?{urllib.parse.urlencode(q)}",
                                 headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def accesso():
    """Access token dal refresh token più recente (quello salvato cifrato, se c'è)."""
    candidati = []
    if os.path.exists(TOKEN_FILE):
        try:
            candidati.append(decifra(open(TOKEN_FILE).read().strip()))
        except Exception as e:
            print("netatmo: token salvato non leggibile, uso quello dei segreti:", e, file=sys.stderr)
    if ENV["NETATMO_REFRESH_TOKEN"]:
        candidati.append(ENV["NETATMO_REFRESH_TOKEN"])
    ultimo = None
    for rt in candidati:
        try:
            j = post(f"{API}/oauth2/token", {"grant_type": "refresh_token", "refresh_token": rt,
                                             "client_id": ENV["NETATMO_CLIENT_ID"],
                                             "client_secret": ENV["NETATMO_CLIENT_SECRET"]})
            nuovo = j.get("refresh_token") or rt
            with open(TOKEN_FILE, "w") as f:
                f.write(cifra(nuovo))
            return j["access_token"]
        except urllib.error.HTTPError as e:
            ultimo = f"HTTP {e.code} {e.read()[:200]!r}"
    raise RuntimeError("accesso Netatmo non riuscito: " + str(ultimo))


def arrot(v, n=1):
    return None if v is None else round(v, n)


def iso(ts):
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if ts else None


def storia(token, device, modulo, tipi, ore=24):
    """Serie a 30 minuti delle ultime 24 ore per un modulo esterno."""
    fine = int(time.time()); inizio = fine - ore * 3600
    j = get("/api/getmeasure", token, device_id=device, module_id=modulo, scale="30min",
            type=",".join(tipi), date_begin=inizio, date_end=fine, optimize="false", real_time="true")
    righe = []
    for ts, valori in sorted((j.get("body") or {}).items(), key=lambda x: int(x[0])):
        righe.append([int(ts)] + [arrot(v) for v in valori])
    return righe


def main():
    if not (ENV["NETATMO_CLIENT_ID"] and ENV["NETATMO_CLIENT_SECRET"] and ENV["NETATMO_KEY"]
            and (ENV["NETATMO_REFRESH_TOKEN"] or os.path.exists(TOKEN_FILE))):
        print("netatmo: segreti non configurati, salto")
        return
    token = accesso()
    body = get("/api/getstationsdata", token).get("body", {})
    stazioni = []
    for dev in body.get("devices", []):
        place = dev.get("place") or {}
        st = {"nome": dev.get("station_name") or dev.get("home_name") or "Stazione Netatmo",
              "luogo": place.get("city") or "", "quota": place.get("altitude"),
              "attiva": bool(dev.get("reachable", True)), "moduli": {}}
        for m in dev.get("modules", []):
            d = m.get("dashboard_data") or {}
            t = m.get("type")
            if t == "NAModule1":            # esterno: temperatura e umidità
                st["moduli"]["esterno"] = {
                    "t": arrot(d.get("Temperature")), "u": d.get("Humidity"),
                    "tmin": arrot(d.get("min_temp")), "tmax": arrot(d.get("max_temp")),
                    "ora_min": iso(d.get("date_min_temp")), "ora_max": iso(d.get("date_max_temp")),
                    "tendenza": d.get("temp_trend"), "agg": iso(d.get("time_utc")),
                    "batteria": m.get("battery_percent")}
                try:
                    st["storia"] = {"campi": ["ts", "t", "u"],
                                    "dati": storia(token, dev["_id"], m["_id"], ["Temperature", "Humidity"])}
                except Exception as e:
                    print("netatmo: storia non disponibile:", e, file=sys.stderr)
            elif t == "NAModule3":          # pluviometro
                st["moduli"]["pioggia"] = {"ora": arrot(d.get("sum_rain_1")), "oggi": arrot(d.get("sum_rain_24")),
                                           "ultima": arrot(d.get("Rain")), "agg": iso(d.get("time_utc"))}
            elif t == "NAModule2":          # anemometro
                st["moduli"]["vento"] = {"v": d.get("WindStrength"), "dir": d.get("WindAngle"),
                                         "raffica": d.get("GustStrength"), "dir_raffica": d.get("GustAngle"),
                                         "max_oggi": d.get("max_wind_str"), "agg": iso(d.get("time_utc"))}
        dd = dev.get("dashboard_data") or {}
        if dd.get("Pressure") is not None:  # la pressione la misura il modulo interno, ma è un dato "esterno"
            st["pressione"] = {"p": arrot(dd.get("Pressure")), "tendenza": dd.get("pressure_trend"),
                               "agg": iso(dd.get("time_utc"))}
        stazioni.append(st)
    out = {"aggiornato": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "fonte": "Netatmo Weather API", "stazioni": stazioni}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"netatmo: {len(stazioni)} stazioni scritte in {OUT}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:      # mai bloccare gli altri aggiornamenti
        print("netatmo: errore", e, file=sys.stderr)
