#!/usr/bin/env python3
"""
Dati per il video verticale «La pioggia sul Mugello» (scripts/video-pioggia/video.html).

Mette insieme la pioggia giornaliera di un evento per tutti i pluviometri del Mugello e dell'Alto Mugello,
con coordinate e quota, e ne ricava la griglia interpolata che il video estrude in 3D.

Ingresso:  data/verifica/pluvio-mugello.json   pluviometri SIR/CFR Toscana (coordinate e quota incluse)
           data/arpae/<stazione>/prec024.csv   versante romagnolo, con le coordinate di data/arpae/stazioni.csv
Uscita:    scripts/video-pioggia/dati.json
  da, a        primo e ultimo giorno dell'evento
  giorni       elenco dei giorni (AAAA-MM-GG)
  stazioni     [{n, q, la, lo, v: [mm di ogni giorno], f: rete}]
  griglia      {nx, ny, la0, la1, lo0, lo1, c: [[cumulata di ogni giorno] per ogni nodo]}

La griglia è interpolata con la media pesata sull'inverso del quadrato della distanza (IDW), corretta
per la quota: la pioggia di questo evento cresce con l'altitudine, quindi si interpola il rapporto fra
la pioggia della stazione e quella attesa alla sua quota, e si rimoltiplica per quella attesa al nodo.
Senza un modello digitale del terreno la quota dei nodi è a sua volta interpolata dalle stazioni.

Uso:  python3 scripts/video-pioggia/build_dati.py [primo-giorno] [ultimo-giorno]
"""
import csv, datetime as dt, json, os, sys

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.dirname(os.path.dirname(QUI))
PLUVIO = os.path.join(RADICE, "data", "verifica", "pluvio-mugello.json")
ARPAE = os.path.join(RADICE, "data", "arpae")
USCITA = os.path.join(QUI, "dati.json")
ROMAGNA = ["firenzuola", "marradi", "palazzuolo", "bibbiana"]
# nomi per esteso: negli archivi sono abbreviati
NOMI = {"Borgo S. Lorenzo": "Borgo San Lorenzo", "Borgo S. Lorenzo 2": "Borgo San Lorenzo 2",
        "S. Agata di Mugello": "Sant'Agata", "S. Piero a Sieve-Sieve": "San Piero a Sieve"}
NX, NY = 104, 80          # nodi della griglia
MARGINE = 0.035           # gradi di margine attorno alle stazioni
POT = 2.6                 # esponente dell'IDW


def giorni(da, a):
    d0, d1 = dt.date.fromisoformat(da), dt.date.fromisoformat(a)
    return [(d0 + dt.timedelta(i)).isoformat() for i in range((d1 - d0).days + 1)]


def stazioni(gg):
    out = []
    for s in json.load(open(PLUVIO, encoding="utf-8"))["stazioni"]:
        v = [s["giorni"].get(g) for g in gg]
        if any(x is None for x in v) or s.get("lat") is None:
            continue
        out.append({"n": NOMI.get(s["nome"], s["nome"]), "q": round(s["quota"]) if s.get("quota") else None,
                    "la": s["lat"], "lo": s["lon"], "v": [round(x, 1) for x in v], "f": "SIR"})
    anag = {}
    p = os.path.join(ARPAE, "stazioni.csv")
    if os.path.exists(p):
        for r in csv.DictReader(open(p, encoding="utf-8"), delimiter=";"):
            anag[r["id"].strip().lower()] = r
    for nome in ROMAGNA:
        f = os.path.join(ARPAE, nome, "prec024.csv")
        a = anag.get(nome)
        if not os.path.exists(f) or not a:
            continue
        P = {}
        for l in open(f, encoding="utf-8").read().split("\n")[1:]:
            c = l.split(";")
            if len(c) > 1 and c[1] != "":
                P[c[0]] = float(c[1])
        v = [P.get(g) for g in gg]
        if any(x is None for x in v):
            continue
        out.append({"n": a["nome"], "q": round(float(a["quota"])), "la": float(a["lat"]), "lo": float(a["lon"]),
                    "v": [round(x, 1) for x in v], "f": "ARPAE"})
    return out


def retta(xs, ys):
    """Retta dei minimi quadrati; (0, media) se le x sono tutte uguali."""
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx < 1e-9:
        return 0.0, my
    b = sum((xs[i] - mx) * (ys[i] - my) for i in range(n)) / sxx
    return b, my - b * mx


def griglia(S, ng):
    la = [s["la"] for s in S]
    lo = [s["lo"] for s in S]
    la0, la1 = min(la) - MARGINE, max(la) + MARGINE
    lo0, lo1 = min(lo) - MARGINE, max(lo) + MARGINE
    kx = 111.3 * 0.72                      # un grado di longitudine in km a questa latitudine
    tot = [sum(s["v"]) for s in S]
    quote = [s["q"] or 0 for s in S]
    bq, aq = retta(quote, tot)             # pioggia totale attesa a una data quota
    atteso = lambda q: max(1.0, aq + bq * q)
    # rapporto fra la pioggia della stazione e quella attesa alla sua quota, giorno per giorno
    for s in S:
        s["_r"] = [s["v"][i] / atteso(s["q"] or 0) for i in range(ng)]
    C = []
    for j in range(NY):
        y = la0 + (la1 - la0) * j / (NY - 1)
        for i in range(NX):
            x = lo0 + (lo1 - lo0) * i / (NX - 1)
            pesi, sq, sr = [], 0.0, [0.0] * ng
            for s in S:
                dy = (y - s["la"]) * 111.3
                dx = (x - s["lo"]) * kx
                d = (dx * dx + dy * dy) ** .5
                w = 1e6 if d < .25 else 1 / d ** POT
                pesi.append(w)
            tp = sum(pesi)
            for w, s in zip(pesi, S):
                sq += w * (s["q"] or 0)
                for k in range(ng):
                    sr[k] += w * s["_r"][k]
            qn = sq / tp                                  # quota interpolata del nodo
            at = atteso(qn)
            cum, acc = [], 0.0
            for k in range(ng):
                acc += sr[k] / tp * at
                cum.append(round(acc, 1))
            C.append(cum)
    for s in S:
        del s["_r"]
    return {"nx": NX, "ny": NY, "la0": la0, "la1": la1, "lo0": lo0, "lo1": lo1, "c": C}


def main():
    da = sys.argv[1] if len(sys.argv) > 1 else "2026-11-09"
    a = sys.argv[2] if len(sys.argv) > 2 else "2026-11-13"
    gg = giorni(da, a)
    S = stazioni(gg)
    if len(S) < 5:
        sys.exit("troppe poche stazioni con i dati completi: %d" % len(S))
    d = {"da": da, "a": a, "giorni": gg, "stazioni": S, "griglia": griglia(S, len(gg))}
    json.dump(d, open(USCITA, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    tot = sorted(((sum(s["v"]), s["n"], s["q"]) for s in S), reverse=True)
    print("%d stazioni, %d giorni, griglia %dx%d → %s (%d KB)"
          % (len(S), len(gg), NX, NY, os.path.relpath(USCITA, RADICE), os.path.getsize(USCITA) // 1024))
    for t, n, q in tot[:5]:
        print("   %-26s %4s m  %6.1f mm" % (n, q, t))
    print("   ...")
    for t, n, q in tot[-2:]:
        print("   %-26s %4s m  %6.1f mm" % (n, q, t))


if __name__ == "__main__":
    main()
