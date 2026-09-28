#!/usr/bin/env python3
"""
Aggiorna data/bsl/borgo.json (stazione TOS01000999 Borgo S. Lorenzo) con i giorni
successivi all'export dell'archivio SIR, usando i dati in tempo reale del CFR:
  - temperatura: minima e massima di ieri e di oggi da data/termo.json
    (scritto poco prima da scripts/fetch_termo.py nella stessa Action);
  - pioggia: cumulata degli ultimi 30 giorni dalla pagina della stazione CFR,
    da cui si ricava la pioggia di ogni giorno.
I giorni già presenti nell'export SIR (fino a "sir_al") non vengono mai toccati;
quelli aggiunti qui sono provvisori. Gira nell'Action ogni 30 minuti.
"""
import json, os, re, sys, datetime as dt, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "bsl", "borgo.json")
TERMO = os.path.join(HERE, "data", "termo.json")
ID = "TOS01000999"
PLUVIO = f"https://www.cfr.toscana.it/monitoraggio/dettaglio.php?id={ID}&title={ID}_termo&type=pluvio_men"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteo/1.0"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8", "replace")


def metti(serie, dal, giorno, valore, sir_al):
    """Scrive un valore giornaliero allungando l'array; mai sopra i dati SIR."""
    if valore is None or giorno <= sir_al:
        return
    i = (giorno - dal).days
    while len(serie) <= i:
        serie.append(None)
    serie[i] = round(valore, 1)


def main():
    B = json.load(open(OUT, encoding="utf-8"))
    sir_al = dt.date.fromisoformat(B["sir_al"])
    t0 = dt.date.fromisoformat(B["t"]["dal"]); p0 = dt.date.fromisoformat(B["p"]["dal"])
    oggi = {}

    # temperatura da termo.json
    try:
        T = json.load(open(TERMO, encoding="utf-8"))
        rif = dt.datetime.fromisoformat(T["aggiornato"])
        s = next(x for x in T["stazioni"] if x["id"] == ID)
        ieri = rif.date() - dt.timedelta(days=1)
        metti(B["t"]["tx"], t0, ieri, s.get("ieri_max"), sir_al)
        metti(B["t"]["tn"], t0, ieri, s.get("ieri_min"), sir_al)
        oggi.update({"data": rif.date().isoformat(), "ora": s.get("ora"), "t": s.get("t"),
                     "min": s.get("min"), "max": s.get("max")})
        # le due serie restano lunghe uguali
        n = max(len(B["t"]["tx"]), len(B["t"]["tn"]))
        for k in ("tx", "tn"):
            B["t"][k] += [None] * (n - len(B["t"][k]))
    except Exception as e:
        print(f"borgo: temperatura non aggiornata ({e})", file=sys.stderr)

    # pioggia dalla cumulata a 30 giorni del CFR
    try:
        html = get(PLUVIO)
        nome = re.search(r"var (\w+) = new Array\(\);", html).group(1)
        cum = []
        for a in re.findall(nome + r"\[\d+\] = new Array\(([^)]*)\)", html):
            c = re.findall(r'"([^"]*)"', a)
            g, m, y = map(int, c[1].split("/"))
            v = float(c[2].replace(",", ".")) if c[2].strip() else None
            cum.append((dt.date(y, m, g), v))
        cum.sort()
        for (d0, v0), (d1, v1) in zip(cum, cum[1:]):
            if v0 is None or v1 is None or (d1 - d0).days != 1:
                continue
            pioggia = max(0.0, v1 - v0)
            if oggi.get("data") == d1.isoformat():
                oggi["p"] = round(pioggia, 1)          # oggi è ancora in corso
            else:
                metti(B["p"]["mm"], p0, d1, pioggia, sir_al)
    except Exception as e:
        print(f"borgo: pioggia non aggiornata ({e})", file=sys.stderr)

    if oggi:
        B["oggi"] = oggi
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(B, f, separators=(",", ":"))
    fine_t = t0 + dt.timedelta(days=len(B["t"]["tx"]) - 1)
    fine_p = p0 + dt.timedelta(days=len(B["p"]["mm"]) - 1)
    print(f"borgo: temperature fino al {fine_t}, pioggia fino al {fine_p}, oggi {oggi}")


if __name__ == "__main__":
    main()
