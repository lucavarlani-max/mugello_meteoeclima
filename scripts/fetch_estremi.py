#!/usr/bin/env python3
"""
Aggiorna data/estremi.json: le 10 temperature più alte, le 10 più basse e le
10 stazioni con più pioggia nel mondo nelle ultime 24 ore, per il ticker
della pagina radar.html. Per le temperature più basse si tiene una sola stazione
dell'Antartide (la più fredda): le altre nove sono dal resto del mondo. Ogni
stazione ha il codice ISO del paese ("iso") per la bandierina.

Fonte: OGIMET (www.ogimet.com), ranking mondiale calcolato dai bollettini
SYNOP delle stazioni sinottiche di tutto il mondo:
  http://www.ogimet.com/cgi-bin/gsynext?state=World&rank=10&ano=..&mes=..&day=..&hora=..
La pagina somma temperatura massima/minima e pioggia nelle 24 ore precedenti
l'ora scelta (UTC). Si usa l'ora UTC corrente meno qualche ora di margine,
perché i bollettini di tutto il mondo impiegano un po' a essere raccolti;
se la pagina risulta comunque scarsa (poche stazioni) si riprova con ore
precedenti.

Nessuna chiave richiesta: pagina pubblica, ma il server rifiuta le richieste
senza uno User-Agent "da browser" e un Referer dello stesso sito.
"""
import re, json, os, sys, html, datetime, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "estremi.json")
URL = "http://www.ogimet.com/cgi-bin/gsynext"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Referer": "http://www.ogimet.com/ranking.phtml",
}
RANK = 10
RANK_RICHIESTA = 60          # si chiede una classifica più lunga per poter scartare le stazioni antartiche
MAX_ANTARTIDE = 1            # temperature più basse: al massimo una stazione dell'Antartide, le altre dal resto del mondo
MIN_STAZIONI = 500          # sotto questa soglia l'ora è considerata troppo recente/incompleta
TENTATIVI_ORE = [2, 4, 7, 12, 24]   # ore di margine da provare, in ordine

# Paesi OGIMET (nomi ufficiali/inglesi) -> italiano. Quelli non in elenco restano
# in inglese (meglio un nome non tradotto che uno sbagliato).
PAESI_IT = {
    "United States": "Stati Uniti", "United States of America": "Stati Uniti",
    "United Kingdom": "Regno Unito", "United Arab Emirates": "Emirati Arabi Uniti",
    "Saudi Arabia": "Arabia Saudita", "Bolivia, Plurinational State of": "Bolivia",
    "Venezuela, Bolivarian Republic of": "Venezuela", "Iran, Islamic Republic of": "Iran",
    "Korea, Republic of": "Corea del Sud", "Korea, Democratic People's Republic of": "Corea del Nord",
    "Tanzania, United Republic of": "Tanzania", "Moldova, Republic of": "Moldavia",
    "Congo, Democratic Republic of the": "Repubblica Democratica del Congo", "Congo": "Congo",
    "Lao People's Democratic Republic": "Laos", "Syrian Arab Republic": "Siria",
    "Russian Federation": "Russia", "Viet Nam": "Vietnam", "Brunei Darussalam": "Brunei",
    "Micronesia, Federated States of": "Micronesia", "Taiwan, Province of China": "Taiwan",
    "Czechia": "Repubblica Ceca", "North Macedonia": "Macedonia del Nord",
    "Bosnia and Herzegovina": "Bosnia ed Erzegovina", "Saint Vincent and the Grenadines": "Saint Vincent e Grenadine",
    "Trinidad and Tobago": "Trinidad e Tobago", "Antigua and Barbuda": "Antigua e Barbuda",
    "Papua New Guinea": "Papua Nuova Guinea", "New Zealand": "Nuova Zelanda",
    "South Africa": "Sudafrica", "South Sudan": "Sudan del Sud", "Sri Lanka": "Sri Lanka",
    "Sao Tome and Principe": "São Tomé e Príncipe", "Dominican Republic": "Repubblica Dominicana",
    "Costa Rica": "Costa Rica", "Puerto Rico": "Portorico", "Ivory Coast": "Costa d'Avorio",
    "Cote d'Ivoire": "Costa d'Avorio", "Burkina Faso": "Burkina Faso",
    "Equatorial Guinea": "Guinea Equatoriale", "Guinea-Bissau": "Guinea-Bissau",
    "Central African Republic": "Repubblica Centrafricana", "Western Sahara": "Sahara Occidentale",
    "Cabo Verde": "Capo Verde", "Cape Verde": "Capo Verde",
    "French Polynesia": "Polinesia Francese", "French Guiana": "Guyana Francese",
    "New Caledonia": "Nuova Caledonia", "Solomon Islands": "Isole Salomone",
    "Marshall Islands": "Isole Marshall", "Faroe Islands": "Isole Fær Øer",
    "Cayman Islands": "Isole Cayman", "Virgin Islands": "Isole Vergini",
    "Turks and Caicos Islands": "Turks e Caicos", "Falkland Islands (Malvinas)": "Isole Falkland",
    "Greenland": "Groenlandia", "Iceland": "Islanda", "Ireland": "Irlanda",
    "Netherlands": "Paesi Bassi", "Germany": "Germania", "Switzerland": "Svizzera",
    "Austria": "Austria", "Belgium": "Belgio", "France": "Francia", "Spain": "Spagna",
    "Portugal": "Portogallo", "Italy": "Italia", "Greece": "Grecia", "Poland": "Polonia",
    "Sweden": "Svezia", "Norway": "Norvegia", "Finland": "Finlandia", "Denmark": "Danimarca",
    "Estonia": "Estonia", "Latvia": "Lettonia", "Lithuania": "Lituania", "Belarus": "Bielorussia",
    "Ukraine": "Ucraina", "Romania": "Romania", "Bulgaria": "Bulgaria", "Hungary": "Ungheria",
    "Slovakia": "Slovacchia", "Slovenia": "Slovenia", "Croatia": "Croazia", "Serbia": "Serbia",
    "Montenegro": "Montenegro", "Albania": "Albania", "Turkey": "Turchia", "Cyprus": "Cipro",
    "Malta": "Malta", "Luxembourg": "Lussemburgo", "Georgia": "Georgia", "Armenia": "Armenia",
    "Azerbaijan": "Azerbaigian", "Kazakhstan": "Kazakistan", "Uzbekistan": "Uzbekistan",
    "Turkmenistan": "Turkmenistan", "Kyrgyzstan": "Kirghizistan", "Tajikistan": "Tagikistan",
    "Mongolia": "Mongolia", "China": "Cina", "Japan": "Giappone", "India": "India",
    "Pakistan": "Pakistan", "Bangladesh": "Bangladesh", "Nepal": "Nepal", "Bhutan": "Bhutan",
    "Myanmar": "Myanmar", "Thailand": "Thailandia", "Cambodia": "Cambogia",
    "Malaysia": "Malesia", "Singapore": "Singapore", "Indonesia": "Indonesia",
    "Philippines": "Filippine", "Fiji": "Figi", "Australia": "Australia",
    "Canada": "Canada", "Mexico": "Messico", "Cuba": "Cuba", "Jamaica": "Giamaica",
    "Haiti": "Haiti", "Panama": "Panama", "Nicaragua": "Nicaragua", "Honduras": "Honduras",
    "Guatemala": "Guatemala", "Belize": "Belize", "El Salvador": "El Salvador",
    "Colombia": "Colombia", "Ecuador": "Ecuador", "Peru": "Perù", "Chile": "Cile",
    "Argentina": "Argentina", "Paraguay": "Paraguay", "Uruguay": "Uruguay",
    "Brazil": "Brasile", "Guyana": "Guyana", "Suriname": "Suriname",
    "Egypt": "Egitto", "Libya": "Libia", "Tunisia": "Tunisia", "Algeria": "Algeria",
    "Morocco": "Marocco", "Sudan": "Sudan", "Ethiopia": "Etiopia", "Eritrea": "Eritrea",
    "Djibouti": "Gibuti", "Somalia": "Somalia", "Kenya": "Kenya", "Uganda": "Uganda",
    "Rwanda": "Ruanda", "Burundi": "Burundi", "Nigeria": "Nigeria", "Niger": "Niger",
    "Chad": "Ciad", "Mali": "Mali", "Mauritania": "Mauritania", "Senegal": "Senegal",
    "Gambia": "Gambia", "Guinea": "Guinea", "Sierra Leone": "Sierra Leone",
    "Liberia": "Liberia", "Ghana": "Ghana", "Togo": "Togo", "Benin": "Benin",
    "Cameroon": "Camerun", "Gabon": "Gabon", "Angola": "Angola", "Zambia": "Zambia",
    "Zimbabwe": "Zimbabwe", "Botswana": "Botswana", "Namibia": "Namibia",
    "Mozambique": "Mozambico", "Malawi": "Malawi", "Madagascar": "Madagascar",
    "Mauritius": "Mauritius", "Seychelles": "Seychelles", "Comoros": "Comore",
    "Eswatini": "Eswatini", "Lesotho": "Lesotho", "Yemen": "Yemen", "Oman": "Oman",
    "Qatar": "Qatar", "Bahrain": "Bahrein", "Kuwait": "Kuwait", "Jordan": "Giordania",
    "Lebanon": "Libano", "Israel": "Israele", "Palestine": "Palestina", "Iraq": "Iraq",
    "Afghanistan": "Afghanistan", "Antarctica": "Antartide",
}

# Paesi OGIMET -> codice ISO 3166-1 alpha-2, per la bandierina nel ticker.
PAESI_ISO = {
    "United States": "us", "United States of America": "us", "United Kingdom": "gb",
    "United Arab Emirates": "ae", "Saudi Arabia": "sa", "Bolivia, Plurinational State of": "bo", "Bolivia": "bo",
    "Venezuela, Bolivarian Republic of": "ve", "Venezuela": "ve", "Iran, Islamic Republic of": "ir", "Iran": "ir",
    "Korea, Republic of": "kr", "Korea, Democratic People's Republic of": "kp",
    "Tanzania, United Republic of": "tz", "Tanzania": "tz", "Moldova, Republic of": "md", "Moldova": "md",
    "Congo, Democratic Republic of the": "cd", "Congo": "cg", "Lao People's Democratic Republic": "la",
    "Syrian Arab Republic": "sy", "Syria": "sy", "Russian Federation": "ru", "Russia": "ru", "Viet Nam": "vn", "Vietnam": "vn",
    "Brunei Darussalam": "bn", "Micronesia, Federated States of": "fm", "Taiwan, Province of China": "tw", "Taiwan": "tw",
    "Czechia": "cz", "Czech Republic": "cz", "North Macedonia": "mk", "Bosnia and Herzegovina": "ba",
    "Saint Vincent and the Grenadines": "vc", "Trinidad and Tobago": "tt", "Antigua and Barbuda": "ag",
    "Papua New Guinea": "pg", "New Zealand": "nz", "South Africa": "za", "South Sudan": "ss", "Sri Lanka": "lk",
    "Sao Tome and Principe": "st", "Dominican Republic": "do", "Costa Rica": "cr", "Puerto Rico": "pr",
    "Ivory Coast": "ci", "Cote d'Ivoire": "ci", "Burkina Faso": "bf", "Equatorial Guinea": "gq",
    "Guinea-Bissau": "gw", "Central African Republic": "cf", "Western Sahara": "eh", "Cabo Verde": "cv",
    "Cape Verde": "cv", "French Polynesia": "pf", "French Guiana": "gf", "New Caledonia": "nc",
    "Solomon Islands": "sb", "Marshall Islands": "mh", "Faroe Islands": "fo", "Cayman Islands": "ky",
    "Turks and Caicos Islands": "tc", "Falkland Islands (Malvinas)": "fk", "Falkland Islands": "fk",
    "Greenland": "gl", "Iceland": "is", "Ireland": "ie", "Netherlands": "nl", "Germany": "de",
    "Switzerland": "ch", "Austria": "at", "Belgium": "be", "France": "fr", "Spain": "es", "Portugal": "pt",
    "Italy": "it", "Greece": "gr", "Poland": "pl", "Sweden": "se", "Norway": "no", "Finland": "fi",
    "Denmark": "dk", "Estonia": "ee", "Latvia": "lv", "Lithuania": "lt", "Belarus": "by", "Ukraine": "ua",
    "Romania": "ro", "Bulgaria": "bg", "Hungary": "hu", "Slovakia": "sk", "Slovenia": "si", "Croatia": "hr",
    "Serbia": "rs", "Montenegro": "me", "Albania": "al", "Turkey": "tr", "Turkiye": "tr", "Cyprus": "cy",
    "Malta": "mt", "Luxembourg": "lu", "Georgia": "ge", "Armenia": "am", "Azerbaijan": "az",
    "Kazakhstan": "kz", "Uzbekistan": "uz", "Turkmenistan": "tm", "Kyrgyzstan": "kg", "Tajikistan": "tj",
    "Mongolia": "mn", "China": "cn", "Hong Kong": "hk", "Macao": "mo", "Japan": "jp", "India": "in",
    "Pakistan": "pk", "Bangladesh": "bd", "Nepal": "np", "Bhutan": "bt", "Myanmar": "mm", "Thailand": "th",
    "Cambodia": "kh", "Malaysia": "my", "Singapore": "sg", "Indonesia": "id", "Philippines": "ph",
    "Fiji": "fj", "Australia": "au", "Canada": "ca", "Mexico": "mx", "Cuba": "cu", "Jamaica": "jm",
    "Haiti": "ht", "Panama": "pa", "Nicaragua": "ni", "Honduras": "hn", "Guatemala": "gt", "Belize": "bz",
    "El Salvador": "sv", "Colombia": "co", "Ecuador": "ec", "Peru": "pe", "Chile": "cl", "Argentina": "ar",
    "Paraguay": "py", "Uruguay": "uy", "Brazil": "br", "Guyana": "gy", "Suriname": "sr", "Egypt": "eg",
    "Libya": "ly", "Tunisia": "tn", "Algeria": "dz", "Morocco": "ma", "Sudan": "sd", "Ethiopia": "et",
    "Eritrea": "er", "Djibouti": "dj", "Somalia": "so", "Kenya": "ke", "Uganda": "ug", "Rwanda": "rw",
    "Burundi": "bi", "Nigeria": "ng", "Niger": "ne", "Chad": "td", "Mali": "ml", "Mauritania": "mr",
    "Senegal": "sn", "Gambia": "gm", "Guinea": "gn", "Sierra Leone": "sl", "Liberia": "lr", "Ghana": "gh",
    "Togo": "tg", "Benin": "bj", "Cameroon": "cm", "Gabon": "ga", "Angola": "ao", "Zambia": "zm",
    "Zimbabwe": "zw", "Botswana": "bw", "Namibia": "na", "Mozambique": "mz", "Malawi": "mw",
    "Madagascar": "mg", "Mauritius": "mu", "Seychelles": "sc", "Comoros": "km", "Eswatini": "sz",
    "Swaziland": "sz", "Lesotho": "ls", "Yemen": "ye", "Oman": "om", "Qatar": "qa", "Bahrain": "bh",
    "Kuwait": "kw", "Jordan": "jo", "Lebanon": "lb", "Israel": "il", "Palestine": "ps", "Iraq": "iq",
    "Afghanistan": "af", "Antarctica": "aq", "Svalbard and Jan Mayen": "sj", "Reunion": "re",
    "Martinique": "mq", "Guadeloupe": "gp", "Bermuda": "bm", "Bahamas": "bs", "Barbados": "bb",
}


def _get(url, timeout=40):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def paese_it(nome):
    nome = nome.strip()
    return PAESI_IT.get(nome, nome)


ROW_RE = re.compile(
    r'<Td><a href="[^"]*">(?P<label>[^<]+)</a></td>\s*'
    r'<td[^>]*><font[^>]*><b>(?P<val>-?[\d.]+)\s*(?:&#176;C|mm)</b>',
    re.I,
)
LABEL_RE = re.compile(r'^(?P<staz>.*)\s\((?P<paese>[^()]*)\)\s*$')


def parse_sezione(pagina, ancora, n=RANK):
    m = re.search(r'<a name="' + re.escape(ancora) + r'">', pagina, re.I)
    if not m:
        return []
    fine = pagina.find("</table>", m.end())
    blocco = pagina[m.end():fine if fine != -1 else m.end() + 20000]
    out = []
    for rm in ROW_RE.finditer(blocco):
        label = html.unescape(rm.group("label")).strip()
        lm = LABEL_RE.match(label)
        if lm:
            en = lm.group("paese").strip()
            staz, paese, iso = lm.group("staz").strip(), paese_it(en), PAESI_ISO.get(en, "")
        else:
            staz, paese, iso = label, "", ""
        try:
            v = float(rm.group("val"))
        except ValueError:
            continue
        out.append({"staz": staz, "paese": paese, "iso": iso, "v": v})
        if len(out) >= n:
            break
    return out


def limita_antartide(righe, n=RANK):
    """Tiene al massimo MAX_ANTARTIDE stazioni antartiche (le più fredde) e completa con il resto del mondo."""
    out, ant = [], 0
    for r in righe:
        if r["iso"] == "aq" or r["paese"] == "Antartide":
            if ant >= MAX_ANTARTIDE:
                continue
            ant += 1
        out.append(r)
        if len(out) >= n:
            break
    return out


def scarica_ranking(ora_utc):
    url = (f"{URL}?lang=en&state=World&rank={RANK_RICHIESTA}"
           f"&ano={ora_utc.year}&mes={ora_utc.month:02d}&day={ora_utc.day:02d}&hora={ora_utc.hour:02d}")
    pagina = _get(url)
    caldo = parse_sezione(pagina, "tmax")
    freddo = limita_antartide(parse_sezione(pagina, "tmin", RANK_RICHIESTA))
    pioggia = parse_sezione(pagina, "R24")
    return caldo, freddo, pioggia, ora_utc


def main():
    ora_base = datetime.datetime.now(datetime.timezone.utc).replace(minute=0, second=0, microsecond=0)
    risultato = None
    for margine in TENTATIVI_ORE:
        ora = ora_base - datetime.timedelta(hours=margine)
        try:
            caldo, freddo, pioggia, usata = scarica_ranking(ora)
        except Exception as e:
            print(f"OGIMET non raggiungibile per le {ora.isoformat()}: {e}", file=sys.stderr)
            continue
        if len(caldo) >= 5 and len(freddo) >= 5 and len(pioggia) >= 5:
            risultato = (caldo, freddo, pioggia, usata)
            break
        print(f"dati scarsi per le {ora.isoformat()} UTC (caldo={len(caldo)} freddo={len(freddo)} "
              f"pioggia={len(pioggia)}), provo un'ora più indietro", file=sys.stderr)

    if risultato is None:
        print("OGIMET non ha dato risultati utilizzabili: data/estremi.json non modificato", file=sys.stderr)
        sys.exit(0 if os.path.exists(OUT) else 1)

    caldo, freddo, pioggia, usata = risultato
    out = {
        "aggiornato": usata.isoformat().replace("+00:00", "Z"),
        "caldo": caldo,
        "freddo": freddo,
        "pioggia": pioggia,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("scritto", OUT, "· 24h fino alle", out["aggiornato"],
          f"· {len(caldo)} caldo, {len(freddo)} freddo, {len(pioggia)} pioggia")


if __name__ == "__main__":
    main()
