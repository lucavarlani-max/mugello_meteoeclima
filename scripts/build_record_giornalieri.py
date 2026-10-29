#!/usr/bin/env python3
"""
Record giornalieri delle stazioni del Mugello, per la pagina MeteoGeek «Il contatore dei record» (geek-record.html).

Un record giornaliero è un valore che supera tutti quelli degli anni precedenti nella stessa data (stesso giorno e mese):
  hx  massima più alta (giorno più caldo per quella data)      lx  massima più bassa (giorno più freddo)
  hn  minima più alta (notte più calda)                        ln  minima più bassa (notte più fredda)
  p   pioggia giornaliera più alta (almeno 1 mm)
Conta solo se per quella data la stazione ha già almeno MIN_ANNI anni di misure; il 29 febbraio non si usa. Il valore
deve superare il record precedente di almeno 0,1 °C (o 0,1 mm): a parità non è un record.

In un clima stabile, se gli anni sono scambiabili, la probabilità che l'anno n+1 batta i precedenti n in una certa data è
1/(n+1): il numero atteso di record in un anno è la somma di 1/(n+1) sulle date con dati (per la pioggia, con molti giorni
asciutti e quindi valori uguali, è un limite superiore). Il rapporto fra record di caldo (hx) e di freddo (ln) è
l'indicatore di Meehl et al. (2009): vale circa 1 in un clima stabile.

Dati: stazioni e controllo di qualità di scripts/build_hall_of_fame.py (temperature SIR e ARPAE, Borgo S. Lorenzo da
data/bsl/borgo.json). Per la pioggia si usa la serie «9-9» del SIR (prec99.csv, dal 1991), più lunga della 0-24; per le
stazioni ARPAE la pioggia giornaliera. I valori scartati dal controllo non entrano; quelli non verificabili sì.

Scrive data/record-giornalieri.json:
  {"agg","min_anni","stazioni":[{"id","nome","comune","quota","fonte","dal_t","dal_p","fine",
     "anni":{"AAAA":{tipo:[record, atteso, date con dati]}},
     "eventi":[{"d","t","v","prec","anno_prec","n"}]}]}   (eventi degli ultimi 3 anni)
"""
import datetime as dt, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_hall_of_fame as hof

HERE = hof.HERE
OUT = os.path.join(HERE, "data", "record-giornalieri.json")
MIN_ANNI = 20
TIPI = {"hx": (0, 1), "lx": (0, -1), "hn": (1, 1), "ln": (1, -1)}   # (indice massima/minima, verso)


def record(serie, verso, minimo=None):
    """serie {data: valore} -> (eventi, conteggi per anno). verso 1 = record del più alto, -1 = del più basso."""
    best, per_anno, eventi = {}, {}, []
    for d in sorted(serie):
        if d[5:] == "02-29":
            continue
        v = serie[d]
        k, y = d[5:], int(d[:4])
        b = best.get(k)
        a = per_anno.setdefault(y, [0, 0.0, 0])
        if b is not None and b["n"] >= MIN_ANNI:
            a[1] += 1 / (b["n"] + 1)
            a[2] += 1
            if verso * (v - b["v"]) >= 0.05 and (minimo is None or v >= minimo):
                a[0] += 1
                eventi.append({"d": d, "v": v, "prec": b["v"], "anno_prec": b["y"], "n": b["n"]})
        if b is None:
            best[k] = {"v": v, "y": y, "n": 1}
        else:
            b["n"] += 1
            if verso * (v - b["v"]) > 0:
                b["v"], b["y"] = v, y
    return eventi, per_anno


def main():
    S = hof.stazioni()
    # pioggia 9-9 dove c'è (più lunga della 0-24)
    for sid, s in S.items():
        p99 = hof.leggi_csv(os.path.join(hof.SIR, sid, "prec99.csv"), 1)
        if p99:
            s["p"] = {d: v[0] for d, v in p99.items() if v[0] is not None}
    T = hof.controlla_temperature(S)
    P = hof.controlla_pioggia(S)
    ok = lambda m: m is None or m == "?"
    oggi = dt.date.today()
    out = []
    for sid, s in sorted(S.items(), key=lambda kv: kv[1]["quota"]):
        rec = {"id": sid, "nome": s["nome"], "comune": s["comune"], "quota": s["quota"], "fonte": s.get("fonte", "SIR"),
               "anni": {}, "eventi": []}
        for tipo, (j, verso) in TIPI.items():
            serie = {d: v for d, (v, m) in T[(sid, "x" if j == 0 else "n")].items() if ok(m)}
            if len({d[:4] for d in serie}) <= MIN_ANNI:
                continue
            rec.setdefault("dal_t", min(serie))
            rec["fine"] = max(rec.get("fine", ""), max(serie))
            ev, pa = record(serie, verso)
            for y, (c, att, nd) in pa.items():
                if nd:
                    rec["anni"].setdefault(str(y), {})[tipo] = [c, round(att, 2), nd]
            rec["eventi"] += [dict(e, t=tipo) for e in ev if int(e["d"][:4]) >= oggi.year - 2]
        serie = {d: v for d, (v, m) in P[sid].items() if ok(m)}
        if len({d[:4] for d in serie}) > MIN_ANNI:
            rec["dal_p"] = min(serie)
            rec["fine"] = max(rec.get("fine", ""), max(serie))
            ev, pa = record(serie, 1, minimo=1.0)
            for y, (c, att, nd) in pa.items():
                if nd:
                    rec["anni"].setdefault(str(y), {})["p"] = [c, round(att, 2), nd]
            rec["eventi"] += [dict(e, t="p") for e in ev if int(e["d"][:4]) >= oggi.year - 2]
        if rec["anni"] and int(max(rec["anni"])) >= oggi.year - 1:   # solo stazioni ancora attive
            rec["anni"] = dict(sorted(rec["anni"].items()))
            rec["eventi"].sort(key=lambda e: (e["d"], e["t"]))
            out.append(rec)
            ult = rec["anni"].get(str(oggi.year), {})
            print(f"record: {s['nome']}: {oggi.year} " + ", ".join(f"{k} {v[0]}/{v[1]}" for k, v in ult.items()), file=sys.stderr)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"agg": oggi.isoformat(), "min_anni": MIN_ANNI,
                   "fonte": "Servizio Idrologico Regionale della Toscana (CC BY-SA 4.0); ARPAE Emilia-Romagna (dati aperti)",
                   "stazioni": out}, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"record: {len(out)} stazioni", file=sys.stderr)


if __name__ == "__main__":
    main()
