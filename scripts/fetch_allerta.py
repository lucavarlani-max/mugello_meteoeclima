#!/usr/bin/env python3
"""
Aggiorna data/allerta.json dal Bollettino di Valutazione delle Criticità del
Centro Funzionale Regione Toscana (CFR).

Fonte (PDF): https://www.cfr.toscana.it/bollettini/pdf_12.php?print=true&light=true
Nella sezione "DESCRIZIONE DELLE CRITICITÀ PREVISTE" il PDF riporta "NESSUNA"
oppure una tabella ZONE DI ALLERTA / RISCHIO / TEMPI / CRITICITA'. Lo script
legge la tabella e tiene solo le righe che contengono la zona M (Mugello-Val
di Sieve): livello = il massimo fra quelle righe, "verde" se M non compare.

La tabella viene letta dalle celle del PDF (pdfplumber.extract_tables) e, se
non disponibili, dal testo. Attenzione: nel testo estratto le colonne sono
separate da UN solo spazio e le celle vanno a capo, es.

    A1, A2, A3, A4, A5 TEMPORALI FORTI CON dalle ore 09.00 Giovedì, 12 GIALLO
    A6, C, E1, E2, E3 RISCHIO IDROGEOLOGIC Novembre 2026
    F1, F2, I, M, O1 O-IDRAULICO RETICOLO alle ore 23.59 Giovedì, 12
    O2, O3, R2, S3, T MINORE Novembre 2026

Se c'è una criticità ma la tabella non è leggibile, NON si ripiega sul livello
massimo regionale: il banner segnala un'allerta in Toscana e rimanda al
bollettino (livello "avviso").
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
# codici delle zone di allerta della Toscana
_COD = r"(?:A[1-6]|E[1-3]|F[12]|O[1-3]|R[12]|S[1-3]|[BCILMTV])"
# elenco zone a inizio riga: "F1, F2, I, M, O1" (virgola finale facoltativa)
ZONE_INIZIO = re.compile(r"^(%s(?:\s*,\s*%s)*)\s*,?(?=\s|$)" % (_COD, _COD))
LIV_FINE = re.compile(r"(?:^|\s)(GIALLO|ARANCIONE|ROSSO)$")
LIV_PAROLA = re.compile(r"\b(?:GIALLO|ARANCIONE|ROSSO)\b")


def _pulisci(s):
    s = re.sub(r"\s+", " ", s).strip()
    # parola spezzata dall'a capo nella cella: "IDROGEOLOGIC / O-IDRAULICO"
    return re.sub(r"\bIDROGEOLOGIC O\b", "IDROGEOLOGICO", s)


def _riga(zone, rischio, tempi, livello):
    return {"zone": set(re.findall(_COD, zone)), "rischio": _pulisci(rischio),
            "tempi": _pulisci(tempi), "livello": livello}


def _valide(righe):
    """Tutte le righe devono essere complete, altrimenti il formato non è riconosciuto."""
    if righe and all(r["zone"] and r["livello"] and r["tempi"] for r in righe):
        return righe
    return []


def righe_da_tabelle(tabelle):
    """Righe dalla tabella a celle (pdfplumber.extract_tables):
    [[zone, rischio, tempi, criticità], ...] preceduta dall'intestazione."""
    righe = []
    for tab in tabelle or []:
        if not tab or not tab[0] or len(tab[0]) != 4:
            continue
        h = _noacc(" ".join(c or "" for c in tab[0])).upper()
        if "ZONE DI ALLERTA" not in h or "RISCHIO" not in h:
            continue
        for r in tab[1:]:
            if len(r) != 4:
                return []
            z, ris, tem, liv = [(c or "") for c in r]
            liv = LIV.get(_noacc(liv).strip().upper(), "")
            if not liv:
                return []
            righe.append(_riga(z, ris, tem, liv))
    return _valide(righe)


def estrai_righe(testo):
    """Legge dal testo la tabella ZONE DI ALLERTA / RISCHIO / TEMPI / CRITICITA'.
    Restituisce [{zone:set, rischio:str, tempi:str, livello:str}]; lista vuota
    se il formato non è riconosciuto.

    Non si fa affidamento sugli spazi fra le colonne (nel testo del PDF è uno
    solo). Una riga della tabella comincia con l'elenco zone e finisce con il
    livello; le righe di testo seguenti ne continuano le celle: l'eventuale
    elenco zone iniziale va alle zone, le parole tutte maiuscole al rischio,
    il resto ("alle ore 23.59 Giovedì, 12", "Novembre 2026") ai tempi."""
    righe, cur, in_tab, n_liv = [], None, False, 0
    for ln in testo.splitlines():
        ln = ln.strip()
        u = _noacc(ln).upper()
        if "ZONE DI ALLERTA" in u and "RISCHIO" in u:
            in_tab = True
            continue
        if not in_tab or not ln:
            continue
        if "DESCRIZIONE DEGLI SCENARI" in u:
            break
        if re.fullmatch(r"\d+\s*/\s*\d+", ln):      # numero di pagina
            continue
        n_liv += len(LIV_PAROLA.findall(u))
        mz = ZONE_INIZIO.match(ln)
        ml = LIV_FINE.search(u)
        if mz and ml:                                # prima riga di una nuova voce
            cur = {"zone": "", "rischio": [], "tempi": [], "livello": LIV[ml.group(1)]}
            righe.append(cur)
            ln = ln[:ml.start()]
        if cur is None:
            return []
        if mz:
            cur["zone"] += " " + mz.group(1)
            ln = ln[mz.end():]
        parole = ln.split()
        k = 0
        while k < len(parole) and not re.search(r"[a-z0-9]", _noacc(parole[k])):
            k += 1
        cur["rischio"] += parole[:k]
        cur["tempi"] += parole[k:]
    if n_liv != len(righe):                          # un livello per voce, non di più
        return []
    # due inizi di validità nella stessa voce = due voci fuse (livello non trovato
    # sulla prima riga di una delle due): formato non riconosciuto
    if any(len(re.findall(r"(?i)\bdalle ore\b|\bin corso\b", " ".join(r["tempi"]))) > 1 for r in righe):
        return []
    return _valide([_riga(r["zone"], " ".join(r["rischio"]), " ".join(r["tempi"]), r["livello"])
                    for r in righe])


def valuta(testo, tabelle=None):
    """Dal testo (e dalle eventuali tabelle a celle) del bollettino ricava
    livello, rischio, validità e testo del banner per la sola zona M."""
    up = _noacc(testo).upper()
    idx = up.find("DESCRIZIONE DELLE CRITICITA")
    fine = up.find("DESCRIZIONE DEGLI SCENARI", max(idx, 0))
    descr = up[max(idx, 0):fine if fine != -1 else len(up)]

    righe = righe_da_tabelle(tabelle) or estrai_righe(testo)
    if righe:
        mug = [r for r in righe if ZONA in r["zone"]]
        if not mug:
            return {"livello": "verde", "rischio": "",
                    "testo": "Nessuna criticità meteo in corso sul Mugello (allerte in altre zone della Toscana)",
                    "validita": "", "link": LINK}
        liv = max((r["livello"] for r in mug), key=ORDINE.index)
        top = [r for r in mug if r["livello"] == liv]      # rischio e validità del livello mostrato
        rischio = ", ".join(dict.fromkeys(r["rischio"].lower() for r in top if r["rischio"]))
        validita = "; ".join(dict.fromkeys(r["tempi"] for r in top))
        return {"livello": liv, "rischio": rischio,
                "testo": "Allerta " + liv + " sul Mugello" + (": " + rischio if rischio else "")
                         + (" — " + validita if validita else ""),
                "validita": validita, "link": LINK}

    if idx != -1 and re.search(r"\bNESSUN", descr) and not LIV_PAROLA.search(descr):
        return {"livello": "verde", "rischio": "",
                "testo": "Nessuna criticità meteo in corso sul Mugello",
                "validita": "", "link": LINK}

    # criticità presente (o bollettino cambiato) ma tabella non leggibile: non si
    # attribuisce al Mugello il livello massimo regionale, si rimanda al bollettino
    print("ATTENZIONE: tabella delle criticità non riconosciuta, livello per la zona "
          + ZONA + " non determinato", file=sys.stderr)
    return {"livello": "avviso", "rischio": "",
            "testo": "Allerta meteo in corso in Toscana: livello per il Mugello non "
                     "determinabile in automatico, consulta il bollettino ufficiale",
            "validita": "", "link": LINK, "non_riconosciuto": True}


def estrai_pdf(pdf_bytes):
    """Restituisce (testo, tabelle) del PDF; tabelle = [] se pdfplumber non c'è."""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            testo = "\n".join((p.extract_text() or "") for p in pdf.pages)
            tabelle = [t for p in pdf.pages for t in p.extract_tables()]
            return testo, tabelle
    except Exception:
        import subprocess, tempfile
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(pdf_bytes); path = f.name
        out = subprocess.run(["pdftotext", "-layout", path, "-"],
                             capture_output=True, text=True)
        return out.stdout, []


def main():
    prev = {}
    try:
        prev = json.load(open(OUT, encoding="utf-8"))
    except Exception:
        pass

    try:
        if len(sys.argv) > 1:                       # PDF locale, per prove
            pdf = open(sys.argv[1], "rb").read()
        else:
            req = urllib.request.Request(PDF, headers={"User-Agent": "mugello-meteo/1.0"})
            pdf = urllib.request.urlopen(req, timeout=45).read()
        testo, tabelle = estrai_pdf(pdf)
        if not testo.strip():
            raise ValueError("testo del PDF vuoto")
    except Exception as e:
        print(f"Bollettino non raggiungibile: {e}", file=sys.stderr)
        json.dump(prev or {"livello": "verde",
                           "testo": "Nessuna criticità meteo in corso sul Mugello",
                           "link": LINK}, open(OUT, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)
        return

    out = valuta(testo, tabelle)
    out["aggiornato"] = datetime.datetime.now().isoformat(timespec="minutes")
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("scritto", OUT, out)


if __name__ == "__main__":
    main()
