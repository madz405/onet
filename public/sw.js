// Service worker KOYEN (PWA). Sengaja minimal: tidak menyimpan hasil API atau
// media supaya data download selalu segar. Hanya menyediakan halaman offline
// saat HP tidak ada internet.
const CACHE = "koyen-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Hanya tangani perpindahan halaman; semua request lain (API, media,
  // Turnstile, dll) dibiarkan langsung ke jaringan.
  if (req.mode !== "navigate") return;
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
});
