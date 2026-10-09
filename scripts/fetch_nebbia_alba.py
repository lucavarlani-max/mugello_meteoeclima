#!/usr/bin/env python3
"""
Diario della nebbia del Mugello: ogni mattina una foto della webcam del lago di Bilancino (fondovalle, 252 m)
e le condizioni misurate nella notte dalle stazioni del Centro Funzionale. Serve a costruire, inverno dopo
inverno, l'archivio di «nebbia sì / nebbia no» con cui calibrare una probabilità di nebbia per il Mugello
(pagina MeteoGeek geek-nebbia.html).

Ogni giorno, alla prima esecuzione fra le 7 e le 10:30 (ora italiana):
  - scarica la foto della webcam, la rimpicciolisce (640 px) e la salva in reports/nebbia/AAAA-MM-GG.jpg;
    se è identica a quella del giorno prima la segna come «ferma» (webcam bloccata);
  - calcola due misure grezze dell'immagine, luminosità media e contrasto (deviazione standard / media della
    luminanza): la nebbia abbassa il contrasto, ma la misura NON è un'osservazione di nebbia;
  - copia le condizioni della notte da data/termo.json e data/nebbia.json (devono essere già aggiornati):
    minime di Borgo S. Lorenzo e Monte Giovi, umidità massima e vento massimo dalla mezzanotte alle stazioni
    di fondovalle e di collina;
  - registra la previsione che Open-Meteo aveva emesso il giorno prima per la notte appena finita (dalle 20 alle 8,
    «Previous Runs», modello best match): scarto minimo fra temperatura e punto di rugiada, vento medio a 10 m,
    nuvolosità media, ore con tutte e tre le soglie pratiche. Sono le grandezze che la pagina userà per la probabilità;
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
VALLE, MONTE = "TOS01000999", "TOS03001001"
UMIDITA = ["TOS11000017", "TOS01000926", "TOS11000089", "TOS01000921", "TOS03001001"]   # dal fondovalle alla collina
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
    out = {}
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
    except Exception as e:
        print("nebbia-alba: umidità e vento non letti", e, file=sys.stderr)
    return out


def previsione_notte(oggi):
    """Previsione emessa il giorno prima per la notte da ieri alle 20 a oggi alle 8 (Open-Meteo Previous Runs)."""
    v = ["temperature_2m", "dew_point_2m", "wind_speed_10m", "cloud_cover"]
    q = ("latitude=43.958&longitude=11.391&timezone=Europe%2FRome&past_days=1&forecast_days=1&wind_speed_unit=ms"
         "&hourly=" + ",".join(x + "_previous_day1" for x in v))
    h = json.loads(scarica("https://previous-runs-api.open-meteo.com/v1/forecast?" + q))["hourly"]
    ieri = (dt.date.fromisoformat(oggi) - dt.timedelta(days=1)).isoformat()
    ore = [i for i, t in enumerate(h["time"]) if (t[:10] == ieri and t[11:13] >= "20") or (t[:10] == oggi and t[11:13] <= "08")]
    righe = []
    for i in ore:
        t, td, w, c = (h[x + "_previous_day1"][i] for x in v)
        if None not in (t, td, w, c):
            righe.append((max(0.0, t - td), w, c))
    if len(righe) < 10:
        raise ValueError(f"solo {len(righe)} ore disponibili")
    return {"scarto_min": round(min(r[0] for r in righe), 1),
            "vento_medio": round(sum(r[1] for r in righe) / len(righe), 1),
            "nuvole_medie": round(sum(r[2] for r in righe) / len(righe)),
            "ore_soglie": sum(1 for r in righe if r[0] <= 1 and r[1] <= 2 and r[2] <= 30),
            "ore": len(righe)}


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
    finestra = dt.time(7, 0) <= ora.time() <= dt.time(10, 30)
    if not forza and (not finestra or (oggi in giorni and giorni[oggi].get("foto"))):
        print(f"nebbia-alba: niente da fare ({'fuori finestra' if not finestra else 'giorno già archiviato'})")
        return
    rec = {"ora": ora.strftime("%H:%M"), "nebbia": giorni.get(oggi, {}).get("nebbia")}
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
