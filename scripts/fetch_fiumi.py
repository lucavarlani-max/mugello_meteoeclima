#!/usr/bin/env python3
"""
Aggiorna data/fiumi.json con dati reali di:
  - Fiume Sieve (livello idrometrico) dal Centro Funzionale Regione Toscana (CFR)
  - Invaso di Bilancino (quota m slm + volume Mmc) dall'OpenData del Comune di Firenze

Sorgenti:
  CFR idrometria (dati in array JS nella pagina):
    https://www.cfr.toscana.it/monitoraggio/stazioni.php?type=idro
    stazione TOS01004641 = Sieve a Fornacina (indice 8 = livello m, 13 = data/ora, 6/7 = soglie)
  Bilancino OpenData (CSV ; -> Data;Altezza (m slm);Milioni mc), aggiornato ~quotidiano:
    https://datastore.comune.fi.it/od/livelli_bilancino_<ANNO>.csv
"""
import re, json, os, sys, datetime, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "fiumi.json")
CFR = "https://www.cfr.toscana.it/monitoraggio/stazioni.php?type=idro"
BIL = "https://datastore.comune.fi.it/od/livelli_bilancino_{year}.csv"
SIEVE_CODE = "TOS01004641"   # Sieve a Fornacina


def _get(url, timeout=45):
    req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteo/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def _f(x):
    try:
        return float(str(x).replace(",", ".").strip())
    except (ValueError, TypeError):
        return None


def sieve_cfr():
    html = _get(CFR)
    for blob in re.findall(r"new Array\((.*?)\);", html):
        t = re.findall(r'"([^"]*)"', blob)
        if len(t) >= 14 and t[0] == SIEVE_CODE:
            liv, sh, sl = _f(t[8]), _f(t[6]), _f(t[7])
            stato = "normale"
            if liv is not None and sh is not None and liv >= sh:
                stato = "allarme"
            elif liv is not None and sl is not None and liv >= sl:
                stato = "attenzione"
            return {"nome": "Sieve a Fornacina", "livello_m": liv, "stato": stato, "ora": t[13]}
    return None


def bilancino_invaso():
    """Ritorna (ultimo, serie): ultimo dato + serie giornaliera dell'anno."""
    year = datetime.date.today().year
    txt = _get(BIL.format(year=year))
    rows = [r for r in txt.splitlines() if r.strip()]
    if len(rows) < 2:
        return None, None
    serie = []
    for r in rows[1:]:
        c = r.split(";")
        if len(c) >= 3 and _f(c[1]) is not None:
            dd = c[0].strip()
            serie.append({"d": dd[:5], "q": _f(c[1]), "v": _f(c[2])})  # d = gg/mm
    if not serie:
        return None, None
    last = rows[-1].split(";")
    ultimo = {"data": last[0].strip(), "quota_m_slm": _f(last[1]), "volume_mmc": _f(last[2])}
    return ultimo, {"anno": year, "serie": serie}


def carica_precedente():
    try:
        with open(OUT, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def main():
    prev = carica_precedente()
    out = {"aggiornato": datetime.datetime.now().isoformat(timespec="minutes")}

    try:
        s = sieve_cfr()
    except Exception as e:
        print(f"CFR non raggiungibile: {e}", file=sys.stderr); s = None
    out["sieve"] = s if (s and s["livello_m"] is not None) else prev.get("sieve")

    serie = None
    try:
        b, serie = bilancino_invaso()
    except Exception as e:
        print(f"OpenData Bilancino non raggiungibile: {e}", file=sys.stderr); b = None
    out["bilancino"] = b if (b and b["quota_m_slm"] is not None) else prev.get("bilancino")

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("scritto", OUT, out)

    # serie storica invaso -> data/bilancino.json (per il grafico)
    if serie and serie.get("serie"):
        bp = os.path.join(HERE, "data", "bilancino.json")
        with open(bp, "w", encoding="utf-8") as f:
            json.dump(serie, f, ensure_ascii=False, separators=(",", ":"))
        print("scritto", bp, len(serie["serie"]), "giorni")


if __name__ == "__main__":
    main()
