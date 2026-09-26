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
- **Radar e dati** (`radar.html`, voce "Radar & dati" del menu) — riquadri "Adesso sul
  Mugello" (allerta, pioggia, temporali, fiumi, aria, terremoti); mappe Windy radar/satellite/
  previsione pioggia/vento; pioggia nelle prossime 2 ore ogni 15 minuti per comune (Open-Meteo);
  mappa fulmini Blitzortung e temporali previsti; 5 idrometri del Mugello con soglie e grafico
  48 ore (`data/idrometri.json`, aggiornato dall'Action) e Bilancino; aria, pollini e UV;
  terremoti INGV degli ultimi 30 giorni. Si aggiorna da sola ogni 5 minuti.
  **Carte sinottiche** disegnate dal sito (`sinottica.js`): geopotenziale 500 hPa con isobare,
  temperatura 850 hPa con geopotenziale, pressione al suolo con A/B, sull'Europa in proiezione
  conica di Lambert, ogni 12 ore fino a 5 giorni. Dati ECMWF/GFS via Open-Meteo scaricati ogni
  6 ore da `scripts/fetch_sinottica.py` in `data/sinottica.json`; base cartografica e griglia in
  `data/sinottica-mappa.json` (Natural Earth).
  **Analisi e satellite**: immagini di Wetterzentrale richiamate dal loro sito (satellite
  EUMETSAT, ultima immagine oraria trovata da sola; analisi al suolo DWD e UK Met Office),
  ricaricate ogni 15 minuti; se non sono disponibili compare il link diretto.
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
  una pagina per stazione: **Milano Brera 1763–2024** (`milano-brera.html`) e
  **New York Central Park 1869–2026** (`new-york-central-park.html`, con la neve) e
  **Padova 1725–2023** (`padova.html`, serie omogeneizzata di sola temperatura, con la fonte di ogni anno).
  Analisi d'insieme **Italia, stazioni NOAA** (`italia-ghcn.html` + `italia-ghcn.js`): 100 stazioni
  italiane del registro GHCN-Daily (mappa, cronologia, tabella) e trent'anni di dati 1996–2025
  su 46 stazioni (temperatura, gelo e caldo, precipitazioni, quota, latitudine); dati in `data/serie/italia-ghcn.json`, file originali (CSV, riepilogo,
  script Python) in `data/serie/italia/`.
  Per ogni stazione:
  strisce del riscaldamento, temperatura annua, mese per mese e per stagione, giorni estremi,
  pioggia, normali climatiche, record e "un giorno nella storia". Approfondimento PDF sulle
  estati a Milano 1991–2026 (`reports/`).
  La pagina mostra anche un'anteprima del catalogo mondiale (numeri, mappa, 22 stazioni
  italiane); il catalogo completo delle 474 stazioni centenarie OMM, con mappa Mondo/Europa,
  filtri, tabella e scheda di ogni stazione, è in `stazioni-centenarie.html`
  (componente `wmo-catalogo.js`, dati in `data/serie/wmo-centenarie.json`).
- **Curiosità e notizie** (`notizie.html` + `notizie.js`) — i numeri della rassegna quotidiana
  *Terra & Cielo*: in cima l'ultimo numero (apertura, numero del giorno, notizie, rubriche),
  sotto l'archivio con ricerca e filtro per argomento. Dati in `data/notizie.json`, un elemento
  per numero (`data`, `apertura`, `numero`, `storie`, `rubriche`); ogni notizia ha `cat`
  (clima, oceani, vulcani, terremoti, uragani, ghiacci, ozono, cielo, temporali, mugello) e,
  se serve, `foto` (id in `data/notizie-foto.json`, foto di Wikimedia Commons con autore e
  licenza). Le ultime tre notizie compaiono anche in home.
- **Contatore visite** (`analytics.js`, incluso in tutte le pagine) — GoatCounter, gratuito e
  senza cookie, account `mugellometeoeclima`. In fondo a ogni pagina mostra il totale delle
  visite (serve l'opzione "Allow adding visitor counts on your website" in GoatCounter).
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
scripts/fetch_idro.py          aggiorna data/idrometri.json (livelli + storico 48 ore)
scripts/fetch_sinottica.py     aggiorna data/sinottica.json (carte sinottiche, ogni 6 ore)
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

1. Metti il CSV giornaliero in una cartella qualsiasi. Formati accettati: ARPA
   (`year,month,day,prec,tempMax,tempMin`, `-99.9` = mancante) oppure export NOAA
   GHCN-Daily in unità metriche (colonne `DATE, PRCP, TMAX, TMIN, SNOW`).
2. Esegui `python scripts/build_serie.py <file>.csv <slug>`: scrive
   `data/serie/<slug>.csv` (ripulito) e `data/serie/<slug>.json` (aggregati, record,
   normali e, se c'è, la neve per stagione).
3. Duplica `new-york-central-park.html` (o `milano-brera.html`) come `<slug>.html` e cambia
   titoli, testi e l'oggetto `window.SERIE` in fondo alla pagina (slug, nome, periodo
   iniziale per il confronto del riscaldamento, epoche della tabella, tacche delle strisce).
   Grafici e tabelle sono in `serie-storica.js` / `serie-storica.css`, condivisi da tutte
   le stazioni; la sezione neve compare da sola se i dati la contengono.
4. Aggiungi la scheda in `serie-storiche.html` (attributi `data-serie` e `data-early`) e il
   nome OMM della stazione in `links` nelle chiamate a `WMOCat.mount`
   (`serie-storiche.html` e `stazioni-centenarie.html`) per evidenziarla sulla mappa.
