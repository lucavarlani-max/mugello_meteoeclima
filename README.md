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
  scrive `data/previsioni.json`. Per ogni giorno: icona, massima, minima, probabilità di pioggia (`pp`, %)
  e pioggia prevista (`mm`, somma di giorno e notte dalla `qpf` di Google, `precipitation_sum` con Open-Meteo). Se la chiave manca o l'API non risponde, ripiega
  automaticamente su **Open-Meteo** (server e, in ultima istanza, lato browser).
  Le pagine (`previsioni-allinea.js`) scartano i giorni già passati in ora italiana: le
  esecuzioni programmate di GitHub possono partire con ore di ritardo e, prima delle 7,
  Google conta ancora "oggi" il giorno precedente. Con meno di 3 giorni validi si passa a
  Open-Meteo dal browser.
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
  **Estremi nel mondo**: ticker scorrevole con le 10 temperature più alte, le 10 più basse e
  le 10 stazioni con più pioggia nel mondo nelle ultime 24 ore, dal ranking sinottico di OGIMET;
  dati in `data/estremi.json`, aggiornati dall'Action da `scripts/fetch_estremi.py`.
- **Monitoraggio** — qualità dell'aria (Open-Meteo Air Quality) e sismicità (INGV,
  ultimo evento entro 45 km) in tempo reale. Livelli Sieve e Bilancino: vedi Action sotto.
- **Andamento invaso di Bilancino** — grafico della serie giornaliera del volume
  (milioni di m³) nell'anno, con tacche dei mesi e hover, da OpenData Comune di Firenze.
- **Cielo** — alba, tramonto, ore di luce.
- **Piogge estreme in Toscana** (`piogge-estreme.html` + `piogge-estreme.js`, menu Toscana) — report interattivo
  sul documento regionale «Un secolo di precipitazioni estreme in Toscana» (Centro Funzionale Regionale, agg. 2021,
  dati 1923–2017): i 5 massimi per 10 durate da 5 minuti a 24 ore, grafico durata/pioggia, classifiche, linea del
  tempo, stazioni ed eventi (1996, 2017, 1930). Dati in `data/piogge-estreme.json`, PDF originale in `reports/toscana/`.
- **Archivio climatico** (`archivio-climatico.html`, link "Archivio climatico" del riquadro "Il mese in cifre"
  in home e sottomenu Toscana) — i report climatologici mensili di Borgo San Lorenzo (stazione SIR TOS01000999)
  e Firenzuola (stazione Arpae-SIMC, 476 m), da leggere online (HTML interattivo, se c'è) o in PDF. File in `reports/clima/AAAA-MM-<luogo>.html/.pdf`, elenco in
  `data/report-clima.json`: per aggiungere un mese basta copiare i due file e inserire un elemento in cima a `report`.
- **Mappe** (`mappe.html`) — mappa del Mugello con le previsioni per comune (WeatherNext 3) e, sotto, le
  **carte del Centro europeo ECMWF** (`ecmwf-carte.js`): 10 carte del modello IFS sull'Europa (pressione e vento,
  geopotenziale 500 hPa, precipitazioni, temperatura, nuvole, neve, zero termico, raffiche, instabilità) fino a
  10 giorni, con selettore, cursore e animazione. I link alle immagini (OpenCharts API, © ECMWF, CC BY 4.0) sono in
  `data/ecmwf.json`, raccolti da `scripts/fetch_ecmwf.py` nel workflow dedicato `.github/workflows/ecmwf.yml`
  (00:41, 02:41, 12:41 e 14:41 UTC; ~150 richieste distanziate di 4 s, perché l'API limita le richieste):
  una corsa nuova (00 o 12 UTC, vecchia almeno 12 ore) viene mostrata solo quando è completa.
- **Temperature in Toscana** (`temperature-toscana.html`) — tutte le stazioni della rete
  termometrica del CFR Toscana: temperatura attuale, minime e massime di oggi e di ieri,
  classifiche, anomalie rispetto alla quota, grafico temperatura/quota, andamento giorno
  per giorno e download per Excel. Stazioni della zona M (Mugello-Val di Sieve) in evidenza.
- **Borgo San Lorenzo nella storia** (`borgo-storico.html` + `borgo-storico.js`, menu Toscana) —
  confronto di un giorno (o di una temperatura scritta dall'utente) con tutta la serie della
  stazione CFR/SIR TOS01000999 dal 1951 (massima, minima, media) e della pioggia di un mese
  con lo stesso mese degli altri anni dal 1991. Dati in `data/bsl/borgo.json`, generato da
  `scripts/build_bsl.py` con gli export dell'archivio SIR (`data/bsl/*.csv`) e aggiornato
  ogni giorno da `scripts/fetch_bsl.py` nell'Action con i dati in tempo reale del CFR.
- **Effemeridi** (`effemeridi.html` + `effemeridi.js`, link dal box "Cielo di stasera") —
  per qualsiasi giorno dal 1950 al 2050: alba, tramonto, mezzogiorno vero, crepuscoli, ora
  d'oro e ora blu, altezza del Sole ora per ora, alba e tramonto nell'anno, fase e orari
  della Luna con calendario lunare, pianeti visibili e prossimi eventi (equinozi, solstizi,
  sciami meteorici, cambio dell'ora). Calcoli nel browser con `astro.js` (SunCalc, Meeus,
  elementi orbitali JPL), sempre in ora italiana; `cielo.js` usa gli stessi calcoli per il box
  della home.
- **Serie storiche** (`serie-storiche.html`) — sezione dedicata alle stazioni centenarie,
  una pagina per stazione: **Milano Brera 1763–2024** (`milano-brera.html`) e
  **New York Central Park 1869–2026** (`new-york-central-park.html`, con la neve) e
  **Padova 1725–2023** (`padova.html`, serie omogeneizzata di sola temperatura, con la fonte di ogni anno),
  **Moncalieri 1865–2025** (`moncalieri.html`, Collegio Carlo Alberto, Società Meteorologica Italiana, sola temperatura),
  **San Francisco 1921–2026** (`san-francisco.html`, stazione San Francisco Downtown, dati NOAA trascritti dai moduli storici in PDF),
  **Genova 1833–2025** (`genova.html`, Osservatorio Meteorologico Storico dell'Università di Genova, dati aperti HistObs UniGe, temperatura e pioggia),
  **Mont Aigoual 1896–2026** (`mont-aigoual.html`, osservatorio di Météo-France a 1567 m nelle Cevenne, dati NOAA GHCN-Daily: pioggia dal 1896, temperatura dal 1949, media giornaliera completata con TAVG, opzione `--tavg` di `build_serie.py`) e
  **De Bilt 1901–2026** (`de-bilt.html`, stazione di riferimento del KNMI nei Paesi Bassi, stazione centenaria OMM) e
  **Bangalore 1901–2026** (`bangalore.html`, India Meteorological Department, stazione centenaria OMM come osservatorio pluviometrico dal 1867: pioggia dal 1901, temperatura dal 1973, media giornaliera completata con TAVG e soglia di giorni validi per anno abbassata a 275 con `--min-anno=275` di `build_serie.py`, introdotta per questa serie) e
  **Firenzuola 1961–2026** (`firenzuola.html`, la prima serie di un comune del Mugello stesso: stazione 01429 di ARPAE Emilia-Romagna, archivio opendata Eraclito, 66 anni praticamente senza lacune) e
  **Oxford 1815–2025** (`oxford.html`, Radcliffe Meteorological Station dell'Università di Oxford, stazione centenaria OMM: temperatura dal 1815, pioggia dal 1827, 211 anni con appena 5 valori mancanti) e
  **Domodossola 1872–2013** (`domodossola.html`, Osservatorio del Collegio Rosmini, stazione centenaria OMM: unica serie del sito senza dati giornalieri, costruita a mano dalle tabelle annuali e mensili pubblicate su *Nimbus* 72 della Società Meteorologica Italiana — niente massime/minime separate né "un giorno nella storia"; script di estrazione via `pdftotext -bbox` non versionato, dati finali in `domodossola.js` e `data/serie/domodossola.json`).
  Analisi d'insieme **Italia, stazioni NOAA** (`italia-ghcn.html` + `italia-ghcn.js`): 100 stazioni
  italiane del registro GHCN-Daily (mappa, cronologia, tabella) e trent'anni di dati 1996–2025
  su 46 stazioni (temperatura, gelo e caldo, precipitazioni, quota, latitudine); dati in `data/serie/italia-ghcn.json`, file originali (CSV, riepilogo,
  script Python) in `data/serie/italia/`.
  Per ogni stazione:
  strisce del riscaldamento, temperatura annua, mese per mese e per stagione, giorni estremi,
  pioggia, normali climatiche, record e "un giorno nella storia". Approfondimento PDF sulle
  estati a Milano 1991–2026 (`reports/`).
  In cima alla pagina, il grafico **Il riscaldamento nelle stazioni** (`serie-confronto.js`) confronta
  l'anomalia annua rispetto al 1961–1990 di tutte le stazioni (media su 11 anni o valori annui), con tabella riassuntiva;
  per aggiungere una stazione basta inserirla nell'elenco `ST` del file e dare un colore `--sN` nella pagina.
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
- **Storico SIR del Mugello** (`data/sir/`, script `scripts/fetch_sir_storico.py`) — serie giornaliere
  delle 47 stazioni del Servizio Idrologico Regionale dei comuni del Mugello, scaricate dall'archivio
  storico pubblico (sir.toscana.it): `temp.csv` (massima e minima, dal 1951), `prec024.csv` (pioggia
  0→24, dal 2004) e `prec99.csv` (pioggia 9→9, dal 1916), più `stato.json` (stato di validazione di ogni
  anno) e `stazioni.csv`. Si aggiorna con `python3 scripts/fetch_sir_storico.py --mugello --pluvio9`
  (riprende da dove si era fermato). Dati Regione Toscana - SIR, licenza CC BY-SA 4.0.
- **Stazioni del Mugello** (`stazioni-mugello.html`) — confronto fra le stazioni SIR dei comuni del
  Mugello: classifica e andamento della pioggia annua con la quota, temperature massime e minime,
  confronto interattivo fino a quattro stazioni (clima mensile e pioggia anno per anno) ed elenco ordinabile.
  Dati sintetizzati in `data/sir/mugello.json` da `scripts/build_sir_mugello.py`.
- **Webcam** — nel menu un sottomenu con *Webcam Mugello* (mappa delle webcam della vallata in
  home, `data/webcam.json`) e *Webcam Panomax* (`webcam-panomax.html` + `webcam-panomax.js`):
  le 668 webcam panoramiche pubbliche Panomax su mappa Leaflet con ricerca, filtri per paese e
  tipo, ordinate per distanza dal Mugello. Elenco in `data/panomax.json`, ripreso dal progetto
  webcam-panomax.
- **Menu principale nelle pagine interne** (`menu.js`, incluso in tutte le pagine tranne la home e
  `fb-post.html`) — la stessa barra di navigazione della home, fissa in alto durante lo scorrimento, con la voce
  della pagina evidenziata e il menu ☰ sotto i 1180 px. Le voci sono nell'elenco `VOCI` del file: se si aggiunge
  una pagina al menu della home, va aggiunta anche lì.
- **MeteoGeek** (`meteogeek.html`, voce 🧪 MeteoGeek del menu) — il laboratorio: sperimentazioni, grafici insoliti,
  statistiche, curiosità e tabelle, come schede filtrabili per tipo e con ricerca. Elenco in `data/meteogeek.json`
  (un elemento in cima a `esperimenti`: titolo, tipo grafico/statistica/curiosita/tabella/esperimento, **tema**, data, testo,
  link, tag, stato e anteprima facoltativi). I **temi** (le sottosezioni della home: clima, pioggia, previsioni, stazioni,
  mondo) sono definiti nel blocco `temi` dello stesso file (id, icona, nome, testo, colore): per aggiungerne uno basta
  una voce lì. La home mostra i temi come riquadri e, senza filtri, le ultime 3 prove di ciascuno con "Tutte le N prove →";
  i filtri tema, tipo e ricerca si combinano e il tema è nell'indirizzo (`meteogeek.html?tema=pioggia`). Una scheda senza
  tema (o con un tema sconosciuto) finisce in "Altre prove". Le pagine delle nuove sperimentazioni si chiamano `geek-<nome>.html` e partono
  dal modello `geek-modello.html` (non indicizzato); nel menu evidenziano MeteoGeek.
  **Verifica delle previsioni** (`geek-verifica-modello.html`): `scripts/fetch_verifica.py` (nel giro dell'Action `update-data`)
  archivia le previsioni a 7 giorni dei nove comuni di WeatherNext 3 (solo se tutti da Google) e di Open-Meteo in
  `data/verifica/log.json` (per ogni giorno e anticipo, la previsione emessa entro le 12) e il riepilogo giornaliero di
  ISCARP2 (Weather Underground, chiave pubblica di `stazioni.js`) in `data/verifica/iscarp2.json`. La pagina li confronta con le misure
  (ISCARP2 per Scarperia e San Piero, SIR per Borgo San Lorenzo) e con persistenza e climatologia. Una tantum,
  `python scripts/fetch_verifica.py --da-git` recupera dalla storia git le previsioni WeatherNext passate.
- **Le mie stazioni** (`stazioni.html` + `stazioni.js`, voce Stazioni del menu) — la stazione ISCARP2 di Scarperia
  (Weather Underground, letta dal browser come in home) e la stazione Netatmo: valori attuali, min/max di oggi,
  temperature delle ultime 24 ore a confronto e ultimi 7 giorni di ISCARP2. La Netatmo è letta dall'Action con
  `scripts/fetch_netatmo.py` (API Netatmo con OAuth) che scrive `data/netatmo.json`, solo moduli esterni e senza
  coordinate. Servono i segreti `NETATMO_CLIENT_ID`, `NETATMO_CLIENT_SECRET`, `NETATMO_REFRESH_TOKEN` (permesso
  read_station) e `NETATMO_KEY` (frase a piacere): il refresh token che Netatmo rinnova a ogni accesso viene
  salvato cifrato in `data/netatmo-token.enc`. Senza segreti la scheda Netatmo mostra «in arrivo».
- **Contatore visite** (`analytics.js`, incluso in tutte le pagine) — GoatCounter, gratuito e
  senza cookie, account `mugellometeoeclima`. In fondo a ogni pagina mostra il totale delle
  visite (serve l'opzione "Allow adding visitor counts on your website" in GoatCounter).
  **Google Analytics 4** (facoltativo, sempre in `analytics.js`): si attiva scrivendo l'ID di misurazione
  (`G-...`) in `GA_ID`. Usa cookie, quindi parte solo se il visitatore accetta nel banner; la scelta resta nel
  browser e si cambia con il link "Preferenze cookie" in fondo a ogni pagina. GoatCounter continua a contare tutti.
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
scripts/fetch_estremi.py       aggiorna data/estremi.json (estremi meteo nel mondo, da OGIMET)
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
4. Aggiungi la scheda in `serie-storiche.html` (attributi `data-serie` e `data-early`),
   **con la foto della città in trasparenza** come le altre schede (classe `body ph`,
   `style="--foto:url('https://commons.wikimedia.org/wiki/Special:FilePath/<file>.jpg?width=800')"`,
   più la voce foto/autore/licenza nel paragrafo `.crediti` in fondo alla griglia — è una
   regola fissa, non va saltata) e il nome OMM della stazione in `links` nelle chiamate a
   `WMOCat.mount` (`serie-storiche.html` e `stazioni-centenarie.html`) per evidenziarla sulla
   mappa, solo se è davvero una delle stazioni centenarie riconosciute (vedi `data/serie/wmo-centenarie.json`).
5. **Aggiungi la stazione anche al grafico di confronto del riscaldamento** (anche questa è
   una regola fissa, non va saltata): nell'array `ST` in cima a `serie-confronto.js`
   (`{id:"<slug>",n:"<nome>",c:"<nome breve per etichette e legenda>"}`) e, se sono finiti
   i colori già definiti, una nuova coppia `--sN` (chiaro e scuro) nella regola `.rs` in
   `serie-storiche.html`. Tabella, legenda e testo si aggiornano da soli.
