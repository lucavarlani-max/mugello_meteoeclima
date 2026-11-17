#!/usr/bin/env node
/* Rigenera il blocco "Stasera in breve" nell'HTML iniziale di effemeridi.html.
   Usa astro.js e lo stesso modulo della pagina, così i valori statici e live coincidono.
   Eseguire da qualunque directory:  node scripts/build_effemeridi_statiche.js  */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
global.window=global.window||{};
require(path.join(root,'astro.js'));
const A=global.window.Astro;
const R=require(path.join(root,'effemeridi-riepilogo.js'));
const pad=n=>String(n).padStart(2,'0');

const [y,m,d]=A.partiRoma(new Date());
const noon=A.mezzogiorno(y,m,d);
const s=R.sintesi(A,noon);
if(!s.tramonto||!s.alba)throw new Error('Orari del Sole non calcolabili per '+y+'-'+m+'-'+d);
const iso=`${y}-${pad(m)}-${pad(d)}`;
const start='<!-- EFF-OGGI:INIZIO -->',end='<!-- EFF-OGGI:FINE -->';
const blocco=`${start}\n    ${R.sezione(A,s,{titolo:'Stasera in breve'})}\n    ${end}`;

const htmlPath=path.join(root,'effemeridi.html');
let html=fs.readFileSync(htmlPath,'utf8');
const re=new RegExp(start.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[\\s\\S]*?'+end.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
if(!re.test(html)){console.error('Marcatori EFF-OGGI non trovati in effemeridi.html');process.exit(1);}
const nuovo=html.replace(re,blocco);
let cambiato=false;
if(nuovo!==html){fs.writeFileSync(htmlPath,nuovo,'utf8');cambiato=true;}

const sitemapPath=path.join(root,'sitemap.xml');
let sitemap=fs.readFileSync(sitemapPath,'utf8');
const smRe=/(<loc>https:\/\/lucavarlani-max\.github\.io\/mugello_meteoeclima\/effemeridi\.html<\/loc><lastmod>)\d{4}-\d{2}-\d{2}(<\/lastmod>)/;
if(!smRe.test(sitemap)){console.error('URL effemeridi non trovato in sitemap.xml');process.exit(1);}
const sitemapNuovo=sitemap.replace(smRe,`$1${iso}$2`);
if(sitemapNuovo!==sitemap){fs.writeFileSync(sitemapPath,sitemapNuovo,'utf8');cambiato=true;}

console.log(`Effemeridi statiche ${iso}: alba ${A.ora(s.alba)}, tramonto ${A.ora(s.tramonto)}, luna ${s.luna.nome} ${Math.round(s.luna.frazione*100)}%, pianeti ${s.pianeti.map(p=>p.nome).join(', ')||'nessuno'}.`);
console.log(cambiato?'File aggiornati.':'Nessuna variazione.');
