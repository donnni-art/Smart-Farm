// ── Service Worker — Smart Farm Monitor v1.7 ──
const CACHE = 'smartfarm-v1.7';

const LOCAL_ASSETS = [
  '.',
  'index.html',
  'flow.html',
  'guide.html',
  'manifest.json',
  'icons/icon.svg',
  'css/dashboard.css',
  'css/flow.css',
  'css/guide.css',
  'js/state.js',
  'js/alerts.js',
  'js/charts.js',
  'js/valves.js',
  'js/sensors.js',
  'js/plugins.js',
  'js/connection.js',
  'js/notifications.js',
  'js/timer.js',
  'js/weather.js',
  'js/crops.js',
  'js/growth.js',
  'js/db.js',
  'js/prediction.js',
  'js/scheduler.js',
  'js/notify.js',
  'js/camera.js',
  'js/devices.js',
  'js/app.js',
  'js/flow.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(LOCAL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Network-first สำหรับ CDN และ API ภายนอก
  if (url.origin !== self.location.origin) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first สำหรับ local assets
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
