#!/usr/bin/env python3
"""
Aggiorna data/idrometri.json con i livelli dei corsi d'acqua della zona di allerta M
(Mugello-Val di Sieve) dal Centro Funzionale Regione Toscana, e tiene lo storico
delle ultime 48 ore per i grafici della pagina Radar e dati.

Sorgente (array JS nella pagina, una riga da 22 campi per stazione):
  https://www.cfr.toscana.it/monitoraggio/stazioni.php?type=idro
  0 codice · 1 fiume · 2 stazione · 3 provincia · 4 bacino · 5 zona
  6 soglia 2 (allarme) · 7 soglia 1 (attenzione) · 8 livello m · 9 portata
  10/11/12 variazione di livello in 1/3/6 ore · 13 data "gg/mm hh.mm" (ora solare) · 15 attiva
"""
import re, json, os, sys, datetime, urllib.request
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "idrometri.json")
CFR = "https://www.cfr.toscana.it/monitoraggio/stazioni.php?type=idro"
STAZIONI = {                      # codice -> nome mostrato (in ordine da monte a valle)
    "TOS01004611": "Sieve a Bilancino",
    "TOS01004621": "Sieve a San Piero a Sieve",
    "TOS01004623": "Carza a San Piero a Sieve",
    "TOS01004641": "Sieve a Fornacina",
    "TOS01004625": "Sieve a Dicomano",
}
ORE_STORICO = 48
ROMA = ZoneInfo("Europe/Rome")   # l'Action gira in UTC, il CFR usa l'ora italiana


def adesso():
    return datetime.datetime.now(ROMA).replace(tzinfo=None)


def _get(url, timeout=45):
    req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteo/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def _f(x):
    try:
        return float(str(x).replace(",", ".").strip())
    except (ValueError, TypeError):
        return None


def _quando(s, oggi):
    m = re.fullmatch(r"(\d{2})/(\d{2}) (\d{2})\.(\d{2})", (s or "").strip())
    if not m:
        return None
    d, mo, hh, mm = map(int, m.groups())
    y = oggi.year - (1 if mo > oggi.month + 1 else 0)     # dato di dicembre letto a gennaio
    # il CFR scrive gli orari in ora solare (UTC+1): li riportiamo all'ora italiana
    solare = datetime.datetime(y, mo, d, hh, mm, tzinfo=datetime.timezone(datetime.timedelta(hours=1)))
    return solare.astimezone(ROMA).replace(tzinfo=None)


def leggi():
    html = _get(CFR)
    oggi = adesso().date()
    out = {}
    for blob in re.findall(r"new Array\((.*?)\);", html):
        t = re.findall(r'"([^"]*)"', blob)
        if len(t) < 16 or t[0] not in STAZIONI or t[0] in out:
            continue
        liv, att, all_ = _f(t[8]), _f(t[7]), _f(t[6])
        stato = "normale"
        if liv is not None and all_ is not None and liv >= all_:
            stato = "allarme"
        elif liv is not None and att is not None and liv >= att:
            stato = "attenzione"
        q = _quando(t[13], oggi)
        out[t[0]] = {
            "id": t[0], "nome": STAZIONI[t[0]], "fiume": t[1],
            "livello": liv, "attenzione": att, "allarme": all_, "stato": stato,
            "dh1": _f(t[10]), "dh3": _f(t[11]), "dh6": _f(t[12]),
            "ora": q.isoformat(timespec="minutes") if q else None,
            "attiva": t[15] == "1",
        }
    if not out:
        raise ValueError("nessuna stazione del Mugello trovata")
    return out


def main():
    try:
        prev = json.load(open(OUT, encoding="utf-8"))
    except Exception:
        prev = {"stazioni": []}
    storia_prec = {s["id"]: s.get("storia", []) for s in prev.get("stazioni", [])}
    try:
        nuove = leggi()
    except Exception as e:
        print(f"CFR idrometria non disponibile: {e}", file=sys.stderr)
        return

    limite = (adesso() - datetime.timedelta(hours=ORE_STORICO + 2)).isoformat(timespec="minutes")
    stazioni = []
    for cod in STAZIONI:
        s = nuove.get(cod)
        if not s:
            continue
        storia = [p for p in storia_prec.get(cod, []) if p[0] >= limite]
        if s["ora"] and s["livello"] is not None and (not storia or storia[-1][0] < s["ora"]):
            storia.append([s["ora"], s["livello"]])
        s["storia"] = storia
        stazioni.append(s)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"aggiornato": adesso().isoformat(timespec="minutes"),
                   "fonte": "Centro Funzionale Regione Toscana", "stazioni": stazioni},
                  f, ensure_ascii=False, separators=(",", ":"))
    print(f"idrometri: {len(stazioni)} stazioni", [f'{s["nome"]} {s["livello"]}' for s in stazioni])


if __name__ == "__main__":
    main()
