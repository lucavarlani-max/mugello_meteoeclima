#!/usr/bin/env python3
"""Cerca e scarica anteprima pubblica e metadati di schede Alinari.

Uso:
    python3 scripts/alinari_scrape.py 268305 268306
    python3 scripts/alinari_scrape.py https://www.alinari.it/item/it/1/268305
    python3 scripts/alinari_scrape.py -f ids.txt -o alinari --delay 2
    python3 scripts/alinari_scrape.py --search "Salaiole"              # elenca i risultati
    python3 scripts/alinari_scrape.py --search "Borgo San Lorenzo" --max 50 --ids-out ids.txt
    python3 scripts/alinari_scrape.py --search "Salaiole" --download   # scarica i risultati

Scarica solo l'anteprima a bassa risoluzione servita pubblicamente
(Image<ID>.jpg) e la scheda metadati. Non tocca l'alta risoluzione,
che richiede login/licenza presso Archivi Alinari.
Host da consentire nell'ambiente: www.alinari.it, d1.momapix.com.
"""
import argparse
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (compatible; mugello-meteoeclima-archive)"
LABELS = {
    "Numero inventario:": "inventario",
    "didascalia (it):": "didascalia",
    "Credito fotografico obbligatorio:": "credito",
    "AVVERTENZA:": "avvertenza",
    "Fotografo:": "fotografo",
    "Data ripresa:": "data_ripresa",
    "Luogo dello ripresa:": "luogo",
    "Referenza fondo / Collezione:": "fondo",
    "Definizione:": "definizione",
    "Materia:": "materia",
    "Tecniche:": "tecniche",
    "Dimensioni:": "dimensioni",
}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def item_id(s):
    m = re.search(r"/item/\w+/\d+/(\d+)", s) or re.fullmatch(r"(\d+)", s.strip())
    if not m:
        raise ValueError(f"ID non riconosciuto: {s}")
    return m.group(1)


def search(keyword, max_results, delay):
    """Cerca per parola chiave; restituisce [(id, didascalia)] (100 per pagina)."""
    q = urllib.parse.quote(keyword)
    found, seen, total, pg = [], set(), None, 1
    while True:
        url = f"https://www.alinari.it/search/it/{pg}/{q}?searchbar={q}"
        page = get(url).decode("utf-8", "ignore")
        if total is None:
            t = re.search(r"trovati\s+([\d.]+)\s+risultat", page)
            total = int(t.group(1).replace(".", "")) if t else 0
            print(f"Risultati trovati: {total}", file=sys.stderr)
        new = 0
        for m in re.finditer(r'class="alinari-item-link" href="[^"]*/item/\w+/\d+/(\d+)[^"]*".*?alt="([^"]*)"', page, re.S):
            if m.group(1) not in seen:
                seen.add(m.group(1))
                found.append((m.group(1), html.unescape(m.group(2))))
                new += 1
        if len(found) >= max_results or len(found) >= total or not new:
            return found[:max_results], total
        pg += 1
        time.sleep(delay)


def parse(page, iid):
    og = re.search(r'property="og:image"\s+content="([^"]+)"', page)
    url = re.search(r'property="og:url"\s+content="([^"]+)"', page)
    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", page, flags=re.S)
    lines = [l.strip() for l in html.unescape(re.sub(r"<[^>]+>", "\n", body)).split("\n") if l.strip()]
    meta = {"id": iid, "url": url.group(1) if url else None, "immagine": og.group(1) if og else None}
    for i, l in enumerate(lines[:-1]):
        if l in LABELS and LABELS[l] not in meta:
            meta[LABELS[l]] = lines[i + 1]
    return meta


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("items", nargs="*", help="ID o URL di schede Alinari")
    ap.add_argument("-f", "--file", help="file con un ID/URL per riga")
    ap.add_argument("-o", "--out", default="alinari", help="cartella di output")
    ap.add_argument("--delay", type=float, default=2.0, help="secondi tra le richieste")
    ap.add_argument("-s", "--search", help="cerca per parola chiave (elenca i risultati)")
    ap.add_argument("--max", type=int, default=20, help="massimo di risultati per la ricerca (default 20)")
    ap.add_argument("--download", action="store_true", help="con --search: scarica anche i risultati")
    ap.add_argument("--ids-out", help="con --search: scrive gli ID trovati in questo file")
    a = ap.parse_args()

    items = list(a.items)
    if a.file:
        for l in Path(a.file).read_text().splitlines():
            l = l.split("#", 1)[0].strip()  # ignora commenti (anche a fine riga)
            if l:
                items.append(l)
    if a.search:
        try:
            res, total = search(a.search, a.max, a.delay)
        except Exception as e:  # noqa: BLE001
            print(f"FAIL ricerca: {e}", file=sys.stderr)
            return 1
        for iid, cap in res:
            print(f"{iid}\t{cap}")
        if total > len(res):
            print(f"... mostrati {len(res)} di {total} (usa --max per averne di piu')", file=sys.stderr)
        if a.ids_out:
            Path(a.ids_out).write_text("".join(f"{i}  # {c}\n" for i, c in res))
        if a.download:
            items += [i for i, _ in res]
        else:
            return 0
        if items:
            time.sleep(a.delay)
    if not items:
        ap.error("indica almeno un ID/URL oppure --search")

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    rc = 0
    for n, it in enumerate(items):
        if n:
            time.sleep(a.delay)
        try:
            iid = item_id(it)
            page = get(f"https://www.alinari.it/item/it/1/{iid}").decode("utf-8", "ignore")
            meta = parse(page, iid)
            if not meta.get("immagine"):
                raise RuntimeError("immagine non trovata nella scheda")
            name = re.sub(r"[^\w.-]+", "_", meta.get("inventario", iid))
            (out / f"{name}_preview.jpg").write_bytes(get(meta["immagine"]))
            (out / f"{name}_preview.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
            print(f"OK   {iid} -> {out / (name + '_preview.jpg')}")
        except Exception as e:  # noqa: BLE001
            rc = 1
            print(f"FAIL {it}: {e}", file=sys.stderr)
    return rc


if __name__ == "__main__":
    sys.exit(main())
