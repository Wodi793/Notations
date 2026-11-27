/* BOOT — load data, draw the first screen, and on the web build register the offline worker. */
(async function boot() {
  await loadLabCases();
  S = await Store.load();
  recompute();
  render();
  requestAnimationFrame(() => { render(); if (ses.out) flashComp(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => renderBridge());
  if (BUILD === 'artifact') { const tag = $('#buildTag'); if (tag) tag.hidden = false; initRemote(); }
  else registerWorker();
  const nag = backupReminder();
  if (nag) setTimeout(() => toast(nag, { label: 'Back up', act: 'backupnow' }), 1500);
  window.Notations = { state: () => S, session: () => ses, Engine: E, store: Store };
})();

let pendingWorker = null;
// Offline: cache the app with a versioned service worker. A new version waits until Bill chooses to reload.
function registerWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (w) => { pendingWorker = w; toast('Updated. Reload to use it.', { label: 'Reload', act: 'applyupdate' }); };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
  }).catch(() => { /* offline support is optional */ });
  ACT.applyupdate = () => { if (pendingWorker) pendingWorker.postMessage({ type: 'skipWaiting' }); else location.reload(); };
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
}
