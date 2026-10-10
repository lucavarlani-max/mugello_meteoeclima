#!/usr/bin/env python3
"""
Diario della nebbia del Mugello: ogni mattina una foto della webcam del lago di Bilancino (fondovalle, 252 m)
e le condizioni misurate nella notte dalle stazioni del Centro Funzionale. Serve a costruire, inverno dopo
inverno, l'archivio di «nebbia sì / nebbia no» con cui calibrare una probabilità di nebbia per il Mugello
(pagina MeteoGeek geek-nebbia.html).

Ogni giorno, alla prima esecuzione fra l'alba (non prima delle 7) e le 10:30 (ora italiana):
  - scarica la foto della webcam, la rimpicciolisce (640 px) e la salva in reports/nebbia/AAAA-MM-GG.jpg;
    se è identica a quella del giorno prima la segna come «ferma» (webcam bloccata);
  - calcola due misure grezze dell'immagine, luminosità media e contrasto (deviazione standard / media della
    luminanza): la nebbia abbassa il contrasto, ma la misura NON è un'osservazione di nebbia;
  - copia le condizioni della notte da data/termo.json e data/nebbia.json (devono essere già aggiornati):
    minime di Borgo S. Lorenzo e Monte Giovi, umidità massima e vento massimo dalla mezzanotte alle stazioni
    di fondovalle e di collina;
  - registra la previsione che Open-Meteo aveva emesso il giorno prima per la notte appena finita (dalle 20 alle 8,
    «Previous Runs», modello best match): scarto minimo fra temperatura e punto di rugiada, vento medio a 10 m,
    nuvolosità media, ore con tutte e tre le soglie pratiche; e, nelle ore dell'alba (da 3 ore prima a 1 dopo il
    sorgere del sole, quando la nebbia è più probabile), scarto minimo e vento medio, più le nuvole medie e alte della
    notte e le nubi basse del modello all'alba. Sono le grandezze che la pagina userà per la probabilità;
  - aggiunge il giorno a data/nebbia-diario.json con "nebbia": null.
Il campo "nebbia" si compila guardando la foto: true (nebbia o banchi in valle), false (visibilità buona),
"incerto" (foto buia, controluce, gocce sull'obiettivo...). Solo i giorni con true/false entrano nella calibrazione.

Uso: python scripts/fetch_nebbia_alba.py [--forza]   (--forza: fuori dalla finestra oraria o se il giorno c'è già)
"""
import datetime as dt, hashlib, io, json, os, sys, urllib.request
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIARIO = os.path.join(HERE, "data", "nebbia-diario.json")
FOTO = os.path.join(HERE, "reports", "nebbia")
TERMO = os.path.join(HERE, "data", "termo.json")
NEBBIA = os.path.join(HERE, "data", "nebbia.json")
ROMA = ZoneInfo("Europe/Rome")
WEBCAM = {"nome": "Lago di Bilancino (252 m)", "fonte": "Meteo-Project",
          "url": "https://stazioni.meteoproject.it/webcam/lagobilancino/lagobilancino.jpg"}
LAT, LON = 43.958, 11.391           # Borgo S. Lorenzo, fondovalle
VALLE, MONTE = "TOS01000999", "TOS03001001"
UMIDITA = ["TOS11000017", "TOS01000926", "TOS11000089", "TOS01000921", "TOS03001001"]   # dal fondovalle alla collina
BORGO2 = "TOS11000017"
VENTO = ["TOS11000017", "TOS01000926", "TOS03001001"]


def scarica(url):
    req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteo/1.0 (diario della nebbia)"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read()


def misure_immagine(img):
    from PIL import ImageStat
    g = img.convert("L")
    s = ImageStat.Stat(g)
    media, dev = s.mean[0], s.stddev[0]
    return round(media, 1), (round(dev / media, 3) if media > 0 else None)


def condizioni():
    out, T = {}, {}
    try:
        T = json.load(open(TERMO, encoding="utf-8"))
        st = {s["id"]: s for s in T.get("stazioni", [])}
        v, m = st.get(VALLE, {}), st.get(MONTE, {})
        out["termo_ora"] = T.get("aggiornato")
        out["tmin_borgo"], out["tmin_giovi"] = v.get("min"), m.get("min")
        if v.get("min") is not None and m.get("min") is not None:
            out["inversione"] = round(m["min"] - v["min"], 1)      # > 0: fondovalle più freddo
    except Exception as e:
        print("nebbia-alba: temperature non lette", e, file=sys.stderr)
    try:
        N = json.load(open(NEBBIA, encoding="utf-8"))
        st = N.get("stazioni", {})
        out["umidita_max"] = {i: st[i]["ur"]["oggi_max"] for i in UMIDITA if i in st and st[i].get("ur")}
        out["umidita_ora"] = {i: st[i]["ur"]["v"] for i in UMIDITA if i in st and st[i].get("ur")}
        out["vento_max"] = {i: st[i]["vento"]["oggi_max"] for i in VENTO if i in st and st[i].get("vento")}
        out["cfr_ora"] = N.get("rif")
        b2 = st.get(BORGO2, {}).get("ur") or {}
        tb2 = next((x.get("t") for x in T.get("stazioni", []) if x.get("id") == BORGO2), None)
        if b2.get("v") is not None and tb2 is not None:
            out["rugiada_ora"] = rugiada(tb2, b2["v"])            # Borgo S. Lorenzo 2, misurata
            out["scarto_ora"] = round(tb2 - out["rugiada_ora"], 1)
    except Exception as e:
        print("nebbia-alba: umidità e vento non letti", e, file=sys.stderr)
    return out


def alba(giorno):
    """Ora del sorgere del sole a Borgo S. Lorenzo (ora di Roma), algoritmo NOAA semplificato (errore di 1-2 minuti)."""
    import math
    d = dt.date.fromisoformat(giorno) if isinstance(giorno, str) else giorno
    g = 2 * math.pi / 365 * (d.timetuple().tm_yday - 1)
    eqt = 229.18 * (0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g)
                    - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g))
    dec = (0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g) - 0.006758 * math.cos(2 * g)
           + 0.000907 * math.sin(2 * g) - 0.002697 * math.cos(3 * g) + 0.00148 * math.sin(3 * g))
    lat = math.radians(LAT)
    ha = math.degrees(math.acos(math.cos(math.radians(90.833)) / (math.cos(lat) * math.cos(dec)) - math.tan(lat) * math.tan(dec)))
    utc = dt.datetime(d.year, d.month, d.day, tzinfo=dt.timezone.utc) + dt.timedelta(minutes=720 - 4 * (LON + ha) - eqt)
    return utc.astimezone(ROMA)


def ore_alba(sorge):
    """Le ore attorno all'alba, quando la nebbia da irraggiamento è più probabile: da 3 ore prima a 1 ora dopo."""
    h = sorge.hour
    return [f"{h + k:02d}" for k in range(-3, 2)]


VERSIONE = 3        # versione delle grandezze registrate: i giorni più vecchi vengono completati da completa()
# Gruppi di grandezze facoltative, chiesti separatamente: se il servizio non ne fornisce uno, gli altri restano.
EXTRA = [["cloud_cover_low", "cloud_cover_mid", "cloud_cover_high"],
         ["relative_humidity_2m", "precipitation"],
         ["soil_moisture_0_to_1cm"],
         ["pressure_msl"],
         ["temperature_850hPa"],
         ["boundary_layer_height"]]


def previsione_notte(oggi):
    """Previsione emessa il giorno prima per la notte da ieri alle 20 a oggi alle 8 (Open-Meteo Previous Runs).
    Oltre alle grandezze sull'intera notte registra quelle delle ore dell'alba e separa le nuvole per strato:
    le nuvole medie e alte frenano il raffreddamento notturno, mentre le «nubi basse» del modello al mattino sono
    spesso la nebbia stessa (o lo strato basso) che il modello vede. Registra anche punto di rugiada e umidità
    all'alba, il «crossover» (minima della notte meno il punto di rugiada del pomeriggio prima), la pioggia delle
    24 ore precedenti, l'umidità del suolo, la pressione, l'inversione in quota (850 hPa) e lo strato limite."""
    v = ["temperature_2m", "dew_point_2m", "wind_speed_10m", "cloud_cover"]
    giorni_fa = (dt.datetime.now(ROMA).date() - dt.date.fromisoformat(oggi)).days
    q = (f"latitude={LAT}&longitude={LON}&timezone=Europe%2FRome&past_days={giorni_fa + 1}&forecast_days=1"
         "&wind_speed_unit=ms&hourly=")
    url = "https://previous-runs-api.open-meteo.com/v1/forecast?" + q
    h = json.loads(scarica(url + ",".join(x + "_previous_day1" for x in v)))["hourly"]
    for gruppo in EXTRA:
        try:
            r = json.loads(scarica(url + ",".join(x + "_previous_day1" for x in gruppo)))["hourly"]
            if r.get("time") == h["time"]:
                h.update(r)
        except Exception as e:
            print("nebbia-alba: non lette", ",".join(gruppo), e, file=sys.stderr)
    ieri = (dt.date.fromisoformat(oggi) - dt.timedelta(days=1)).isoformat()
    sorge = alba(oggi)
    alb = ore_alba(sorge)
    val = lambda x, i: (h.get(x + "_previous_day1") or [None] * len(h["time"]))[i]
    notte, mattina = [], []
    for i, t in enumerate(h["time"]):
        if not ((t[:10] == ieri and t[11:13] >= "20") or (t[:10] == oggi and t[11:13] <= "08")):
            continue
        T, td, w, c = (val(x, i) for x in v)
        if None in (T, td, w, c):
            continue
        mi, hi = val("cloud_cover_mid", i), val("cloud_cover_high", i)
        t850 = val("temperature_850hPa", i)
        r = {"T": T, "td": td, "s": max(0.0, T - td), "w": w, "c": c, "lo": val("cloud_cover_low", i),
             "mh": None if mi is None or hi is None else max(mi, hi), "ur": val("relative_humidity_2m", i),
             "suolo": val("soil_moisture_0_to_1cm", i), "p": val("pressure_msl", i),
             "inv": None if t850 is None else t850 - T, "blh": val("boundary_layer_height", i),
             "alba": t[:10] == oggi and t[11:13] in alb, "prima": t[:10] == ieri or t[11:13] <= alb[-2]}
        notte.append(r)
        if r["alba"]:
            mattina.append(r)
    if len(notte) < 10:
        raise ValueError(f"solo {len(notte)} ore disponibili")
    media = lambda a: round(sum(a) / len(a), 1) if a else None
    ok = lambda k, rr: [r[k] for r in rr if r[k] is not None]
    out = {"v": VERSIONE,
           "scarto_min": round(min(r["s"] for r in notte), 1),
           "vento_medio": media([r["w"] for r in notte]),
           "nuvole_medie": round(sum(r["c"] for r in notte) / len(notte)),
           "ore_soglie": sum(1 for r in notte if r["s"] <= 1 and r["w"] <= 2 and r["c"] <= 30),
           "ore": len(notte), "alba": sorge.strftime("%H:%M")}
    if mattina:
        out["scarto_alba"] = round(min(r["s"] for r in mattina), 1)
        out["vento_alba"] = media([r["w"] for r in mattina])
        out["dp_alba"] = media([r["td"] for r in mattina])                  # punto di rugiada medio all'alba
    if ok("mh", [r for r in notte if r["prima"]]):
        out["nuvole_alte"] = round(sum(ok("mh", [r for r in notte if r["prima"]])) / len(ok("mh", [r for r in notte if r["prima"]])))
    for k, nome, f in [("lo", "nubi_basse_alba", lambda a: round(max(a))), ("ur", "ur_alba", lambda a: round(max(a))),
                       ("suolo", "suolo_alba", lambda a: round(sum(a) / len(a), 3)), ("inv", "inv850_alba", lambda a: round(max(a), 1)),
                       ("blh", "blh_alba", lambda a: round(min(a)))]:
        if ok(k, mattina):
            out[nome] = f(ok(k, mattina))
    if ok("p", notte):
        out["pressione"] = round(sum(ok("p", notte)) / len(ok("p", notte)))
    # crossover (Craddock e Pritchard): minima della notte meno il punto di rugiada delle 15 del giorno prima.
    # Se la temperatura scende sotto la rugiada del pomeriggio, l'aria al suolo arriva a saturazione.
    i15 = h["time"].index(f"{ieri}T15:00") if f"{ieri}T15:00" in h["time"] else None
    if i15 is not None and val("dew_point_2m", i15) is not None:
        out["crossover"] = round(min(r["T"] for r in notte) - val("dew_point_2m", i15), 1)
    # pioggia delle 24 ore prima dell'alba (suolo bagnato = più umidità nello strato vicino al suolo)
    pp = [val("precipitation", i) for i, t in enumerate(h["time"])
          if (t[:10] == ieri and t[11:13] >= alb[-2]) or (t[:10] == oggi and t[11:13] < alb[-2])]
    if pp and None not in pp:
        out["pioggia_24h"] = round(sum(pp), 1)
    return out


def completa(giorni, oggi):
    """Rifà la previsione dei giorni già archiviati registrati con una versione precedente (fino a 60 giorni fa)."""
    limite = (dt.date.fromisoformat(oggi) - dt.timedelta(days=60)).isoformat()
    for d, r in giorni.items():
        p = r.get("previsione") or {}
        if d < oggi and d >= limite and p.get("v", 0) < VERSIONE:
            try:
                r["previsione"] = previsione_notte(d)
                print(f"nebbia-alba: previsione del {d} completata")
            except Exception as e:
                print(f"nebbia-alba: previsione del {d} non completata", e, file=sys.stderr)


def rugiada(T, ur):
    """Punto di rugiada (formula di Magnus) da temperatura e umidità relativa misurate."""
    import math
    if T is None or not ur:
        return None
    g = math.log(ur / 100) + 17.62 * T / (243.12 + T)
    return round(243.12 * g / (17.62 - g), 1)


def main():
    forza = "--forza" in sys.argv
    ora = dt.datetime.now(ROMA)
    oggi = ora.date().isoformat()
    D = json.load(open(DIARIO, encoding="utf-8")) if os.path.exists(DIARIO) else {}
    D.setdefault("nota", "Diario della nebbia del Mugello (scripts/fetch_nebbia_alba.py). "
                 "\"nebbia\": true = nebbia o banchi in valle nella foto, false = visibilità buona, "
                 "\"incerto\" = foto non giudicabile, null = da classificare.")
    D.setdefault("webcam", WEBCAM)
    giorni = D.setdefault("giorni", {})
    completa(giorni, oggi)
    # i veli di nebbia sottili si dissolvono poco dopo l'alba: la foto si scatta il prima possibile con la luce,
    # da 10 minuti dopo il sorgere del sole (e non prima delle 7) fino alle 10:30
    sorge = alba(oggi)
    inizio = max(dt.time(7, 0), (sorge + dt.timedelta(minutes=10)).time())
    finestra = inizio <= ora.time() <= dt.time(10, 30)
    if not forza and (not finestra or (oggi in giorni and giorni[oggi].get("foto"))):
        print(f"nebbia-alba: niente da fare ({'fuori finestra' if not finestra else 'giorno già archiviato'})")
        with open(DIARIO, "w", encoding="utf-8") as f:
            json.dump(D, f, ensure_ascii=False, indent=1)
        return
    rec = {"ora": ora.strftime("%H:%M"), "dopo_alba": round((ora - sorge).total_seconds() / 60),
           "nebbia": giorni.get(oggi, {}).get("nebbia")}
    rec.update(condizioni())
    try:
        rec["previsione"] = previsione_notte(oggi)
    except Exception as e:
        print("nebbia-alba: previsione della notte non letta", e, file=sys.stderr)
    try:
        from PIL import Image
        raw = scarica(WEBCAM["url"])
        img = Image.open(io.BytesIO(raw))
        img.load()
        h = hashlib.sha1(raw).hexdigest()[:16]
        prec = [g for d, g in sorted(giorni.items()) if d < oggi and g.get("hash")]
        rec["hash"] = h
        rec["ferma"] = bool(prec and prec[-1]["hash"] == h)
        rec["luce"], rec["contrasto"] = misure_immagine(img)
        img = img.convert("RGB")
        img.thumbnail((640, 640))
        os.makedirs(FOTO, exist_ok=True)
        img.save(os.path.join(FOTO, oggi + ".jpg"), "JPEG", quality=72, optimize=True, progressive=True)
        rec["foto"] = f"reports/nebbia/{oggi}.jpg"
    except Exception as e:
        print("nebbia-alba: foto non scaricata", e, file=sys.stderr)
        rec["foto"] = None
    giorni[oggi] = rec
    D["giorni"] = dict(sorted(giorni.items()))
    with open(DIARIO, "w", encoding="utf-8") as f:
        json.dump(D, f, ensure_ascii=False, indent=1)
    print(f"nebbia-alba: {oggi} {rec['ora']} foto={'sì' if rec.get('foto') else 'no'} "
          f"inversione={rec.get('inversione')} contrasto={rec.get('contrasto')}")


if __name__ == "__main__":
    main()
