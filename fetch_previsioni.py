#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Previsioni per i 9 comuni del Mugello.

Fonte primaria: Google Weather API (powered by WeatherNext 3, Google DeepMind).
  - forecast/days:lookup  -> 7 giorni (tmax, tmin, prob. pioggia, condizione)
  - currentConditions:lookup -> valore attuale (temp + condizione)
La chiave si legge dalla variabile d'ambiente GMAPS_WEATHER_KEY (GitHub secret).

Se la chiave manca o una chiamata fallisce, per quel comune si ripiega su
Open-Meteo (gratis, senza chiave) mantenendo la stessa struttura JSON, così il
sito ha sempre dati.

Output: data/previsioni.json
"""

import os, sys, json, time, urllib.parse, urllib.request
from datetime import datetime

KEY = os.environ.get("GMAPS_WEATHER_KEY", "").strip()

COMUNI = [
    {"n": "Firenzuola",             "lat": 44.1206, "lon": 11.3789},
    {"n": "Palazzuolo sul Senio",   "lat": 44.1131, "lon": 11.5433},
    {"n": "Marradi",                "lat": 44.0722, "lon": 11.6142},
    {"n": "Barberino di Mugello",   "lat": 43.9908, "lon": 11.2386},
    {"n": "Scarperia e San Piero",  "lat": 43.9928, "lon": 11.3549},
    {"n": "San Piero a Sieve",      "lat": 43.9631, "lon": 11.3283},
    {"n": "Borgo San Lorenzo",      "lat": 43.9547, "lon": 11.3861},
    {"n": "Vicchio",                "lat": 43.9339, "lon": 11.4650},
    {"n": "Dicomano",               "lat": 43.8917, "lon": 11.5222},
]
FCAST = 6  # Borgo San Lorenzo: riferimento 7 giorni / sole

# --- mappa condizione Google -> codice WMO (così il sito usa le stesse icone) ---
G2WMO = {
    "CLEAR": 0, "MOSTLY_CLEAR": 1, "PARTLY_CLOUDY": 2, "MOSTLY_CLOUDY": 3,
    "CLOUDY": 3, "WINDY": 2, "WIND_AND_RAIN": 63,
    "LIGHT_RAIN_SHOWERS": 80, "CHANCE_OF_SHOWERS": 80, "SCATTERED_SHOWERS": 80,
    "RAIN_SHOWERS": 81, "HEAVY_RAIN_SHOWERS": 82,
    "LIGHT_RAIN": 61, "LIGHT_TO_MODERATE_RAIN": 63, "RAIN": 63,
    "MODERATE_TO_HEAVY_RAIN": 65, "HEAVY_RAIN": 65, "RAIN_PERIODICALLY_HEAVY": 65,
    "DRIZZLE": 51,
    "LIGHT_SNOW_SHOWERS": 85, "CHANCE_OF_SNOW_SHOWERS": 85, "SCATTERED_SNOW_SHOWERS": 85,
    "SNOW_SHOWERS": 86, "HEAVY_SNOW_SHOWERS": 86,
    "LIGHT_SNOW": 71, "LIGHT_TO_MODERATE_SNOW": 73, "SNOW": 73,
    "MODERATE_TO_HEAVY_SNOW": 75, "HEAVY_SNOW": 75, "SNOW_PERIODICALLY_HEAVY": 75,
    "SNOWSTORM": 75, "HEAVY_SNOW_STORM": 75, "BLOWING_SNOW": 75,
    "RAIN_AND_SNOW": 66, "HAIL": 96, "HAIL_SHOWERS": 96,
    "THUNDERSTORM": 95, "THUNDERSHOWER": 95, "LIGHT_THUNDERSTORM_RAIN": 95,
    "SCATTERED_THUNDERSTORMS": 95, "HEAVY_THUNDERSTORM": 99,
    "FOG": 45, "HAZE": 45, "MIST": 45,
}

def g2wmo(t):
    if not t:
        return 3
    t = t.upper()
    if t in G2WMO:
        return G2WMO[t]
    # euristica sui nomi meno comuni
    if "THUNDER" in t: return 95
    if "SNOW" in t:    return 73
    if "HAIL" in t:    return 96
    if "SHOWER" in t:  return 80
    if "RAIN" in t or "DRIZZLE" in t: return 63
    if "FOG" in t or "HAZE" in t or "MIST" in t: return 45
    if "CLOUD" in t:   return 3
    if "CLEAR" in t or "SUN" in t: return 0
    return 3

def getjson(url, timeout=30, retries=3):
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteo/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except Exception as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last

# -------------------- Google Weather API --------------------
def google_days(c):
    q = urllib.parse.urlencode({
        "key": KEY,
        "location.latitude": c["lat"],
        "location.longitude": c["lon"],
        "days": 7, "pageSize": 7,
        "unitsSystem": "METRIC", "languageCode": "it",
    })
    j = getjson("https://weather.googleapis.com/v1/forecast/days:lookup?" + q)
    days = []
    sole = None
    for d in j.get("forecastDays", [])[:7]:
        dd = d.get("displayDate", {})
        iso = "%04d-%02d-%02d" % (dd.get("year", 1970), dd.get("month", 1), dd.get("day", 1))
        day = d.get("daytimeForecast", {}) or {}
        night = d.get("nighttimeForecast", {}) or {}
        cond = (day.get("weatherCondition") or night.get("weatherCondition") or {}).get("type")
        pp_d = (((day.get("precipitation") or {}).get("probability") or {}).get("percent"))
        pp_n = (((night.get("precipitation") or {}).get("probability") or {}).get("percent"))
        pp = max([x for x in (pp_d, pp_n) if x is not None], default=0)
        tmax = (d.get("maxTemperature") or {}).get("degrees")
        tmin = (d.get("minTemperature") or {}).get("degrees")
        days.append({
            "iso": iso, "code": g2wmo(cond),
            "tmax": None if tmax is None else round(tmax),
            "tmin": None if tmin is None else round(tmin),
            "pp": int(round(pp)),
        })
        if sole is None:
            se = d.get("sunEvents") or {}
            sr, ss = se.get("sunriseTime"), se.get("sunsetTime")
            if sr and ss:
                sole = {"rise": sr, "set": ss}
    return days, sole

def google_now(c):
    q = urllib.parse.urlencode({
        "key": KEY,
        "location.latitude": c["lat"],
        "location.longitude": c["lon"],
        "unitsSystem": "METRIC", "languageCode": "it",
    })
    j = getjson("https://weather.googleapis.com/v1/currentConditions:lookup?" + q)
    t = (j.get("temperature") or {}).get("degrees")
    cond = (j.get("weatherCondition") or {}).get("type")
    return {"t": None if t is None else round(t, 1), "code": g2wmo(cond)}

def from_google(c):
    days, sole = google_days(c)
    now = google_now(c)
    return {"n": c["n"], "now": now, "giorni": days, "_sole": sole}

# -------------------- Open-Meteo (fallback) --------------------
def from_openmeteo(c):
    q = urllib.parse.urlencode({
        "latitude": c["lat"], "longitude": c["lon"],
        "current": "temperature_2m,weather_code",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
        "timezone": "Europe/Rome", "forecast_days": 7,
    })
    j = getjson("https://api.open-meteo.com/v1/forecast?" + q)
    cur = j.get("current", {}); dl = j.get("daily", {})
    days = []
    for i, iso in enumerate(dl.get("time", [])[:7]):
        days.append({
            "iso": iso, "code": int(dl["weather_code"][i]),
            "tmax": round(dl["temperature_2m_max"][i]),
            "tmin": round(dl["temperature_2m_min"][i]),
            "pp": int(dl["precipitation_probability_max"][i] or 0),
        })
    sole = None
    if dl.get("sunrise") and dl.get("sunset"):
        sole = {"rise": dl["sunrise"][0], "set": dl["sunset"][0]}
    return {"n": c["n"],
            "now": {"t": round(cur.get("temperature_2m", 0), 1), "code": int(cur.get("weather_code", 3))},
            "giorni": days, "_sole": sole}

def from_openmeteo_all():
    """Una sola chiamata multipunto per tutti i comuni (fallback quando non c'e' la chiave)."""
    lats = ",".join(str(c["lat"]) for c in COMUNI)
    lons = ",".join(str(c["lon"]) for c in COMUNI)
    q = urllib.parse.urlencode({
        "latitude": lats, "longitude": lons,
        "current": "temperature_2m,weather_code",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
        "timezone": "Europe/Rome", "forecast_days": 7,
    })
    data = getjson("https://api.open-meteo.com/v1/forecast?" + q)
    if not isinstance(data, list):
        data = [data]
    recs = []
    for i, c in enumerate(COMUNI):
        d = data[i] if i < len(data) else {}
        cur = d.get("current", {}); dl = d.get("daily", {})
        days = []
        for k, iso in enumerate(dl.get("time", [])[:7]):
            days.append({
                "iso": iso, "code": int(dl["weather_code"][k]),
                "tmax": round(dl["temperature_2m_max"][k]),
                "tmin": round(dl["temperature_2m_min"][k]),
                "pp": int(dl["precipitation_probability_max"][k] or 0),
            })
        sole = None
        if dl.get("sunrise") and dl.get("sunset"):
            sole = {"rise": dl["sunrise"][0], "set": dl["sunset"][0]}
        recs.append({"n": c["n"],
                     "now": {"t": round(cur.get("temperature_2m", 0), 1), "code": int(cur.get("weather_code", 3))},
                     "giorni": days, "_sole": sole})
    return recs

# -------------------- main --------------------
def main():
    out = {"aggiornato": datetime.now().strftime("%Y-%m-%dT%H:%M"), "comuni": []}
    used_google = 0

    if not KEY:
        # Nessuna chiave: un'unica chiamata multipunto Open-Meteo.
        print("GMAPS_WEATHER_KEY non impostata: uso Open-Meteo (fallback).", file=sys.stderr)
        try:
            out["comuni"] = from_openmeteo_all()
        except Exception as e:
            print("Open-Meteo multipunto KO: %s" % e, file=sys.stderr)
            out["comuni"] = [{"n": c["n"], "now": {"t": None, "code": 3}, "giorni": [], "_sole": None} for c in COMUNI]
    else:
        for c in COMUNI:
            rec = None
            try:
                rec = from_google(c)
                used_google += 1
            except Exception as e:
                print("Google KO per %s: %s -> fallback Open-Meteo" % (c["n"], e), file=sys.stderr)
                try:
                    rec = from_openmeteo(c)
                except Exception as e2:
                    print("Open-Meteo KO per %s: %s" % (c["n"], e2), file=sys.stderr)
                    rec = {"n": c["n"], "now": {"t": None, "code": 3}, "giorni": [], "_sole": None}
            out["comuni"].append(rec)
            time.sleep(0.3)

    # sole dal comune di riferimento (Borgo)
    ref = out["comuni"][FCAST] if len(out["comuni"]) > FCAST else {}
    out["sole"] = ref.get("_sole")
    for c in out["comuni"]:
        c.pop("_sole", None)

    if used_google == len(COMUNI):
        out["fonte"] = "WeatherNext 3 (Google) · Google Weather API"
    elif used_google > 0:
        out["fonte"] = "WeatherNext 3 (Google) + Open-Meteo"
    else:
        out["fonte"] = "Open-Meteo (modelli ICON + GFS)"

    os.makedirs("data", exist_ok=True)
    with open("data/previsioni.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("scritto data/previsioni.json — fonte: %s (google %d/%d)" %
          (out["fonte"], used_google, len(COMUNI)))

if __name__ == "__main__":
    main()
