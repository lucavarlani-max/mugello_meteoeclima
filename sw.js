/* Mugello Meteo & Clima - service worker */
const CACHE = 'mmc-v2';
const SHELL = [
  './',
  './index.html',
  './comune.html',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Dati meteo/live (API esterne o data/*.json): sempre dalla rete, mai cache
  const isLiveData = /api\.open-meteo\.com|air-quality-api\.open-meteo\.com|api\.weather\.com|webservices\.ingv\.it|windy\.com/.test(url.href)
                     || url.pathname.endsWith('.json');
  if (isLiveData) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Shell del sito: cache-first, con aggiornamento in background
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200 && url.origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
