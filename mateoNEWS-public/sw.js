const CACHE_NAME = 'mateonews-v1';
const urlsToCache = [
  '/admin',
  '/styles.css',
  '/app.js',
  'https://x.mateopoznan.pl/mateo%20news-2.png',
  'https://x.mateopoznan.pl/mateoNEWS.png',
  'https://x.mateopoznan.pl/mateoNEWS1.png',
  'https://x.mateopoznan.pl/mateoNEWSpilne.png',
  'https://x.mateopoznan.pl/mateoNEWSwazne.png',
  'https://x.mateopoznan.pl/mateoNEWSopinia.png',
  'https://x.mateopoznan.pl/mateoNEWSpublicystyka.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
