#!/usr/bin/env python3
"""
Aggiorna data/fiumi.json con i livelli di Sieve e Bilancino.

NOTA SORGENTE DATI
------------------
Il CFR / SIR Toscana (https://www.cfr.toscana.it, https://www.sir.toscana.it)
pubblica i livelli idrometrici in tempo reale, ma non tramite un'API pubblica
documentata e stabile. Questo script è la base pronta: cerca le stazioni via
il WFS OpenData della Regione Toscana e lascia UN SOLO punto da confermare —
l'URL/parse del valore in tempo reale (funzione `livello_realtime`).

Finché quel punto non è confermato, lo script mantiene i valori precedenti
già presenti in data/fiumi.json (così l'Action non fallisce mai e il sito
continua a mostrare l'ultimo dato valido).
"""
import json, sys, datetime, os, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "fiumi.json")

# Stazioni da monitorare (nome mostrato sul sito -> ricerca stazione SIR)
STAZIONI = {
    "sieve": {"nome": "Sieve", "match": "SIEVE"},          # idrometro sul fiume Sieve
    "bilancino": {"nome": "Bilancino", "match": "BILANCINO"},
}

WFS = ("https://geo.sir.toscana.it/geoserver/geo/ows?service=WFS&version=1.0.0"
       "&request=GetFeature&typeName=geo%3Acf_idrometri&maxFeatures=300000"
       "&outputFormat=application%2Fjson")


def get_json(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteo/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def trova_stazioni():
    """Ritorna le feature del WFS che contengono i nomi cercati."""
    try:
        fc = get_json(WFS)
    except Exception as e:
        print(f"WFS non raggiungibile: {e}", file=sys.stderr)
        return {}
    found = {}
    for feat in fc.get("features", []):
        props = {k.lower(): v for k, v in (feat.get("properties") or {}).items()}
        blob = " ".join(str(v).upper() for v in props.values())
        for key, cfg in STAZIONI.items():
            if cfg["match"] in blob and key not in found:
                found[key] = props
    return found


def livello_realtime(props):
    """
    DA CONFERMARE: dato il record stazione (props dal WFS, che contiene il
    codice stazione), restituire il livello/quota in tempo reale.
    Appena confermiamo l'endcoint SIR dei valori correnti, si implementa qui.
    Per ora ritorna None -> lo script tiene il valore precedente.
    """
    return None


def carica_precedente():
    try:
        with open(OUT, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def main():
    prev = carica_precedente()
    out = {
        "aggiornato": datetime.datetime.now().isoformat(timespec="minutes"),
        "sieve": prev.get("sieve", {"nome": "Sieve"}),
        "bilancino": prev.get("bilancino", {"nome": "Bilancino"}),
    }

    stazioni = trova_stazioni()
    ora = datetime.datetime.now().strftime("%d/%m %H:%M")

    if "sieve" in stazioni:
        v = livello_realtime(stazioni["sieve"])
        if v is not None:
            out["sieve"] = {"nome": "Sieve", "livello_m": round(v, 2), "ora": ora}
    if "bilancino" in stazioni:
        v = livello_realtime(stazioni["bilancino"])
        if v is not None:
            out["bilancino"] = {"nome": "Bilancino", "quota_m_slm": round(v, 1), "ora": ora}

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("scritto", OUT)


if __name__ == "__main__":
    main()
