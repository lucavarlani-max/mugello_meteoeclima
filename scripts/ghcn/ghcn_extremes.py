#!/usr/bin/env python3
"""Calcola statistiche di giornate calde e fredde da un CSV GHCN-Daily long.

Produce un file JavaScript compatibile con le pagine MeteoGeek:
  const EXTREMES = {"STATION_ID": {...}};

Soglie incluse:
- hot30: TMAX >= 30 °C
- hot35: TMAX >= 35 °C
- cold0: TMIN <= 0 °C
- cold5: TMIN <= -5 °C
"""
from __future__ import annotations
import argparse, csv, json, math
from collections import defaultdict
from pathlib import Path


def main() -> int:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    args=p.parse_args()
    stats=defaultdict(lambda: {
        'hot30':0,'hot35':0,'cold0':0,'cold5':0,
        'tmax_record':None,'tmin_record':None,
        'tmax_date':None,'tmin_date':None,
        'observations':0,'first_date':None,'last_date':None,
    })
    with args.input.open(encoding='utf-8-sig', newline='') as f:
        for row in csv.DictReader(f, delimiter=','):
            sid=(row.get('station_id') or '').strip()
            element=(row.get('element') or '').strip().upper()
            if not sid or element not in {'TMAX','TMIN'}: continue
            try: value=float(row.get('value',''))
            except (TypeError,ValueError): continue
            if not math.isfinite(value): continue
            d=(row.get('date') or '').strip(); st=stats[sid]; st['observations']+=1
            if d and (st['first_date'] is None or d<st['first_date']): st['first_date']=d
            if d and (st['last_date'] is None or d>st['last_date']): st['last_date']=d
            if element=='TMAX':
                if value>=30: st['hot30']+=1
                if value>=35: st['hot35']+=1
                if st['tmax_record'] is None or value>st['tmax_record']:
                    st['tmax_record']=value; st['tmax_date']=d
            else:
                if value<=0: st['cold0']+=1
                if value<=-5: st['cold5']+=1
                if st['tmin_record'] is None or value<st['tmin_record']:
                    st['tmin_record']=value; st['tmin_date']=d
    args.output.parent.mkdir(parents=True, exist_ok=True)
    payload={k:v for k,v in sorted(stats.items())}
    args.output.write_text('/* Statistiche eventi estremi GHCN-Daily */\nconst EXTREMES='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    print(f'Scritte {len(payload)} stazioni in {args.output}')
    return 0
if __name__=='__main__': raise SystemExit(main())
