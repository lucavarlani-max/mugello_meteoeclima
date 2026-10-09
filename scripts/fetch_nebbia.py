#!/usr/bin/env python3
"""
Umidità relativa e vento delle stazioni del Centro Funzionale Regione Toscana nella zona di allerta
Mugello-Val di Sieve (zona «M»), per la pagina MeteoGeek «Nebbia in valle» (geek-nebbia.html).
Le temperature le scrive già scripts/fetch_termo.py in data/termo.json.

Legge le tabelle in tempo reale
  https://www.cfr.toscana.it/monitoraggio/stazioni.php?type=igro   umidità: ultimo dato, minima e massima di oggi e di ieri
  https://www.cfr.toscana.it/monitoraggio/stazioni.php?type=anemo  vento (m/s): media e raffica, ultimo dato e massimi di oggi e di ieri
e scrive data/nebbia.json:
  {"agg":..,"rif":..,"stazioni":{id:{"nome","quota","ur":{..},"vento":{..}}},
   "archivio":{"AAAA-MM-GG":{id:{"ur_min","ur_max","v_max"}}}}
L'archivio tiene i valori di «ieri» di ogni giorno (fino a 400 giorni), per costruire nel tempo una statistica
delle notti sature.
"""
import datetime as dt, json, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "nebbia.json")
URL = "https://www.cfr.toscana.it/monitoraggio/stazioni.php?type={}"
TENGO = 400


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteo/1.0"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8", "replace")


def f(x):
    try:
        return float(str(x).replace(",", ".").strip())
    except (TypeError, ValueError):
        return None


def ora(x):
    x = (x or "").strip()
    return x.replace(".", ":") if re.fullmatch(r"\d{2}\.\d{2}", x) else None


def tabella(tipo):
    html = get(URL.format(tipo))
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})\s+(\d{2})\.(\d{2})", html)
    rif = dt.datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)), int(m.group(4)), int(m.group(5))) if m else None
    righe = {}
    for blob in re.findall(r"new Array\((.*?)\);", html):
        c = re.findall(r'"([^"]*)"', blob)
        if len(c) >= 16 and c[0].startswith("TOS") and c[1] and c[4] == "M":
            righe[c[0]] = c
    return rif, righe


def nome(x):
    return re.sub(r"\s*\((RADIO|GPRS|SAT|GSM)\)\s*$", "", x.strip(), flags=re.I)


def main():
    prima = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
    rif_u, igro = tabella("igro")
    rif_v, anemo = tabella("anemo")
    rif = rif_u or rif_v
    if not igro and not anemo:
        raise SystemExit("nebbia: nessuna stazione letta, file non toccato")
    st = {}
    for sid, c in igro.items():
        st.setdefault(sid, {"nome": nome(c[1]), "quota": f(c[5])})["ur"] = {
            "v": f(c[6]), "ora": ora(c[7]), "oggi_min": f(c[8]), "oggi_max": f(c[10]),
            "ieri_min": f(c[12]), "ieri_max": f(c[14])}
    for sid, c in anemo.items():
        # colonne: ultimo dato (media, raffica, direzione, ora), poi oggi e ieri (media max, raffica max, dir, ora).
        # L'intestazione del CFR dice «Raff. / Vel.», ma il primo valore è sempre il più basso: è la media.
        st.setdefault(sid, {"nome": nome(c[1]), "quota": f(c[5])})["vento"] = {
            "v": f(c[6]), "raffica": f(c[7]), "dir": f(c[8]), "ora": ora(c[9]),
            "oggi_max": f(c[10]), "oggi_raffica": f(c[11]), "ieri_max": f(c[14]), "ieri_raffica": f(c[15])}
    arch = prima.get("archivio", {})
    if rif:
        ieri = (rif.date() - dt.timedelta(days=1)).isoformat()
        giorno = {}
        for sid, s in st.items():
            r = {}
            if s.get("ur") and s["ur"]["ieri_max"] is not None:
                r["ur_min"], r["ur_max"] = s["ur"]["ieri_min"], s["ur"]["ieri_max"]
            if s.get("vento") and s["vento"]["ieri_max"] is not None:
                r["v_max"] = s["vento"]["ieri_max"]
            if r:
                giorno[sid] = r
        if giorno:
            arch[ieri] = giorno
        limite = (rif.date() - dt.timedelta(days=TENGO)).isoformat()
        arch = {d: v for d, v in sorted(arch.items()) if d >= limite}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump({"agg": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ"),
                   "rif": rif.strftime("%Y-%m-%dT%H:%M") if rif else None,
                   "fonte": "Centro Funzionale Regione Toscana (dati provvisori)",
                   "stazioni": st, "archivio": arch}, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"nebbia: {len(st)} stazioni ({sum('ur' in s for s in st.values())} umidità, "
          f"{sum('vento' in s for s in st.values())} vento), archivio {len(arch)} giorni")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("nebbia: errore", e, file=sys.stderr)
        sys.exit(1)
