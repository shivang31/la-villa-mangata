/* Offline support: pages are fetched fresh when online (falling back to the cached copy),
   static assets are served from cache and refreshed in the background. */
const VERSION = 'lvm-v10';
const SHELL = [
  './', 'index.html', 'css/styles.css', 'css/listing.css', 'css/gallery.css',
  'js/main.js', 'js/water.js', 'js/hud.js', 'js/booking.js', 'js/gallery.js', 'js/listing.js', 'js/motion.js',
  'data/gallery.json', 'data/platforms.json', 'data/site.json',
  'img/exterior.jpg', 'manifest.webmanifest', 'icons/icon-192.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Live data and third-party embeds always go to the network.
  if (url.hostname.includes('open-meteo') || /availability|platforms|site\.json$/.test(url.pathname)) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
    return;
  }

  const cacheable = url.origin === self.location.origin || /fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(url.hostname);
  if (!cacheable) return;
  e.respondWith(caches.open(VERSION).then((c) => c.match(req).then((hit) => {
    const fresh = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || fresh;
  })));
});
