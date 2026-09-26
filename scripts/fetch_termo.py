#!/usr/bin/env python3
"""
Aggiorna data/termo.json con le temperature delle stazioni della rete regionale
del Centro Funzionale Regione Toscana (CFR) e aggiunge il riepilogo del giorno
precedente a data/termo_storico.json.

Sorgente (dati in array JS nella pagina, una riga da 17 campi per stazione):
  https://www.cfr.toscana.it/monitoraggio/stazioni.php?type=termo
  0 codice · 1 nome · 2 provincia · 3 bacino · 4 zona allerta · 5 quota
  6 ultimo dato · 7 ora · 8 min oggi · 9 ora · 10 max oggi · 11 ora
  12 min ieri · 13 ora · 14 max ieri · 15 ora · 16 attiva (1/0)
"""
import re, json, os, sys, datetime, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "termo.json")
STORICO = os.path.join(HERE, "data", "termo_storico.json")
CFR = "https://www.cfr.toscana.it/monitoraggio/stazioni.php?type=termo"
GIORNI_STORICO = 400


def _get(url, timeout=45):
    req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteo/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def _f(x):
    try:
        return float(str(x).replace(",", ".").strip())
    except (ValueError, TypeError):
        return None


def _ora(x):
    x = (x or "").strip()
    return x.replace(".", ":") if re.fullmatch(r"\d{2}\.\d{2}", x) else None


def _nome(x):
    # "Borgo S. Lorenzo (GPRS)" -> "Borgo S. Lorenzo"
    return re.sub(r"\s*\((RADIO|GPRS|SAT|GSM)\)\s*$", "", x.strip(), flags=re.I)


def _bacino(x):
    x = x.strip().strip("-").strip()
    return x.capitalize() if x.isupper() else x


def leggi_cfr():
    html = _get(CFR)
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})\s+(\d{2})\.(\d{2})", html)
    if not m:
        raise ValueError("data di riferimento non trovata")
    d, mo, y, hh, mm = map(int, m.groups())
    rif = datetime.datetime(y, mo, d, hh, mm)

    stazioni, visti = [], set()
    for blob in re.findall(r"new Array\((.*?)\);", html):
        t = re.findall(r'"([^"]*)"', blob)
        if len(t) != 17 or t[0] in visti:
            continue
        visti.add(t[0])
        stazioni.append({
            "id": t[0], "nome": _nome(t[1]), "prov": t[2], "bacino": _bacino(t[3]),
            "zona": t[4], "quota": _f(t[5]), "attiva": t[16] == "1",
            "t": _f(t[6]), "ora": _ora(t[7]),
            "min": _f(t[8]), "ora_min": _ora(t[9]),
            "max": _f(t[10]), "ora_max": _ora(t[11]),
            "ieri_min": _f(t[12]), "ieri_ora_min": _ora(t[13]),
            "ieri_max": _f(t[14]), "ieri_ora_max": _ora(t[15]),
        })
    # le stazioni non attive, o i valori senza orario, riportano 0.0 come segnaposto
    for s in stazioni:
        for k, o in (("t", "ora"), ("min", "ora_min"), ("max", "ora_max"),
                     ("ieri_min", "ieri_ora_min"), ("ieri_max", "ieri_ora_max")):
            if not s["attiva"] or s[o] is None:
                s[k] = None
    if len([s for s in stazioni if s["t"] is not None]) < 20:
        raise ValueError(f"troppe poche stazioni con dati ({len(stazioni)} righe)")
    return rif, stazioni


def riepilogo_ieri(giorno, stazioni):
    def estremo(chiave, fn):
        v = [s for s in stazioni if s[chiave] is not None]
        if not v:
            return None
        s = fn(v, key=lambda s: s[chiave])
        return {"v": s[chiave], "id": s["id"], "nome": s["nome"]}

    def media(chiave, filtro=lambda s: True):
        v = [s[chiave] for s in stazioni if s[chiave] is not None and filtro(s)]
        return round(sum(v) / len(v), 1) if v else None

    zona_m = lambda s: s["zona"] == "M"
    return {
        "data": giorno.isoformat(),
        "max": estremo("ieri_max", max),
        "min": estremo("ieri_min", min),
        "media_max": media("ieri_max"),
        "media_min": media("ieri_min"),
        "m_media_max": media("ieri_max", zona_m),
        "m_media_min": media("ieri_min", zona_m),
        "n": len([s for s in stazioni if s["ieri_max"] is not None]),
    }


def carica(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def scrivi(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def main():
    try:
        rif, stazioni = leggi_cfr()
    except Exception as e:
        # si tiene l'ultimo file valido: il sito continua a mostrare i dati precedenti
        print(f"CFR termometria non disponibile: {e}", file=sys.stderr)
        return

    scrivi(OUT, {"aggiornato": rif.strftime("%Y-%m-%dT%H:%M"), "fonte": "CFR Regione Toscana",
                 "fuso": "ora solare", "stazioni": stazioni})

    storico = carica(STORICO, {"giorni": []})
    ieri = (rif.date() - datetime.timedelta(days=1))
    giorni = [g for g in storico.get("giorni", []) if g.get("data") != ieri.isoformat()]
    giorni.append(riepilogo_ieri(ieri, stazioni))
    giorni.sort(key=lambda g: g["data"])
    scrivi(STORICO, {"giorni": giorni[-GIORNI_STORICO:]})
    print(f"termo: {len(stazioni)} stazioni, riferimento {rif:%d/%m/%Y %H:%M}")


if __name__ == "__main__":
    main()
