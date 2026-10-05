#!/usr/bin/env python3
"""Scarica e converte i file NOAA GHCN-Daily .dly in CSV.

Il formato predefinito è "long": una riga per stazione, data ed elemento.
Esempio:
    python ghcn_dly_to_csv.py --station AO000066160 --output luanda.csv

Più stazioni:
    python ghcn_dly_to_csv.py --station AO000066160 --station IT000016239 \
        --output stazioni.csv

Da ghcnd-stations.txt, con filtro opzionale per codice paese:
    python ghcn_dly_to_csv.py --stations-file ghcnd-stations.txt \
        --country IT --output italia.csv

Per l'intero catalogo NOAA usare --all con cautela: può comportare decine di
migliaia di download e produrre un file molto grande.
"""

from __future__ import annotations

import argparse
import csv
import io
import sys
import time
from datetime import date
from pathlib import Path
from typing import Iterable, Iterator, TextIO
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_BASE_URL = "https://www.ncei.noaa.gov/pub/data/ghcn/daily/all"
DEFAULT_STATIONS_URL = "https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt"

# Scale and unit for elements whose .dly values are stored as integers.
# Elements not present here are retained as the raw integer from NOAA.
SCALES: dict[str, tuple[float, str]] = {
    "TAVG": (0.1, "degC"),
    "TMAX": (0.1, "degC"),
    "TMIN": (0.1, "degC"),
    "TOBS": (0.1, "degC"),
    "ADPT": (0.1, "degC"),
    "AWBT": (0.1, "degC"),
    "TAXN": (0.1, "degC"),
    "MNPN": (0.1, "degC"),
    "MXPN": (0.1, "degC"),
    "PRCP": (0.1, "mm"),
    "EVAP": (0.1, "mm"),
    "WESD": (0.1, "mm"),
    "WESF": (0.1, "mm"),
    "SNOW": (1.0, "mm"),
    "SNWD": (1.0, "mm"),
    "AWND": (0.1, "m/s"),
    "WSF1": (0.1, "m/s"),
    "WSF2": (0.1, "m/s"),
    "WSF5": (0.1, "m/s"),
    "WSFG": (0.1, "m/s"),
    "WSFI": (0.1, "m/s"),
    "WSFM": (0.1, "m/s"),
    "ASLP": (0.1, "hPa"),
    "ASTP": (0.1, "hPa"),
    "RHAV": (1.0, "%"),
    "RHMN": (1.0, "%"),
    "RHMX": (1.0, "%"),
    "PSUN": (1.0, "%"),
    "AWDR": (1.0, "degree"),
    "WDF1": (1.0, "degree"),
    "WDF2": (1.0, "degree"),
    "WDF5": (1.0, "degree"),
    "WDFG": (1.0, "degree"),
    "WDFI": (1.0, "degree"),
    "WDFM": (1.0, "degree"),
    "TSUN": (1.0, "minutes"),
    "WDMV": (1.0, "km"),
}

LONG_HEADER = [
    "station_id",
    "date",
    "year",
    "month",
    "day",
    "element",
    "value",
    "unit",
    "mflag",
    "qflag",
    "sflag",
]


def station_ids_from_file(source: str, country: str | None = None) -> Iterator[str]:
    """Yield station IDs from ghcnd-stations.txt or a local list of IDs."""
    if source.startswith(("http://", "https://")):
        request = Request(source, headers={"User-Agent": "ghcn-dly-to-csv/1.0"})
        stream: TextIO = io.TextIOWrapper(urlopen(request, timeout=60), encoding="ascii", errors="replace")
        close_stream = True
    else:
        stream = open(source, "r", encoding="ascii", errors="replace")
        close_stream = True

    try:
        for line in stream:
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            # ghcnd-stations.txt is fixed-width; a plain one-ID-per-line file
            # is accepted too.
            station_id = line[:11].strip() if len(line) >= 11 else line.split()[0]
            if len(station_id) != 11:
                continue
            if country and station_id[:2].upper() != country.upper():
                continue
            yield station_id
    finally:
        if close_stream:
            stream.close()


def iter_dly_rows(text: str, station_id: str, include_missing: bool = False) -> Iterator[dict[str, object]]:
    """Decode one NOAA .dly text into normalized daily rows."""
    for line_number, line in enumerate(text.splitlines(), start=1):
        if len(line) < 21:
            continue
        sid = line[0:11].strip() or station_id
        try:
            year = int(line[11:15])
            month = int(line[15:17])
            date(year, month, 1)
        except ValueError:
            continue
        element = line[17:21].strip()
        if not element:
            continue

        scale, unit = SCALES.get(element, (1.0, "raw"))
        # The 31 day slots begin at column 22 (zero-based 21), each 8 chars:
        # VALUE[5], MFLAG[1], QFLAG[1], SFLAG[1].
        for day in range(1, 32):
            pos = 21 + (day - 1) * 8
            slot = line[pos:pos + 8]
            if len(slot) < 8:
                continue
            raw_value = slot[0:5].strip()
            if not raw_value:
                continue
            try:
                integer_value = int(raw_value)
            except ValueError:
                continue
            missing = integer_value == -9999
            if missing and not include_missing:
                continue

            try:
                current_date = date(year, month, day)
            except ValueError:
                # Invalid dates are the padding slots for shorter months.
                continue

            value: float | str = "" if missing else round(integer_value * scale, 6)
            if isinstance(value, float) and value.is_integer():
                value = int(value)
            yield {
                "station_id": sid,
                "date": current_date.isoformat(),
                "year": year,
                "month": month,
                "day": day,
                "element": element,
                "value": value,
                "unit": "" if missing else unit,
                "mflag": slot[5].strip(),
                "qflag": slot[6].strip(),
                "sflag": slot[7].strip(),
            }


def download_text(station_id: str, base_url: str, timeout: int) -> str:
    url = f"{base_url.rstrip('/')}/{station_id}.dly"
    request = Request(url, headers={"User-Agent": "ghcn-dly-to-csv/1.0"})
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("ascii", errors="replace")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--station", action="append", default=[], help="Codice stazione di 11 caratteri; ripetibile.")
    parser.add_argument("--stations-file", help="ghcnd-stations.txt, URL o file locale con gli ID delle stazioni.")
    parser.add_argument("--country", help="Codice paese FIPS a due caratteri, usato con --stations-file (es. IT, AO).")
    parser.add_argument("--all", action="store_true", help="Usa tutte le stazioni di ghcnd-stations.txt; richiede attenzione.")
    parser.add_argument("--stations-url", default=DEFAULT_STATIONS_URL, help=argparse.SUPPRESS)
    parser.add_argument("--output", required=True, help="CSV di destinazione.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help=f"Directory NOAA dei .dly (default: {DEFAULT_BASE_URL}).")
    parser.add_argument("--include-missing", action="store_true", help="Mantiene i valori -9999 come celle vuote.")
    parser.add_argument("--element", action="append", dest="elements", help="Limita agli elementi indicati, es. --element TMAX --element TMIN.")
    parser.add_argument("--timeout", type=int, default=60, help="Timeout in secondi per ogni download (default: 60).")
    parser.add_argument("--pause", type=float, default=0.0, help="Pausa in secondi tra i download.")
    parser.add_argument("--max-stations", type=int, help="Limita il numero di stazioni, utile per prove.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    station_ids = list(dict.fromkeys(x.strip().upper() for x in args.station if x.strip()))
    if args.stations_file:
        station_ids.extend(station_ids_from_file(args.stations_file, args.country))
    elif args.all:
        station_ids.extend(station_ids_from_file(args.stations_url, args.country))
    if args.all and not args.country:
        print("ATTENZIONE: --all può richiedere molti download e molto spazio.", file=sys.stderr)
    station_ids = list(dict.fromkeys(station_ids))
    if args.max_stations:
        station_ids = station_ids[:args.max_stations]
    if not station_ids:
        print("Errore: indica --station, --stations-file oppure --all.", file=sys.stderr)
        return 2
    if args.country and not args.stations_file and not args.all:
        print("Errore: --country richiede --stations-file oppure --all.", file=sys.stderr)
        return 2

    allowed = {x.upper() for x in args.elements} if args.elements else None
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    rows_written = 0
    stations_ok = 0
    stations_failed = 0

    with output.open("w", newline="", encoding="utf-8-sig") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=LONG_HEADER)
        writer.writeheader()
        for index, station_id in enumerate(station_ids, start=1):
            if len(station_id) != 11:
                print(f"[{index}/{len(station_ids)}] ID ignorato: {station_id!r}", file=sys.stderr)
                stations_failed += 1
                continue
            try:
                text = download_text(station_id, args.base_url, args.timeout)
                count = 0
                for row in iter_dly_rows(text, station_id, args.include_missing):
                    if allowed and str(row["element"]).upper() not in allowed:
                        continue
                    writer.writerow(row)
                    count += 1
                stations_ok += 1
                rows_written += count
                print(f"[{index}/{len(station_ids)}] {station_id}: {count:,} righe", file=sys.stderr)
            except (HTTPError, URLError, TimeoutError, OSError) as exc:
                stations_failed += 1
                print(f"[{index}/{len(station_ids)}] {station_id}: ERRORE {exc}", file=sys.stderr)
            if args.pause and index < len(station_ids):
                time.sleep(args.pause)

    print(f"Creato: {output}")
    print(f"Stazioni OK: {stations_ok}; errori: {stations_failed}; righe CSV: {rows_written:,}")
    return 0 if stations_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
