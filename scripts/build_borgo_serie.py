#!/usr/bin/env python3
"""
Dati della pagina «Le serie più lunghe» di Borgo San Lorenzo (borgo-serie-lunghe.html), dall'archivio SIR in data/sir/.

Ingresso:  data/sir/TOS01000999/{temp,prec024}.csv   Borgo S. Lorenzo (196 m, dal 1951; pioggia 0→24 dal 2004)
           data/sir/TOS11000017/{temp,prec024}.csv   Borgo S. Lorenzo 2 (280 m, dal 1993)
Uscita:    data/borgo-serie-lunghe.json, nello stesso formato compatto che la pagina usava incorporato:
  y0      primo anno (giorno 0 = 1° gennaio y0)
  n       numero di giorni fino all'ultimo dato
  last    ultimo giorno con un dato
  tmax1, tmin1, prec1   Borgo, in decimi (−32768 = mancante); prec1 parte dal giorno p1off
                        (si scartano i giorni con la massima più bassa della minima)
  tmax2, tmin2, prec2   Borgo 2, in decimi, dal giorno a0
  off     scarto medio mensile Borgo 2 − Borgo (°C) nei giorni in cui ci sono entrambe le stazioni: la pagina
          lo sottrae a Borgo 2 quando ne usa i valori per colmare le lacune di Borgo (serie composita)
I dati del SIR sono distribuiti con licenza CC BY-SA 4.0 (Regione Toscana, Servizio Idrologico Regionale).
"""
import datetime as dt, json, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIR = os.path.join(HERE, "data", "sir")
OUT = os.path.join(HERE, "data", "borgo-serie-lunghe.json")
Y0 = 1951
MISS = -32768
T0 = dt.date(Y0, 1, 1)


def leggi(stazione, nome, n):
    out = {}
    p = os.path.join(SIR, stazione, nome)
    for r in open(p, encoding="utf-8").read().splitlines()[1:]:
        c = r.split(";")
        out[c[0]] = [None if x == "" else float(x) for x in c[1:n + 1]]
    return out


def idx(d):
    return (dt.date.fromisoformat(d) - T0).days


def serie(dati, col, dal, al):
    """Valori in decimi dal giorno «dal» al giorno «al» compresi."""
    v = [MISS] * (al - dal + 1)
    for d, r in dati.items():
        i = idx(d)
        if dal <= i <= al and r[col] is not None:
            v[i - dal] = int(round(r[col] * 10))
    return v


def ultimo(v):
    i = len(v) - 1
    while i >= 0 and v[i] == MISS:
        i -= 1
    return i


def main():
    t1, t2 = leggi("TOS01000999", "temp.csv", 2), leggi("TOS11000017", "temp.csv", 2)
    # controllo di qualità: un giorno con la massima più bassa della minima è un errore, si scartano entrambe
    for t in (t1, t2):
        for d, r in t.items():
            if None not in r and r[0] < r[1]:
                t[d] = [None, None]
    p1, p2 = leggi("TOS01000999", "prec024.csv", 1), leggi("TOS11000017", "prec024.csv", 1)
    fine = max(idx(max(d)) for d in (t1, t2, p1, p2) if d)
    a0 = min(idx(min(t2)), idx(min(p2)))
    p1off = idx(min(p1))
    D = {"y0": Y0, "n": fine + 1, "last": (T0 + dt.timedelta(days=fine)).isoformat(), "a0": a0, "p1off": p1off}
    for nome, dati, col, dal in (("tmax1", t1, 0, 0), ("tmin1", t1, 1, 0), ("prec1", p1, 0, p1off),
                                 ("tmax2", t2, 0, a0), ("tmin2", t2, 1, a0), ("prec2", p2, 0, a0)):
        v = serie(dati, col, dal, fine)
        D[nome] = v[:ultimo(v) + 1]
    # scarto mensile Borgo 2 − Borgo nei giorni con massima e minima valide in entrambe le stazioni
    off = {"tmax": [], "tmin": []}
    for m in range(1, 13):
        dx, dn = [], []
        for d, r in t2.items():
            if int(d[5:7]) != m or d not in t1:
                continue
            a, b = t1[d], r
            if None in a or None in b or a[0] < a[1] or b[0] < b[1]:
                continue
            dx.append(b[0] - a[0]); dn.append(b[1] - a[1])
        off["tmax"].append(round(sum(dx) / len(dx), 1) if dx else 0.0)
        off["tmin"].append(round(sum(dn) / len(dn), 1) if dn else 0.0)
    D["off"] = off
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(D, f, separators=(",", ":"))
    print(f"borgo-serie-lunghe: {D['last']}, {D['n']} giorni; scarti Borgo 2 − Borgo: massime {off['tmax']}, minime {off['tmin']}")


if __name__ == "__main__":
    main()
