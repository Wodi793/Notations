/* Offline support for the Home Screen app. Caches the app shell under a versioned name; tools/build-artifact.js
   stamps VERSION from the files' contents, so any change to the app produces a new cache and an update offer. */
const VERSION = 'f664b06159';
const CACHE = 'notations-' + VERSION;
// The app shell, plus the piano samples so the Home Screen app has the real piano offline.
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/engine.js', 'js/chordname.js', 'js/progcheck.js', 'js/musicxml.js', 'js/engine-worker.js', 'js/engine-client.js', 'js/util.js', 'js/storage.js', 'js/sound.js', 'js/app.js', 'js/sheets.js', 'js/staff.js', 'js/progressions.js', 'js/space.js', 'js/boot.js',
  'tests/lab-cases.json', 'tests/progressions.json', 'vendor/vexflow-5.0.0/vexflow-bravura.js', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-32.png',
  'samples/piano/A0.m4a', 'samples/piano/C1.m4a', 'samples/piano/Ds1.m4a', 'samples/piano/Fs1.m4a', 'samples/piano/A1.m4a', 'samples/piano/C2.m4a', 'samples/piano/Ds2.m4a', 'samples/piano/Fs2.m4a', 'samples/piano/A2.m4a', 'samples/piano/C3.m4a', 'samples/piano/Ds3.m4a', 'samples/piano/Fs3.m4a', 'samples/piano/A3.m4a', 'samples/piano/C4.m4a', 'samples/piano/Ds4.m4a', 'samples/piano/Fs4.m4a', 'samples/piano/A4.m4a', 'samples/piano/C5.m4a', 'samples/piano/Ds5.m4a', 'samples/piano/Fs5.m4a', 'samples/piano/A5.m4a', 'samples/piano/C6.m4a', 'samples/piano/Ds6.m4a', 'samples/piano/Fs6.m4a', 'samples/piano/A6.m4a', 'samples/piano/C7.m4a', 'samples/piano/Ds7.m4a', 'samples/piano/Fs7.m4a', 'samples/piano/A7.m4a', 'samples/piano/C8.m4a',
];
const FONTS = 'notations-fonts';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('notations-') && k !== CACHE && k !== FONTS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// A new version waits until the page asks for it, so nothing reloads mid-use.
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin) {
    // App files: from the cache first, so the app opens offline; anything not cached falls back to the network.
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : null)).then((hit) => hit || fetch(req)));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // Fonts: serve what is cached, refresh it in the background.
    e.respondWith(caches.open(FONTS).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
