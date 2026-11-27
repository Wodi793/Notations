/* STORAGE — Bill's data: learned weights, picks, favourites, translations, tests, instruments and capo setups.
   Kept in IndexedDB, with persistent storage requested so iOS is less likely to clear it. Data saved by the
   first build in localStorage is carried over on first load. Backup and restore stay the safety net. */
const LS_KEY = 'notations.state.v1';
const preset = (id) => E.PRESETS.find((p) => p.id === id);
let LAB_CASES = [];
function starterTests() {
  return LAB_CASES.map((t) => {
    const c = clone(t);
    if (c.capoFret) { c.capos = [E.fullCapo(preset(c.target), c.capoFret)]; delete c.capoFret; }
    return Object.assign({ status: 'provisional', capos: [] }, c);
  });
}
function defaultState() {
  return {
    v: 1, updatedAt: 0,
    settings: { mode: 'simple', play: 'block', comfortMm: 105, impossibleMm: 135, a4: 440, preferEasier: false, hintShown: false, src: 'piano', tgt: 'mandolin', libGroup: 'chord' },
    weights: {}, taste: E.newTaste(), instruments: [], capoSetups: [], favourites: [], translations: [], tests: starterTests(), picks: [],
    work: { piano: [60, 64, 67, 71], staff: [60, 64, 67, 71], staffSpell: {}, staffLast: null, fing: {}, srcCapos: [], tgtCapos: [] },
    meta: { lastBackupAt: 0, picksAtBackup: 0 },
  };
}
function migrate(o) {
  const d = defaultState();
  for (const k of Object.keys(d)) if (o[k] == null) o[k] = d[k];
  o.settings = Object.assign(d.settings, o.settings);
  o.work = Object.assign(d.work, o.work);
  o.meta = Object.assign(d.meta, o.meta);
  if (!o.taste.global) o.taste = E.newTaste();
  return o;
}
let S = null;

/* IndexedDB, one record holding the whole state. Writes are coalesced and flushed when the app is hidden. */
const Store = {
  db: null, where: 'memory', persisted: null, timer: 0,
  open() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('notations', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => { this.db = req.result; resolve(true); };
        req.onerror = req.onblocked = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  },
  get(key) {
    return new Promise((resolve) => {
      try { const r = this.db.transaction('kv').objectStore('kv').get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(undefined); } catch (e) { resolve(undefined); }
    });
  },
  put(key, value) {
    return new Promise((resolve) => {
      try { const tx = this.db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(value, key); tx.oncomplete = () => resolve(true); tx.onerror = tx.onabort = () => resolve(false); } catch (e) { resolve(false); }
    });
  },
  async load() {
    let raw = null;
    if (await this.open()) { raw = await this.get('state'); this.where = 'indexeddb'; }
    if (!raw) { try { const t = localStorage.getItem(LS_KEY); if (t) raw = JSON.parse(t); if (!this.db) this.where = 'localstorage'; } catch (e) { /* no storage: run from defaults */ } }
    if (navigator.storage && navigator.storage.persist) {
      try { this.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist()); } catch (e) { this.persisted = null; }
    }
    return raw ? migrate(raw) : defaultState();
  },
  write() {
    clearTimeout(this.timer); this.timer = 0;
    if (this.db) this.put('state', JSON.parse(JSON.stringify(S)));
    else { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { /* keep working without it */ } }
  },
  schedule() { if (!this.timer) this.timer = setTimeout(() => this.write(), 400); },
  flush() { if (this.timer) this.write(); },
};
function saveLocal() { Store.write(); }
function save(workOnly) { if (!workOnly) S.updatedAt = Date.now(); Store.schedule(); if (!workOnly) schedulePush(); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') Store.flush(); });
window.addEventListener('pagehide', () => Store.flush());

// One gentle line when there is learning newer than the last backup and that backup is 30 days old or more.
function backupReminder() {
  const m = S.meta, picks = S.picks.length;
  if (picks <= (m.picksAtBackup || 0)) return null;
  const since = m.lastBackupAt || (S.picks[0] && S.picks[0].t) || Date.now();
  const days = Math.floor((Date.now() - since) / 86400000);
  return days >= 30 ? (m.lastBackupAt ? `No backup for ${days} days.` : 'Your picks have never been backed up.') : null;
}
function markBackedUp() { S.meta.lastBackupAt = Date.now(); S.meta.picksAtBackup = S.picks.length; save(); }

/* The artifact build also keeps a copy in the signed-in viewer's Claude account store. */
const PARTS = { core: ['settings', 'weights', 'taste', 'instruments', 'capoSetups', 'meta'], library: ['favourites', 'translations', 'tests'], picks: ['picks'] };
const remote = { col: null, status: 'device', pushed: {}, busy: false, dirty: false, t: 0 };
const partJson = (name) => { const o = {}; for (const k of PARTS[name]) o[k] = S[k]; return JSON.stringify(o); };
function schedulePush() { if (!remote.col) return; clearTimeout(remote.t); remote.t = setTimeout(push, 2000); }
async function push() {
  if (remote.busy) { remote.dirty = true; return; }
  remote.busy = true;
  try {
    for (const n of Object.keys(PARTS)) {
      const j = partJson(n);
      if (remote.pushed[n] === j) continue;
      await remote.col.doc(n).set({ v: 1, updatedAt: S.updatedAt, json: j });
      remote.pushed[n] = j;
    }
    remote.status = 'account';
  } catch (e) { remote.status = 'error'; }
  remote.busy = false;
  if (remote.dirty) { remote.dirty = false; schedulePush(); }
}
async function initRemote() {
  try {
    if (BUILD !== 'artifact' || !window.claude || !window.claude.use) return;
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (!db || !user) return;
    const uid = await user.id();
    if (!uid) return;
    const col = db.collection('data/users/' + uid), names = Object.keys(PARTS);
    const snaps = await Promise.all(names.map((n) => col.doc(n).get()));
    let newest = 0;
    const got = {};
    snaps.forEach((s, i) => { if (s.exists) { const d = s.data(); got[names[i]] = d; newest = Math.max(newest, d.updatedAt || 0); } });
    remote.col = col; remote.status = 'account';
    if (newest > (S.updatedAt || 0)) {
      for (const n of names) if (got[n]) { Object.assign(S, JSON.parse(got[n].json)); remote.pushed[n] = got[n].json; }
      S.updatedAt = newest; S = migrate(S); saveLocal(); recompute(); render();
    } else if (S.updatedAt) schedulePush();
  } catch (e) { remote.status = 'device'; }
}

/* Lab cases: inlined in the artifact build, fetched from tests/ on the web build. */
async function loadLabCases() {
  if (window.NOTATIONS_LAB_CASES) { LAB_CASES = window.NOTATIONS_LAB_CASES; return; }
  try { const r = await fetch('tests/lab-cases.json'); LAB_CASES = (await r.json()).cases; } catch (e) { LAB_CASES = []; }
}
