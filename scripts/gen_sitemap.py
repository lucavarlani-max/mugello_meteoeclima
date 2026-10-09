#!/usr/bin/env python3
"""Rigenera sitemap.xml dalle pagine HTML pubblicate (esclude quelle con noindex o di servizio)."""
import glob, os, re, subprocess
BASE = "https://lucavarlani-max.github.io/mugello_meteoeclima/"
SKIP = {"index_1.html", "fb-post.html", "geek-modello.html"}
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
os.chdir(root)
rows = []
for f in sorted(glob.glob("*.html")):
    if f in SKIP or "noindex" in open(f, encoding="utf-8").read(4000):
        continue
    d = subprocess.run(["git", "log", "-1", "--format=%cs", "--", f], capture_output=True, text=True).stdout.strip()
    url = BASE if f == "index.html" else BASE + f
    pri = "1.0" if f == "index.html" else ("0.8" if f in ("radar.html", "comune.html", "meteogeek.html") else "0.6")
    rows.append(f"  <url><loc>{url}</loc>" + (f"<lastmod>{d}</lastmod>" if d else "") + f"<priority>{pri}</priority></url>")
open("sitemap.xml", "w", encoding="utf-8").write(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(rows) + "\n</urlset>\n")
print(len(rows), "url")
