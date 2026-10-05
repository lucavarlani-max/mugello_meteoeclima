# Pacchetto GHCN-Daily per Mugello MeteoGeek

Pacchetto per scaricare i dati NOAA GHCN-Daily, convertirli in CSV, calcolare climatologie e generare grafici HTML interattivi nello stile MeteoGeek.

## Contenuto

- `ghcn-stations-map.html` — mappa interattiva delle stazioni NOAA con filtri, grafici, statistiche ed esportazione CSV.
- `ghcn_dly_to_csv.py` — scarica e converte i file `.dly` NOAA in CSV normalizzato.
- `ghcn_climatology.py` — calcola climatologie mensili e medie annuali.
- `ghcn_climatology_chart.py` — genera la pagina HTML con grafici interattivi e confronto tra più stazioni.
- `climatologia_interattiva.html` — pagina HTML di esempio già generata per i dati disponibili.

## Requisiti

- Python 3.10 o superiore.
- Connessione Internet per scaricare i dati NOAA.
- Non sono richiesti pacchetti Python esterni.

## Flusso per più stazioni

### 1. Scaricare e convertire i dati

Per un elenco di stazioni contenuto in `ghcnd-stations.txt`:

```bash
python3 ghcn_dly_to_csv.py \
  --stations-file ghcnd-stations.txt \
  --output stazioni.csv
```

Per un singolo paese, ad esempio l'Italia:

```bash
python3 ghcn_dly_to_csv.py \
  --all \
  --country IT \
  --output stazioni_italia.csv
```

Per una selezione di stazioni:

```bash
python3 ghcn_dly_to_csv.py \
  --station AO000066160 \
  --station IT000016239 \
  --output stazioni_selezionate.csv
```

È possibile limitare gli elementi:

```bash
python3 ghcn_dly_to_csv.py \
  --stations-file ghcnd-stations.txt \
  --country IT \
  --element TAVG \
  --element TMAX \
  --element TMIN \
  --output temperature_italia.csv
```

### 2. Calcolare le climatologie

```bash
python3 ghcn_climatology.py \
  --input stazioni.csv \
  --mode both \
  --output-dir climatologie
```

Per una climatologia standard 1961–1990:

```bash
python3 ghcn_climatology.py \
  --input stazioni.csv \
  --mode both \
  --start-year 1961 \
  --end-year 1990 \
  --output-dir climatologie_1961_1990
```

### 3. Generare la pagina HTML

```bash
python3 ghcn_climatology_chart.py \
  --monthly climatologie/climatologia_monthly.csv \
  --annual climatologie/climatologia_annual.csv \
  --output climatologia_confronto.html \
  --title "Confronto climatologico tra stazioni"
```

La pagina generata consente di selezionare due o più stazioni nello stesso grafico usando **Ctrl** su Windows/Linux oppure **Cmd** su macOS.

## Pubblicazione sul sito

Caricare sul proprio hosting:

1. `ghcn-stations-map.html`, se si vuole pubblicare la mappa delle stazioni;
2. `climatologia_confronto.html`, oppure rinominarlo in `climatologia_interattiva.html`;
3. eventuali file CSV solo se servono per successive rielaborazioni: i dati necessari ai grafici sono incorporati nell'HTML generato.

È anche possibile incorporare la pagina in una pagina esistente:

```html
<iframe
  src="climatologia_confronto.html"
  title="Confronto climatologico tra stazioni"
  style="width:100%; height:850px; border:0;"
  loading="lazy">
</iframe>
```

## Note

- Le fonti dei dati sono i file ufficiali NOAA/NCEI GHCN-Daily.
- La pagina HTML usa JavaScript e SVG nativi, senza framework obbligatori.
- La mappa usa Leaflet e OpenStreetMap tramite risorse esterne.
- I font MeteoGeek sono caricati da Google Fonts; se il sito deve funzionare completamente offline, sostituire i font con file locali o lasciare i fallback di sistema.
- Il download dell'intero catalogo NOAA può essere molto grande e richiedere molto tempo. È consigliabile iniziare con un paese o una lista mirata di stazioni.

## Modifiche rispetto al pacchetto originale

- `ghcn_climatology.py` scarta di default i valori con flag di qualità NOAA (`qflag`) e quelli fisicamente impossibili (per esempio i 999 °C usati come segnaposto in alcune stazioni); `--keep-flagged` li mantiene.
- `ghcn_climatology_chart.py`: nel grafico delle medie annuali le stazioni ora condividono lo stesso asse degli anni (prima ogni serie era stirata sul proprio periodo) e l'asse mostra gli anni; la legenda ha i colori; se la pagina trova `NAMES` e `DEFAULTS` mostra i nomi delle stazioni e le selezioni iniziali.
- `to_site.py` porta nel sito la pagina generata (`data/geek/ghcn-climatologia.js`), con i nomi delle stazioni da `ghcnd-stations.txt`.
- Pagina del sito: `geek-ghcn-climatologia.html`. Dati attuali: 49 stazioni italiane con temperatura, climatologia mensile 1991–2020 e medie annuali su tutto il periodo.
