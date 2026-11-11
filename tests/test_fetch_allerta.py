#!/usr/bin/env python3
"""Test del parser del bollettino CFR (scripts/fetch_allerta.py).

Uso:  python -m unittest discover -s tests   (oppure: python tests/test_fetch_allerta.py)

Il testo è quello estratto da pdfplumber dal bollettino dell'11/11/2026
(emissione ore 13.04): rosso solo su L, R1, S1; zona M (Mugello) in GIALLO.
"""
import os, sys, io, unittest, contextlib

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import fetch_allerta as fa

BOLLETTINO_2026_11_11 = """\
MARE: domani, giovedì, nella seconda parte della giornata, mare molto mosso su costa e Arcipelago.
DESCRIZIONE DELLE CRITICITÀ PREVISTE:
Sulla base delle previsioni meteorologiche odierne e delle valutazioni dei possibili effetti al suolo effettuate, si prefigurano
i seguenti scenari di criticità:
ZONE DI ALLERTA RISCHIO TEMPI CRITICITA'
B, L, S1, S2 IDRAULICO in corso fino GIALLO
RETICOLO PRINCIPALE alle ore 23.59 Mercoledí, 11
Novembre 2026
B, L, S1, S2, S3 IDRAULICO dalle ore 00.00 Giovedì, 12 ARANCIONE
RETICOLO PRINCIPALE Novembre 2026
alle ore 23.59 Giovedì, 12
Novembre 2026
L, R1, S1 IDROGEOLOGICO dalle ore 17.00 Mercoledí, 11 ARANCIONE
IDRAULICO RETICOLO Novembre 2026
MINORE alle ore 10.00 Giovedì, 12
Novembre 2026
L, R1, S1 IDROGEOLOGICO dalle ore 10.00 Giovedì, 12 ROSSO
IDRAULICO RETICOLO Novembre 2026
MINORE alle ore 23.59 Giovedì, 12
Novembre 2026
B, S2, S3, V IDROGEOLOGICO dalle ore 17.00 Mercoledí, 11 ARANCIONE
IDRAULICO RETICOLO Novembre 2026
MINORE alle ore 23.59 Giovedì, 12
Novembre 2026
B, L, R1, S1, S2 TEMPORALI FORTI CON in corso fino GIALLO
S3, V RISCHIO IDROGEOLOGIC alle ore 23.59 Giovedì, 12
O-IDRAULICO RETICOLO Novembre 2026
MINORE
A1, A2, A3, A4, A5 TEMPORALI FORTI CON dalle ore 09.00 Giovedì, 12 GIALLO
A6, C, E1, E2, E3 RISCHIO IDROGEOLOGIC Novembre 2026
F1, F2, I, M, O1 O-IDRAULICO RETICOLO alle ore 23.59 Giovedì, 12
O2, O3, R2, S3, T MINORE Novembre 2026
DESCRIZIONE DEGLI SCENARI DI EVENTO PREVISTI
IDRAULICO
RETICOLO PRINCIPALE
Criticità Giallo: Possibilità di localizzati fenomeni di incremento dei livelli dei corsi d'acqua maggiori.
Criticità Rosso: nessun testo di questa sezione deve influire sul livello.
2 / 4
"""

# la stessa tabella come la restituisce pdfplumber.extract_tables() (ultime righe)
TABELLA_2026_11_11 = [[
    ["ZONE DI ALLERTA", "RISCHIO", "TEMPI", "CRITICITA'"],
    ["L, R1, S1", "IDROGEOLOGICO\nIDRAULICO RETICOLO\nMINORE",
     "dalle ore 10.00 Giovedì, 12\nNovembre 2026\nalle ore 23.59 Giovedì, 12\nNovembre 2026", "ROSSO"],
    ["A1, A2, A3, A4, A5\nA6, C, E1, E2, E3\nF1, F2, I, M, O1\nO2, O3, R2, S3, T",
     "TEMPORALI FORTI CON\nRISCHIO IDROGEOLOGIC\nO-IDRAULICO RETICOLO\nMINORE",
     "dalle ore 09.00 Giovedì, 12\nNovembre 2026\nalle ore 23.59 Giovedì, 12\nNovembre 2026", "GIALLO"],
]]

RISCHIO_M = "temporali forti con rischio idrogeologico-idraulico reticolo minore"
VALIDITA_M = "dalle ore 09.00 Giovedì, 12 Novembre 2026 alle ore 23.59 Giovedì, 12 Novembre 2026"


class TestBollettino11Novembre2026(unittest.TestCase):
    def _verifica_m(self, out):
        self.assertEqual(out["livello"], "gialla")
        self.assertEqual(out["rischio"], RISCHIO_M)
        self.assertEqual(out["validita"], VALIDITA_M)
        self.assertIn("gialla sul Mugello", out["testo"])

    def test_righe_dal_testo(self):
        righe = fa.estrai_righe(BOLLETTINO_2026_11_11)
        self.assertEqual([r["livello"] for r in righe],
                         ["gialla", "arancione", "arancione", "rossa", "arancione", "gialla", "gialla"])
        self.assertEqual(righe[3]["zone"], {"L", "R1", "S1"})
        self.assertEqual(righe[5]["zone"], {"B", "L", "R1", "S1", "S2", "S3", "V"})
        self.assertEqual(len(righe[6]["zone"]), 20)
        self.assertEqual([i for i, r in enumerate(righe) if "M" in r["zone"]], [6])

    def test_zona_m_gialla_dal_testo(self):
        self._verifica_m(fa.valuta(BOLLETTINO_2026_11_11))

    def test_zona_m_gialla_dal_testo_incolonnato(self):
        # stesso testo con colonne distanziate (pdftotext -layout)
        largo = "\n".join("    " + ln.replace(" IDR", "      IDR").replace(" TEMPORALI", "    TEMPORALI")
                          .replace(" dalle", "     dalle").replace(" GIALLO", "    GIALLO")
                          for ln in BOLLETTINO_2026_11_11.splitlines())
        self._verifica_m(fa.valuta(largo))

    def test_zona_m_gialla_dalle_celle(self):
        self._verifica_m(fa.valuta(BOLLETTINO_2026_11_11, TABELLA_2026_11_11))

    def test_massimo_fra_le_righe_con_m(self):
        t = BOLLETTINO_2026_11_11.replace("L, R1, S1 IDROGEOLOGICO dalle ore 10.00", "L, M, S1 IDROGEOLOGICO dalle ore 10.00")
        out = fa.valuta(t)
        self.assertEqual(out["livello"], "rossa")
        self.assertEqual(out["rischio"], "idrogeologico idraulico reticolo minore")
        self.assertTrue(out["validita"].startswith("dalle ore 10.00"))

    def test_verde_se_m_non_compare(self):
        t = BOLLETTINO_2026_11_11.replace("F1, F2, I, M, O1", "F1, F2, I, O1")
        out = fa.valuta(t)
        self.assertEqual(out["livello"], "verde")
        self.assertIn("altre zone", out["testo"])

    def test_nessuna_criticita(self):
        out = fa.valuta("FENOMENI PREVISTI\nDESCRIZIONE DELLE CRITICITÀ PREVISTE:\nNESSUNA\n")
        self.assertEqual(out["livello"], "verde")

    def test_formato_non_riconosciuto_non_usa_il_massimo_regionale(self):
        t = ("DESCRIZIONE DELLE CRITICITÀ PREVISTE:\nCriticità ROSSO sulle zone L, R1 e GIALLO altrove.\n"
             "DESCRIZIONE DEGLI SCENARI DI EVENTO PREVISTI\n")
        with contextlib.redirect_stderr(io.StringIO()):
            out = fa.valuta(t)
        self.assertNotIn(out["livello"], fa.ORDINE)
        self.assertTrue(out["non_riconosciuto"])
        self.assertIn("Toscana", out["testo"])
        self.assertIn("bollettino", out["testo"])

    def test_tabella_incompleta_non_riconosciuta(self):
        # una voce senza livello: meglio rimandare al bollettino che indovinare
        t = BOLLETTINO_2026_11_11.replace("dalle ore 09.00 Giovedì, 12 GIALLO", "dalle ore 09.00 Giovedì, 12")
        with contextlib.redirect_stderr(io.StringIO()):
            out = fa.valuta(t)
        self.assertEqual(out["livello"], "avviso")


if __name__ == "__main__":
    unittest.main()
