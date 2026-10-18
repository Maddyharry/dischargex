/* Retires the previous DischargeX root worker without caching or reading requests. */
const KNOWN_NEXT_PWA_CACHES = new Set([
  "apis",
  "others",
  "start-url",
  "static-data-assets",
  "static-image-assets",
  "next-image",
  "static-audio-assets",
  "static-video-assets",
  "static-js-assets",
  "static-style-assets",
  "static-font-assets",
  "google-fonts-webfonts",
  "google-fonts-stylesheets",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const rootPrecacheName = `workbox-precache-v2-${self.location.origin}/`;
    const names = await caches.keys();
    const obsolete = names.filter(
      (name) => KNOWN_NEXT_PWA_CACHES.has(name) || name === rootPrecacheName,
    );
    await Promise.all(obsolete.map((name) => caches.delete(name)));

    await self.clients.claim();
    await self.registration.unregister();
  })());
});
