#!/usr/bin/env python3
"""
Scarica dall'archivio storico del SIR Toscana (https://www.sir.toscana.it/consistenza-rete)
le serie giornaliere di temperatura e precipitazione di ogni stazione.

Per ogni stazione (e per ogni anno disponibile) legge le tabelle pubbliche di
  archivio/dati.php?A=<anno>&IDS=<stazione>&IDST=<prodotto>
con prodotto:
  termo       temperature giornaliere (massima e minima)
  pluvio0_24  precipitazioni giornaliere 0 -> 24 (mm)
  pluvio      precipitazioni giornaliere 9 -> 9 (mm), solo con --pluvio9

Uscita, in data/sir/ (una cartella per stazione):
  data/sir/stazioni.csv              anagrafica delle stazioni scaricate
  data/sir/<ID>/temp.csv             data;max;min          (valori vuoti = mancanti)
  data/sir/<ID>/prec024.csv          data;mm               (idem)
  data/sir/<ID>/stato.json           anni scaricati e relativo stato (VALIDATO / PRE-VALIDATO ...)

Si può interrompere e rilanciare: gli anni già scaricati e validati non si riscaricano
(il corrente e l'ultimo si riscaricano sempre, perché pre-validati).
Pausa tra le richieste (--pausa, default 0.4 s) per non appesantire il server.

Esempi:
  python3 scripts/fetch_sir_storico.py --id TOS01000999
  python3 scripts/fetch_sir_storico.py --bbox 11.1,43.8,11.7,44.2          # il Mugello
  python3 scripts/fetch_sir_storico.py --tutte

I dati del SIR sono distribuiti con licenza CC BY-SA 4.0 (https://www.sir.toscana.it/licenze):
vanno citati (Regione Toscana, Servizio Idrologico Regionale), con indicazione delle modifiche,
e redistribuiti con la stessa licenza.
"""
import argparse, csv, datetime as dt, html, io, json, os, re, sys, time, urllib.request, http.cookiejar

BASE = "https://www.sir.toscana.it"
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "sir")
UA = "mugello-meteoeclima/1.0 (archivio storico SIR, uso non commerciale)"

_jar = http.cookiejar.CookieJar()
_op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_jar))
_ultima = [0.0]
PAUSA = [0.4]


def get(path, tentativi=4):
    """GET con pausa fra le richieste e nuovi tentativi; decodifica ISO-8859-1 se serve."""
    url = path if path.startswith("http") else BASE + "/" + path.lstrip("/")
    for t in range(tentativi):
        attesa = PAUSA[0] - (time.time() - _ultima[0])
        if attesa > 0:
            time.sleep(attesa)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with _op.open(req, timeout=60) as r:
                raw = r.read()
            _ultima[0] = time.time()
            try:
                return raw.decode("utf-8")
            except UnicodeDecodeError:
                return raw.decode("latin-1")
        except Exception as e:
            _ultima[0] = time.time()
            if t == tentativi - 1:
                raise
            time.sleep(2 * (t + 1))


def stazioni(bbox="7,40,15,46"):
    """Stazioni con archivio storico (gestite dal SIR, hysto=1): id, nome, lat, lon, quota, sensori."""
    d = json.loads(get(f"open_layers/ajax_stations.php?bbox={bbox}&zoom=8&types=pluvio,termo"))
    out = []
    for f in d["features"]:
        if "REG-TOS" not in f["manager"] or not f["hysto"]:
            continue
        desc = f["description"]
        m = re.search(r"Com\.</b>\s*([^<]*)", desc)
        q = re.search(r"Quota staz\. slm \[m\]</b>\s*([-\d.]+)", desc)
        out.append({"id": f["id"], "nome": f["name"], "comune": html.unescape(m.group(1).strip()) if m else "",
                    "lat": f["lat"], "lon": f["lon"], "quota": q.group(1) if q else "",
                    "termo": int("termometro" in desc), "pluvio": int("pluviometro" in desc)})
    return out


def anni_disponibili(ids, prodotto):
    """Anni elencati nella scheda della stazione (link getDataDetail(...,anno) o testo 'Lista dati')."""
    t = get(f"archivio/stazione.php?IDST={prodotto}&IDS={ids}")
    i = t.find("Lista dati")
    s = t[i:] if i >= 0 else t
    s = s.split("function sendRequest")[0]
    return sorted({int(a) for a in re.findall(r">\s*((?:19|20)\d\d)\s*(?:&nbsp;|<)", s)})


CELLA = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.S)


def _num(s):
    s = re.sub(r"<[^>]+>", "", s).replace("&nbsp;", "").strip().strip("[]()")
    try:
        return float(s)
    except ValueError:
        return None


def parse_anno(h, prodotto, anno):
    """-> (stato, {data iso: valore | (max, min)}). Giorni inesistenti (30 feb ecc.) ignorati."""
    m = re.search(r"&raquo;\s*\d{4}</b>\s*-\s*<b>(?:<span[^>]*>)?([^<]*)", h)
    stato = html.unescape(m.group(1)).strip() if m else ""
    righe = re.findall(r"<tr>(.*?)</tr>", h, re.S)
    dati = {}
    for r in righe:
        celle = CELLA.findall(r)
        if len(celle) != 13:
            continue
        g = re.sub(r"<[^>]+>|&nbsp;", "", celle[0]).strip()
        if not g.isdigit():
            continue
        g = int(g)
        for mese in range(1, 13):
            c = celle[mese]
            try:
                d = dt.date(anno, mese, g)
            except ValueError:
                continue
            if prodotto == "termo":
                sp = re.findall(r"<span class=\"text-(?:danger|primary)\">(?:<span[^>]*>)?([^<]*)", c)
                if len(sp) >= 2:
                    dati[d.isoformat()] = (_num(sp[0]), _num(sp[1]))
                else:
                    dati[d.isoformat()] = (None, None)
            else:
                txt = re.sub(r"<[^>]+>|&nbsp;", "", c).strip()
                dati[d.isoformat()] = _num(txt) if txt not in ("", "-") else ("-" if txt == "-" else None)
    return stato, dati


def scrivi_csv(path, intestazione, righe):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter=";", lineterminator="\n")
        w.writerow(intestazione)
        w.writerows(righe)


def carica_csv(path):
    if not os.path.exists(path):
        return {}
    out = {}
    with open(path, encoding="utf-8") as f:
        r = csv.reader(f, delimiter=";")
        next(r, None)
        for row in r:
            out[row[0]] = tuple(row[1:])
    return out


def scarica(st, prodotto, nome, colonne, forza):
    ids = st["id"]
    cartella = os.path.join(OUT, ids)
    pf = os.path.join(cartella, "stato.json")
    stato = json.load(open(pf)) if os.path.exists(pf) else {}
    sk = stato.setdefault(prodotto, {})
    dati = carica_csv(os.path.join(cartella, nome))
    oggi = dt.date.today().year
    anni = anni_disponibili(ids, prodotto)
    n = 0
    for a in anni:
        if not forza and str(a) in sk and a < oggi - 1 and "PRE" not in sk[str(a)].upper():
            continue
        h = get(f"archivio/dati.php?A={a}&IDS={ids}&IDST={prodotto}")
        s, d = parse_anno(h, prodotto, a)
        sk[str(a)] = s
        for k, v in d.items():
            if prodotto == "termo":
                dati[k] = tuple("" if x is None else f"{x:.1f}" for x in v)
            else:
                dati[k] = ("" if v is None else ("" if v == "-" else f"{v:.1f}"),) if v != "-" else ("0.0",)
        n += 1
    righe = [(k,) + v for k, v in sorted(dati.items()) if any(v)]
    scrivi_csv(os.path.join(cartella, nome), colonne, righe)
    json.dump(stato, open(pf, "w"), ensure_ascii=False, indent=1)
    return len(anni), n, len(righe)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--id", action="append", help="codice stazione (ripetibile), es. TOS01000999")
    g.add_argument("--bbox", help="lon_min,lat_min,lon_max,lat_max")
    g.add_argument("--tutte", action="store_true", help="tutte le stazioni del SIR con archivio")
    ap.add_argument("--pausa", type=float, default=0.4, help="secondi fra una richiesta e l'altra")
    ap.add_argument("--pluvio9", action="store_true", help="scarica anche la pioggia 9->9")
    ap.add_argument("--forza", action="store_true", help="riscarica anche gli anni già presenti")
    ap.add_argument("--max", type=int, default=0, help="si ferma dopo N stazioni (prove)")
    a = ap.parse_args()
    PAUSA[0] = a.pausa
    elenco = stazioni(a.bbox or "7,40,15,46")
    if a.id:
        elenco = [s for s in elenco if s["id"] in a.id]
    if a.max:
        elenco = elenco[:a.max]
    print(f"{len(elenco)} stazioni", flush=True)
    scrivi_csv(os.path.join(OUT, "stazioni.csv"), ["id", "nome", "comune", "lat", "lon", "quota", "termo", "pluvio"],
               [[s[k] for k in ("id", "nome", "comune", "lat", "lon", "quota", "termo", "pluvio")] for s in elenco]) \
        if not os.path.exists(os.path.join(OUT, "stazioni.csv")) or a.tutte or a.bbox else None
    for i, s in enumerate(elenco, 1):
        r = []
        try:
            if s["termo"]:
                x = scarica(s, "termo", "temp.csv", ["data", "max", "min"], a.forza)
                r.append("temp %d anni (%d scaricati), %d giorni" % x)
            if s["pluvio"]:
                x = scarica(s, "pluvio0_24", "prec024.csv", ["data", "mm"], a.forza)
                r.append("prec0-24 %d anni (%d scaricati), %d giorni" % x)
                if a.pluvio9:
                    scarica(s, "pluvio", "prec99.csv", ["data", "mm"], a.forza)
        except Exception as e:
            r.append("ERRORE %s" % e)
        print(f"[{i}/{len(elenco)}] {s['id']} {s['nome']}: " + "; ".join(r), flush=True)


if __name__ == "__main__":
    main()
