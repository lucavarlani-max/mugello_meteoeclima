#!/usr/bin/env python3
"""
Download dati giornalieri GHCN (.dly) per le stazioni italiane
=================================================================

Scarica i file .dly (formato a colonne fisse) dal server pubblico NOAA
per tutte le stazioni indicate, li converte in un CSV in formato lungo
(una riga per stazione/data/elemento), filtrando solo gli ultimi N anni.

Nessun token richiesto: i file .dly sono pubblici via HTTPS.

Output:
    dati_giornalieri_italia_30anni.csv

Colonne output:
    station_id, name, date, element, value, mflag, qflag, sflag

    Valori già convertiti in unita' fisiche standard:
    - TMAX, TMIN, TAVG -> gradi Celsius
    - PRCP, SNOW, SNWD -> millimetri
    (nel file .dly originale sono in decimi; qui gia' divisi per 10)

Uso:
    pip install requests
    python3 download_dati_giornalieri.py
"""

import os
import time
import csv
import requests
from datetime import datetime

BASE_URL = "https://www.ncei.noaa.gov/pub/data/ghcn/daily/all/"
OUTPUT_CSV = "dati_giornalieri_italia_30anni.csv"
RAW_DIR = "dly_raw"                 # cartella dove salvare i .dly grezzi scaricati
YEARS_BACK = 30
SLEEP_BETWEEN_DOWNLOADS = 0.3       # cortesia verso il server, non e' rate-limited come CDO

CURRENT_YEAR = datetime.now().year
MIN_YEAR = CURRENT_YEAR - YEARS_BACK

# Elementi che ci interessano (i 5 core + TAVG). Aggiungi altri codici
# (vedi GHCND_documentation) se ti servono, es. "AWND", "WT01", ecc.
ELEMENTS_OF_INTEREST = {"TMAX", "TMIN", "TAVG", "PRCP", "SNOW", "SNWD"}

# Fattore di conversione (da decimi a unita' fisiche) per elemento
SCALE = {
    "TMAX": 0.1, "TMIN": 0.1, "TAVG": 0.1,   # tenths of degrees C -> C
    "PRCP": 0.1, "SNOW": 1.0, "SNWD": 1.0,   # PRCP tenths of mm -> mm; SNOW/SNWD gia' in mm
}

# ---- Elenco delle 100 stazioni italiane (ID GHCN + nome) ----
STATIONS = [
    {"id": "ITE00100550", "name": "Bologna"},
    {"id": "ITE00100552", "name": "Genoa"},
    {"id": "ITE00155357", "name": "Marienberg"},
    {"id": "ITE00155347", "name": "Cortina"},
    {"id": "ITE00155360", "name": "Mitterkaser"},
    {"id": "ITE00155371", "name": "Rolle"},
    {"id": "ITE00155369", "name": "Rein"},
    {"id": "ITE00155372", "name": "Rovereto"},
    {"id": "ITE00155342", "name": "Brixen"},
    {"id": "ITE00155366", "name": "Predazzo"},
    {"id": "ITE00155383", "name": "Windisch Matrei"},
    {"id": "SIE00115206", "name": "Ratece Planica"},
    {"id": "ITE00100554", "name": "Milano"},
    {"id": "SIE00115106", "name": "Bilje"},
    {"id": "ITE00155379", "name": "Toblach"},
    {"id": "ITE00115588", "name": "Genova Sestri"},
    {"id": "ITE00115584", "name": "Torino Caselle"},
    {"id": "ITE00155385", "name": "Zell Am See"},
    {"id": "ITW00034187", "name": "Palermo"},
    {"id": "ITM00016148", "name": "Pratica Di Mare"},
    {"id": "ITM00016033", "name": "Milano Linate"},
    {"id": "ITM00016429", "name": "Brindisi"},
    {"id": "ITM00016480", "name": "Trapani Birgi"},
    {"id": "ITM00016325", "name": "Roma Ciampino"},
    {"id": "ITE00155343", "name": "Bruneck"},
    {"id": "ITM00016360", "name": "Grazzanise"},
    {"id": "ITE00155352", "name": "Klausen"},
    {"id": "ITE00100553", "name": "Torino"},
    {"id": "IT000162580", "name": "Brindisi"},
    {"id": "ITE00155376", "name": "Sillian"},
    {"id": "ITE00155373", "name": "Salurn"},
    {"id": "IT000162240", "name": "Amendola"},
    {"id": "ITM00016280", "name": "Grosseto"},
    {"id": "ITE00155346", "name": "Cavalese"},
    {"id": "ITE00155351", "name": "Innichen"},
    {"id": "ITE00155354", "name": "Lienz"},
    {"id": "ITE00155362", "name": "Neumarkt"},
    {"id": "ITM00016008", "name": "Alghero"},
    {"id": "ITM00016252", "name": "Pisa"},
    {"id": "ITM00016061", "name": "Bolzano"},
    {"id": "ITM00016098", "name": "Verona Villafranca"},
    {"id": "ITM00016179", "name": "Falconara"},
    {"id": "ITM00016245", "name": "Firenze"},
    {"id": "IT000016239", "name": "Pescara"},
    {"id": "ITM00016546", "name": "Lamezia Terme"},
    {"id": "IT000160220", "name": "Bergamo Orio Al Serio"},
    {"id": "ITE00155337", "name": "Altrei"},
    {"id": "ITE00155384", "name": "Wolkenstein"},
    {"id": "ITE00100551", "name": "Venezia"},
    {"id": "ITE00155339", "name": "Antholz"},
    {"id": "ITE00155358", "name": "Meran"},
    {"id": "ITM00016420", "name": "Bari"},
    {"id": "ITE00155341", "name": "Bozen"},
    {"id": "ITE00155355", "name": "Longarone"},
    {"id": "ITE00155353", "name": "Kolfuschg"},
    {"id": "ITE00155363", "name": "Niederdorf"},
    {"id": "ITM00016088", "name": "Treviso"},
    {"id": "ITE00155349", "name": "Corvara"},
    {"id": "IT000016090", "name": "Trieste"},
    {"id": "ITE00155359", "name": "Mezzocorona"},
    {"id": "ITE00155381", "name": "Villnoess"},
    {"id": "IT000016320", "name": "Roma Urbe"},
    {"id": "IT000016134", "name": "Cagliari Elmas"},
    {"id": "ITM00016400", "name": "Napoli Capodichino"},
    {"id": "ITE00155378", "name": "Toblacher See"},
    {"id": "ITE00155377", "name": "St Vigil"},
    {"id": "ITE00155350", "name": "Deutschnofen"},
    {"id": "ITE00105250", "name": "Aviano"},
    {"id": "ITE00155361", "name": "Mules"},
    {"id": "ITE00155338", "name": "Andraz"},
    {"id": "ITM00016219", "name": "Ancona"},
    {"id": "ITE00155382", "name": "Welsberg"},
    {"id": "ITE00155340", "name": "Arco"},
    {"id": "ITM00016064", "name": "Bolzano Aeroporto"},
    {"id": "ITM00016158", "name": "Guidonia"},
    {"id": "ITE00155368", "name": "Proveis"},
    {"id": "ITE00155374", "name": "Sand In Taufers"},
    {"id": "ITE00155380", "name": "Truden"},
    {"id": "ITE00155356", "name": "Luttach"},
    {"id": "ITE00155348", "name": "Colfosco"},
    {"id": "ITM00016206", "name": "Perugia"},
    {"id": "ITE00155367", "name": "Prad"},
    {"id": "ITE00155364", "name": "Percha"},
    {"id": "SZ000006717", "name": "Col Du Grand St Bernard"},
    {"id": "ITE00155336", "name": "Ala"},
    {"id": "ITW00033126", "name": "Catania Fontanarossa"},
    {"id": "ITM00016052", "name": "Rimini"},
    {"id": "ITE00155365", "name": "Percha"},
    {"id": "ITM00016045", "name": "Bologna Borgo Panigale"},
    {"id": "ITM00016344", "name": "Latina"},
    {"id": "ITE00155345", "name": "Caldaro"},
    {"id": "ITM00016149", "name": "Roma Fiumicino"},
    {"id": "ITM00016253", "name": "Pisa San Giusto"},
    {"id": "ITE00155344", "name": "Brenner"},
    {"id": "ITE00155370", "name": "Ridnaun"},
    {"id": "ITE00155375", "name": "Sarnthein"},
    {"id": "ITM00016450", "name": "Crotone"},
    {"id": "ITW00034194", "name": "Reggio Calabria"},
    {"id": "ITM00016410", "name": "Amendola"},
    {"id": "ITW00034113", "name": "Cozzo Spadaro"},
]


def download_dly(station_id, dest_dir):
    """Scarica il file .dly per una stazione, se non gia' presente."""
    dest_path = os.path.join(dest_dir, f"{station_id}.dly")
    if os.path.exists(dest_path):
        return dest_path, True

    url = f"{BASE_URL}{station_id}.dly"
    resp = requests.get(url, timeout=30)
    if resp.status_code != 200:
        return None, False

    with open(dest_path, "wb") as f:
        f.write(resp.content)
    return dest_path, True


def parse_dly(path, min_year):
    """Parsa un file .dly secondo il formato a colonne fisse GHCN.

    Ritorna una lista di dict: date, element, value, mflag, qflag, sflag
    (solo per anni >= min_year e per gli elementi di interesse).
    """
    records = []
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            if len(line) < 269:
                continue

            year = int(line[11:15])
            if year < min_year:
                continue

            month = int(line[15:17])
            element = line[17:21].strip()
            if element not in ELEMENTS_OF_INTEREST:
                continue

            scale = SCALE.get(element, 1.0)

            for day in range(1, 32):
                offset = 21 + (day - 1) * 8
                value_str = line[offset:offset + 5]
                mflag = line[offset + 5:offset + 6].strip()
                qflag = line[offset + 6:offset + 7].strip()
                sflag = line[offset + 7:offset + 8].strip()

                try:
                    raw_value = int(value_str)
                except ValueError:
                    continue

                if raw_value == -9999:
                    continue  # dato mancante

                try:
                    date_obj = datetime(year, month, day)
                except ValueError:
                    continue  # es. 31 aprile, giorno inesistente

                records.append({
                    "date": date_obj.strftime("%Y-%m-%d"),
                    "element": element,
                    "value": round(raw_value * scale, 2),
                    "mflag": mflag,
                    "qflag": qflag,
                    "sflag": sflag,
                })

    return records


def main():
    os.makedirs(RAW_DIR, exist_ok=True)
    print(f"Filtro dati dal {MIN_YEAR} al {CURRENT_YEAR} ({YEARS_BACK} anni)")
    print(f"Stazioni da processare: {len(STATIONS)}\n")

    all_rows = []
    ok_count = 0
    fail_count = 0

    for i, station in enumerate(STATIONS, 1):
        sid = station["id"]
        name = station["name"]
        print(f"[{i}/{len(STATIONS)}] {sid} ({name})...", end=" ")

        path, success = download_dly(sid, RAW_DIR)
        if not success:
            print("FALLITO (file non trovato)")
            fail_count += 1
            continue

        records = parse_dly(path, MIN_YEAR)
        for r in records:
            r["station_id"] = sid
            r["name"] = name
            all_rows.append(r)

        print(f"OK ({len(records)} osservazioni)")
        ok_count += 1
        time.sleep(SLEEP_BETWEEN_DOWNLOADS)

    print(f"\nCompletato: {ok_count} stazioni OK, {fail_count} fallite")
    print(f"Totale osservazioni raccolte: {len(all_rows)}")

    fieldnames = ["station_id", "name", "date", "element", "value", "mflag", "qflag", "sflag"]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\nSalvato: {OUTPUT_CSV}")
    print(f"(file .dly grezzi conservati in ./{RAW_DIR}/ per riuso futuro)")


if __name__ == "__main__":
    main()
