#!/usr/bin/env python3
"""
Classifica bioclimatica del Mugello anno per anno, per la pagina MeteoGeek «Bioclimatico Mugello» (geek-bioclima.html).

Per i nove capoluoghi del Mugello e il Passo della Futa scarica dall'archivio delle previsioni di Open-Meteo
(https://historical-forecast-api.open-meteo.com, modello scelto automaticamente: per l'Italia ICON-D2 a 2 km e
ICON-EU) le serie orarie di temperatura, punto di rugiada, umidità, vento a 10 m e radiazione solare diretta e
diffusa, alla quota del paese. Per ogni ora calcola Humidex, wind chill e UTCI con le stesse formule della pagina
(utci.js) e per ogni anno conta le ore di disagio. Scrive data/bioclima-anni.json:
  {"agg","fonte","dal","al","luoghi":[{"id","nome","tipo","lat","lon","q"}],
   "anni":{"AAAA":{id:{"ore","caldo","caldo_forte","freddo","freddo_forte","afa","vento","comfort","umax","umin"}}}}
  caldo        UTCI >= 26 (stress da caldo moderato o peggio)     caldo_forte  UTCI >= 32
  freddo       UTCI <  0  (stress da freddo moderato o peggio)    freddo_forte UTCI < -13
  afa          Humidex >= 30                                      vento        wind chill <= -10
  comfort      ore fra le 8 e le 20 con UTCI fra 9 e 26
L'anno in corso è parziale (fino a ieri). Se un luogo non si scarica, il file resta invariato.
"""
import datetime as dt, json, math, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "bioclima-anni.json")
DAL = dt.date(2022, 1, 1)
VAR = "temperature_2m,relative_humidity_2m,dew_point_2m,wind_speed_10m,direct_normal_irradiance_instant,diffuse_radiation_instant"
LUOGHI = [
    ("bsl", "Borgo San Lorenzo", "fondovalle", 43.9547, 11.3861, 193),
    ("sp", "San Piero a Sieve", "fondovalle", 43.9637, 11.3253, 212),
    ("vi", "Vicchio", "fondovalle", 43.9339, 11.4650, 203),
    ("di", "Dicomano", "fondovalle", 43.8917, 11.5222, 162),
    ("ba", "Barberino di Mugello", "piana di Bilancino", 43.9998, 11.2386, 270),
    ("sc", "Scarperia", "collina", 43.9944, 11.3545, 292),
    ("ma", "Marradi", "valle del Lamone", 44.0722, 11.6142, 328),
    ("fi", "Firenzuola", "valle del Santerno", 44.1206, 11.3789, 422),
    ("pa", "Palazzuolo sul Senio", "valle del Senio", 44.1131, 11.5433, 437),
    ("fu", "Passo della Futa", "crinale", 44.0917, 11.2833, 903),
]


def utci_poly(Ta, va, D, Pa):
    return Ta + 0.607562052 + (-0.0227712343) * Ta + 8.06470249e-4 * Ta * Ta + -1.54271372e-4 * Ta * Ta * Ta + -3.24651735e-6 * Ta * Ta * Ta * Ta + 7.32602852e-8 * Ta * Ta * Ta * Ta * Ta + 1.35959073e-9 * Ta * Ta * Ta * Ta * Ta * Ta + (-2.25836520) * va + 0.0880326035 * Ta * va + 0.00216844454 * Ta * Ta * va + -1.53347087e-5 * Ta * Ta * Ta * va + -5.72983704e-7 * Ta * Ta * Ta * Ta * va + -2.55090145e-9 * Ta * Ta * Ta * Ta * Ta * va + (-0.751269505) * va * va + (-0.00408350271) * Ta * va * va + -5.21670675e-5 * Ta * Ta * va * va + 1.94544667e-6 * Ta * Ta * Ta * va * va + 1.14099531e-8 * Ta * Ta * Ta * Ta * va * va + 0.158137256 * va * va * va + -6.57263143e-5 * Ta * va * va * va + 2.22697524e-7 * Ta * Ta * va * va * va + -4.16117031e-8 * Ta * Ta * Ta * va * va * va + (-0.0127762753) * va * va * va * va + 9.66891875e-6 * Ta * va * va * va * va + 2.52785852e-9 * Ta * Ta * va * va * va * va + 4.56306672e-4 * va * va * va * va * va + -1.74202546e-7 * Ta * va * va * va * va * va + -5.91491269e-6 * va * va * va * va * va * va + 0.398374029 * D + 1.83945314e-4 * Ta * D + -1.73754510e-4 * Ta * Ta * D + -7.60781159e-7 * Ta * Ta * Ta * D + 3.77830287e-8 * Ta * Ta * Ta * Ta * D + 5.43079673e-10 * Ta * Ta * Ta * Ta * Ta * D + (-0.0200518269) * va * D + 8.92859837e-4 * Ta * va * D + 3.45433048e-6 * Ta * Ta * va * D + -3.77925774e-7 * Ta * Ta * Ta * va * D + -1.69699377e-9 * Ta * Ta * Ta * Ta * va * D + 1.69992415e-4 * va * va * D + -4.99204314e-5 * Ta * va * va * D + 2.47417178e-7 * Ta * Ta * va * va * D + 1.07596466e-8 * Ta * Ta * Ta * va * va * D + 8.49242932e-5 * va * va * va * D + 1.35191328e-6 * Ta * va * va * va * D + -6.21531254e-9 * Ta * Ta * va * va * va * D + -4.99410301e-6 * va * va * va * va * D + -1.89489258e-8 * Ta * va * va * va * va * D + 8.15300114e-8 * va * va * va * va * va * D + 7.55043090e-4 * D * D + -5.65095215e-5 * Ta * D * D + -4.52166564e-7 * Ta * Ta * D * D + 2.46688878e-8 * Ta * Ta * Ta * D * D + 2.42674348e-10 * Ta * Ta * Ta * Ta * D * D + 1.54547250e-4 * va * D * D + 5.24110970e-6 * Ta * va * D * D + -8.75874982e-8 * Ta * Ta * va * D * D + -1.50743064e-9 * Ta * Ta * Ta * va * D * D + -1.56236307e-5 * va * va * D * D + -1.33895614e-7 * Ta * va * va * D * D + 2.49709824e-9 * Ta * Ta * va * va * D * D + 6.51711721e-7 * va * va * va * D * D + 1.94960053e-9 * Ta * va * va * va * D * D + -1.00361113e-8 * va * va * va * va * D * D + -1.21206673e-5 * D * D * D + -2.18203660e-7 * Ta * D * D * D + 7.51269482e-9 * Ta * Ta * D * D * D + 9.79063848e-11 * Ta * Ta * Ta * D * D * D + 1.25006734e-6 * va * D * D * D + -1.81584736e-9 * Ta * va * D * D * D + -3.52197671e-10 * Ta * Ta * va * D * D * D + -3.36514630e-8 * va * va * D * D * D + 1.35908359e-10 * Ta * va * va * D * D * D + 4.17032620e-10 * va * va * va * D * D * D + -1.30369025e-9 * D * D * D * D + 4.13908461e-10 * Ta * D * D * D * D + 9.22652254e-12 * Ta * Ta * D * D * D * D + -5.08220384e-9 * va * D * D * D * D + -2.24730961e-11 * Ta * va * D * D * D * D + 1.17139133e-10 * va * va * D * D * D * D + 6.62154879e-10 * D * D * D * D * D + 4.03863260e-13 * Ta * D * D * D * D * D + 1.95087203e-12 * va * D * D * D * D * D + -4.73602469e-12 * D * D * D * D * D * D + 5.12733497 * Pa + (-0.312788561) * Ta * Pa + (-0.0196701861) * Ta * Ta * Pa + 9.99690870e-4 * Ta * Ta * Ta * Pa + 9.51738512e-6 * Ta * Ta * Ta * Ta * Pa + -4.66426341e-7 * Ta * Ta * Ta * Ta * Ta * Pa + 0.548050612 * va * Pa + (-0.00330552823) * Ta * va * Pa + (-0.00164119440) * Ta * Ta * va * Pa + -5.16670694e-6 * Ta * Ta * Ta * va * Pa + 9.52692432e-7 * Ta * Ta * Ta * Ta * va * Pa + (-0.0429223622) * va * va * Pa + 0.00500845667 * Ta * va * va * Pa + 1.00601257e-6 * Ta * Ta * va * va * Pa + -1.81748644e-6 * Ta * Ta * Ta * va * va * Pa + -1.25813502e-3 * va * va * va * Pa + -1.79330391e-4 * Ta * va * va * va * Pa + 2.34994441e-6 * Ta * Ta * va * va * va * Pa + 1.29735808e-4 * va * va * va * va * Pa + 1.29064870e-6 * Ta * va * va * va * va * Pa + -2.28558686e-6 * va * va * va * va * va * Pa + (-0.0369476348) * D * Pa + 0.00162325322 * Ta * D * Pa + -3.14279680e-5 * Ta * Ta * D * Pa + 2.59835559e-6 * Ta * Ta * Ta * D * Pa + -4.77136523e-8 * Ta * Ta * Ta * Ta * D * Pa + 8.64203390e-3 * va * D * Pa + -6.87405181e-4 * Ta * va * D * Pa + -9.13863872e-6 * Ta * Ta * va * D * Pa + 5.15916806e-7 * Ta * Ta * Ta * va * D * Pa + -3.59217476e-5 * va * va * D * Pa + 3.28696511e-5 * Ta * va * va * D * Pa + -7.10542454e-7 * Ta * Ta * va * va * D * Pa + -1.24382300e-5 * va * va * va * D * Pa + -7.38584400e-9 * Ta * va * va * va * D * Pa + 2.20609296e-7 * va * va * va * va * D * Pa + -7.32469180e-4 * D * D * Pa + -1.87381964e-5 * Ta * D * D * Pa + 4.80925239e-6 * Ta * Ta * D * D * Pa + -8.75492040e-8 * Ta * Ta * Ta * D * D * Pa + 2.77862930e-5 * va * D * D * Pa + -5.06004592e-6 * Ta * va * D * D * Pa + 1.14325367e-7 * Ta * Ta * va * D * D * Pa + 2.53016723e-6 * va * va * D * D * Pa + -1.72857035e-8 * Ta * va * va * D * D * Pa + -3.95079398e-8 * va * va * va * D * D * Pa + -3.59413173e-7 * D * D * D * Pa + 7.04388046e-7 * Ta * D * D * D * Pa + -1.89309167e-8 * Ta * Ta * D * D * D * Pa + -4.79768731e-7 * va * D * D * D * Pa + 7.96079978e-9 * Ta * va * D * D * D * Pa + 1.62897058e-9 * va * va * D * D * D * Pa + 3.94367674e-8 * D * D * D * D * Pa + -1.18566247e-9 * Ta * D * D * D * D * Pa + 3.34678041e-10 * va * D * D * D * D * Pa + -1.15606447e-10 * D * D * D * D * D * Pa + (-2.80626406) * Pa * Pa + 0.548712484 * Ta * Pa * Pa + (-0.00399428410) * Ta * Ta * Pa * Pa + -9.54009191e-4 * Ta * Ta * Ta * Pa * Pa + 1.93090978e-5 * Ta * Ta * Ta * Ta * Pa * Pa + (-0.308806365) * va * Pa * Pa + 0.0116952364 * Ta * va * Pa * Pa + 4.95271903e-4 * Ta * Ta * va * Pa * Pa + -1.90710882e-5 * Ta * Ta * Ta * va * Pa * Pa + 0.00210787756 * va * va * Pa * Pa + -6.98445738e-4 * Ta * va * va * Pa * Pa + 2.30109073e-5 * Ta * Ta * va * va * Pa * Pa + 4.17856590e-4 * va * va * va * Pa * Pa + -1.27043871e-5 * Ta * va * va * va * Pa * Pa + -3.04620472e-6 * va * va * va * va * Pa * Pa + 0.0514507424 * D * Pa * Pa + (-0.00432510997) * Ta * D * Pa * Pa + 8.99281156e-5 * Ta * Ta * D * Pa * Pa + -7.14663943e-7 * Ta * Ta * Ta * D * Pa * Pa + -2.66016305e-4 * va * D * Pa * Pa + 2.63789586e-4 * Ta * va * D * Pa * Pa + -7.01199003e-6 * Ta * Ta * va * D * Pa * Pa + -1.06823306e-4 * va * va * D * Pa * Pa + 3.61341136e-6 * Ta * va * va * D * Pa * Pa + 2.29748967e-7 * va * va * va * D * Pa * Pa + 3.04788893e-4 * D * D * Pa * Pa + -6.42070836e-5 * Ta * D * D * Pa * Pa + 1.16257971e-6 * Ta * Ta * D * D * Pa * Pa + 7.68023384e-6 * va * D * D * Pa * Pa + -5.47446896e-7 * Ta * va * D * D * Pa * Pa + -3.59937910e-8 * va * va * D * D * Pa * Pa + -4.36497725e-6 * D * D * D * Pa * Pa + 1.68737969e-7 * Ta * D * D * D * Pa * Pa + 2.67489271e-8 * va * D * D * D * Pa * Pa + 3.23926897e-9 * D * D * D * D * Pa * Pa + (-0.0353874123) * Pa * Pa * Pa + (-0.221201190) * Ta * Pa * Pa * Pa + 0.0155126038 * Ta * Ta * Pa * Pa * Pa + -2.63917279e-4 * Ta * Ta * Ta * Pa * Pa * Pa + 0.0453433455 * va * Pa * Pa * Pa + (-0.00432943862) * Ta * va * Pa * Pa * Pa + 1.45389826e-4 * Ta * Ta * va * Pa * Pa * Pa + 2.17508610e-4 * va * va * Pa * Pa * Pa + -6.66724702e-5 * Ta * va * va * Pa * Pa * Pa + 3.33217140e-5 * va * va * va * Pa * Pa * Pa + (-0.00226921615) * D * Pa * Pa * Pa + 3.80261982e-4 * Ta * D * Pa * Pa * Pa + -5.45314314e-9 * Ta * Ta * D * Pa * Pa * Pa + -7.96355448e-4 * va * D * Pa * Pa * Pa + 2.53458034e-5 * Ta * va * D * Pa * Pa * Pa + -6.31223658e-6 * va * va * D * Pa * Pa * Pa + 3.02122035e-4 * D * D * Pa * Pa * Pa + -4.77403547e-6 * Ta * D * D * Pa * Pa * Pa + 1.73825715e-6 * va * D * D * Pa * Pa * Pa + -4.09087898e-7 * D * D * D * Pa * Pa * Pa + 0.614155345 * Pa * Pa * Pa * Pa + (-0.0616755931) * Ta * Pa * Pa * Pa * Pa + 0.00133374846 * Ta * Ta * Pa * Pa * Pa * Pa + 0.00355375387 * va * Pa * Pa * Pa * Pa + -5.13027851e-4 * Ta * va * Pa * Pa * Pa * Pa + 1.02449757e-4 * va * va * Pa * Pa * Pa * Pa + (-0.00148526421) * D * Pa * Pa * Pa * Pa + -4.11469183e-5 * Ta * D * Pa * Pa * Pa * Pa + -6.80434415e-6 * va * D * Pa * Pa * Pa * Pa + -9.77675906e-6 * D * D * Pa * Pa * Pa * Pa + 0.0882773108 * Pa * Pa * Pa * Pa * Pa + (-0.00301859306) * Ta * Pa * Pa * Pa * Pa * Pa + 0.00104452989 * va * Pa * Pa * Pa * Pa * Pa + 2.47090539e-4 * D * Pa * Pa * Pa * Pa * Pa + 0.00148348065 * Pa * Pa * Pa * Pa * Pa * Pa


def es(t):
    c = [-2836.5744, -6028.076559, 19.54263612, -0.02737830188, 0.000016261698, 7.0229056e-10, -1.8680009e-13]
    tk = t + 273.15
    e = 2.7150305 * math.log(tk) + sum(k * tk ** (i - 2) for i, k in enumerate(c))
    return math.exp(e) * 0.01


def utci(Ta, Tmrt, va, rh):
    D = Tmrt - Ta
    if Ta < -50 or Ta > 50 or D < -30 or D > 70 or va < 0.5 or va > 17:
        return None
    return utci_poly(Ta, va, D, es(Ta) * rh / 100 / 10)


def humidex(T, Td):
    if T < 20:
        return None
    return T + 0.5555 * (6.11 * math.exp(5417.7530 * (1 / 273.16 - 1 / (273.15 + Td))) - 10)


def wind_chill(T, V):
    if T > 10 or V <= 4.8:
        return None
    p = V ** 0.16
    return 13.12 + 0.6215 * T - 11.37 * p + 0.3965 * T * p


def alt_sole(ms, lat, lon):
    r = math.pi / 180
    d = ms / 86400000 - 10957.5
    g = (357.529 + 0.98560028 * d) * r
    q = 280.459 + 0.98564736 * d
    L = (q + 1.915 * math.sin(g) + 0.020 * math.sin(2 * g)) * r
    e = (23.439 - 0.00000036 * d) * r
    ra = math.atan2(math.cos(e) * math.sin(L), math.cos(L))
    dec = math.asin(math.sin(e) * math.sin(L))
    gmst = (18.697374558 + 24.06570982441908 * d) % 24
    ha = (gmst * 15 + lon) * r - ra
    return math.asin(math.sin(lat * r) * math.sin(dec) + math.cos(lat * r) * math.cos(dec) * math.cos(ha)) / r


FP = [0.303, 0.303, 0.272, 0.222, 0.176, 0.123, 0.082]   # SolarCal, persona in piedi, media sugli azimut


def delta_mrt(alt, dni, dif):
    if alt <= 0 or dni is None or dif is None:
        return 0.0
    k = min(5, int(alt // 15))
    fp = FP[k] + (FP[k + 1] - FP[k]) * (alt - 15 * k) / 15
    feff, asw, rho, hr = 0.725, 0.7, 0.2, 6
    erf = feff * (0.5 * dif + fp * dni + 0.5 * (dni * math.sin(alt * math.pi / 180) + dif) * rho) * asw / 0.95
    return erf / (hr * feff)


def get(url):
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "mugello-meteo/1.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except Exception as e:  # 429/503 passeggeri: si riprova
            print("  tentativo", i + 1, "fallito:", e, file=sys.stderr)
            time.sleep(20 * (i + 1))
    raise SystemExit("bioclima: Open-Meteo non risponde, file non toccato")


def main():
    al = dt.date.today() - dt.timedelta(days=1)
    anni = {}
    for lid, nome, tipo, lat, lon, q in LUOGHI:
        url = ("https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&elevation=%s"
               "&hourly=%s&timezone=Europe%%2FRome&timeformat=unixtime&start_date=%s&end_date=%s"
               % (lat, lon, q, VAR, DAL.isoformat(), al.isoformat()))
        o = get(url)
        h, off = o["hourly"], o.get("utc_offset_seconds", 0)
        n = 0
        for i, t in enumerate(h["time"]):
            T, rh, Td, V = (h[k][i] for k in ("temperature_2m", "relative_humidity_2m", "dew_point_2m", "wind_speed_10m"))
            if None in (T, rh, Td, V):
                continue
            loc = dt.datetime.fromtimestamp(t + off, dt.timezone.utc)
            dm = delta_mrt(alt_sole(t * 1000, lat, lon), h["direct_normal_irradiance_instant"][i], h["diffuse_radiation_instant"][i])
            U = utci(T, T + dm, max(0.5, V / 3.6), rh)
            H, W = humidex(T, Td), wind_chill(T, V)
            a = anni.setdefault(str(loc.year), {}).setdefault(lid, {"ore": 0, "ore_utci": 0, "caldo": 0, "caldo_forte": 0, "freddo": 0,
                                                                   "freddo_forte": 0, "afa": 0, "vento": 0, "comfort": 0, "umax": None, "umin": None})
            a["ore"] += 1
            n += 1
            if H is not None and H >= 30:
                a["afa"] += 1
            if W is not None and W <= -10:
                a["vento"] += 1
            if U is None:
                continue
            a["ore_utci"] += 1
            a["caldo"] += U >= 26
            a["caldo_forte"] += U >= 32
            a["freddo"] += U < 0
            a["freddo_forte"] += U < -13
            a["comfort"] += 8 <= loc.hour < 20 and 9 <= U <= 26
            if a["umax"] is None or U > a["umax"]["v"]:
                a["umax"] = {"v": round(U, 1), "t": loc.strftime("%Y-%m-%dT%H:%M")}
            if a["umin"] is None or U < a["umin"]["v"]:
                a["umin"] = {"v": round(U, 1), "t": loc.strftime("%Y-%m-%dT%H:%M")}
        print(nome, n, "ore", file=sys.stderr)
        time.sleep(3)
    out = {"agg": dt.date.today().isoformat(),
           "fonte": "Archivio delle previsioni Open-Meteo (CC BY 4.0); indici calcolati da Mugello Meteo & Clima",
           "dal": DAL.isoformat(), "al": al.isoformat(),
           "luoghi": [{"id": l[0], "nome": l[1], "tipo": l[2], "lat": l[3], "lon": l[4], "q": l[5]} for l in LUOGHI],
           "anni": anni}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")


if __name__ == "__main__":
    main()
