/* PROGRESSIONS — a run of chords Bill builds, plays and translates as a whole. The tray sits under the bridge band.
   With two or more chords, the translation is chosen for the whole run (Engine.progression) to keep the sound close
   and the voices moving smoothly; a chord Bill picks by hand is locked and the run is optimised around it. */
const prog = () => S.work.prog || (S.work.prog = { chords: [], name: '' });
// For key prediction: each chord's sounding pitches.
function progressionPitches() { return prog().chords.map((c) => c.pitches).filter((p) => p && p.length); }
const instOf = (src) => (src.kind === 'staff' ? STAFF : src.kind === 'piano' ? E.PIANO : instr(src.instrument));

function chordRecord() {
  const A = ses.A;
  if (!A || A.empty) return null;
  const card = ses.picked ? ses.picked.result : currentCard();
  return {
    id: 'k' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    src: packSource(), name: A.name, pitches: A.notes.filter((n) => n.weight >= 1).map((n) => n.pitch),
    translation: card && card.kind !== 'staff' && !ses.pending ? packVoicing(card) : null, tgt: S.settings.tgt, locked: false,
    bar: null, beat: null, lines: null, analysis: null,
  };
}
const voicingOfChip = (c) => (c && c.translation && c.tgt === S.settings.tgt ? Object.assign({ capos: S.work.tgtCapos }, c.translation) : null);
// The neighbours' chosen voicings, so the open chord's cards are ranked in context.
function chipNeighbours() {
  const i = ses.chipOpen, cs = prog().chords;
  if (i == null || !cs[i]) return {};
  return { previousVoicing: voicingOfChip(cs[i - 1]), nextVoicing: voicingOfChip(cs[i + 1]) };
}
// Called by recompute: while a chip is open, edits to the source save back to it.
function chipSaveBack() {
  const i = ses.chipOpen, c = prog().chords[i];
  if (c == null || ses.loadingChip) { ses.loadingChip = false; return; }
  const src = packSource();
  if (JSON.stringify(src) === JSON.stringify(c.src)) return;
  Object.assign(c, { src, name: ses.A.name, pitches: ses.A.notes.filter((n) => n.weight >= 1).map((n) => n.pitch), locked: false, translation: null });
  scheduleProgression();
}
// Load a source into the source strip without touching the target.
function applySource(src) {
  if (src.kind === 'staff') { S.settings.src = 'staff'; S.work.staff = src.pitches.slice(); S.work.staffSpell = {}; }
  else if (src.kind === 'piano') { S.settings.src = 'piano'; S.work.piano = src.pitches.slice(); }
  else { if (!instr(src.instrument)) return false; S.settings.src = src.instrument; S.work.fing[src.instrument] = src.fingering.map((f) => (f < 0 ? null : f)); S.work.srcCapos = clone(src.capos || []); }
  return true;
}
function openChip(i) {
  const c = prog().chords[i];
  if (!c || !applySource(c.src)) return toast('That chord’s instrument is no longer saved.');
  ses.chipOpen = i; ses.loadingChip = true; ses.wantCard = voicingOfChip(c);
  ses.fit.src = true; save(true); recompute(0, false); render();
}

/* The run is re-optimised a moment after anything in it changes. */
let progT = 0, progGen = 0;
function scheduleProgression() { clearTimeout(progT); progT = setTimeout(optimiseRun, 300); }
async function optimiseRun() {
  const cs = prog().chords, tgt = side('tgt');
  if (cs.length < 2 || isStaff(tgt)) return;
  const gen = ++progGen;
  const ids = new Set(cs.filter((c) => c.src.kind === 'strings').map((c) => c.src.instrument));
  const chords = cs.map((c) => ({
    source: c.src.kind === 'strings' ? { kind: 'strings', instrument: instr(c.src.instrument), fingering: c.src.fingering, capos: c.src.capos || [] } : { kind: 'piano', pitches: c.src.pitches },
    locked: c.locked && c.tgt === tgt.id && c.translation ? c.translation : null,
  }));
  if (chords.some((c) => c.source.kind === 'strings' && !c.source.instrument)) return;
  void ids;
  let r;
  try { r = await Eng.call('progression', { chords, target: tgt, capos: isPiano(tgt) ? [] : S.work.tgtCapos, weights: E.effectiveWeights(S.weights, S.taste), options: opts() }); } catch (e) { return; }
  if (gen !== progGen) return;
  r.chords.forEach((rc, i) => {
    const c = cs[i];
    if (!c || !rc.chosen) return;
    if (!(c.locked && c.tgt === tgt.id)) { c.translation = packVoicing(rc.chosen); c.tgt = tgt.id; c.locked = false; }
    // How each voice moves to the next chord, kept for the analysis round.
    c.voiceMoves = r.steps[i] ? r.steps[i].pairs : null;
    c.stepLines = r.steps[i] ? r.steps[i].lines.map((l) => `${l.points > 0 ? '+' : ''}${l.points}: ${l.detail}`) : null;
  });
  save(true); renderTray();
  if (ses.chipOpen != null) { ses.loadingChip = true; ses.wantCard = voicingOfChip(cs[ses.chipOpen]); recompute(0, false); renderTarget(); renderBridge(); }
}

/* ───────── tray ───────── */
function renderTray() {
  const el = $('#tray');
  if (!el || !S) return;
  const cs = prog().chords, n = cs.length, open = ses.chipOpen;
  if (!n) { el.innerHTML = `<button class="pill trayadd" data-act="progadd"><span>+ Add to progression</span></button>`; return; }
  const chip = (c, i) => `<button class="tchip ${i === open ? 'open' : ''} ${i === ses.playIdx ? 'playing' : ''} ${c.locked && c.tgt === S.settings.tgt ? 'locked' : ''}" data-act="chip" data-i="${i}" aria-pressed="${i === open}">${esc(c.name)}</button>`;
  const key = E.predictKey(progressionPitches());
  const keyBtn = key ? `<button class="txtbtn keybtn" data-act="progkey" aria-label="Key: ${esc(key.key.name)}">${esc(key.key.name)}${key.confidence < 0.5 ? '?' : ''}</button>` : '';
  const ctl = `<button class="iconbtn" data-act="progplay" aria-label="${ses.playing ? 'Stop' : 'Play the progression'}">${ses.playing ? '<svg class="ico" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1"/></svg>' : '<svg class="ico" viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5z"/></svg>'}</button>
    <div class="seg" role="group" aria-label="What you hear"><button data-act="proghear" data-v="src" aria-pressed="${S.settings.progHear !== 'tgt'}"><span>Original</span></button><button data-act="proghear" data-v="tgt" aria-pressed="${S.settings.progHear === 'tgt'}"><span>Translation</span></button></div>
    <div class="step tempo"><button data-act="progtempo" data-d="-1" aria-label="Slower">−</button><output>${S.settings.tempo}</output><button data-act="progtempo" data-d="1" aria-label="Faster">+</button></div>
    ${keyBtn}<button class="txtbtn" data-act="progmore" aria-label="Progression: save, clear, list">More</button>`;
  if (!ses.roomy) {
    const i = open != null ? open : Math.max(0, n - 1);
    el.innerHTML = `<div class="tray-one"><button class="iconbtn" data-act="progstep" data-d="-1" aria-label="Previous chord">${ICON.left}</button>${chip(cs[i], i).replace('</button>', ` <small>${i + 1} of ${n}</small></button>`)}<button class="iconbtn" data-act="progstep" data-d="1" aria-label="Next chord">${ICON.right}</button><button class="tchip add" data-act="progadd" aria-label="Add the current chord">+</button></div><div class="tray-ctl">${ctl}</div>`;
    return;
  }
  el.innerHTML = `<div class="tray-chips" id="trayChips">${cs.map(chip).join('')}<button class="tchip add" data-act="progadd" aria-label="Add the current chord">+</button></div><div class="tray-ctl">${ctl}</div>`;
}

/* Long-press a chip for duplicate, move, unlock and delete; drag it to reorder. */
let chipHold = 0, chipDrag = null;
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.tchip[data-i]');
  if (!el) return;
  const i = +el.dataset.i;
  ses.chipLong = false;
  chipDrag = { el, i, x0: e.clientX, moved: false };
  chipHold = setTimeout(() => { if (!chipDrag || !chipDrag.moved) { ses.chipLong = true; chipActions(i); } }, 500);
});
document.addEventListener('pointermove', (e) => {
  if (!chipDrag) return;
  const dx = e.clientX - chipDrag.x0;
  if (!chipDrag.moved && Math.abs(dx) > 10) { chipDrag.moved = true; clearTimeout(chipHold); chipDrag.el.classList.add('dragging'); }
  if (chipDrag.moved) chipDrag.el.style.transform = `translateX(${dx}px)`;
});
document.addEventListener('pointerup', (e) => {
  clearTimeout(chipHold);
  if (!chipDrag) return;
  const d = chipDrag; chipDrag = null;
  if (!d.moved) return;
  ses.chipDragged = true;
  const chips = [...document.querySelectorAll('#trayChips .tchip[data-i]')];
  let to = chips.findIndex((c) => { const r = c.getBoundingClientRect(); return e.clientX < r.left + r.width / 2; });
  if (to < 0) to = chips.length;
  if (to > d.i) to--;
  moveChip(d.i, to);
});
function moveChip(from, to) {
  const cs = prog().chords;
  to = clamp(to, 0, cs.length - 1);
  if (from === to) return renderTray();
  const [c] = cs.splice(from, 1); cs.splice(to, 0, c);
  if (ses.chipOpen === from) ses.chipOpen = to;
  else if (ses.chipOpen != null && from < ses.chipOpen && to >= ses.chipOpen) ses.chipOpen--;
  else if (ses.chipOpen != null && from > ses.chipOpen && to <= ses.chipOpen) ses.chipOpen++;
  save(); renderTray(); scheduleProgression();
}
function chipActions(i) {
  const c = prog().chords[i];
  if (!c) return;
  openSheet(c.name, () => {
    const locked = c.locked && c.tgt === S.settings.tgt;
    return `${c.stepLines && c.stepLines.length ? sec('Move to the next chord', c.stepLines.map((l) => `<p class="note">${esc(l)}</p>`).join('')) : ''}
      <div class="row tap" data-act="chipdup" data-i="${i}"><span class="grow">Duplicate</span></div>
      <div class="row tap" data-act="chipmove" data-i="${i}" data-d="-1"><span class="grow">Move left</span></div>
      <div class="row tap" data-act="chipmove" data-i="${i}" data-d="1"><span class="grow">Move right</span></div>
      ${locked ? `<div class="row tap" data-act="chipunlock" data-i="${i}"><span class="grow">Unlock<span class="sub">Let the run choose this chord's voicing again.</span></span></div>` : ''}
      <div class="row tap" data-act="chipdel" data-i="${i}"><span class="grow">Delete</span></div>`;
  }, true);
}

/* Playing: steps through the chips at the tempo, two beats each, Block or Arpeggio as set. */
function stopProgression() { (ses.playTimers || []).forEach(clearTimeout); ses.playTimers = []; ses.playing = false; ses.playIdx = null; renderTray(); }
async function playChip(i) {
  const c = prog().chords[i];
  if (!c) return;
  ses.playIdx = i; openChip(i); renderTray();
  if (S.settings.progHear === 'tgt') {
    const v = voicingOfChip(c), tgt = side('tgt');
    if (!v) return;
    const sched = await Snd.play(eventsOf(tgt, S.work.tgtCapos, v), isPiano(tgt) || isStaff(tgt));
    setTimeout(() => { if (sched) lightUp(document.querySelectorAll('#cards .card')[ses.card], sched); }, 150);
  } else {
    const inst = instOf(c.src);
    const sched = await Snd.play(eventsOf(inst, c.src.capos || [], c.src.kind === 'strings' ? { fingering: c.src.fingering } : { pitches: c.src.pitches }), c.src.kind !== 'strings');
    if (sched) lightUp($('#srcScroll'), sched);
  }
}

Object.assign(ACT, {
  progadd() {
    const r = chordRecord();
    if (!r) return toast('Enter a chord first.');
    const cs = prog().chords;
    cs.push(r); ses.chipOpen = null;
    save(); renderTray(); scheduleProgression();
    requestAnimationFrame(() => { const t = $('#trayChips'); if (t) t.scrollLeft = t.scrollWidth; });
  },
  chip(el) {
    if (ses.chipLong) { ses.chipLong = false; return; }
    if (ses.chipDragged) { ses.chipDragged = false; return; }
    const i = +el.dataset.i;
    if (ses.chipOpen === i) { ses.chipOpen = null; renderTray(); return; }
    openChip(i); renderTray();
  },
  progstep(el) {
    const n = prog().chords.length;
    if (!n) return;
    const i = clamp((ses.chipOpen != null ? ses.chipOpen : n - 1) + +el.dataset.d, 0, n - 1);
    openChip(i); renderTray();
  },
  progplay() {
    if (ses.playing) return stopProgression();
    const cs = prog().chords;
    if (!cs.length) return;
    Snd.unlock();
    const dur = (2 * 60 / S.settings.tempo) * 1000;
    ses.playing = true; ses.playTimers = cs.map((_, i) => setTimeout(() => playChip(i), i * dur));
    ses.playTimers.push(setTimeout(stopProgression, cs.length * dur));
    renderTray();
  },
  proghear(el) { S.settings.progHear = el.dataset.v; save(); renderTray(); },
  progtempo(el) { S.settings.tempo = clamp(S.settings.tempo + 5 * +el.dataset.d, 40, 160); save(); renderTray(); },
  // The predicted key with its two alternatives, one tap from using any of them on the staff.
  progkey() {
    const g = E.predictKey(progressionPitches());
    if (!g) return;
    openSheet('Key', () => {
      const row = (name, sub) => `<div class="row tap" data-act="usekey" data-k="${esc(name)}"><span class="grow"><span class="name">${esc(name)}</span><span class="sub">${sub}</span></span></div>`;
      return `<p class="note">Predicted from ${progressionPitches().length} chord${progressionPitches().length === 1 ? '' : 's'}, weighing each note, the bass notes, and the last chord most. ${g.confidence < 0.5 ? 'Not a confident guess.' : ''}</p>` +
        row(g.key.name, `Most likely · confidence ${Math.round(g.confidence * 100)}%`) + g.alternatives.map((k) => row(k.name, 'Next most likely')).join('') +
        '<p class="note">Tap a key to use it for the staff’s key signature.</p>';
    }, true);
  },
  usekey(el) {
    const st = staffSettings(); st.spelling = 'key'; st.key = el.dataset.k;
    save(); closeSheet(); render(); toast(`The staff now uses ${el.dataset.k}.`);
  },
  progmore() {
    openSheet('Progression', () => {
      const cs = prog().chords;
      return sec('Chords', cs.map((c, i) => `<div class="row tap" data-act="chiprow" data-i="${i}"><span class="grow"><span class="name">${i + 1}. ${esc(c.name)}</span><span class="sub">${c.translation ? esc(c.translation.fingering ? c.translation.fingering.map((f) => (f < 0 ? 'x' : f)).join('-') : c.translation.pitches.map((p) => E.pitchName(p)).join(' ')) : 'not yet translated'}${c.locked && c.tgt === S.settings.tgt ? ' · chosen by you' : ''}</span></span>${pill('More', 'chipmore', `data-i="${i}"`)}</div>`).join('')) +
        sec('Save', `<div class="row"><input class="grow" id="progName" placeholder="Name this progression" maxlength="48" value="${esc(prog().name || '')}" aria-label="Progression name">${pill('Save', 'progsave', '', 'primary')}</div><p class="note">Saved progressions are in the Library, and in backups.</p>`) +
        `<div class="row"><span class="grow"></span>${pill(ses.confirmClear ? 'Tap again to clear' : 'Clear the progression', 'progclear', '', ses.confirmClear ? 'on' : '')}</div>`;
    }, true);
  },
  chiprow(el, e) { if (e.target.closest('[data-act="chipmore"]')) return; closeSheet(); openChip(+el.dataset.i); renderTray(); },
  chipmore(el, e) { e.stopPropagation(); chipActions(+el.dataset.i); },
  chipdup(el) { const cs = prog().chords, i = +el.dataset.i, c = clone(cs[i]); c.id += 'd'; cs.splice(i + 1, 0, c); closeSheet(); save(); renderTray(); scheduleProgression(); },
  chipmove(el) { const i = +el.dataset.i; closeSheet(); moveChip(i, i + +el.dataset.d); },
  chipunlock(el) { const c = prog().chords[+el.dataset.i]; c.locked = false; closeSheet(); save(); renderTray(); scheduleProgression(); },
  chipdel(el) {
    const cs = prog().chords, i = +el.dataset.i;
    cs.splice(i, 1);
    if (ses.chipOpen === i) ses.chipOpen = null; else if (ses.chipOpen > i) ses.chipOpen--;
    closeSheet(); save(); renderTray(); scheduleProgression();
  },
  progsave() {
    const name = ($('#progName').value || '').trim();
    if (!name) return toast('Give the progression a name first.');
    const p = prog(); p.name = name;
    const rec = { id: 'p' + Date.now(), format: 'notations-progression', version: 1, title: name, source: null, savedAt: Date.now(), target: S.settings.tgt, tgtCapos: clone(S.work.tgtCapos), chords: clone(p.chords) };
    const at = S.progressions.findIndex((x) => x.title === name);
    if (at >= 0) S.progressions[at] = rec; else S.progressions.unshift(rec);
    save(); closeSheet(); toast(at >= 0 ? 'Progression updated in the Library.' : 'Progression saved to the Library.');
  },
  progclear() {
    if (!ses.confirmClear) { ses.confirmClear = true; return drawSheet(true); }
    ses.confirmClear = false; S.work.prog = { chords: [], name: '' }; ses.chipOpen = null;
    save(); closeSheet(); renderTray();
  },
  progload(el, e) {
    if (e.target.closest('[data-act="progdel"]')) return;
    const p = S.progressions.find((x) => x.id === el.dataset.id);
    if (!p) return;
    S.work.prog = { chords: clone(p.chords), name: p.title };
    if (p.target && instr(p.target)) { S.settings.tgt = p.target; S.work.tgtCapos = clone(p.tgtCapos || []); }
    ses.chipOpen = null; save(); closeSheet();
    if (S.work.prog.chords.length) openChip(0); else render();
    renderTray(); scheduleProgression(); toast(`Loaded “${p.title}”.`);
  },
  progdel(el, e) { e.stopPropagation(); S.progressions = S.progressions.filter((x) => x.id !== el.dataset.id); save(); drawSheet(true); },
});
