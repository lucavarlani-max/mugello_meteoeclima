#!/usr/bin/env python3
"""Calcola i prossimi passaggi della ISS visibili a occhio nudo da Borgo San Lorenzo.

Fonte TLE: Celestrak (NORAD 25544). Propagazione e geometria: Skyfield.
Criterio di visibilità: ISS sopra 10°, Sole sotto -6° e ISS illuminata dal Sole.
Il file data/iss-passaggi.json viene letto da scripts/build_iss_statico.js.
"""
from __future__ import annotations

import json
import math
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
from skyfield.api import EarthSatellite, Loader, wgs84

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "iss-passaggi.json"
TLE_URL = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE"
ROME = ZoneInfo("Europe/Rome")
LAT, LON, ELEV = 43.955, 11.386, 196.0
HORIZON_DAYS = 14
MIN_ALT = 10.0
MIN_SUN_ALT = -6.0
MAX_PASSES = 8
STEP_SECONDS = 10

AZ = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
      "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"]


def az_dir(degrees: float) -> str:
    return AZ[int((degrees % 360) / 22.5 + 0.5) % 16]


def iso_rome(dt: datetime) -> str:
    return dt.astimezone(ROME).isoformat(timespec="seconds")


def fmt_rome(dt: datetime) -> str:
    return dt.astimezone(ROME).strftime("%H:%M")


def read_tle() -> tuple[str, str, str]:
    req = urllib.request.Request(TLE_URL, headers={"User-Agent": "MugelloMeteo/1.0 (effemeridi ISS)"})
    with urllib.request.urlopen(req, timeout=30) as response:
        text = response.read().decode("utf-8", errors="replace")
    lines = [x.strip() for x in text.splitlines() if x.strip()]
    if len(lines) < 3 or not lines[1].startswith("1 ") or not lines[2].startswith("2 "):
        raise RuntimeError(f"Risposta TLE non valida: {text[:160]!r}")
    return lines[0], lines[1], lines[2]


def visible_segments(mask: np.ndarray) -> list[np.ndarray]:
    idx = np.flatnonzero(mask)
    if idx.size == 0:
        return []
    return np.split(idx, np.flatnonzero(np.diff(idx) > 1) + 1)


def main() -> int:
    try:
        name, line1, line2 = read_tle()
    except Exception as exc:
        print(f"Errore nel recupero TLE: {exc}", file=sys.stderr)
        if DATA.exists():
            print("Mantengo il dataset ISS esistente.", file=sys.stderr)
            return 0
        return 1

    loader = Loader(Path.home() / ".skyfield")
    ts = loader.timescale()
    eph = loader("de421.bsp")
    earth, sun = eph["earth"], eph["sun"]
    sat = EarthSatellite(line1, line2, name, ts)
    observer = wgs84.latlon(LAT, LON, elevation_m=ELEV)

    t0 = ts.now()
    t1 = ts.tt_jd(t0.tt + HORIZON_DAYS)
    times, events = sat.find_events(observer, t0, t1, altitude_degrees=MIN_ALT)
    passes: list[dict] = []

    # find_events restituisce 0 = sorgere, 1 = culmine, 2 = tramonto.
    i = 0
    while i + 2 < len(events):
        if list(events[i:i + 3]) != [0, 1, 2]:
            i += 1
            continue
        rise, culm, setting = times[i], times[i + 1], times[i + 2]
        i += 3
        seconds = (setting.tt - rise.tt) * 86400.0
        samples = ts.linspace(rise, setting, max(12, int(seconds / STEP_SECONDS)))
        alt, az, _ = (sat - observer).at(samples).altaz()
        sun_alt = (earth + observer).at(samples).observe(sun).apparent().altaz()[0].degrees
        sunlit = sat.at(samples).is_sunlit(eph)
        mask = (alt.degrees >= MIN_ALT) & (sun_alt < MIN_SUN_ALT) & sunlit
        segments = visible_segments(mask)
        if not segments:
            continue
        best = max(segments, key=len)
        if len(best) < 2:
            continue
        start_idx, end_idx = int(best[0]), int(best[-1])
        peak_idx = int(best[np.argmax(alt.degrees[best])])
        start_dt = samples[start_idx].utc_datetime()
        end_dt = samples[end_idx].utc_datetime()
        peak_dt = samples[peak_idx].utc_datetime()
        max_alt = float(alt.degrees[peak_idx])
        duration = (end_dt - start_dt).total_seconds() / 60.0
        if duration < 1.0:
            continue
        direction = f"da {az_dir(float(az.degrees[start_idx]))} verso {az_dir(float(az.degrees[end_idx]))}"
        quality = "radente" if max_alt < 20 else "alto"
        note = (f"{'Passaggio radente' if quality == 'radente' else 'Passaggio visibile a occhio nudo'}: "
                f"{direction}, massimo {max_alt:.0f}° alle {fmt_rome(peak_dt)}, per {duration:.0f} minuti.")
        passes.append({
            "id": f"iss-{start_dt.astimezone(ROME).strftime('%Y%m%d-%H%M')}",
            "inizio": iso_rome(start_dt),
            "fine": iso_rome(end_dt),
            "massimo": iso_rome(peak_dt),
            "altezza": round(max_alt, 1),
            "direzione": direction,
            "durata": round(duration, 1),
            "qualita": quality,
            "nota": note,
        })
        if len(passes) >= MAX_PASSES:
            break

    payload = {
        "generato": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "luogo": {"nome": "Borgo San Lorenzo", "lat": LAT, "lon": LON, "elevazione_m": ELEV},
        "fonte": {
            "tle": "Celestrak, NORAD 25544",
            "calcolo": "Skyfield",
            "url_tle": TLE_URL,
        },
        "tle": {"nome": name, "line1": line1, "line2": line2},
        "criterio": {
            "altezza_minima_gradi": MIN_ALT,
            "sole_sotto_gradi": MIN_SUN_ALT,
            "finestra_giorni": HORIZON_DAYS,
        },
        "passaggi": passes,
    }
    DATA.parent.mkdir(parents=True, exist_ok=True)
    DATA.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"ISS: {len(passes)} passaggi visibili salvati in {DATA.relative_to(ROOT)}")
    for p in passes:
        print(f"  {p['inizio'][:16]}  {p['direzione']}  max {p['altezza']}°  {p['durata']:.0f} min")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
