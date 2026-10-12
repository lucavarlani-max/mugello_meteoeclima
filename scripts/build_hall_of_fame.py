#!/usr/bin/env python3
"""
Gli estremi del Mugello (pagina MeteoGeek geek-hall-of-fame.html): record di temperatura e di pioggia giornaliera
delle stazioni del Servizio Idrologico Regionale (SIR) nel Mugello e nell'alto Mugello, con controllo di qualità.

Ingresso: data/sir/stazioni.csv e data/sir/<ID>/temp.csv (data;max;min), data/sir/<ID>/prec024.csv (data;mm);
per Borgo S. Lorenzo (TOS01000999) la serie aggiornata di data/bsl/borgo.json.
Uscita:   data/hall-of-fame.json

Controllo di qualità (un valore che fallisce un controllo non entra nei record ed è elencato fra gli scartati):
  T1  limiti fisici: -30 <= T <= 45 °C, massima >= minima dello stesso giorno;
  T2  picco isolato: il valore si stacca di oltre 12 °C, nello stesso verso, sia dal giorno prima sia dal giorno dopo;
  T3  coerenza spaziale: si calcola l'anomalia del valore rispetto alla climatologia della stazione (media di quel
      giorno dell'anno, finestra di ±15 giorni) e la si confronta con la mediana delle anomalie delle altre stazioni
      lo stesso giorno (almeno 2). Differenza oltre 7 °C per le massime e 10 °C per le minime (con l'inversione
      termica il fondovalle si stacca molto dalla collina): il valore non è confermato.
  P1  pioggia giornaliera oltre 400 mm;
  P2  coerenza spaziale: oltre 80 mm mentre nessuna altra stazione supera il 20% del valore (almeno 3 stazioni attive),
      o il 10% se le altre stazioni attive sono 1 o 2.
I valori senza stazioni vicine attive (T3/P2 non verificabili) entrano nei record con l'indicazione «non verificato».
"""
import csv, datetime as dt, json, os, statistics as stat

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIR = os.path.join(HERE, "data", "sir")
OUT = os.path.join(HERE, "data", "hall-of-fame.json")
BORGO = "TOS01000999"
SOGLIA_SPAZIO = {"x": 7.0, "n": 10.0}  # le minime di fondovalle possono staccarsi molto dalle altre (inversione)
SOGLIA_SALTO = 12.0
MIN_ANNI = 5                         # stazioni con meno anni di dati non entrano nella tabella dei record


def leggi_csv(p, n):
    out = {}
    if not os.path.exists(p):
        return out
    for r in open(p, encoding="utf-8").read().splitlines()[1:]:
        c = r.split(";")
        if len(c) < n + 1 or not c[0]:
            continue
        v = [float(x) if x not in ("", "NA") else None for x in c[1:n + 1]]
        out[c[0]] = v
    return out


def stazioni():
    S = {}
    for r in csv.DictReader(open(os.path.join(SIR, "stazioni.csv"), encoding="utf-8"), delimiter=";"):
        t = leggi_csv(os.path.join(SIR, r["id"], "temp.csv"), 2)
        p = leggi_csv(os.path.join(SIR, r["id"], "prec024.csv"), 1)
        if t or p:
            S[r["id"]] = {"nome": r["nome"], "comune": r["comune"].replace(" (FI)", ""), "quota": round(float(r["quota"] or 0)),
                          "t": t, "p": {d: v[0] for d, v in p.items() if v[0] is not None}}
    # Borgo: serie aggiornata (stessa stazione SIR/CFR), già ripulita dei periodi esclusi in build_bsl.py
    try:
        B = json.load(open(os.path.join(HERE, "data", "bsl", "borgo.json"), encoding="utf-8"))
        d0 = dt.date.fromisoformat(B["t"]["dal"])
        t = {}
        for i, (x, n) in enumerate(zip(B["t"]["tx"], B["t"]["tn"])):
            if x is not None or n is not None:
                t[(d0 + dt.timedelta(days=i)).isoformat()] = [x, n]
        if BORGO in S and len(t) >= len(S[BORGO]["t"]):
            S[BORGO]["t"] = t
    except Exception as e:
        print("hall-of-fame: borgo.json non letto", e)
    return S


def climatologia(serie):
    """Media per giorno dell'anno con finestra di ±15 giorni (366 valori)."""
    per = [[] for _ in range(367)]
    for d, v in serie.items():
        if v is not None:
            per[dt.date.fromisoformat(d).timetuple().tm_yday].append(v)
    medie = [stat.fmean(x) if x else None for x in per]
    out = [None] * 367
    for g in range(1, 367):
        vals = [medie[(g - 1 + k) % 366 + 1] for k in range(-15, 16)]
        vals = [v for v in vals if v is not None]
        out[g] = stat.fmean(vals) if vals else None
    return out


def controlla_temperature(S):
    """Per ogni stazione e grandezza ('x' massima, 'n' minima): {data: (valore, esito)}; esito None = valido."""
    anom, esiti = {}, {}
    for sid, s in S.items():
        for k, j in (("x", 0), ("n", 1)):
            serie = {d: v[j] for d, v in s["t"].items()}
            cl = climatologia(serie)
            anom[(sid, k)] = {d: v - cl[dt.date.fromisoformat(d).timetuple().tm_yday]
                              for d, v in serie.items() if v is not None and cl[dt.date.fromisoformat(d).timetuple().tm_yday] is not None}
    for sid, s in S.items():
        for k, j in (("x", 0), ("n", 1)):
            res = {}
            for d, v in s["t"].items():
                x = v[j]
                if x is None:
                    continue
                g = dt.date.fromisoformat(d)
                motivo = None
                if not -30 <= x <= 45:
                    motivo = "fuori dai limiti fisici"
                elif v[0] is not None and v[1] is not None and v[0] < v[1]:
                    motivo = "massima minore della minima"
                else:
                    vic = [s["t"].get((g + dt.timedelta(days=o)).isoformat(), [None, None])[j] for o in (-1, 1)]
                    vic = [y for y in vic if y is not None]
                    # picco isolato: si stacca nello stesso verso sia dal giorno prima sia dal giorno dopo
                    if len(vic) == 2 and (x - vic[0]) * (x - vic[1]) > 0 and min(abs(x - vic[0]), abs(x - vic[1])) > SOGLIA_SALTO:
                        motivo = f"picco isolato di {min(abs(x - vic[0]), abs(x - vic[1])):.0f} °C rispetto ai giorni vicini"
                if motivo is None:
                    altre = [anom[(o, k)][d] for o in S if o != sid and d in anom[(o, k)]]
                    if len(altre) >= 2 and d in anom[(sid, k)]:
                        diff = anom[(sid, k)][d] - stat.median(altre)
                        if abs(diff) > SOGLIA_SPAZIO[k]:
                            motivo = f"non confermato dalle altre stazioni (scarto {diff:+.0f} °C)"
                    elif len(altre) < 2:
                        motivo = "?"                       # non verificabile
                res[d] = (x, motivo)
            esiti[(sid, k)] = res
    return esiti


def controlla_pioggia(S):
    esiti = {}
    for sid, s in S.items():
        res = {}
        for d, x in s["p"].items():
            motivo = None
            if x > 400:
                motivo = "oltre 400 mm in un giorno"
            elif x > 80:
                altre = [S[o]["p"][d] for o in S if o != sid and d in S[o]["p"]]
                if len(altre) >= 3 and max(altre) < 0.2 * x:
                    motivo = f"non confermato: nessuna altra stazione oltre {0.2 * x:.0f} mm"
                elif 1 <= len(altre) < 3 and max(altre) < 0.1 * x:
                    motivo = f"non confermato: le altre stazioni attive non superano {0.1 * x:.0f} mm"
                elif len(altre) < 3:
                    motivo = "?"
            res[d] = (x, motivo)
        esiti[sid] = res
    return esiti


def episodi(cand, n, giorni=3):
    """Dai giorni ordinati dal più estremo tiene solo il picco di ogni episodio: un giorno entro `giorni` giorni da uno
    già scelto appartiene alla stessa ondata (di caldo, di freddo, di pioggia) e non viene ripetuto."""
    scelti = []
    for d, vals in cand:
        g = dt.date.fromisoformat(d)
        if all(abs((g - dt.date.fromisoformat(x)).days) > giorni for x, _ in scelti):
            scelti.append((d, vals))
            if len(scelti) == n:
                break
    return scelti


def anni(serie):
    return len({d[:4] for d in serie})


def main():
    S = stazioni()
    T = controlla_temperature(S)
    P = controlla_pioggia(S)
    nome = {sid: s["nome"] for sid, s in S.items()}
    ok = lambda m: m is None or m == "?"

    # record per stazione
    record = []
    for sid, s in sorted(S.items(), key=lambda kv: kv[1]["quota"]):
        r = {"id": sid, "nome": s["nome"], "comune": s["comune"], "quota": s["quota"]}
        if s["t"] and anni(s["t"]) >= MIN_ANNI:
            dd = sorted(s["t"])
            r["t_dal"], r["t_al"], r["t_giorni"] = dd[0], dd[-1], len(dd)
            vx = [(v, d, m) for d, (v, m) in T[(sid, "x")].items() if ok(m)]
            vn = [(v, d, m) for d, (v, m) in T[(sid, "n")].items() if ok(m)]
            if vx:
                v, d, m = max(vx)
                r["tmax"] = {"v": v, "d": d, "verificato": m is None}
            if vn:
                v, d, m = min(vn)
                r["tmin"] = {"v": v, "d": d, "verificato": m is None}
        if s["p"] and anni(s["p"]) >= MIN_ANNI:
            dd = sorted(s["p"])
            r["p_dal"], r["p_al"], r["p_giorni"] = dd[0], dd[-1], len(dd)
            vp = [(v, d, m) for d, (v, m) in P[sid].items() if ok(m)]
            if vp:
                v, d, m = max(vp)
                r["pmax"] = {"v": v, "d": d, "verificato": m is None}
        if len(r) > 4:
            record.append(r)

    # giornate: per ogni data il valore più estremo fra le stazioni valide, con le altre stazioni dello stesso giorno
    def giornate(chiave, segno, n=15):
        per = {}
        for sid in S:
            for d, (v, m) in T[(sid, chiave)].items():
                if ok(m):
                    per.setdefault(d, []).append((v, sid))
        estremo = lambda vals: max(v for v, _ in vals) if segno > 0 else min(v for v, _ in vals)
        cand = sorted(per.items(), key=lambda kv: segno * estremo(kv[1]), reverse=True)
        out = []
        for d, vals in episodi(cand, n):
            vals.sort(key=lambda t: -segno * t[0])
            out.append({"d": d, "v": vals[0][0], "id": vals[0][1], "nome": nome[vals[0][1]],
                        "altre": [{"nome": nome[s_], "v": v} for v, s_ in vals[1:6]]})
        return out

    def giornate_pioggia(n=15):
        per = {}
        for sid in S:
            for d, (v, m) in P[sid].items():
                if ok(m) and v > 0:
                    per.setdefault(d, []).append((v, sid))
        cand = sorted(per.items(), key=lambda kv: max(v for v, _ in kv[1]), reverse=True)
        out = []
        for d, vals in episodi(cand, n):
            vals.sort(reverse=True)
            out.append({"d": d, "v": vals[0][0], "id": vals[0][1], "nome": nome[vals[0][1]], "stazioni": len(vals),
                        "media": round(stat.fmean(v for v, _ in vals), 1),
                        "altre": [{"nome": nome[s_], "v": v} for v, s_ in vals[1:6]]})
        return out

    # scartati: i valori più estremi esclusi dal controllo di qualità (per trasparenza)
    scart = []
    for (sid, k), res in T.items():
        for d, (v, m) in res.items():
            if not ok(m):
                scart.append({"tipo": "massima" if k == "x" else "minima", "nome": nome[sid], "d": d, "v": v, "motivo": m})
    for sid, res in P.items():
        for d, (v, m) in res.items():
            if not ok(m):
                scart.append({"tipo": "pioggia", "nome": nome[sid], "d": d, "v": v, "motivo": m})

    def peggiori(tipo, segno, n=8):
        return sorted([x for x in scart if x["tipo"] == tipo], key=lambda x: -segno * x["v"])[:n]

    # Borgo S. Lorenzo: massima e minima di ogni anno (anni con almeno l'85% dei giorni)
    anni_b = {}
    for d, (v, m) in T[(BORGO, "x")].items():
        if ok(m):
            anni_b.setdefault(d[:4], {"x": [], "n": []})["x"].append((v, d))
    for d, (v, m) in T[(BORGO, "n")].items():
        if ok(m):
            anni_b.setdefault(d[:4], {"x": [], "n": []})["n"].append((v, d))
    serie_b = []
    for a, z in sorted(anni_b.items()):
        giorni = 366 if int(a) % 4 == 0 else 365
        if len(z["x"]) >= 0.85 * giorni and len(z["n"]) >= 0.85 * giorni:
            mx, mn = max(z["x"]), min(z["n"])
            serie_b.append({"a": int(a), "x": mx[0], "xd": mx[1], "n": mn[0], "nd": mn[1],
                            "g35": sum(1 for v, _ in z["x"] if v >= 35), "gm5": sum(1 for v, _ in z["n"] if v <= -5)})

    tot_t = sum(len(s["t"]) for s in S.values())
    tot_p = sum(len(s["p"]) for s in S.values())
    out = {
        "agg": dt.date.today().isoformat(),
        "fonte": "Servizio Idrologico Regionale e Centro Funzionale della Regione Toscana (dati CC BY-SA 4.0)",
        "metodo": {"soglia_spaziale_max": SOGLIA_SPAZIO["x"], "soglia_spaziale_min": SOGLIA_SPAZIO["n"], "soglia_salto": SOGLIA_SALTO, "min_anni": MIN_ANNI},
        "conteggi": {"stazioni": len(record), "giorni_temperatura": tot_t, "giorni_pioggia": tot_p,
                     "scartati_t": sum(1 for x in scart if x["tipo"] != "pioggia"),
                     "scartati_p": sum(1 for x in scart if x["tipo"] == "pioggia"),
                     "t_dal": min(r["t_dal"] for r in record if "t_dal" in r),
                     "p_dal": min(r["p_dal"] for r in record if "p_dal" in r)},
        "record": record,
        "caldo": giornate("x", 1), "freddo": giornate("n", -1), "pioggia": giornate_pioggia(),
        "scartati": {"massima": peggiori("massima", 1), "minima": peggiori("minima", -1), "pioggia": peggiori("pioggia", 1)},
        "borgo": serie_b,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"hall-of-fame: {len(record)} stazioni, {tot_t} giorni di temperatura, {tot_p} di pioggia, "
          f"{out['conteggi']['scartati_t']} temperature e {out['conteggi']['scartati_p']} piogge scartate")


if __name__ == "__main__":
    main()
