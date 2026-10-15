#!/usr/bin/env python3
"""
Misure giornaliere delle stazioni ARPAE Emilia-Romagna (rete idro-meteo SIMC) nei comuni toscani dell'alto Mugello,
per la pagina «Gli estremi del Mugello» (scripts/build_hall_of_fame.py).

Fonte: archivio mensile delle osservazioni https://dati-simc.arpae.it/opendata/osservati/meteo/storico/AAAA-MM.json.gz
(formato BUFR-JSON di dballe, una riga per stazione e istante). Valori giornalieri usati:
  timerange [2,0,86400] livello 103/2000  temperatura massima a 2 m (K)
  timerange [3,0,86400] livello 103/2000  temperatura minima a 2 m (K)
  timerange [1,0,86400] livello 1         precipitazione cumulata (mm)
con data di riferimento alle 00:00 UTC del giorno DOPO: il valore marcato 2026-09-05T00:00Z è quello del 4 settembre
(verificato con il report di settembre 2026: massima 33,9 °C il 4, 68,0 mm nel mese).

Scrive data/arpae/stazioni.csv (id;nome;comune;lat;lon;quota;rete) e data/arpae/<id>/temp.csv (data;max;min),
data/arpae/<id>/prec024.csv (data;mm), nello stesso formato dell'archivio SIR.

Uso:
  python scripts/fetch_arpae_stazioni.py            aggiorna il mese in corso e il precedente (al massimo una volta al giorno)
  python scripts/fetch_arpae_stazioni.py --dal 2006-01   ricostruisce dall'inizio dell'archivio
"""
import datetime as dt, gzip, io, json, os, sys, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(HERE, "data", "arpae")
URL = "https://dati-simc.arpae.it/opendata/osservati/meteo/storico/{m}.json.gz"
# stazioni scelte: (id del sito, rete ARPAE, nome ARPAE, comune, quota); la posizione si legge dai dati
# Palazzuolo sul Senio e Marradi sono pluviometri: solo precipitazione
STAZIONI = [("firenzuola", "simnbo", "Firenzuola", "Firenzuola", 476),
            ("palazzuolo", "simnbo", "Palazzuolo sul Senio", "Palazzuolo sul Senio", 500),
            ("marradi", "spdsra", "Marradi", "Marradi", 350),
            ("bibbiana", "spdsra", "Bibbiana", "Palazzuolo sul Senio", 858)]


def mese(m):
    req = urllib.request.Request(URL.format(m=m), headers={"User-Agent": "mugello-meteo/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        dati = r.read()
    out = {sid: {} for sid, *_ in STAZIONI}
    pos = {}
    with gzip.open(io.BytesIO(dati), "rt", encoding="utf-8") as f:
        for riga in f:
            if '"simnbo"' not in riga and '"spdsra"' not in riga:
                continue
            r = json.loads(riga)
            nome = None
            for d in r["data"]:
                if "B01019" in d.get("vars", {}):
                    nome = d["vars"]["B01019"]["v"]
            chiave = (r["network"], round(r["lat"] / 1e5, 4), round(r["lon"] / 1e5, 4))
            if nome:
                pos[chiave] = nome
            nome = nome or pos.get(chiave)
            sid = next((s for s, rete, n, *_ in STAZIONI if rete == r["network"] and n == nome), None)
            if not sid or not r["date"].endswith("T00:00:00Z"):
                continue
            giorno = (dt.date.fromisoformat(r["date"][:10]) - dt.timedelta(days=1)).isoformat()
            for d in r["data"]:
                tr, v, lv = d.get("timerange"), d.get("vars", {}), d.get("level") or [None, None]
                if not tr or tr[2] != 86400 or any(x.get("v") is None for x in v.values()):
                    continue
                if tr[0] == 1 and "B13011" in v:
                    out[sid].setdefault(giorno, {})["p"] = v["B13011"]["v"]
                elif tr[0] in (2, 3) and "B12101" in v and lv[0] == 103 and lv[1] == 2000:
                    out[sid].setdefault(giorno, {})["x" if tr[0] == 2 else "n"] = round(v["B12101"]["v"] - 273.15, 1)
            out[sid].setdefault("_pos", (chiave[1], chiave[2]))
    return out


def leggi(p, n):
    if not os.path.exists(p):
        return {}
    return {c[0]: c[1:n + 1] for c in (r.split(";") for r in open(p, encoding="utf-8").read().splitlines()[1:]) if c[0]}


def scrivi(p, testa, righe):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(testa + "\n" + "".join(";".join([d] + v) + "\n" for d, v in sorted(righe.items())))


def fmt(x):
    return "" if x is None else f"{x:.1f}"


def main():
    oggi = dt.date.today()
    dal = next((a.split("=", 1)[1] if "=" in a else sys.argv[sys.argv.index(a) + 1] for a in sys.argv if a.startswith("--dal")), None)
    segno = os.path.join(BASE, "aggiornato.txt")
    if not dal and os.path.exists(segno) and open(segno).read().strip() == oggi.isoformat():
        print("arpae-stazioni: già aggiornato oggi")
        return
    if dal:
        a, m = map(int, dal.split("-"))
        mesi = []
        while (a, m) <= (oggi.year, oggi.month):
            mesi.append(f"{a}-{m:02d}")
            a, m = (a + 1, 1) if m == 12 else (a, m + 1)
    else:
        prec = (oggi.replace(day=1) - dt.timedelta(days=1))
        mesi = [prec.strftime("%Y-%m"), oggi.strftime("%Y-%m")]
    elenco = {}
    for sid, rete, nome, comune, quota in STAZIONI:
        elenco[sid] = {"t": leggi(os.path.join(BASE, sid, "temp.csv"), 2), "p": leggi(os.path.join(BASE, sid, "prec024.csv"), 1), "pos": None}
    for m in mesi:
        try:
            dati = mese(m)
        except Exception as e:
            print(f"arpae-stazioni: {m} non letto", e, file=sys.stderr)
            continue
        for sid, giorni in dati.items():
            elenco[sid]["pos"] = giorni.pop("_pos", None) or elenco[sid]["pos"]
            for d, v in giorni.items():
                if "x" in v or "n" in v:
                    elenco[sid]["t"][d] = [fmt(v.get("x")), fmt(v.get("n"))]
                if "p" in v:
                    elenco[sid]["p"][d] = [fmt(v["p"])]
        print(f"arpae-stazioni: {m} letto")
    righe = ["id;nome;comune;lat;lon;quota;rete"]
    vecchie = {}
    pe = os.path.join(BASE, "stazioni.csv")
    if os.path.exists(pe):
        for r in open(pe, encoding="utf-8").read().splitlines()[1:]:
            vecchie[r.split(";")[0]] = r.split(";")
    for sid, rete, nome, comune, quota in STAZIONI:
        e = elenco[sid]
        if e["t"]:
            scrivi(os.path.join(BASE, sid, "temp.csv"), "data;max;min", e["t"])
        scrivi(os.path.join(BASE, sid, "prec024.csv"), "data;mm", e["p"])
        lat, lon = e["pos"] or (vecchie.get(sid, [None] * 5)[3], vecchie.get(sid, [None] * 5)[4])
        righe.append(f"{sid};{nome};{comune};{lat};{lon};{quota};{rete}")
        print(f"arpae-stazioni: {nome} {len(e['t'])} giorni di temperatura, {len(e['p'])} di pioggia")
    open(pe, "w", encoding="utf-8").write("\n".join(righe) + "\n")
    open(segno, "w").write(oggi.isoformat())


if __name__ == "__main__":
    main()
