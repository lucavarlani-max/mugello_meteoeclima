#!/usr/bin/env python3
"""
Galleria delle webcam del Mugello (pagina webcam.html): scatti candidati e scelta delle foto migliori.

  python scripts/webcam_scatti.py scatta [--ora]
      All'alba (da 10 minuti prima a 40 dopo il sorgere del sole) e al tramonto (da 40 minuti prima a 10 dopo)
      salva una foto da ogni webcam di data/webcam.json che ha un'immagine e non è esclusa ("galleria": false),
      una sola volta per momento, in AAAA-MM-GG/<momento>-<webcam>.jpg nella cartella WEBCAM_CANDIDATI
      (nell'Action: il ramo «webcam-candidati», che non entra nella storia di main).
      Con --ora scatta subito (momento «HHMM»): serve per temporali e arcobaleni, dal tab Actions.
      Gli scatti candidati non scelti si cancellano dopo 6 giorni.

  python scripts/webcam_scatti.py apri
      Per ogni gruppo di scatti nuovo apre una segnalazione GitHub «Galleria AAAA-MM-GG <momento>» con le foto
      numerate: si risponde con i numeri da tenere e la categoria, per esempio «2 tramonto, 5 arcobaleno»,
      oppure «no» per non tenere nulla.

  python scripts/webcam_scatti.py scegli
      Lanciato dall'Action webcam-galleria.yml sulla risposta del proprietario del repository (ISSUE_TITLE, TESTO):
      copia le foto scelte in reports/webcam/galleria/ (1280 px) e le aggiunge a data/galleria.json.
Variabili per apri/scegli: GITHUB_TOKEN, GITHUB_REPOSITORY.
"""
import datetime as dt, hashlib, io, json, math, os, re, shutil, sys, urllib.request
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEBCAM = os.path.join(HERE, "data", "webcam.json")
GALLERIA = os.path.join(HERE, "data", "galleria.json")
# Gli scatti candidati non stanno su main: l'Action li tiene nel ramo «webcam-candidati», riscritto a ogni
# scatto con un solo commit, così le foto non scelte non restano nella storia del repository.
CAND = os.environ.get("WEBCAM_CANDIDATI") or os.path.join(HERE, "reports", "webcam", "candidati")
RAMO_CAND = "webcam-candidati"
SCELTE = os.path.join(HERE, "reports", "webcam", "galleria")
ROMA = ZoneInfo("Europe/Rome")
LAT, LON = 43.958, 11.391
CATEGORIE = {"alba": "alba", "albe": "alba", "tramonto": "tramonto", "tramonti": "tramonto",
             "temporale": "temporale", "temporali": "temporale", "fulmine": "temporale", "fulmini": "temporale",
             "arcobaleno": "arcobaleno", "arcobaleni": "arcobaleno", "nebbia": "nebbia", "neve": "neve",
             "nuvole": "nuvole", "cielo": "nuvole", "altro": "altro"}
ETICHETTA = "galleria-webcam"
TENGO = 6


def sole(giorno, sorge=True):
    """Sorgere o tramonto del sole a Borgo S. Lorenzo, ora di Roma (algoritmo NOAA semplificato, 1-2 minuti)."""
    d = dt.date.fromisoformat(giorno) if isinstance(giorno, str) else giorno
    g = 2 * math.pi / 365 * (d.timetuple().tm_yday - 1)
    eqt = 229.18 * (0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g)
                    - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g))
    dec = (0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g) - 0.006758 * math.cos(2 * g)
           + 0.000907 * math.sin(2 * g) - 0.002697 * math.cos(3 * g) + 0.00148 * math.sin(3 * g))
    lat = math.radians(LAT)
    ha = math.degrees(math.acos(math.cos(math.radians(90.833)) / (math.cos(lat) * math.cos(dec)) - math.tan(lat) * math.tan(dec)))
    minuti = 720 - 4 * (LON + ha) - eqt if sorge else 720 - 4 * (LON - ha) - eqt
    return (dt.datetime(d.year, d.month, d.day, tzinfo=dt.timezone.utc) + dt.timedelta(minutes=minuti)).astimezone(ROMA)


def slug(nome):
    s = re.sub(r"\(.*?\)|·.*", "", nome).lower()
    s = s.translate(str.maketrans("àèéìòù–", "aeeiou-"))
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def webcam():
    lista = json.load(open(WEBCAM, encoding="utf-8"))["webcam"]
    return [w for w in lista if w.get("img") and w.get("galleria", True)]


def scarica(url):
    req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteo/1.0 (galleria webcam)"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()


def leggi_json(p, vuoto):
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else vuoto


def scrivi_json(p, D):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(D, f, ensure_ascii=False, indent=1)


def momento(ora):
    oggi = ora.date()
    a, t = sole(oggi, True), sole(oggi, False)
    if a - dt.timedelta(minutes=10) <= ora <= a + dt.timedelta(minutes=40):
        return "alba"
    if t - dt.timedelta(minutes=40) <= ora <= t + dt.timedelta(minutes=10):
        return "tramonto"
    return None


MAX_ATTESA = 5 * 3600 + 30 * 60          # un job di GitHub Actions dura al massimo 6 ore


def attendi():
    """Per la catena di esecuzioni (webcam-scatti.yml): quanti secondi aspettare prima del prossimo scatto.
    Bersagli: 10 minuti dopo il sorgere del sole e 15 minuti prima del tramonto (dentro le finestre di momento()).
    Se il bersaglio è oltre 5 ore e mezza, si aspetta il massimo e si passa la mano all'esecuzione successiva.
    Scrive in GITHUB_OUTPUT attesa=<secondi> e scatta=1 se allo scadere si è dentro una finestra."""
    ora = dt.datetime.now(ROMA)
    bersagli = []
    for g in (ora.date(), ora.date() + dt.timedelta(days=1)):
        for nome, t in (("alba", sole(g, True) + dt.timedelta(minutes=10)), ("tramonto", sole(g, False) - dt.timedelta(minutes=15))):
            fatto = os.path.isdir(os.path.join(CAND, g.isoformat())) and \
                any(f.startswith(nome + "-") for f in os.listdir(os.path.join(CAND, g.isoformat())))
            if not fatto and t > ora - dt.timedelta(minutes=20):
                bersagli.append((t, nome))
    t, nome = min(bersagli)
    secondi = max(0, int((t - ora).total_seconds()))
    scatta = secondi <= MAX_ATTESA
    attesa = secondi if scatta else MAX_ATTESA
    with open(os.environ.get("GITHUB_OUTPUT", os.devnull), "a") as f:
        f.write(f"attesa={attesa}\nscatta={int(scatta)}\nmomento={nome}\n")
    print(f"webcam-scatti: prossimo bersaglio {nome} alle {t:%d/%m %H:%M}; attesa {attesa // 60} minuti, "
          f"{'poi scatto' if scatta else 'poi passo alla prossima esecuzione'}")


def scatta():
    from PIL import Image
    ora = dt.datetime.now(ROMA)
    m = ora.strftime("%H%M") if "--ora" in sys.argv else momento(ora)
    giorno = ora.date().isoformat()
    cart = os.path.join(CAND, giorno)
    pulisci(ora.date())
    if not m:
        print("webcam-scatti: né alba né tramonto, niente da fare")
        return
    if os.path.isdir(cart) and any(f.startswith(m + "-") for f in os.listdir(cart)):
        print(f"webcam-scatti: {giorno} {m} già scattato")
        return
    os.makedirs(cart, exist_ok=True)
    n, visti = 0, set()
    for w in webcam():
        try:
            raw = scarica(w["img"])
            h = hashlib.sha1(raw).hexdigest()
            if h in visti:
                continue
            visti.add(h)
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            img.thumbnail((1280, 1280))         # le webcam pubblicano di solito 1280 px o meno
            img.save(os.path.join(cart, f"{m}-{slug(w['nome'])}.jpg"), "JPEG", quality=80, optimize=True, progressive=True)
            n += 1
        except Exception as e:
            print("webcam-scatti: non scaricata", w["nome"], e, file=sys.stderr)
    print(f"webcam-scatti: {giorno} {m}: {n} foto")


def pulisci(oggi):
    if not os.path.isdir(CAND):
        return
    limite = (oggi - dt.timedelta(days=TENGO)).isoformat()
    for d in os.listdir(CAND):
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d) and d < limite:
            shutil.rmtree(os.path.join(CAND, d), ignore_errors=True)


def gruppi():
    """{(giorno, momento): [file, ...]} degli scatti candidati presenti."""
    out = {}
    if not os.path.isdir(CAND):
        return out
    for d in sorted(os.listdir(CAND)):
        if not os.path.isdir(os.path.join(CAND, d)):
            continue
        for f in sorted(os.listdir(os.path.join(CAND, d))):
            if f.endswith(".jpg"):
                out.setdefault((d, f.split("-", 1)[0]), []).append(f)
    return out


def nome_webcam(file):
    s = file.split("-", 1)[1][:-4]
    for w in json.load(open(WEBCAM, encoding="utf-8"))["webcam"]:
        if slug(w["nome"]) == s:
            return w
    return {"nome": s}


def api(metodo, percorso, dati=None):
    req = urllib.request.Request(
        f"https://api.github.com/repos/{os.environ['GITHUB_REPOSITORY']}{percorso}", method=metodo,
        data=None if dati is None else json.dumps(dati).encode(),
        headers={"Authorization": "Bearer " + os.environ["GITHUB_TOKEN"], "Accept": "application/vnd.github+json",
                 "User-Agent": "mugello-meteo/1.0 (galleria webcam)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        corpo = r.read()
        return json.loads(corpo) if corpo else None


def apri():
    titoli = {i["title"] for i in api("GET", f"/issues?state=all&labels={ETICHETTA}&per_page=100") or []}
    try:
        api("POST", "/labels", {"name": ETICHETTA, "color": "c9671f", "description": "Galleria webcam: scelta delle foto migliori"})
    except Exception:
        pass
    base = f"https://raw.githubusercontent.com/{os.environ['GITHUB_REPOSITORY']}/{RAMO_CAND}"
    for (d, m), files in gruppi().items():
        etichetta = m if m in ("alba", "tramonto") else f"ore {m[:2]}:{m[2:]}"
        titolo = f"Galleria {d} {etichetta}"
        if titolo in titoli:
            continue
        righe = [f"**Foto delle webcam del Mugello, {d} ({etichetta}).** Quali tieni per la galleria?\n",
                 "Rispondi con i numeri e la categoria, per esempio `2 tramonto, 5 arcobaleno` "
                 "(categorie: alba, tramonto, temporale, arcobaleno, nebbia, neve, nuvole, altro), oppure `no`.\n"]
        for i, f in enumerate(files, 1):
            w = nome_webcam(f)
            righe.append(f"**{i}** · {w['nome']} · fonte: {w.get('fonte', '–')}\n\n![{i}]({base}/{d}/{f})\n")
        righe.append(f"_Gli scatti non scelti si cancellano dopo {TENGO} giorni. Contano solo le risposte del proprietario del repository._")
        n = api("POST", "/issues", {"title": titolo, "body": "\n".join(righe), "labels": [ETICHETTA]})["number"]
        print(f"webcam-scatti: aperta la segnalazione #{n} ({titolo})")


def interpreta(testo):
    """«2 tramonto, 5 arcobaleno» → [(2, 'tramonto'), (5, 'arcobaleno')]; «3 5 alba» → [(3,'alba'), (5,'alba')]."""
    t = (testo or "").lower()
    if re.fullmatch(r"\s*(no|niente|nessuna)\W*", t):
        return []
    out, attesa = [], []
    for tok in re.findall(r"\d+|[a-zà-ù]+", t):
        if tok.isdigit():
            attesa.append(int(tok))
        elif tok in CATEGORIE and attesa:
            out += [(n, CATEGORIE[tok]) for n in attesa]
            attesa = []
    out += [(n, "altro") for n in attesa]
    return out if out else None


def scegli():
    titolo, testo = os.environ.get("ISSUE_TITLE", ""), os.environ.get("TESTO", "")
    m = re.match(r"Galleria (\d{4}-\d{2}-\d{2}) (alba|tramonto|ore (\d\d):(\d\d))", titolo)
    scelte = interpreta(testo)
    esito = os.environ.get("GITHUB_OUTPUT", os.devnull)
    if not m or scelte is None:
        open(esito, "a").write("esito=Non ho capito: scrivi i numeri e la categoria, per esempio «2 tramonto», oppure «no».\n")
        return
    d = m.group(1)
    mom = m.group(2) if m.group(2) in ("alba", "tramonto") else m.group(3) + m.group(4)
    files = gruppi().get((d, mom), [])
    G = leggi_json(GALLERIA, {"nota": "Foto scelte dalle webcam del Mugello (scripts/webcam_scatti.py).", "foto": []})
    presenti = {f["file"] for f in G["foto"]}
    os.makedirs(SCELTE, exist_ok=True)
    tenute = []
    for n, cat in scelte:
        if not 1 <= n <= len(files):
            continue
        f = files[n - 1]
        dest = f"reports/webcam/galleria/{d}-{f}"
        if dest in presenti:
            continue
        shutil.copy(os.path.join(CAND, d, f), os.path.join(HERE, dest))
        w = nome_webcam(f)
        ora = m.group(2) if mom in ("alba", "tramonto") else f"{mom[:2]}:{mom[2:]}"
        G["foto"].append({"file": dest, "data": d, "momento": ora, "categoria": cat, "webcam": w["nome"],
                          "fonte": w.get("fonte"), "link": w.get("link")})
        tenute.append(f"{n} ({cat})")
    G["foto"].sort(key=lambda x: (x["data"], x["file"]), reverse=True)
    scrivi_json(GALLERIA, G)
    open(esito, "a").write("esito=" + (f"Aggiunte alla galleria: {', '.join(tenute)}." if tenute else "Nessuna foto aggiunta.") + "\n")
    print("webcam-scatti: scelte", tenute)


if __name__ == "__main__":
    {"scatta": scatta, "apri": apri, "scegli": scegli, "attendi": attendi}[sys.argv[1]]()
