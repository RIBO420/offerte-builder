// Empty service worker - replaces old one and does nothing
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.registration.unregister());
});
self.addEventListener('fetch', () => {});
