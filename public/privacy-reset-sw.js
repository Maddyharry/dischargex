(() => {
  if (!('caches' in window)) return;

  const knownRuntimeCaches = new Set([
    'apis',
    'others',
    'start-url',
    'static-data-assets',
    'static-image-assets',
    'next-image',
    'static-audio-assets',
    'static-video-assets',
    'static-js-assets',
    'static-style-assets',
    'static-font-assets',
    'google-fonts-webfonts',
    'google-fonts-stylesheets',
  ]);
  const isDischargeXRegistration = (registration) => {
    const workers = [registration.active, registration.waiting, registration.installing].filter(Boolean);
    const scope = new URL(registration.scope);
    return (
      scope.origin === location.origin &&
      scope.pathname === '/' &&
      workers.some((worker) => {
        const script = new URL(worker.scriptURL);
        return script.origin === location.origin && script.pathname === '/sw.js';
      })
    );
  };

  const cleanup = async () => {
    try {
      const registrations = 'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistrations()
        : [];
      const owned = registrations.filter(isDischargeXRegistration);
      const controllerUrl = 'serviceWorker' in navigator && navigator.serviceWorker.controller
        ? new URL(navigator.serviceWorker.controller.scriptURL)
        : null;
      const controlledByDischargeX =
        controllerUrl?.origin === location.origin && controllerUrl.pathname === '/sw.js';
      const hasDischargeXWorker = owned.length > 0 || controlledByDischargeX;

      await Promise.all(owned.map((registration) => registration.unregister()));

      const cacheNames = await caches.keys();
      const rootPrecacheName = `workbox-precache-v2-${location.origin}/`;
      const obsolete = cacheNames.filter(
        (name) =>
          hasDischargeXWorker &&
          (knownRuntimeCaches.has(name) || name === rootPrecacheName)
      );
      await Promise.all(obsolete.map((name) => caches.delete(name)));

      const reloadKey = 'dischargex:privacy-sw-reset-reloaded';
      if (controlledByDischargeX && !sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        location.reload();
      }
    } catch {
      // Keep the app usable if the browser blocks service-worker cleanup.
    }
  };

  void cleanup();
})();
