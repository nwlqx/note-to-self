// Keeps the app and its typeface available offline. Your data is never cached
// here: it lives in the app's own storage and syncs with GitHub directly.
const CACHE = 'plans-b27e686c9f';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './apple-touch-icon.png', './fonts/dm-sans.woff2', './fonts/dm-sans-italic.woff2', './fonts/instrument-serif-normal.woff2', './fonts/instrument-serif-italic.woff2', './fonts/caveat.woff2'];

// GitHub Pages lets browsers reuse files for 10 minutes, so fetch past that cache:
// otherwise a fresh install could save the previous version of the app.
const fresh = (url) => new Request(url, { cache: 'no-cache' });

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map(fresh))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('plans-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.hostname === 'api.github.com') return;
  if (url.origin !== location.origin) return;

  // The page itself: always the latest from GitHub when online, the saved copy when offline.
  // (Showing the saved copy first left the app one version behind after every update.)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(fresh(e.request.url))
        .then((res) => {
          if (res.ok) {
            // copy before the browser reads the page; a copy taken later would be empty
            const copy = res.clone();
            e.waitUntil(caches.open(CACHE).then((c) => c.put('./', copy)));
          }
          return res;
        })
        .catch(() => caches.match('./', { ignoreSearch: true })),
    );
    return;
  }

  // Fonts and icons: the saved copy straight away, refreshed in the background.
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
