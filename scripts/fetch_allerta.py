#!/usr/bin/env python3
"""
Aggiorna data/allerta.json dal Bollettino di Valutazione delle Criticità del
Centro Funzionale Regione Toscana (CFR).

Fonte (PDF): https://www.cfr.toscana.it/bollettini/pdf_12.php?print=true&light=true
Il PDF riporta, nella sezione "DESCRIZIONE DELLE CRITICITÀ PREVISTE", il testo
dell'eventuale criticità (o "NESSUNA"). Lo script estrae quel testo e ne ricava
il livello (verde/gialla/arancione/rossa) e la descrizione mostrata nel banner.

Nota: la mappa a colori per singola zona non è nel testo del PDF; quando c'è
criticità lo script prende il livello massimo citato nella descrizione e usa la
prosa ufficiale come testo. Rifinibile per la sola zona Mugello (M-Val di Sieve)
quando disponibile un bollettino con criticità da cui leggere il formato esatto.
"""
import os, sys, json, re, io, datetime, unicodedata, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "allerta.json")
PDF = "https://www.cfr.toscana.it/bollettini/pdf_12.php?print=true&light=true"
LINK = "https://www.cfr.toscana.it/index.php?IDS=2&IDSS=76"


def _noacc(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))

ZONA = "M"                                  # Mugello-Val di Sieve
ORDINE = ["verde", "gialla", "arancione", "rossa"]
LIV = {"GIALLO": "gialla", "ARANCIONE": "arancione", "ROSSO": "rossa"}
RIGA_ZONE = re.compile(r"^[A-Z]\d?(?:\s*,\s*[A-Z]\d?)*,?$")


def estrai_righe(testo):
    """Legge la tabella ZONE DI ALLERTA / RISCHIO / TEMPI / CRITICITA' del PDF.
    Restituisce [{zone:set, rischio:str, tempi:str, livello:str}]; lista vuota se il formato non è riconosciuto."""
    t = testo.replace("\u00cc", "I")
    righe, cur = [], None
    in_tab = False
    for ln in t.splitlines():
        u = _noacc(ln).upper()
        if "ZONE DI ALLERTA" in u and "RISCHIO" in u:
            in_tab = True
            continue
        if not in_tab:
            continue
        if "DESCRIZIONE DEGLI SCENARI" in u:
            if cur:
                righe.append(cur); cur = None
            in_tab = False
            continue
        cols = [c.strip() for c in re.split(r"\s{3,}", ln.strip()) if c.strip()]
        if not cols:
            continue
        if RIGA_ZONE.match(cols[0]):
            if cur:
                righe.append(cur)
            cur = {"zone": set(), "rischio": "", "tempi": "", "livello": ""}
            cur["zone"] |= set(re.findall(r"[A-Z]\d?", cols[0]))
            cols = cols[1:]
        if cur is None:
            continue
        for c in cols:
            cu = _noacc(c).upper()
            if cu in LIV:
                cur["livello"] = LIV[cu]
            elif re.match(r"^(IDROGEOLOGICO|IDRAULICO|MINORE|MAGGIORE|RETICOLO|TEMPORALI|VENTO|MAREGGIATE|NEVE|GHIACCIO|COSTIERO|VALANGHE)", cu):
                cur["rischio"] = (cur["rischio"] + " " + c).strip()
            else:
                cur["tempi"] = (cur["tempi"] + " " + c).strip()
    if cur:
        righe.append(cur)
    return [r for r in righe if r["zone"] and r["livello"]]


def estrai_testo(pdf_bytes):
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            return "\n".join((p.extract_text() or "") for p in pdf.pages)
    except Exception:
        import subprocess, tempfile
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(pdf_bytes); path = f.name
        out = subprocess.run(["pdftotext", "-layout", path, "-"],
                             capture_output=True, text=True)
        return out.stdout


def main():
    prev = {}
    try:
        prev = json.load(open(OUT, encoding="utf-8"))
    except Exception:
        pass

    try:
        req = urllib.request.Request(PDF, headers={"User-Agent": "mugello-meteo/1.0"})
        pdf = urllib.request.urlopen(req, timeout=45).read()
        testo = estrai_testo(pdf)
    except Exception as e:
        print(f"Bollettino non raggiungibile: {e}", file=sys.stderr)
        json.dump(prev or {"livello": "verde",
                           "testo": "Nessuna criticità meteo in corso sul Mugello",
                           "link": LINK}, open(OUT, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)
        return

    up = _noacc(testo).upper()
    # sezione descrizione
    idx = up.find("DESCRIZIONE DELLE CRITICITA")
    descr = up[idx:] if idx != -1 else up

    if re.search(r"\bNESSUN", descr):  # "criticità previste: NESSUNA"
        out = {"livello": "verde", "rischio": "",
               "testo": "Nessuna criticità meteo in corso sul Mugello",
               "validita": "", "link": LINK}
    else:
        righe = estrai_righe(testo)
        if righe:
            # il bollettino elenca per zona di allerta: conta solo la zona M (Mugello-Val di Sieve)
            mug = [r for r in righe if ZONA in r["zone"]]
            if mug:
                liv = max((r["livello"] for r in mug), key=ORDINE.index)
                r0 = max(mug, key=lambda r: ORDINE.index(r["livello"]))
                rischio = ", ".join(sorted({r["rischio"] for r in mug if r["rischio"]}))
                out = {"livello": liv, "rischio": rischio.lower(),
                       "testo": ("Allerta " + liv + " sul Mugello" + (": " + rischio.lower() if rischio else "")),
                       "validita": r0["tempi"], "link": LINK}
            else:
                out = {"livello": "verde", "rischio": "",
                       "testo": "Nessuna criticità meteo in corso sul Mugello (allerte in altre zone della Toscana)",
                       "validita": "", "link": LINK}
        else:
            # tabella non leggibile: livello massimo citato, solo come parola intera
            if re.search(r"\bROSS[OA]\b", descr):
                liv = "rossa"
            elif re.search(r"\bARANCION[EA]\b", descr):
                liv = "arancione"
            else:
                liv = "gialla"
            raw = testo[idx:] if idx != -1 else testo
            raw = re.sub(r"(?i)descrizione delle criticit[aà]\s+previste:?", "", raw)
            raw = re.sub(r"\s+", " ", raw).strip()
            raw = re.sub(r"(?i)powered by tcpdf.*$", "", raw).strip()
            testo_out = (raw[:200] + "…") if len(raw) > 200 else raw
            out = {"livello": liv, "rischio": "",
                   "testo": testo_out or ("Allerta " + liv + " in corso"),
                   "validita": "", "link": LINK}

    out["aggiornato"] = datetime.datetime.now().isoformat(timespec="minutes")
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("scritto", OUT, out)


if __name__ == "__main__":
    main()
