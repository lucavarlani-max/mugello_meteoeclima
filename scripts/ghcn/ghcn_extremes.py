#!/usr/bin/env python3
"""Calcola eventi termici estremi e trend pluviometrici da un CSV GHCN-Daily long.

Soglie predefinite:
- giornata calda: TMAX >= 30 °C
- giornata molto calda: TMAX >= 35 °C
- giornata fredda: TMIN <= 0 °C
- giornata molto fredda: TMIN <= -5 °C

Il CSV può contenere TMAX, TMIN e PRCP. PRCP è espresso in mm dopo la
conversione con ghcn_dly_to_csv.py.
"""
from __future__ import annotations
import argparse, csv, json, math
from collections import defaultdict
from pathlib import Path


def slope(points):
    if len(points)<2: return None
    xs=[float(x) for x,_ in points]; ys=[float(y) for _,y in points]
    mx=sum(xs)/len(xs); my=sum(ys)/len(ys)
    den=sum((x-mx)**2 for x in xs)
    return None if not den else sum((x-mx)*(y-my) for x,y in zip(xs,ys))/den


def main() -> int:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    p.add_argument('--hot-threshold', type=float, default=30.0, help='TMAX minima per giornata calda (°C).')
    p.add_argument('--very-hot-threshold', type=float, default=35.0, help='TMAX minima per giornata molto calda (°C).')
    p.add_argument('--cold-threshold', type=float, default=0.0, help='TMIN massima per giornata fredda (°C).')
    p.add_argument('--very-cold-threshold', type=float, default=-5.0, help='TMIN massima per giornata molto fredda (°C).')
    args=p.parse_args()
    if args.very_hot_threshold < args.hot_threshold:
        p.error('--very-hot-threshold deve essere >= --hot-threshold')
    if args.very_cold_threshold > args.cold_threshold:
        p.error('--very-cold-threshold deve essere <= --cold-threshold')
    stats=defaultdict(lambda: {
        'hot':0,'very_hot':0,'cold':0,'very_cold':0,
        'tmax_record':None,'tmin_record':None,'tmax_date':None,'tmin_date':None,
        'observations':0,'first_date':None,'last_date':None,
        'precip_yearly':defaultdict(lambda:[0.0,0]),
    })
    with args.input.open(encoding='utf-8-sig', newline='') as f:
        for row in csv.DictReader(f, delimiter=','):
            sid=(row.get('station_id') or '').strip()
            element=(row.get('element') or '').strip().upper()
            if not sid or element not in {'TMAX','TMIN','PRCP'}: continue
            try: value=float(row.get('value',''))
            except (TypeError,ValueError): continue
            if not math.isfinite(value): continue
            d=(row.get('date') or '').strip(); year=d[:4] if len(d)>=4 else ''
            if element=='TMAX' and not -80 <= value <= 70: continue
            if element=='TMIN' and not -90 <= value <= 60: continue
            if element=='PRCP' and not 0 <= value <= 2000: continue
            st=stats[sid]; st['observations']+=1
            if d and (st['first_date'] is None or d<st['first_date']): st['first_date']=d
            if d and (st['last_date'] is None or d>st['last_date']): st['last_date']=d
            if element=='TMAX':
                if value>=args.hot_threshold: st['hot']+=1
                if value>=args.very_hot_threshold: st['very_hot']+=1
                if st['tmax_record'] is None or value>st['tmax_record']:
                    st['tmax_record']=value; st['tmax_date']=d
            elif element=='TMIN':
                if value<=args.cold_threshold: st['cold']+=1
                if value<=args.very_cold_threshold: st['very_cold']+=1
                if st['tmin_record'] is None or value<st['tmin_record']:
                    st['tmin_record']=value; st['tmin_date']=d
            elif element=='PRCP' and year.isdigit():
                st['precip_yearly'][year][0]+=value; st['precip_yearly'][year][1]+=1
    out={}
    for sid,st in sorted(stats.items()):
        years=[]
        for year,(total,n) in sorted(st['precip_yearly'].items()):
            years.append({'year':int(year),'total':round(total,2),'observations':n})
        trend=slope([(x['year'],x['total']) for x in years])
        out[sid]={k:v for k,v in st.items() if k!='precip_yearly'}
        out[sid]['precip_yearly']=years
        out[sid]['precip_trend_mm_per_year']=round(trend,3) if trend is not None else None
        out[sid]['thresholds']={'hot':args.hot_threshold,'very_hot':args.very_hot_threshold,'cold':args.cold_threshold,'very_cold':args.very_cold_threshold}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text('/* Statistiche eventi estremi GHCN-Daily */\nconst EXTREMES='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    print(f'Scritte {len(out)} stazioni in {args.output}')
    return 0
if __name__=='__main__': raise SystemExit(main())
