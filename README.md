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
- **Andamento invaso di Bilancino** — grafico della serie giornaliera del volume
  (milioni di m³) nell'anno, con tacche dei mesi e hover, da OpenData Comune di Firenze.
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
data/fiumi.json                livelli fiumi + invaso (aggiornato dall'Action)
data/bilancino.json            serie giornaliera invaso Bilancino (grafico)
data/allerta.json              avviso criticità meteo mostrato nel banner in alto
scripts/fetch_fiumi.py         aggiorna data/fiumi.json
.github/workflows/update-data.yml   esegue lo script ogni 30 min
.nojekyll
```

## Fiumi (GitHub Action)

`data/fiumi.json` viene aggiornato automaticamente da una GitHub Action ogni 30
minuti (o a mano dal tab **Actions → Aggiorna dati fiumi → Run workflow**).
Lo script `scripts/fetch_fiumi.py` raccoglie:
- **Fiume Sieve** — livello a **Fornacina** (TOS01004641) dalla pagina idrometria
  del Centro Funzionale Regione Toscana (CFR), con data/ora e stato
  (normale/attenzione/allarme sulle soglie CFR).
- **Invaso di Bilancino** — quota (m slm) e volume (milioni di m³) dal CSV OpenData
  del Comune di Firenze (`datastore.comune.fi.it/od/livelli_bilancino_<anno>.csv`),
  aggiornato ~quotidianamente.

Se una fonte non risponde, lo script mantiene l'ultimo valore valido.

## Banner allerta meteo

Il banner in cima alla home legge `data/allerta.json`, aggiornato
**automaticamente** dalla GitHub Action: `scripts/fetch_allerta.py` scarica il
Bollettino di Valutazione delle Criticità del CFR Toscana (PDF), legge la
sezione "DESCRIZIONE DELLE CRITICITÀ PREVISTE" e ne ricava il livello
(`verde` | `gialla` | `arancione` | `rossa`) e il testo. Con `verde` il banner
mostra "nessuna criticità".

Si può anche forzare a mano modificando `data/allerta.json` (matita "Edit" su
GitHub); alla successiva esecuzione dell'Action verrà rigenerato dal bollettino.
Quando in futuro capiterà un bollettino con criticità, il parser può essere
affinato per filtrare la sola zona "M - Mugello-Val di Sieve".

## Pubblicare / aggiornare

Sito già su GitHub Pages (Settings → Pages → branch `main` / root).
Per aggiornare: sostituisci i file nel repo (upload web o `git push`).
URL: `https://lucavarlani-max.github.io/mugello_meteoeclima/`

## Note

- La API key di Weather Underground è dentro `index.html` (fetch diretto dal browser).
  Per nasconderla si può spostare la lettura WU in una GitHub Action con secret.

## Fonti dati

Stazione ISCARP2 (Weather Underground) · Open-Meteo · INGV · SIR/CFR Toscana · Windy · elaborazioni L. Varlani.
