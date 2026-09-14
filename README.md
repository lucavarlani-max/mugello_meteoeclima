# Mugello Meteo & Clima

Portale meteo-climatico della vallata del Mugello (Toscana): previsioni, dati in
tempo reale e analisi per i nove comuni, da Firenzuola a Dicomano.

Sito statico su GitHub Pages. Il file principale è `index.html` (foto e codice inclusi).

## Cosa mostra

- **Adesso** — dati in tempo reale dalla stazione personale **ISCARP2** (Scarperia)
  su Weather Underground: temperatura, vento, umidità, pressione, pioggia.
  Aggiornamento ogni 5 minuti; se la stazione è offline ripiega su Open-Meteo.
- **Previsioni 9 comuni + 7 giorni** — Open-Meteo (modelli ICON + GFS), gratis, senza chiave.
- **Radar** — mappa precipitazioni interattiva (Windy) centrata sul Mugello.
- **Monitoraggio** — qualità dell'aria (Open-Meteo Air Quality) e sismicità (INGV,
  ultimo evento entro 45 km) in tempo reale. Livelli Sieve e Bilancino: vedi Action sotto.
- **Cielo** — alba, tramonto, ore di luce.
- **Crea post** (`fb-post.html`) — genera l'immagine-previsione pronta da scaricare
  e pubblicare su Facebook, con didascalia automatica.
- **PWA** — installabile su telefono (icona in home, apertura a schermo intero, cache offline della struttura).

## Struttura del repo

```
index.html                     home
fb-post.html                   generatore immagini per Facebook
manifest.webmanifest           PWA
sw.js                          service worker (cache offline)
icon-192.png / icon-512.png / icon-maskable-512.png / favicon-64.png
data/fiumi.json                livelli fiumi (aggiornato dall'Action)
scripts/fetch_fiumi.py         aggiorna data/fiumi.json
.github/workflows/update-data.yml   esegue lo script ogni 30 min
.nojekyll
```

## Fiumi (GitHub Action)

`data/fiumi.json` viene aggiornato automaticamente da una GitHub Action ogni 30
minuti (o a mano dal tab **Actions → Aggiorna dati fiumi → Run workflow**).
Lo script `scripts/fetch_fiumi.py` individua le stazioni di Sieve e Bilancino
tramite il WFS OpenData della Regione Toscana. **Da confermare** l'endpoint SIR
dei valori correnti (funzione `livello_realtime`): finché non è impostato, lo
script mantiene i valori precedenti e il sito mostra l'ultimo dato valido.

## Pubblicare / aggiornare

Sito già su GitHub Pages (Settings → Pages → branch `main` / root).
Per aggiornare: sostituisci i file nel repo (upload web o `git push`).
URL: `https://lucavarlani-max.github.io/mugello_meteoeclima/`

## Note

- La API key di Weather Underground è dentro `index.html` (fetch diretto dal browser).
  Per nasconderla si può spostare la lettura WU in una GitHub Action con secret.

## Fonti dati

Stazione ISCARP2 (Weather Underground) · Open-Meteo · INGV · SIR/CFR Toscana · Windy · elaborazioni L. Varlani.
