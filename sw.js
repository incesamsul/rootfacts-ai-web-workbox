importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

workbox.setConfig({ debug: false });

workbox.precaching.precacheAndRoute([
  { url: './index.html', revision: 'rootfacts-v5' },
  { url: './manifest.json', revision: 'rootfacts-v5' },
  { url: './assets/css/styles.css', revision: 'rootfacts-v5' },
  { url: './assets/js/core/app.js', revision: 'rootfacts-v5' },
  { url: './assets/js/core/config.js', revision: 'rootfacts-v5' },
  { url: './assets/js/core/utils.js', revision: 'rootfacts-v5' },
  { url: './assets/js/services/camera.service.js', revision: 'rootfacts-v5' },
  { url: './assets/js/services/detection.service.js', revision: 'rootfacts-v5' },
  { url: './assets/js/services/facts.service.js', revision: 'rootfacts-v5' },
  { url: './assets/js/ui/ui.handler.js', revision: 'rootfacts-v5' },
  { url: './model/model.json', revision: 'rootfacts-v5' },
  { url: './model/metadata.json', revision: 'rootfacts-v5' },
  { url: './model/weights.bin', revision: 'rootfacts-v5' },
  { url: './assets/icons/icon-192x192.png', revision: 'rootfacts-v5' },
  { url: './assets/icons/icon-512x512.png', revision: 'rootfacts-v5' },
  { url: './assets/icons/apple-touch-icon.png', revision: 'rootfacts-v5' },
  { url: './assets/icons/favicon.ico', revision: 'rootfacts-v5' }
]);

workbox.routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  new workbox.strategies.NetworkFirst({
    cacheName: 'rootfacts-pages-v5',
    networkTimeoutSeconds: 3
  })
);

workbox.routing.registerRoute(
  ({ url }) => url.origin === 'https://cdn.jsdelivr.net' || url.origin === 'https://unpkg.com',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'rootfacts-cdn-v5'
  })
);

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
