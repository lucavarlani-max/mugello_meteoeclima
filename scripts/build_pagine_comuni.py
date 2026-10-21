#!/usr/bin/env python3
"""Genera le pagine statiche meteo-<comune>.html (una per comune del Mugello) da comune.html.

Ogni pagina ha titolo, descrizione, canonical, dati strutturati e testo propri, e contiene già
nel codice HTML i 7 giorni di previsione (da data/previsioni.json), così i motori di ricerca
vedono il contenuto anche senza JavaScript. Al caricamento lo script della pagina aggiorna
tutto dal vivo, come in comune.html.

Uso: python scripts/build_pagine_comuni.py   (dalla radice del repository o da qualunque cartella)
"""
import html, json, os, re
from datetime import date

BASE = "https://lucavarlani-max.github.io/mugello_meteoeclima/"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
os.chdir(ROOT)

# slug, nome, testo introduttivo (fatti stabili; il resto della pagina è dinamico)
COMUNI = [
    ("firenzuola", "Firenzuola",
     "Firenzuola è il comune più a nord del Mugello, sul crinale dell'Appennino tosco-emiliano, "
     "vicino ai passi della Futa e del Giogo. Qui il tempo cambia in fretta: in inverno è fra i luoghi "
     "dove la neve arriva per prima e dove le gelate sono più frequenti."),
    ("palazzuolo-sul-senio", "Palazzuolo sul Senio",
     "Palazzuolo sul Senio si trova nell'alta valle del Senio, tra boschi e crinali, nella parte "
     "nord-orientale del Mugello. Le valli strette e la quota rendono le temperature più fresche che "
     "nel fondovalle e facilitano nebbie e inversioni termiche."),
    ("marradi", "Marradi",
     "Marradi sorge lungo il torrente Lamone, sul versante romagnolo dell'Appennino. Chiusa fra versanti "
     "ripidi, la valle è esposta a rovesci intensi quando le correnti umide risalgono dalla Romagna."),
    ("barberino-di-mugello", "Barberino di Mugello",
     "Barberino di Mugello è la porta sud-occidentale della vallata e si affaccia sul lago di Bilancino, "
     "il grande invaso sulla Sieve. Il lago favorisce la nebbia all'alba nelle mattine tranquille e l'umidità "
     "elevata in autunno."),
    ("scarperia-e-san-piero", "Scarperia e San Piero",
     "Scarperia e San Piero è il comune dell'Autodromo del Mugello, dove il meteo conta per i weekend di gara, "
     "e dell'antica tradizione dei coltelli. Le previsioni qui servono a chi segue il circuito, "
     "i motociclisti e chi pianifica una giornata nella vallata."),
    ("san-piero-a-sieve", "San Piero a Sieve",
     "San Piero a Sieve è nel fondovalle della Sieve, ai piedi della Fortezza di San Martino. "
     "Come gli altri paesi del fondovalle, in autunno e inverno ha notti più fredde e una maggiore "
     "frequenza di nebbia rispetto ai rilievi circostanti."),
    ("borgo-san-lorenzo", "Borgo San Lorenzo",
     "Borgo San Lorenzo è il centro più popoloso del Mugello e il suo punto di riferimento. Ha una delle "
     "serie meteorologiche più lunghe della vallata: su questo sito trovi anche il clima storico di Borgo "
     "con temperature e piogge misurate negli ultimi decenni."),
    ("vicchio", "Vicchio",
     "Vicchio si trova nella media valle della Sieve, nella terra che ha dato i natali a Giotto e al Beato "
     "Angelico. È una zona di colline e vigneti dove nebbie e brinate sono frequenti nelle notti limpide "
     "d'autunno e d'inverno."),
    ("dicomano", "Dicomano",
     "Dicomano è alla confluenza fra la Sieve e il torrente Comano, nella parte più orientale e più bassa "
     "del Mugello. Le temperature sono spesso un po' più miti rispetto ai paesi dell'alta valle, "
     "con estati calde e afose."),
]

SRC = open("comune.html", encoding="utf-8").read()
prev = json.load(open("data/previsioni.json", encoding="utf-8"))

# codici meteo -> (icona, descrizione), presi da comune.html
WM = {int(c): (i, d) for c, i, d in re.findall(r"(\d+):\['([^']*)','([^']*)'\]", SRC)}
DOW = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"]
esc = html.escape

# dati dei comuni (nome, quota, zona, wiki) letti dall'array COMUNI di comune.html
J = re.search(r"const COMUNI=\[(.*?)\n  \];", SRC, re.S).group(1)
ANAG = re.findall(r'n:"([^"]+)",\s*lat:([\d.]+),lon:([\d.]+),elev:(\d+),zona:"([^"]+)"', J)
assert len(ANAG) == len(COMUNI) == 9, "elenco comuni non allineato a comune.html"


def mm_txt(v):
    if v is None or v < 0.1:
        return ""
    return (f"{v:.1f}".replace(".", ",") if v < 10 else str(round(v))) + " mm"


def giorni_html(giorni):
    out = []
    for i, d in enumerate(giorni[:7]):
        y, m, dd = map(int, d["iso"].split("-"))
        wd = date(y, m, dd).isoweekday() % 7
        ico, desc = WM.get(d["code"], ("⛅", "—"))
        mm = mm_txt(d.get("mm"))
        out.append(
            '<div class="day"><div class="dow">' + ("Oggi" if i == 0 else DOW[wd]) + "</div>"
            f'<div class="di">{ico}</div><div class="dd">{esc(desc)} · {dd}/{m}</div>'
            f'<div class="pp">💧 {d.get("pp") or 0}%' + (f"<small>{mm}</small>" if mm else "") + "</div>"
            f'<div class="tp">{round(d["tmax"])}°<s>{round(d["tmin"])}°</s></div></div>')
    return "".join(out)


def riepilogo(nome, giorni):
    """Frase di sintesi sui prossimi giorni, generata dai dati."""
    g = giorni[:7]
    if not g:
        return ""
    tmax = max(d["tmax"] for d in g)
    tmin = min(d["tmin"] for d in g)
    piovosi = [d for d in g if (d.get("pp") or 0) >= 50 or (d.get("mm") or 0) >= 1]
    if piovosi:
        y, m, dd = map(int, piovosi[0]["iso"].split("-"))
        p = f"possibile pioggia a partire da {DOW[date(y, m, dd).isoweekday() % 7].lower()} {dd}/{m}"
        if len(piovosi) > 1:
            p = f"{len(piovosi)} giorni con pioggia probabile (la prima {DOW[date(y, m, dd).isoweekday() % 7].lower()} {dd}/{m})"
    else:
        p = "nessuna pioggia significativa prevista"
    return (f"Nei prossimi 7 giorni a {nome} le temperature massime arrivano fino a {round(tmax)}° e le minime "
            f"scendono fino a {round(tmin)}°; {p}.")


def jsonld(slug, nome, quota, lat, lon, desc):
    url = BASE + f"meteo-{slug}.html"
    return json.dumps({"@context": "https://schema.org", "@graph": [
        {"@type": "WebPage", "@id": url, "url": url, "name": f"Meteo {nome}", "description": desc,
         "inLanguage": "it-IT", "isPartOf": {"@id": BASE + "#website"},
         "about": {"@type": "Place", "name": nome,
                   "address": {"@type": "PostalAddress", "addressLocality": nome,
                               "addressRegion": "Toscana", "addressCountry": "IT"},
                   "geo": {"@type": "GeoCoordinates", "latitude": float(lat), "longitude": float(lon),
                           "elevation": int(quota)}},
         "primaryImageOfPage": BASE + "og-image.jpg",
         "breadcrumb": {"@id": url + "#breadcrumb"}},
        {"@type": "BreadcrumbList", "@id": url + "#breadcrumb", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Mugello Meteo & Clima", "item": BASE},
            {"@type": "ListItem", "position": 2, "name": f"Meteo {nome}", "item": url}]},
    ]}, ensure_ascii=False, separators=(",", ":"))


def sub(pattern, repl, s, count=1, flags=0):
    s2, n = re.subn(pattern, lambda m: repl, s, count=count, flags=flags)
    assert n >= 1, f"pattern non trovato: {pattern[:50]}"
    return s2


def build(idx):
    slug, nome, intro = COMUNI[idx]
    an = ANAG[idx]
    assert an[0] == nome, (an[0], nome)
    _, lat, lon, quota, zona = an
    url = BASE + f"meteo-{slug}.html"
    title = f"Meteo {nome}: previsioni oggi, domani e 7 giorni | Mugello Meteo"
    desc = (f"Previsioni meteo a {nome} ({quota} m, Mugello): temperatura e pioggia ora per ora, "
            f"prossimi 7 giorni, radar delle precipitazioni e dati in tempo reale.")
    rec = prev["comuni"][idx]
    assert rec["n"] == nome, (rec["n"], nome)
    giorni = rec.get("giorni") or []

    s = SRC
    s = sub(r"<title>.*?</title>", f"<title>{esc(title)}</title>", s)
    s = sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{esc(desc)}">', s)
    s = sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url}">', s)
    s = sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{url}">', s)
    s = sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{esc(title)}">', s)
    s = sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{esc(desc)}">', s)
    s = sub(r'<link rel="manifest"', '<script type="application/ld+json">' + jsonld(slug, nome, quota, lat, lon, desc)
            + '</script>\n<link rel="manifest"', s)

    # testi fissi nel codice: titolo, sottotitolo, 7 giorni
    s = sub(r'<h1 id="nome">—</h1>', f'<h1 id="nome">Meteo {esc(nome)}</h1>', s)
    s = sub(r'<div class="meta" id="meta">—</div>',
            f'<div class="meta" id="meta">{quota} m s.l.m. · {esc(zona)} · Mugello</div>', s)
    s = sub(r'<div class="days" id="days"></div>', f'<div class="days" id="days">{giorni_html(giorni)}</div>', s)

    # il comune è fisso: niente parametro ?c=
    s = sub(r"const params=new URLSearchParams\(location\.search\);\n.*?\n.*?\n  const C=COMUNI\[ci\];",
            f"const ci={idx};\n  const C=COMUNI[ci];", s, flags=re.S)
    # il titolo scritto da JS deve restare quello della pagina
    s = sub(r"document\.title=C\.n\+' · Previsioni · Mugello Meteo & Clima';\n  set\('nome',C\.n\);",
            "", s)

    # sezione di testo + altri comuni, prima della nota finale
    altri = "".join(
        f'<a href="meteo-{sl}.html">{esc(n)}</a>' for j, (sl, n, _) in enumerate(COMUNI) if j != idx)
    blocco = f"""    <section>
      <div class="sh"><h2>Il meteo a {esc(nome)}</h2></div>
      <div class="card seo">
        <p>{esc(intro)}</p>
        <p>{esc(riepilogo(nome, giorni))}</p>
        <p>Le previsioni giornaliere sono del modello AI WeatherNext 3 di Google, il dettaglio orario è di Open-Meteo.
        Per i livelli dei fiumi, le allerte e il radar di tutta la vallata vai alla pagina
        <a href="radar.html">Radar &amp; dati</a>; per il clima storico guarda l'<a href="archivio-climatico.html">archivio climatico</a>.</p>
      </div>
    </section>

    <section>
      <div class="sh"><h2>Meteo negli altri comuni del Mugello</h2></div>
      <nav class="card altri" aria-label="Altri comuni">{altri}</nav>
    </section>

"""
    s = sub(r'    <p class="note" id="note">', blocco + '    <p class="note" id="note">', s)
    s = sub(r"</style>\n<script src=\"analytics.js\"",
            "  .seo p{margin:0 0 12px;line-height:1.6;color:var(--ink-soft)} .seo p:last-child{margin:0}\n"
            "  .seo a{color:var(--pine);font-weight:600}\n"
            "  .altri{display:flex;flex-wrap:wrap;gap:8px 10px}\n"
            "  .altri a{padding:7px 13px;border:1px solid var(--line);border-radius:var(--r-pill);color:var(--pine);"
            "text-decoration:none;font-size:14px;font-weight:500}\n"
            "  .altri a:hover{background:var(--pine-tint)}\n"
            "</style>\n<script src=\"analytics.js\"", s)
    open(f"meteo-{slug}.html", "w", encoding="utf-8").write(s)
    return slug


if __name__ == "__main__":
    done = [build(i) for i in range(len(COMUNI))]
    print(len(done), "pagine:", ", ".join(f"meteo-{d}.html" for d in done))
