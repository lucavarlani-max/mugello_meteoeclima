#!/usr/bin/env python3
"""
Classificazione rapida del diario della nebbia con le segnalazioni (issue) di GitHub.

  python scripts/nebbia_issue.py apri
      Per ogni mattina con la foto ma ancora da classificare (ultimi 7 giorni) apre, se non c'è già, una segnalazione
      «Nebbia AAAA-MM-GG» con la foto e le misure. GitHub manda la notifica (app o email): basta rispondere
      con un commento «sì», «no» o «?».

  python scripts/nebbia_issue.py classifica
      Lanciato dall'Action nebbia-classifica.yml quando il proprietario del repository commenta o apre una
      segnalazione «Nebbia AAAA-MM-GG». Legge la risposta, scrive "nebbia" in data/nebbia-diario.json,
      risponde e chiude la segnalazione. Variabili: ISSUE_NUMBER, ISSUE_TITLE, TESTO (commento o corpo).

Risposte riconosciute (prima parola, maiuscole e punteggiatura ignorate):
  sì / si / s / nebbia / banchi  → true      no / n / limpido / sereno → false      ? / incerto / boh → "incerto"
Variabili sempre necessarie: GITHUB_TOKEN, GITHUB_REPOSITORY.
"""
import datetime as dt, json, os, re, sys, urllib.request
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIARIO = os.path.join(HERE, "data", "nebbia-diario.json")
ETICHETTA = "diario-nebbia"
RISPOSTE = {True: {"sì", "si", "s", "nebbia", "banchi", "yes", "y"},
            False: {"no", "n", "limpido", "sereno", "niente"},
            "incerto": {"?", "incerto", "boh", "forse", "dubbio"}}
NOMI = {True: "nebbia", False: "limpido", "incerto": "incerto"}


def api(metodo, percorso, dati=None):
    req = urllib.request.Request(
        f"https://api.github.com/repos/{os.environ['GITHUB_REPOSITORY']}{percorso}", method=metodo,
        data=None if dati is None else json.dumps(dati).encode(),
        headers={"Authorization": "Bearer " + os.environ["GITHUB_TOKEN"], "Accept": "application/vnd.github+json",
                 "User-Agent": "mugello-meteo/1.0 (diario della nebbia)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        corpo = r.read()
        return json.loads(corpo) if corpo else None


def leggi():
    return json.load(open(DIARIO, encoding="utf-8"))


def scrivi(D):
    with open(DIARIO, "w", encoding="utf-8") as f:
        json.dump(D, f, ensure_ascii=False, indent=1)


def interpreta(testo):
    t = (testo or "").strip().lower()
    if t.startswith("?"):
        return "incerto"
    parola = re.sub(r"[^\wàèéìòù?]", "", (t.split() or [""])[0])
    for valore, parole in RISPOSTE.items():
        if parola in parole:
            return valore
    return None


def fmt(v, u):
    return "–" if v is None else f"{v}{u}".replace(".", ",")


def apri():
    D = leggi()
    oggi = dt.datetime.now(ZoneInfo("Europe/Rome")).date()
    limite = (oggi - dt.timedelta(days=7)).isoformat()
    aperte = api("GET", f"/issues?state=all&labels={ETICHETTA}&per_page=50") or []
    titoli = {i["title"] for i in aperte}
    try:
        api("POST", "/labels", {"name": ETICHETTA, "color": "8a9ba8", "description": "Diario della nebbia: classificazione delle foto"})
    except Exception:
        pass                                    # esiste già
    ramo = os.environ.get("GITHUB_REF_NAME", "main")
    for d, r in sorted(D.get("giorni", {}).items()):
        titolo = f"Nebbia {d}"
        if d < limite or not r.get("foto") or r.get("nebbia") is not None or titolo in titoli:
            continue
        foto = f"https://raw.githubusercontent.com/{os.environ['GITHUB_REPOSITORY']}/{ramo}/{r['foto']}"
        b2 = (r.get("umidita_max") or {}).get("TOS11000017")
        corpo = (f"**C'era nebbia a Bilancino la mattina del {d}?**\n\n"
                 f"Rispondi con un commento: **sì**, **no** oppure **?** (foto non giudicabile).\n\n"
                 f"![Lago di Bilancino, {d} ore {r.get('ora')}]({foto})\n\n"
                 f"Foto delle {r.get('ora')}" + (f", {r['dopo_alba']} minuti dopo l'alba" if r.get("dopo_alba") is not None else "") +
                 f" · webcam di Bilancino del Filo\n\n"
                 f"| inversione (Monte Giovi − Borgo) | umidità max Borgo 2 | rugiada / scarto alla foto | vento max Borgo 2 |\n|---|---|---|---|\n"
                 f"| {fmt(r.get('inversione'), ' °C')} | {fmt(b2, '%')} | {fmt(r.get('rugiada_ora'), ' °C')} / {fmt(r.get('scarto_ora'), ' °C')} | "
                 f"{fmt((r.get('vento_max') or {}).get('TOS11000017'), ' m/s')} |\n\n"
                 f"_Segnalazione aperta in automatico da `scripts/nebbia_issue.py`. Contano solo le risposte del proprietario del repository._")
        n = api("POST", "/issues", {"title": titolo, "body": corpo, "labels": [ETICHETTA]})["number"]
        print(f"nebbia-issue: aperta la segnalazione #{n} per il {d}")


def classifica():
    numero, titolo, testo = os.environ["ISSUE_NUMBER"], os.environ.get("ISSUE_TITLE", ""), os.environ.get("TESTO", "")
    m = re.search(r"(\d{4}-\d{2}-\d{2})", titolo)
    valore = interpreta(testo)
    if not m or valore is None:
        api("POST", f"/issues/{numero}/comments",
            {"body": "Non ho capito la risposta: scrivi solo **sì**, **no** oppure **?**."})
        print("nebbia-issue: risposta non riconosciuta", repr(testo[:40]))
        return
    d = m.group(1)
    D = leggi()
    giorni = D.setdefault("giorni", {})
    if d not in giorni:
        api("POST", f"/issues/{numero}/comments", {"body": f"Nel diario non c'è la mattina del {d}."})
        return
    giorni[d]["nebbia"] = valore
    scrivi(D)
    with open(os.environ.get("GITHUB_OUTPUT", os.devnull), "a") as f:
        f.write(f"giorno={d}\nvalore={NOMI[valore]}\n")
    print(f"nebbia-issue: {d} → {NOMI[valore]}")


def chiudi():
    numero, d, valore = os.environ["ISSUE_NUMBER"], os.environ["GIORNO"], os.environ["VALORE"]
    api("POST", f"/issues/{numero}/comments", {"body": f"Fatto: la mattina del {d} è classificata **{valore}**."})
    api("PATCH", f"/issues/{numero}", {"state": "closed", "state_reason": "completed"})
    # chiude anche l'eventuale segnalazione automatica dello stesso giorno, se la risposta è arrivata da un'altra
    for i in api("GET", f"/issues?state=open&labels={ETICHETTA}&per_page=50") or []:
        if i["title"] == f"Nebbia {d}" and str(i["number"]) != str(numero):
            api("POST", f"/issues/{i['number']}/comments", {"body": f"Classificata nella segnalazione #{numero}: **{valore}**."})
            api("PATCH", f"/issues/{i['number']}", {"state": "closed", "state_reason": "completed"})


if __name__ == "__main__":
    {"apri": apri, "classifica": classifica, "chiudi": chiudi}[sys.argv[1]]()
