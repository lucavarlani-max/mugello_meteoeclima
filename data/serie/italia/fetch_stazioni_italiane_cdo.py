#!/usr/bin/env python3
"""
Fetch stazioni italiane via NOAA CDO Web Services v2
======================================================

Recupera l'elenco completo delle stazioni meteo in Italia (FIPS:IT) tramite
l'API REST NOAA CDO v2, con copertura temporale (mindate/maxdate) e
percentuale di completezza dati (datacoverage) per ciascuna.

Prerequisiti:
    1. Token API gratuito: https://www.ncdc.noaa.gov/cdo-web/token
    2. Impostare la variabile d'ambiente NOAA_CDO_TOKEN, es:
         export NOAA_CDO_TOKEN="il-tuo-token-qui"
    3. pip install requests

Output:
    stazioni_italia_cdo.csv  -> elenco stazioni con metadata CDO

Note sui limiti API:
    - 5 richieste/secondo, 10.000 richieste/giorno per token
    - Paginazione: max 1000 risultati per richiesta (limit param)
"""

import os
import sys
import csv
import time
import requests

BASE_URL = "https://www.ncei.noaa.gov/cdo-web/api/v2"
TOKEN = os.environ.get("NOAA_CDO_TOKEN")
LOCATION_ID = "FIPS:IT"      # Italia
DATASET_ID = "GHCND"         # Daily Summaries (cambia se serve GSOM/GSOY ecc.)
PAGE_SIZE = 1000
SLEEP_BETWEEN_CALLS = 0.25   # margine di sicurezza sotto i 5 req/sec
OUTPUT_CSV = "stazioni_italia_cdo.csv"


def check_token():
    if not TOKEN:
        sys.exit(
            "ERRORE: variabile d'ambiente NOAA_CDO_TOKEN non impostata.\n"
            "Registrati qui per un token gratuito: "
            "https://www.ncdc.noaa.gov/cdo-web/token\n"
            "Poi lancia: export NOAA_CDO_TOKEN='il-tuo-token'"
        )


def fetch_all_stations(locationid=LOCATION_ID, datasetid=DATASET_ID):
    """Scarica tutte le stazioni per una location, gestendo la paginazione."""
    headers = {"token": TOKEN}
    stations = []
    offset = 1

    while True:
        params = {
            "locationid": locationid,
            "datasetid": datasetid,
            "limit": PAGE_SIZE,
            "offset": offset,
        }
        resp = requests.get(f"{BASE_URL}/stations", headers=headers, params=params, timeout=30)

        if resp.status_code == 429:
            print("Rate limit raggiunto, attendo 5 secondi...")
            time.sleep(5)
            continue

        resp.raise_for_status()
        data = resp.json()

        results = data.get("results", [])
        stations.extend(results)

        count = data.get("metadata", {}).get("resultset", {}).get("count", 0)
        print(f"  Scaricate {len(stations)}/{count} stazioni...")

        if not results or len(stations) >= count:
            break

        offset += PAGE_SIZE
        time.sleep(SLEEP_BETWEEN_CALLS)

    return stations


def save_csv(stations, path=OUTPUT_CSV):
    fieldnames = ["id", "name", "latitude", "longitude", "elevation",
                  "elevationUnit", "mindate", "maxdate", "datacoverage"]

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for s in stations:
            writer.writerow(s)

    print(f"\nSalvato: {path} ({len(stations)} stazioni)")


def main():
    check_token()
    print(f"Scarico stazioni per {LOCATION_ID}, dataset {DATASET_ID}...")
    stations = fetch_all_stations()

    if not stations:
        print("Nessuna stazione trovata. Controlla il token o i parametri.")
        return

    # Ordina per datacoverage decrescente (stazioni con dati più completi prima)
    stations.sort(key=lambda s: s.get("datacoverage", 0), reverse=True)

    save_csv(stations)

    # Riepilogo rapido
    print("\nTop 10 stazioni per copertura dati:")
    for s in stations[:10]:
        print(f"  {s['id']:<20} {s['name']:<35} "
              f"copertura={s.get('datacoverage', 0):.2f}  "
              f"{s.get('mindate','?')} -> {s.get('maxdate','?')}")


if __name__ == "__main__":
    main()
