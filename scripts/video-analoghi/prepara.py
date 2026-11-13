#!/usr/bin/env python3
"""Prepara dati.json per il video «Ricerca analoghi» (scripts/video-analoghi/video.html).

Rifà in Python lo stesso calcolo della pagina geek-analoghi.html (pesi predefiniti, stessa stagione ±30 giorni)
per un giorno di riferimento e salva solo quello che serve all'animazione.
Uso: python scripts/video-analoghi/prepara.py [AAAA-MM-GG]   (senza data: l'ultimo giorno dell'archivio)
"""
import datetime, json, math, os, sys
QUI = os.path.dirname(os.path.abspath(__file__))
A = json.load(open(os.path.join(QUI, "..", "..", "data", "geek", "analoghi-archivio.json"), encoding="utf-8"))
G0 = datetime.date.fromisoformat(A["inizio"]); N = A["n"]
W = {"p": .40, "l": .10, "t": .175, "r": .175, "w": .10, "h": .05}
K, LONTANO, EPISODIO, FINESTRA = 35, 60, 7, 30

def giorno(i):
    p = [1000 + A["p"][j][i] / 10 for j in range(12)]
    pm = sum(p) / 12
    return {"i": i, "p": p, "pm": pm, "pa": [x - pm for x in p], "t": A["t"][i] / 10, "pr": A["pr"][i] / 10,
            "s": math.sqrt(A["pr"][i] / 10), "u": A["u"][i] / 10, "v": A["v"][i] / 10, "rh": A["rh"][i]}
def data(i): return G0 + datetime.timedelta(days=i)
def doy(i): d = data(i); return (d - datetime.date(d.year, 1, 1)).days

rif = (datetime.date.fromisoformat(sys.argv[1]) - G0).days if len(sys.argv) > 1 else N - 1
R = giorno(rif); dR = doy(rif); G = []
for i in range(N - 3):
    if abs(i - rif) < LONTANO: continue
    dd = abs(doy(i) - dR); dd = 366 - dd if dd > 183 else dd
    if dd <= FINESTRA: G.append(giorno(i))
n = len(G); m = lambda f: sum(f(g) for g in G) / n
mpa = [m(lambda g, j=j: g["pa"][j]) for j in range(12)]
st = {"p": m(lambda g: sum((g["pa"][j] - mpa[j]) ** 2 for j in range(12)) / 12)}
for k, f in (("l", lambda g: g["pm"]), ("t", lambda g: g["t"]), ("r", lambda g: g["s"]), ("h", lambda g: g["rh"])):
    mu = m(f); st[k] = m(lambda g: (f(g) - mu) ** 2)
mu, mv = m(lambda g: g["u"]), m(lambda g: g["v"]); st["w"] = m(lambda g: (g["u"] - mu) ** 2 + (g["v"] - mv) ** 2)
for g in G:
    q = {"p": sum((g["pa"][j] - R["pa"][j]) ** 2 for j in range(12)) / 12 / st["p"], "l": (g["pm"] - R["pm"]) ** 2 / st["l"],
         "t": (g["t"] - R["t"]) ** 2 / st["t"], "r": (g["s"] - R["s"]) ** 2 / st["r"],
         "w": ((g["u"] - R["u"]) ** 2 + (g["v"] - R["v"]) ** 2) / st["w"], "h": (g["rh"] - R["rh"]) ** 2 / st["h"]}
    g["D"] = math.sqrt(sum(W[k] * q[k] for k in q)); g["score"] = max(0, round(100 - K * g["D"]))
G.sort(key=lambda g: g["D"]); scelti = []
for g in G:
    if all(abs(s["i"] - g["i"]) >= EPISODIO for s in scelti): scelti.append(g)
    if len(scelti) >= 10: break
def vento(g): return {"s": round(math.hypot(g["u"], g["v"]), 1), "d": round((math.degrees(math.atan2(-g["u"], -g["v"])) + 360) % 360)}
def scheda(g): return {"data": data(g["i"]).isoformat(), "p": [round(x, 1) for x in g["p"]], "t": g["t"], "pr": g["pr"], "rh": g["rh"], "vento": vento(g), "score": g.get("score")}
dopo = []
for j in range(4):
    gg = [giorno(s["i"] + j) for s in scelti]
    dopo.append({"t": round(sum(x["t"] for x in gg) / len(gg), 1), "p": round(sum(x["pr"] for x in gg) / len(gg), 1),
                 "pmin": min(x["pr"] for x in gg), "pmax": max(x["pr"] for x in gg)})
tot = [sum(giorno(s["i"] + j)["pr"] for j in (1, 2, 3)) for s in scelti]
out = {"rif": scheda(R), "archivio": N, "confrontati": n, "anni": [G0.year, data(N - 1).year],
       "punti": [[round(data(g["i"]).year + doy(g["i"]) / 366, 3), g["score"]] for g in G],
       "primi": [scheda(g) for g in scelti[:3]], "dopo": dopo,
       "dopo_mm": {"media": round(sum(tot) / len(tot), 1), "min": round(min(tot), 1), "max": round(max(tot), 1), "n": len(scelti)}}
json.dump(out, open(os.path.join(QUI, "dati.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(out["rif"]["data"], n, [(s["data"], s["score"]) for s in out["primi"]], out["dopo_mm"])
