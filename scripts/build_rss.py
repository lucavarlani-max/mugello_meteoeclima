#!/usr/bin/env python3
"""Genera feed.xml (RSS 2.0) con gli ultimi numeri della rassegna «Terra & Cielo» da data/notizie.json.

Un elemento per numero: titolo dell'apertura, link a notizie.html#n-AAAA-MM-GG (che apre quel numero),
categoria e riassunto con apertura, numero del giorno e titoli delle altre storie.
Il file è deterministico (la data di compilazione è quella dell'ultimo numero): se notizie.json non
cambia, feed.xml non cambia e l'Action non fa commit inutili.

Uso: python scripts/build_rss.py
"""
import json, os
from datetime import datetime, timezone
from email.utils import format_datetime
from xml.sax.saxutils import escape as e

BASE = "https://lucavarlani-max.github.io/mugello_meteoeclima/"
MAX_NUMERI = 20
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
os.chdir(ROOT)


def pub(data):
    # notizie.json ha solo la data: i numeri escono al mattino
    return datetime.fromisoformat(data).replace(hour=7, tzinfo=timezone.utc)


def cdata(s):
    return s.replace("]]>", "]]]]><![CDATA[>")


d = json.load(open("data/notizie.json", encoding="utf-8"))
numeri = sorted(d["numeri"], key=lambda n: n["data"], reverse=True)[:MAX_NUMERI]

items = []
for n in numeri:
    a = n["apertura"]
    link = f"{BASE}notizie.html#n-{n['data']}"
    corpo = f"<p><b>{e(a['titolo'])}</b>. {e(a['testo'])}</p>"
    if n.get("numero"):
        corpo += f"<p><b>Il numero del giorno: {e(n['numero']['valore'])}</b>. {e(n['numero']['testo'])}</p>"
    if n.get("storie"):
        corpo += "<ul>" + "".join(f"<li>{e(s['titolo'])}</li>" for s in n["storie"]) + "</ul>"
    items.append(
        "    <item>\n"
        f"      <title>{e(a['titolo'])}</title>\n"
        f"      <link>{link}</link>\n"
        f'      <guid isPermaLink="true">{link}</guid>\n'
        f"      <pubDate>{format_datetime(pub(n['data']))}</pubDate>\n"
        f"      <category>{e(a.get('cat', 'meteo'))}</category>\n"
        f"      <description><![CDATA[{cdata(corpo)}]]></description>\n"
        "    </item>")

xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Terra &amp; Cielo · Mugello Meteo &amp; Clima</title>
    <link>{BASE}notizie.html</link>
    <atom:link href="{BASE}feed.xml" rel="self" type="application/rss+xml"/>
    <description>La rassegna quotidiana di meteo, clima e curiosità dal Mugello e dal mondo.</description>
    <language>it-it</language>
    <lastBuildDate>{format_datetime(pub(numeri[0]['data']))}</lastBuildDate>
{chr(10).join(items)}
  </channel>
</rss>
"""
open("feed.xml", "w", encoding="utf-8").write(xml)
print(len(items), "numeri in feed.xml")
