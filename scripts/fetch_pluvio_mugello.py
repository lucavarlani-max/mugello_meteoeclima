#!/usr/bin/env python3
"""
Pioggia giornaliera degli ultimi 30 giorni dei pluviometri del Mugello (Centro Funzionale Regione Toscana),
per la pagina MeteoGeek «Sei modelli a confronto» (geek-modelli.html), che la confronta con le previsioni.

  1. dalla pagina dei pluviometri in tempo reale del CFR prende le stazioni attive;
  2. tiene quelle del Mugello che hanno coordinate in data/sir/stazioni.csv;
  3. per ognuna legge la cumulata degli ultimi 30 giorni (pagina di dettaglio «pluvio_men»)
     e ne ricava la pioggia di ogni giorno (come la pagina del CFR). Il giorno in corso non si tiene.

Uscita: data/verifica/pluvio-mugello.json
  {"agg":..,"fonte":..,"stazioni":[{"id","nome","quota","lat","lon","giorni":{"AAAA-MM-GG":mm}}]}
I giorni già archiviati restano (fino a 60), così la serie non si accorcia se il CFR salta un giorno.
Si aggiorna al massimo ogni 3 ore: le misure di ieri non cambiano.
"""
import csv, datetime as dt, json, os, re, sys, time, urllib.request
from zoneinfo import ZoneInfo

ROMA = ZoneInfo("Europe/Rome")

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "verifica", "pluvio-mugello.json")
ANAG = os.path.join(HERE, "data", "sir", "stazioni.csv")
LIVE = "https://www.cfr.toscana.it/monitoraggio/stazioni.php?type=pluvio"
DETT = "https://www.cfr.toscana.it/monitoraggio/dettaglio.php?id={id}&title={id}_termo&type=pluvio_men"
TENGO = 60


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteo/1.0"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8", "replace")


def attive():
    """id delle stazioni con un dato recente nella pagina in tempo reale."""
    ids = {}
    for blob in re.findall(r"new Array\((.*?)\);", get(LIVE)):
        c = re.findall(r'"([^"]*)"', blob)
        if len(c) >= 12 and c[0].startswith("TOS") and c[1]:
            nome = re.sub(r"\s*\((RADIO|GPRS|SAT|GSM)\)\s*$", "", c[1].strip(), flags=re.I)
            ids[c[0]] = nome
    return ids


def giornaliera(sid):
    html = get(DETT.format(id=sid))
    nome = re.search(r"var (\w+) = new Array\(\);", html).group(1)
    cum = []
    for a in re.findall(nome + r"\[\d+\] = new Array\(([^)]*)\)", html):
        c = re.findall(r'"([^"]*)"', a)
        g, m, y = map(int, c[1].split("/"))
        v = float(c[2].replace(",", ".")) if c[2].strip() else None
        cum.append((dt.date(y, m, g), v))
    cum.sort()
    oggi = dt.datetime.now(ROMA).date()
    out = {}
    for (d0, v0), (d1, v1) in zip(cum, cum[1:]):
        if v0 is None or v1 is None or (d1 - d0).days != 1 or d1 >= oggi:
            continue
        out[d1.isoformat()] = round(max(0.0, v1 - v0), 1)
    return out


def main():
    prima = {}
    if os.path.exists(OUT):
        prima = json.load(open(OUT, encoding="utf-8"))
        agg = dt.datetime.fromisoformat(prima.get("agg", "2000-01-01T00:00"))
        if "--forza" not in sys.argv and dt.datetime.now(ROMA).replace(tzinfo=None) - agg < dt.timedelta(hours=3):
            print("pluvio-mugello: aggiornato da meno di 3 ore, salto")
            return
    vecchie = {s["id"]: s for s in prima.get("stazioni", [])}
    anag = {r["id"]: r for r in csv.DictReader(open(ANAG, encoding="utf-8"), delimiter=";") if r.get("pluvio") == "1"}
    live = attive()
    ids = sorted(i for i in live if i in anag)
    limite = (dt.datetime.now(ROMA).date() - dt.timedelta(days=TENGO)).isoformat()
    stazioni = []
    for sid in ids:
        a = anag[sid]
        giorni = dict(vecchie.get(sid, {}).get("giorni", {}))
        try:
            giorni.update(giornaliera(sid))
        except Exception as e:
            print(f"pluvio-mugello: {sid} non letto ({e})", file=sys.stderr)
        giorni = {d: v for d, v in sorted(giorni.items()) if d >= limite}
        if giorni:
            stazioni.append({"id": sid, "nome": live[sid] or a["nome"], "quota": round(float(a["quota"])),
                             "lat": float(a["lat"]), "lon": float(a["lon"]), "giorni": giorni})
        time.sleep(0.4)
    if not stazioni:
        raise SystemExit("pluvio-mugello: nessuna stazione letta, file non toccato")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"agg": dt.datetime.now(ROMA).strftime("%Y-%m-%dT%H:%M"),
                   "fonte": "Centro Funzionale Regione Toscana, pluviometri (dati provvisori)",
                   "stazioni": stazioni}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"pluvio-mugello: {len(stazioni)} stazioni, fino al {max(max(s['giorni']) for s in stazioni)}")


if __name__ == "__main__":
    main()
