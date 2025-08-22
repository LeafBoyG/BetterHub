// A basic "do-nothing" service worker to prevent 404 errors.

self.addEventListener('install', event => {
  console.log('Service worker installing...');
  // You can add assets to cache here later.
});

self.addEventListener('activate', event => {
  console.log('Service worker activating...');
});

self.addEventListener('fetch', event => {
  // This service worker doesn't intercept any requests.
  // It lets the browser handle everything as usual.
  return;
});