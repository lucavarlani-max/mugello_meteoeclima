#!/usr/bin/env python3
"""
Raccoglie i link alle carte di previsione ECMWF (OpenCharts, modello IFS, area
Europa) per la pagina Mappe e scrive data/ecmwf.json.

API: https://charts.ecmwf.int/opencharts-api/v1/products/<prodotto>/
     ?base_time=...&valid_time=...&projection=opencharts_europe
La risposta JSON contiene il link all'immagine PNG in data.link.href (le immagini
restano su charts.ecmwf.int). Licenza CC-BY-4.0, © ECMWF.

L'API limita molto le richieste (429 già dopo una decina di chiamate ravvicinate),
quindi ogni esecuzione dell'Action fa al massimo BUDGET chiamate distanziate di
PAUSA secondi e riprende la volta dopo da dove si era fermata. Si usa l'ultima
corsa (00 o 12 UTC) vecchia almeno 12 ore, che ECMWF ha già pubblicato per intero.
Finché la corsa nuova non è completa la pagina continua a mostrare la precedente.
"""
import json, os, sys, time, datetime, urllib.request, urllib.parse, urllib.error

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "ecmwf.json")
API = "https://charts.ecmwf.int/opencharts-api/v1/products/{}/"
PROIEZIONE = "opencharts_europe"
# (codice ECMWF, nome in italiano)
PRODOTTI = [
    ("medium-mslp-wind850", "Pressione e vento a 850 hPa"),
    ("medium-z500-t850", "Geopotenziale a 500 hPa e temperatura a 850 hPa"),
    ("medium-mslp-rain", "Pressione e precipitazioni"),
    ("medium-rain-acc", "Precipitazioni accumulate"),
    ("medium-2t-wind", "Temperatura a 2 metri e vento"),
    ("medium-clouds", "Nuvolosità"),
    ("medium-snowfall", "Neve"),
    ("medium-zero-level", "Zero termico"),
    ("medium-wind-10wg", "Raffiche di vento"),
    ("medium-cape-cin", "Instabilità (CAPE e CIN)"),
]
PASSI = [0, 12, 24, 36, 48, 60, 72, 84, 96, 120, 144, 168, 192, 216, 240]   # ore dalla corsa
ETA_MIN = datetime.timedelta(hours=12)
BUDGET = 40          # chiamate per esecuzione
PAUSA = 4            # secondi tra le chiamate
ATTESA_429 = 20


def adesso():
    return datetime.datetime.now(datetime.timezone.utc)


def iso(d):
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


def corsa(now):
    b = now.replace(minute=0, second=0, microsecond=0, hour=0 if now.hour < 12 else 12)
    while now - b < ETA_MIN:
        b -= datetime.timedelta(hours=12)
    return b


def chiedi(prod, base, passo):
    q = urllib.parse.urlencode({"base_time": iso(base), "valid_time": iso(base + datetime.timedelta(hours=passo)),
                                "projection": PROIEZIONE})
    req = urllib.request.Request(API.format(prod) + "?" + q, headers={"User-Agent": "mugello-meteo/1.0 (+github pages)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.loads(r.read().decode("utf-8"))
    return d["data"]["link"]["href"], (d["data"].get("attributes") or {}).get("title")


def nuova(base):
    return {"base": iso(base), "prodotti": {p: {} for p, _ in PRODOTTI}}


def mancanti(s):
    # passi non ancora provati (None = provato ma non disponibile)
    return [(p, k) for p, _ in PRODOTTI for k in PASSI if str(k) not in s["prodotti"].setdefault(p, {})]


def main():
    try:
        dati = json.load(open(OUT, encoding="utf-8"))
    except Exception:
        dati = {}
    base = corsa(adesso())
    cor, nuo = dati.get("corrente"), dati.get("nuovo")
    if cor and cor.get("base") == iso(base):
        lavoro = cor
    else:
        if not nuo or nuo.get("base") != iso(base):
            nuo = nuova(base)
        lavoro = nuo if cor else None
        if lavoro is None:            # prima esecuzione: si riempie direttamente la corrente
            cor = lavoro = nuo
            nuo = None
    titoli = dati.get("titoli", {})
    da_fare = mancanti(lavoro)
    if not da_fare:
        print("ecmwf: corsa", lavoro["base"], "già completa")
        return
    chiamate, bloccato = 0, False
    for prod, k in da_fare:
        if chiamate >= BUDGET or bloccato:
            break
        if chiamate:
            time.sleep(PAUSA)
        chiamate += 1
        for tentativo in (1, 2):
            try:
                href, titolo = chiedi(prod, base, k)
                lavoro["prodotti"][prod][str(k)] = href
                if titolo:
                    titoli[prod] = titolo
                break
            except urllib.error.HTTPError as e:
                if e.code == 429 and tentativo == 1:
                    time.sleep(ATTESA_429)
                    continue
                if e.code == 404:
                    lavoro["prodotti"][prod][str(k)] = None     # passo non previsto per questo prodotto
                if e.code == 429:
                    bloccato = True                              # troppe richieste: si riprende alla prossima esecuzione
                print(f"ecmwf: {prod} +{k}h errore HTTP {e.code}")
                break
            except Exception as e:
                print(f"ecmwf: {prod} +{k}h errore {e}")
                break
    resto = len(mancanti(lavoro))
    if lavoro is nuo and resto == 0:      # corsa nuova completa: diventa quella mostrata
        cor, nuo = nuo, None
    out = {"aggiornato": iso(adesso()), "fonte": "ECMWF OpenCharts (modello IFS)", "licenza": "CC-BY-4.0",
           "proiezione": PROIEZIONE, "passi": PASSI,
           "nomi": {p: n for p, n in PRODOTTI}, "titoli": titoli, "corrente": cor}
    if nuo:
        out["nuovo"] = nuo
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)
    print(f"ecmwf: corsa {lavoro['base']}, {chiamate} chiamate, mancano {resto} carte")


if __name__ == "__main__":
    main()
