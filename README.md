# Mugello Meteo & Clima

Portale meteo-climatico della vallata del Mugello (Toscana): previsioni, dati in
tempo reale e analisi per i nove comuni, da Firenzuola a Dicomano.

Sito statico su GitHub Pages. Il file principale è `index.html` (foto e codice inclusi).

## Cosa mostra

- **Adesso** — dati in tempo reale dalla stazione personale **ISCARP2** (Scarperia)
  su Weather Underground: temperatura, vento, umidità, pressione, pioggia.
  Aggiornamento ogni 5 minuti; se la stazione è offline ripiega su Open-Meteo.
- **Previsioni 9 comuni + 7 giorni** — modello AI **WeatherNext 3** di Google
  (DeepMind), tramite la Google Weather API, aggiornate dalla GitHub Action che
  scrive `data/previsioni.json`. Se la chiave manca o l'API non risponde, ripiega
  automaticamente su **Open-Meteo** (server e, in ultima istanza, lato browser).
- **Radar** — mappa precipitazioni interattiva (Windy) centrata sul Mugello.
- **Monitoraggio** — qualità dell'aria (Open-Meteo Air Quality) e sismicità (INGV,
  ultimo evento entro 45 km) in tempo reale. Livelli Sieve e Bilancino: vedi Action sotto.
- **Andamento invaso di Bilancino** — grafico della serie giornaliera del volume
  (milioni di m³) nell'anno, con tacche dei mesi e hover, da OpenData Comune di Firenze.
- **Cielo** — alba, tramonto, ore di luce.
- **Temperature in Toscana** (`temperature-toscana.html`) — tutte le stazioni della rete
  termometrica del CFR Toscana: temperatura attuale, minime e massime di oggi e di ieri,
  classifiche, anomalie rispetto alla quota, grafico temperatura/quota, andamento giorno
  per giorno e download per Excel. Stazioni della zona M (Mugello-Val di Sieve) in evidenza.
- **Serie storiche** (`serie-storiche.html`) — sezione dedicata alle stazioni centenarie,
  una pagina per stazione. Prima stazione: **Milano Brera 1763–2024** (`milano-brera.html`):
  strisce del riscaldamento, temperatura annua, mese per mese e per stagione, giorni estremi,
  pioggia, normali climatiche, record e "un giorno nella storia". Approfondimento PDF sulle
  estati a Milano 1991–2026 (`reports/`).
  La pagina mostra anche un'anteprima del catalogo mondiale (numeri, mappa, 22 stazioni
  italiane); il catalogo completo delle 474 stazioni centenarie OMM, con mappa Mondo/Europa,
  filtri, tabella e scheda di ogni stazione, è in `stazioni-centenarie.html`
  (componente `wmo-catalogo.js`, dati in `data/serie/wmo-centenarie.json`).
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
data/previsioni.json           previsioni 9 comuni + 7 giorni (WeatherNext/Open-Meteo)
data/fiumi.json                livelli fiumi + invaso (aggiornato dall'Action)
data/bilancino.json            serie giornaliera invaso Bilancino (grafico)
data/allerta.json              avviso criticità meteo mostrato nel banner in alto
data/termo.json                temperature stazioni CFR Toscana (aggiornato dall'Action)
data/termo_storico.json        riepilogo giornaliero delle temperature (una riga al giorno)
scripts/fetch_previsioni.py    aggiorna data/previsioni.json (Google Weather API)
scripts/fetch_fiumi.py         aggiorna data/fiumi.json
scripts/fetch_allerta.py       aggiorna data/allerta.json
scripts/fetch_termo.py         aggiorna data/termo.json e data/termo_storico.json
scripts/build_serie.py         prepara i dati di una stazione centenaria (data/serie/<slug>.csv/.json)
data/serie/                    serie storiche giornaliere ripulite e aggregati per il sito
reports/                       report PDF di approfondimento
.github/workflows/update-data.yml   esegue gli script ogni 30 min
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

## Previsioni WeatherNext (Google Weather API) — setup della chiave

Le previsioni dei 9 comuni usano il modello AI **WeatherNext 3** di Google
DeepMind tramite la **Google Weather API** (Google Maps Platform). La chiave NON
sta nel sito statico: la legge solo la GitHub Action, da un *secret*.

Da fare una volta sola:

1. **Google Cloud** — crea (o scegli) un progetto su
   `console.cloud.google.com` e attiva la **fatturazione** sul progetto
   (la Weather API la richiede; c'è un credito mensile gratuito).
2. **Abilita la Weather API** — in "APIs & Services → Library" cerca
   *Weather API* e premi **Enable**.
3. **Crea la chiave** — "APIs & Services → Credentials → Create credentials →
   API key". Consigliato limitarla alla sola Weather API (Restrict key →
   Restrict API → Weather API).
4. **Aggiungi il secret su GitHub** — nel repo `mugello_meteoeclima`:
   *Settings → Secrets and variables → Actions → New repository secret*,
   nome esatto **`GMAPS_WEATHER_KEY`**, valore = la chiave.
5. Lancia l'Action a mano (*Actions → Aggiorna dati → Run workflow*): scriverà
   `data/previsioni.json` con fonte "WeatherNext 3 (Google)".

Finché il secret non c'è, l'Action funziona lo stesso e scrive `previsioni.json`
con **Open-Meteo** (così il sito non resta mai senza previsioni). Anche il
browser, se `previsioni.json` mancasse, ripiega su Open-Meteo da solo.

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

Stazione ISCARP2 (Weather Underground) · WeatherNext 3 / Google Weather API · Open-Meteo · INGV · SIR/CFR Toscana · Windy · elaborazioni L. Varlani.

## Aggiungere una stazione centenaria

1. Metti il CSV giornaliero (colonne `year,month,day,prec,tempMax,tempMin`, `-99.9` = mancante)
   in `data/serie/`.
2. Esegui `python scripts/build_serie.py data/serie/<file>.csv <slug>`: scrive
   `data/serie/<slug>.csv` (ripulito) e `data/serie/<slug>.json` (aggregati, record, normali).
3. Duplica `milano-brera.html` come `<slug>.html`, cambia titolo, testi e il nome del file dati,
   e aggiungi la scheda in `serie-storiche.html`. Per evidenziarla su mappa e catalogo,
   aggiungi il nome OMM della stazione e la pagina in `links` nelle chiamate a `WMOCat.mount`
   (`serie-storiche.html` e `stazioni-centenarie.html`).
