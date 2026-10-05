#!/usr/bin/env python3
"""Calcola climatologie mensili e annuali da un CSV GHCN-Daily in formato long.

Il CSV atteso è quello prodotto da ghcn_dly_to_csv.py, con almeno queste colonne:
station_id,date,year,month,day,element,value,unit

Esempi:
  # Climatologia mensile TAVG 1961-1990
  python ghcn_climatology.py --input luanda.csv --mode monthly \
      --element TAVG --start-year 1961 --end-year 1990 --output luanda_clim_mensile.csv

  # Medie annuali e climatologia mensile in due file
  python ghcn_climatology.py --input stazioni.csv --mode both \
      --output-dir risultati_clima

  # Una stazione e un elemento specifici
  python ghcn_climatology.py --input dati.csv --station AO000066160 \
      --element TAVG --mode both --output-dir risultati

Nota: la media mensile è la media dei valori giornalieri disponibili nel mese,
mentre la media annuale è la media dei valori giornalieri disponibili nell'anno.
Le colonne di copertura consentono di valutare quanto il risultato sia completo.
"""

from __future__ import annotations

import argparse
import csv
import math
import statistics
import sys
from collections import defaultdict
from pathlib import Path
from typing import Iterable

REQUIRED = {"station_id", "date", "year", "month", "element", "value"}
MONTH_NAMES = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
               "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--input", required=True, help="CSV long prodotto da ghcn_dly_to_csv.py.")
    p.add_argument("--mode", choices=("monthly", "annual", "both"), default="both",
                   help="Tipo di risultato: monthly, annual oppure both (default: both).")
    p.add_argument("--output", help="CSV di output; obbligatorio con --mode monthly o --mode annual.")
    p.add_argument("--output-dir", default=".", help="Cartella di output quando --mode=both (default: .).")
    p.add_argument("--station", action="append", help="Limita a uno o più codici stazione; opzione ripetibile.")
    p.add_argument("--element", action="append", help="Limita a uno o più elementi, es. TAVG; opzione ripetibile.")
    p.add_argument("--start-year", type=int, help="Primo anno incluso.")
    p.add_argument("--end-year", type=int, help="Ultimo anno incluso.")
    p.add_argument("--min-observations", type=int, default=1,
                   help="Minimo numero di giorni validi per includere un gruppo (default: 1).")
    p.add_argument("--expected-days", type=int, default=30,
                   help="Giorni attesi usati per la copertura mensile (default: 30).")
    p.add_argument("--expected-days-annual", type=int, default=365,
                   help="Giorni attesi usati per la copertura annuale (default: 365).")
    return p.parse_args()


def parse_float(value: str) -> float | None:
    value = value.strip()
    if not value or value in {"-9999", "-9999.0"}:
        return None
    try:
        number = float(value.replace(",", "."))
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def read_rows(path: Path, args: argparse.Namespace) -> Iterable[dict[str, object]]:
    stations = {x.upper() for x in args.station} if args.station else None
    elements = {x.upper() for x in args.element} if args.element else None
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        sample = f.read(4096)
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;	")
        except csv.Error:
            dialect = csv.excel
        reader = csv.DictReader(f, dialect=dialect)
        if not reader.fieldnames or not REQUIRED.issubset(set(reader.fieldnames)):
            missing = REQUIRED - set(reader.fieldnames or [])
            raise ValueError(f"Colonne mancanti nel CSV: {', '.join(sorted(missing))}")
        for line_no, row in enumerate(reader, start=2):
            sid = (row.get("station_id") or "").strip().upper()
            element = (row.get("element") or "").strip().upper()
            if stations and sid not in stations:
                continue
            if elements and element not in elements:
                continue
            try:
                year = int(str(row.get("year", "")).strip())
                month = int(str(row.get("month", "")).strip())
            except ValueError:
                continue
            if args.start_year is not None and year < args.start_year:
                continue
            if args.end_year is not None and year > args.end_year:
                continue
            value = parse_float(str(row.get("value", "")))
            if value is None or not sid or not element or not 1 <= month <= 12:
                continue
            yield {
                "station_id": sid,
                "element": element,
                "year": year,
                "month": month,
                "value": value,
                "unit": (row.get("unit") or "").strip(),
            }


def round_number(value: float) -> int | float:
    rounded = round(value, 6)
    return int(rounded) if rounded.is_integer() else rounded


def calculate(rows: Iterable[dict[str, object]], mode: str, min_obs: int,
              expected_month: int, expected_year: int) -> list[dict[str, object]]:
    groups: dict[tuple[object, ...], list[float]] = defaultdict(list)
    units: dict[tuple[object, ...], str] = {}
    for row in rows:
        if mode == "monthly":
            key = (row["station_id"], row["element"], row["month"])
        else:
            key = (row["station_id"], row["element"], row["year"])
        groups[key].append(float(row["value"]))
        units[key] = str(row["unit"])

    output = []
    for key in sorted(groups, key=lambda k: tuple(str(x) for x in k)):
        values = groups[key]
        if len(values) < min_obs:
            continue
        mean = statistics.fmean(values)
        if mode == "monthly":
            station, element, month = key
            expected = expected_month
            record = {
                "station_id": station,
                "element": element,
                "month": month,
                "month_name": MONTH_NAMES[int(month) - 1],
                "mean_value": round_number(mean),
                "unit": units[key],
                "observations": len(values),
                "coverage_percent": round_number(min(100.0, len(values) / expected * 100)),
                "minimum": round_number(min(values)),
                "maximum": round_number(max(values)),
            }
        else:
            station, element, year = key
            expected = expected_year
            record = {
                "station_id": station,
                "element": element,
                "year": year,
                "mean_value": round_number(mean),
                "unit": units[key],
                "observations": len(values),
                "coverage_percent": round_number(min(100.0, len(values) / expected * 100)),
                "minimum": round_number(min(values)),
                "maximum": round_number(max(values)),
            }
        output.append(record)
    return output


def write_csv(path: Path, rows: list[dict[str, object]], mode: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if mode == "monthly":
        fields = ["station_id", "element", "month", "month_name", "mean_value", "unit",
                  "observations", "coverage_percent", "minimum", "maximum"]
    else:
        fields = ["station_id", "element", "year", "mean_value", "unit",
                  "observations", "coverage_percent", "minimum", "maximum"]
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, delimiter=";")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    args = parse_args()
    if args.start_year is not None and args.end_year is not None and args.start_year > args.end_year:
        print("Errore: --start-year non può essere maggiore di --end-year.", file=sys.stderr)
        return 2
    if args.min_observations < 1 or args.expected_days < 1 or args.expected_days_annual < 1:
        print("Errore: i parametri numerici devono essere positivi.", file=sys.stderr)
        return 2
    if args.mode != "both" and not args.output:
        print("Errore: --output è obbligatorio con --mode monthly o --mode annual.", file=sys.stderr)
        return 2

    try:
        rows = list(read_rows(Path(args.input), args))
    except (OSError, ValueError) as exc:
        print(f"Errore nella lettura: {exc}", file=sys.stderr)
        return 1
    if not rows:
        print("Nessuna osservazione valida dopo i filtri.", file=sys.stderr)
        return 1

    modes = ("monthly", "annual") if args.mode == "both" else (args.mode,)
    outputs: list[Path] = []
    for mode in modes:
        result = calculate(rows, mode, args.min_observations, args.expected_days, args.expected_days_annual)
        if args.mode == "both":
            out_path = Path(args.output_dir) / f"climatologia_{mode}.csv"
        else:
            out_path = Path(args.output)
        write_csv(out_path, result, mode)
        outputs.append(out_path)
        print(f"Creato: {out_path} ({len(result):,} gruppi)")
    print(f"Osservazioni giornaliere utilizzate: {len(rows):,}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
