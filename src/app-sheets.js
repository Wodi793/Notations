/* ───────── sheets ───────── */
const stack = [];
function openSheet(title, fn, fresh) {
  if (fresh) stack.length = 0;
  stack.push({ title, fn });
  drawSheet();
  $('#sheet').classList.add('open'); $('#scrim').classList.add('open');
}
function drawSheet(keep) {
  const top = stack[stack.length - 1];
  if (!top) return;
  const b = $('#sheetBody'), st = b.scrollTop;
  $('#sheetTitle').textContent = typeof top.title === 'function' ? top.title() : top.title;
  $('#sheetBack').hidden = stack.length < 2;
  b.innerHTML = top.fn();
  b.scrollTop = keep ? st : 0;
}
function closeSheet() { stack.length = 0; $('#sheet').classList.remove('open'); $('#scrim').classList.remove('open'); }
const sec = (title, body) => `<section class="sec"><span class="rubric">${title}</span>${body}</section>`;
const pill = (label, act, attrs, cls) => `<button class="pill ${cls || ''}" data-act="${act}" ${attrs || ''}><span>${label}</span></button>`;
const stepper = (act, value, attrs) => `<div class="step"><button data-act="${act}" data-d="-1" ${attrs || ''} aria-label="Less">−</button><output>${value}</output><button data-act="${act}" data-d="1" ${attrs || ''} aria-label="More">+</button></div>`;
const tuning = (i) => (isPiano(i) ? 'A0 to C8' : i.courses.map((c) => E.pitchName(E.mainOf(c)).replace('♯', '♯') + (c.strings.length > 1 ? '×' + c.strings.length : '')).join(' ') + ` · ${i.scaleLengthMm} mm`);
const capoText = (inst, capos) => (capos || []).map((c) => {
  const n = inst.courses.length, cov = [];
  for (let i = 0; i < n; i++) if (inst.courses[i].strings.some((_, s) => c.strings.includes(i + ':' + s))) cov.push(n - i);
  return `fret ${c.fret}` + (cov.length === n ? '' : ` on ${cov.sort((a, b) => a - b).join(',')}`);
}).join(' + ');

/* instruments and capos */
function instrSheet(which) {
  const cur = side(which), capKey = which + 'Capos';
  let h = '';
  if (!isPiano(cur)) {
    const capos = S.work[capKey], n = cur.courses.length, multi = cur.courses.some((c) => c.strings.length > 1);
    let rows = '';
    capos.forEach((cp, i) => {
      let togs = '';
      for (let num = 1; num <= n; num++) {
        const c = n - num, strs = cur.courses[c].strings;
        if (ses.capoSplit && strs.length > 1) strs.forEach((_, s) => { togs += `<button class="tog ${cp.strings.includes(c + ':' + s) ? 'on' : ''}" data-act="capostr" data-i="${i}" data-c="${c}" data-s="${s}" aria-label="String ${num}, strand ${s + 1}"><span>${num}${'abc'[s]}</span></button>`; });
        else togs += `<button class="tog ${strs.some((_, s) => cp.strings.includes(c + ':' + s)) ? 'on' : ''}" data-act="capostr" data-i="${i}" data-c="${c}" aria-label="String ${num}"><span>${num}</span></button>`;
      }
      rows += `<div class="row"><span class="rubric">Fret</span>${stepper('capofret', cp.fret, `data-i="${i}"`)}<div class="grow" style="display:flex;flex-wrap:wrap">${togs}</div><button class="iconbtn" data-act="capodel" data-i="${i}" aria-label="Remove capo">${ICON.x}</button></div>`;
    });
    const split = capos.some((cp) => cur.courses.some((c, ci) => { const k = c.strings.filter((_, s) => cp.strings.includes(ci + ':' + s)).length; return k > 0 && k < c.strings.length; }));
    const setups = S.capoSetups.filter((s) => s.courses === n);
    h += sec(`Capos on ${esc(cur.name)}`, rows +
      (split ? '<p class="note warn">A capo is splitting a course, so its strings sound at different pitches.</p>' : '') +
      `<div class="row">${pill('Add a capo', 'capoadd')}${multi ? pill('Split courses', 'caposplit', '', ses.capoSplit ? 'on' : '') : ''}<span class="grow"></span></div>` +
      (capos.length ? `<div class="row"><input class="grow" id="capoName" placeholder="Name this setup" maxlength="40" aria-label="Setup name">${pill('Save setup', 'caposave')}</div>` : '') +
      setups.map((s) => `<div class="row tap" data-act="capoload" data-id="${s.id}"><span class="grow"><span class="name">${esc(s.name)}</span><span class="sub">${esc(capoText(cur, s.capos))}</span></span><button class="iconbtn" data-act="capodrop" data-id="${s.id}" aria-label="Delete setup">${ICON.x}</button></div>`).join('') +
      '<p class="note">Tap the strings a capo covers. String 1 is the highest. Uncovered strings can still be fretted below the capo.</p>');
  }
  const row = (i, edit) => `<div class="row tap ${i.id === cur.id ? 'sel' : ''}" data-act="pickinstr" data-id="${i.id}"><span class="grow"><span class="name">${esc(i.name)}</span><span class="sub">${esc(tuning(i))}</span></span>${edit ? pill('Edit', 'editinstr', `data-id="${i.id}"`) : ''}</div>`;
  h += sec('Keys', row(E.PIANO, false));
  if (S.instruments.length) h += sec('Your instruments', S.instruments.map((i) => row(i, true)).join(''));
  const groups = [...new Set(E.PRESETS.map((p) => p.group))];
  for (const g of groups) h += sec(g, E.PRESETS.filter((p) => p.group === g).map((i) => row(i, true)).join(''));
  h += sec('Tiple', '<p class="note">Tiple tunings vary by tradition, so there is no ready-made preset. Start from the closer one, check every string, then save it.</p>' +
    E.TIPLE_TEMPLATES.map((i) => `<div class="row tap" data-act="editinstr" data-id="${i.id}"><span class="grow"><span class="name">${esc(i.name)}</span><span class="sub">${esc(tuning(i))} · unconfirmed</span></span>${pill('Check and save', 'editinstr', `data-id="${i.id}"`)}</div>`).join(''));
  return h;
}
function fixFingering(which) {
  if (which !== 'src' || isPiano(side('src'))) return;
  const P = E.prepare(side('src'), S.work.srcCapos), f = srcFing();
  f.forEach((v, c) => { if (v > 0 && (v <= P.minEff[c] || P.collide[c][v])) f[c] = null; });
}
function capoChanged() { fixFingering(ses.sheetSide); save(); recompute(); render(); drawSheet(true); }
const capoList = () => S.work[ses.sheetSide + 'Capos'];

/* instrument editor */
function editorSheet() {
  const d = ses.draft, n = d.courses.length;
  let h = `<div class="row"><span class="grow">Name</span><input id="dName" data-chg="dname" value="${esc(d.name)}" maxlength="48" style="width:56%" aria-label="Instrument name"></div>
    <div class="row"><span class="grow">Scale length<span class="sub">Nut to bridge. Sets how far a hand can reach.</span></span><input class="num" id="dScale" type="number" inputmode="numeric" min="200" max="1100" data-chg="dscale" value="${d.scaleLengthMm}" aria-label="Scale length in millimetres"><span class="rubric">mm</span></div>
    <div class="row"><span class="grow">Frets</span>${stepper('dfrets', d.fretCount)}</div>`;
  d.courses.forEach((c, ci) => {
    let rows = `<div class="row"><span class="grow"><span class="name">String ${n - ci}${ci === 0 ? ' (bass side)' : ci === n - 1 ? ' (treble side)' : ''}</span><span class="sub">${c.startFret ? 'Starts at fret ' + c.startFret : 'Full length'}</span></span><span class="rubric">Starts at</span>${stepper('dstart', c.startFret || 0, `data-c="${ci}"`)}<button class="iconbtn" data-act="dcoursedel" data-c="${ci}" aria-label="Remove string ${n - ci}">${ICON.x}</button></div>`;
    c.strings.forEach((s, si) => {
      rows += `<div class="row" style="padding-left:14px"><span class="grow">${esc(E.pitchName(s.pitch))}</span>${pill('8va−', 'dpitch', `data-c="${ci}" data-s="${si}" data-d="-12"`)}${stepper('dpitch', '½', `data-c="${ci}" data-s="${si}"`)}${pill('8va+', 'dpitch', `data-c="${ci}" data-s="${si}" data-d="12"`)}
        <select data-chg="drole" data-c="${ci}" data-s="${si}" id="role${ci}_${si}" aria-label="Role">${['main', 'unison', 'octave'].map((r) => `<option ${s.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
        ${c.strings.length > 1 ? `<button class="iconbtn" data-act="dstringdel" data-c="${ci}" data-s="${si}" aria-label="Remove strand">${ICON.x}</button>` : ''}</div>`;
    });
    if (c.strings.length < 3) rows += `<div class="row" style="padding-left:14px">${pill('Add a strand to this course', 'dstringadd', `data-c="${ci}"`)}</div>`;
    h += sec(`Course ${ci + 1} of ${n}`, rows);
  });
  h += `<div class="row">${pill('Add a course', 'dcourseadd')}<span class="grow"></span>${ses.draftCustom ? pill('Delete', 'ddelete') : ''}${pill('Save as my instrument', 'dsave', '', 'primary')}</div>`;
  return h;
}

/* library */
function librarySheet() {
  const g = S.settings.libGroup, groups = {};
  for (const f of S.favourites) { const k = g === 'chord' ? f.chord : f.instrName; (groups[k] = groups[k] || []).push(f); }
  let fav = `<div class="row"><span class="grow">Group by</span><div class="seg"><button data-act="libgroup" data-v="chord" aria-pressed="${g === 'chord'}"><span>Chord</span></button><button data-act="libgroup" data-v="instr" aria-pressed="${g !== 'chord'}"><span>Instrument</span></button></div></div>`;
  for (const k of Object.keys(groups).sort()) {
    fav += `<div class="row"><span class="serif" style="font-size:18px">${esc(k)}</span></div>` + groups[k].map((f) => `<div class="row tap" data-act="loadfav" data-id="${esc(f.id)}" style="padding-left:14px"><span class="grow"><span class="name">${esc(g === 'chord' ? f.instrName : f.chord)}</span><span class="sub">${esc(f.text)}${f.capos && f.capos.length ? ' · capo' : ''}</span></span><button class="iconbtn" data-act="delfav" data-id="${esc(f.id)}" aria-label="Remove">${ICON.x}</button></div>`).join('');
  }
  if (!S.favourites.length) fav += '<p class="note">Star a voicing and it is kept here. Tap one to load it as the source.</p>';
  let tr = S.translations.slice(0, 60).map((t) => `<div class="row tap" data-act="loadtr" data-id="${t.id}"><span class="grow"><span class="name">${esc(t.chord)}</span><span class="sub">${esc(t.srcName)} to ${esc(t.tgtName)} · ${esc(t.text)}</span></span><button class="iconbtn" data-act="deltr" data-id="${t.id}" aria-label="Remove">${ICON.x}</button></div>`).join('');
  if (!tr) tr = '<p class="note">Each voicing you choose with “Use this” is saved here with its source.</p>';
  const ins = S.instruments.map((i) => `<div class="row tap" data-act="editinstr" data-id="${i.id}"><span class="grow"><span class="name">${esc(i.name)}</span><span class="sub">${esc(tuning(i))}</span></span></div>`).join('') || '<p class="note">Edit any preset from the instrument list and save it under your own name.</p>';
  const cap = S.capoSetups.map((s) => `<div class="row"><span class="grow"><span class="name">${esc(s.name)}</span><span class="sub">${s.courses} strings · ${s.capos.map((c) => 'fret ' + c.fret).join(' + ')}</span></span><button class="iconbtn" data-act="capodrop" data-id="${s.id}" aria-label="Delete setup">${ICON.x}</button></div>`).join('') || '<p class="note">Save a capo arrangement from an instrument sheet and it appears here.</p>';
  /* LEARN — reserved. A fuller Learn section (why voicings work, ear training) belongs here. Not built in version one. */
  return sec('Favourite voicings', fav) + sec('Saved translations', tr) + sec('Your instruments', ins) + sec('Capo setups', cap) +
    sec('Learn', '<p class="note">Reserved for a fuller guide to why voicings sound the way they do. Not built yet.</p>');
}

/* settings */
function storageNote() {
  if (remote.status === 'account') return 'Saved to your Claude account and on this device.';
  if (remote.status === 'error') return 'Saved on this device. The last save to your account did not go through.';
  return 'Saved on this device only. Make a backup now and then.';
}
function settingsSheet() {
  const st = S.settings;
  const reach = `<div class="row"><span class="grow">Comfortable reach<span class="sub">Stretches up to this are easy.</span></span>${stepper('reach', st.comfortMm + ' mm', 'data-k="comfortMm"')}</div>
    <div class="row"><span class="grow">Impossible above<span class="sub">Shapes wider than this are never offered.</span></span>${stepper('reach', st.impossibleMm + ' mm', 'data-k="impossibleMm"')}</div>
    <div class="row"><span class="grow">Prefer easier<span class="sub">Adds difficulty into the ranking. Off, it only breaks near-ties.</span></span><button class="switch" data-act="easier" aria-pressed="${st.preferEasier}" aria-label="Prefer easier"><span></span></button></div>`;
  const tune = `<div class="row"><span class="grow">A4 reference</span>${stepper('a4', st.a4 + ' Hz')}</div>`;
  let w = '';
  for (const k of Object.keys(E.DEFAULT_WEIGHTS)) {
    const info = E.WEIGHT_INFO[k], v = S.weights[k] != null ? S.weights[k] : E.DEFAULT_WEIGHTS[k];
    w += `<div class="row"><span class="grow">${info[0]}<span class="sub">Default ${E.DEFAULT_WEIGHTS[k]}${info[1] ? ' ' + info[1] : ''}</span></span><input class="num" type="number" inputmode="decimal" step="0.5" min="0" id="w_${k}" data-chg="weight" data-k="${k}" value="${v}" aria-label="${info[0]}"></div>`;
  }
  w += `<div class="row"><span class="grow note">Penalty points. Lower total is a closer sound.</span>${pill('Reset weights', 'wreset')}</div>`;
  const notes = E.tasteNotes(S.taste), ctxs = Object.keys(S.taste.contexts).sort();
  let t = notes.length ? notes.map((n) => `<div class="row"><span class="grow">${esc(n.text)}<span class="sub">${n.picks} picks · weight ×${n.mult}</span></span></div>`).join('')
    : '<p class="note">Nothing learned yet. After five picks in one kind of chord on one kind of instrument, what you favour is listed here in plain words.</p>';
  t += `<div class="row tap" data-act="ctx" data-k="*"><span class="grow"><span class="name">All picks together</span><span class="sub">${S.picks.length} picks</span></span>${ICON.right}</div>`;
  t += ctxs.map((k) => `<div class="row tap" data-act="ctx" data-k="${esc(k)}"><span class="grow"><span class="name">${esc(cap(E.contextLabel(k)))}</span><span class="sub">${S.taste.contexts[k].n} pick${S.taste.contexts[k].n === 1 ? '' : 's'}</span></span>${ICON.right}</div>`).join('');
  if (ctxs.length || Object.keys(S.taste.global).length) t += `<div class="row"><span class="grow"></span>${pill('Forget everything learned', 'tastereset')}</div>`;
  const bk = `<p class="note">${storageNote()} A backup holds instruments, capo setups, favourites, translations, tests, weights and every pick.</p>
    <div class="row">${pill('Back up', 'backup', '', 'primary')}<label class="pill"><span>Restore from file</span><input type="file" id="restoreFile" accept=".json,application/json" data-chg="restorefile" hidden></label><span class="grow"></span></div>
    <div id="bkArea"></div>`;
  return sec('Lab', `<div class="row tap" data-act="lab"><span class="grow"><span class="name">Open the Lab</span><span class="sub">Check the engine against ${S.tests.length} test cases.</span></span>${ICON.right}</div>`) +
    sec('Reach', reach) + sec('Tuning', tune) + sec('Scoring weights', w) + sec('Learned taste', t) + sec('Backup and restore', bk) +
    `<p class="note">Notations, engine ${E.VERSION}. No AI chooses the voicings: the engine lists every playable shape and scores it by the rules above.</p>`;
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);
function ctxSheet(key) {
  const global = key === '*', ctx = global ? null : S.taste.contexts[key];
  if (!global && !ctx) return '<p class="note">Nothing learned here.</p>';
  const eff = global ? null : E.effectiveMultipliers(S.taste, key), share = global ? 0 : ctx.n / (ctx.n + 8);
  let h = `<p class="note">${global ? 'These multipliers apply everywhere, before any context has enough picks of its own.' : `${ctx.n} pick${ctx.n === 1 ? '' : 's'} here, so this context counts for ${Math.round(share * 100)}% and the global weights for the rest.`} A multiplier of 1 is the default; each stays between 0.25 and 4.</p>`;
  for (const k of [...E.LEARNABLE, 'tieWindow']) {
    const own = global ? (S.taste.global[k] || 1) : (ctx.mult[k] || S.taste.global[k] || 1);
    const base = S.weights[k] != null ? S.weights[k] : E.DEFAULT_WEIGHTS[k];
    h += `<div class="row"><span class="grow">${E.WEIGHT_INFO[k][0]}<span class="sub">${global ? `Weight ${fmt(base * own)}` : `In use ×${fmt(eff[k] * 100) / 100}, weight ${fmt(base * eff[k])}`}</span></span><span class="rubric">×</span><input class="num" type="number" inputmode="decimal" step="0.05" min="0.25" max="4" id="m_${k}" data-chg="mult" data-k="${k}" data-ctx="${esc(key)}" value="${Math.round(own * 100) / 100}" aria-label="${E.WEIGHT_INFO[k][0]} multiplier"></div>`;
  }
  return h + `<div class="row"><span class="grow"></span>${pill(global ? 'Reset global learning' : 'Reset this context', 'ctxreset', `data-k="${esc(key)}"`)}</div>`;
}

/* why this score */
function openWhy(i) {
  const res = allCards()[i];
  if (!res) return;
  openSheet(`${ses.A.name} · ${res.kind === 'piano' ? res.label : res.text}`, () => {
    const rows = res.breakdown.map((b) => `<tr><td>${esc(b.rule)}<small>${esc(b.detail)}</small></td><td class="n">${fmt(b.points)}</td></tr>`).join('') || '<tr><td>Nothing given up</td><td class="n">0</td></tr>';
    const dr = res.difficultyParts.map((p) => `<tr><td>${esc(cap(p.label))}</td><td class="n">${p.value > 0 ? '+' : ''}${fmt(p.value)}</td></tr>`).join('');
    const notes = res.kind === 'piano' ? res.pitches : res.pitches;
    const roles = notes.map((p) => { const r = ses.A.roleOfPc[E.mod12(p)]; return `${esc(r ? r.name : E.pitchName(p).replace(/\d+$/, ''))}${E.octaveOf(p)} <span style="color:var(--text2)">${r ? esc(r.label) : 'added'}</span>`; }).join(' &nbsp; ');
    return `<p class="note" style="color:var(--text)">${esc(res.compromise.text)}</p>
      ${(res.violations || []).length ? `<p class="note warn">As entered, this ${esc(res.violations.join('; '))}.</p>` : ''}
      ${res.flags.map((f) => `<p class="note warn">${esc(f.text)}</p>`).join('')}
      ${sec('Sounding notes', `<p class="note" style="color:var(--text)">${roles}</p>`)}
      ${sec('Sound score', `<table class="bd"><tr><th>Rule</th><th class="n">Points</th></tr>${rows}<tr><td><b>Total</b><small>Lower is closer to the source.</small></td><td class="n"><b>${fmt(res.score)}</b></td></tr></table>`)}
      ${res.why.length ? sec('Why these notes went', res.why.map((w) => `<p class="note">${esc(w)}</p>`).join('')) : ''}
      ${sec('Difficulty', `<table class="bd">${dr}<tr><td><b>Rating</b><small>Never added to the sound score. It only breaks ties within ${fmt(ses.W.tieWindow)} points.</small></td><td class="n"><b>${fmt(res.difficulty)} / 10</b></td></tr></table>`)}
      <div class="row"><span class="grow"></span>${pill('Use this', 'usefromwhy', `data-i="${i}"`, 'primary')}</div>`;
  }, true);
}

/* lab */
function labRun() { ses.lab = S.tests.map((tc) => ({ tc, r: E.runTest(tc, instr, {}, {}) })); }
function labSheet() {
  if (!ses.lab || ses.lab.length !== S.tests.length) labRun();
  const L = ses.lab, n = L.length || 1, t1 = L.filter((x) => x.r.rank === 1).length, t3 = L.filter((x) => x.r.rank >= 1 && x.r.rank <= 3).length;
  const conf = L.filter((x) => x.tc.status === 'confirmed'), c3 = conf.filter((x) => x.r.rank >= 1 && x.r.rank <= 3).length;
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  let h = `<div class="stat"><div><span class="rubric">Top 3</span><b>${pct(t3, n)}%</b><span class="note">${t3} of ${L.length}</span></div><div><span class="rubric">Top 1</span><b>${pct(t1, n)}%</b><span class="note">${t1} of ${L.length}</span></div><div><span class="rubric">Your confirmed cases</span><b>${conf.length ? pct(c3, conf.length) + '%' : '–'}</b><span class="note">${conf.length ? `${c3} of ${conf.length} in the top 3` : 'none yet'}</span></div></div>
    <div class="meter" role="img" aria-label="Top-3 hit rate ${pct(t3, n)} percent against a bar of 80"><i style="width:${pct(t3, n)}%"></i><u></u></div>
    <p class="note">The bar is 80% in the top three, with default weights. ${pct(t3, n) >= 80 ? 'The engine clears it.' : 'The engine is below it.'} Provisional cases were written by the builder from common practice, so passing them proves less than passing yours. Confirm a case, or save your own with “Save as test”, and it becomes the authority.</p>`;
  h += sec('Cases', L.map((x, i) => {
    const ok = x.r.rank >= 1 && x.r.rank <= 3, tgt = instr(x.tc.target), src = x.tc.source.kind === 'piano' ? E.PIANO : instr(x.tc.source.instrument);
    return `<div class="row tap" data-act="case" data-i="${i}"><span class="mark ${ok ? '' : 'fail'}" aria-label="${ok ? 'Pass' : 'Fail'}"></span><span class="grow"><span class="name">${esc(x.tc.name)}</span><span class="sub">${esc(src ? src.name : 'missing instrument')} to ${esc(tgt ? tgt.name : 'missing instrument')} · ${x.r.missing ? 'instrument missing' : x.r.rank ? 'rank ' + x.r.rank : 'not in the top four'}</span></span><span class="tag ${x.tc.status === 'confirmed' ? 'ok' : ''}">${x.tc.status === 'confirmed' ? 'Confirmed' : 'Provisional'}</span></div>`;
  }).join(''));
  return h + `<div class="row"><span class="grow"></span>${pill('Restore the starter set', 'labrestore')}</div>`;
}
function caseSheet(i) {
  const x = ses.lab[i];
  if (!x) return '';
  const tc = x.tc, r = x.r, tgt = instr(tc.target);
  if (r.missing) return `<p class="note warn">This case uses an instrument that is no longer saved.</p><div class="row"><span class="grow"></span>${pill('Delete case', 'casedel', `data-i="${i}"`)}</div>`;
  const find = instr, source = E.resolveSource(tc.source, find), ctx = E.contextKey(r.analysis, tgt), LW = E.effectiveWeights(S.weights, S.taste, ctx);
  const learned = E.translate({ source, target: tgt, capos: tc.capos || [], weights: LW, options: { ranked: 12 } });
  const lrank = new Map(learned.ranked.map((c, k) => [c.multiKey, { rank: k + 1, score: c.score }]));
  const shown = new Set(r.results.map((c) => c.multiKey));
  const want = isPiano(tgt) ? (tc.acceptNotes || []).map((a) => (Array.isArray(a) ? a.map((p) => E.pitchName(p)).join(' ') : a)) : (tc.accept || []).map((f) => f.map((v) => (v < 0 ? 'x' : v)).join('-'));
  const rows = r.ranked.map((c, k) => {
    const l = lrank.get(c.multiKey) || (isPiano(tgt) ? null : { rank: 0, score: E.evaluate({ source, target: tgt, capos: tc.capos || [], fingering: c.fingering, weights: LW, analysis: r.analysis }).score });
    return `<tr class="${r.accepted.includes(c.multiKey) ? 'hit' : ''}"><td>${k + 1}. ${esc(c.kind === 'piano' ? c.label : c.text)}${shown.has(c.multiKey) ? ' <span class="tag">shown</span>' : ''}${r.accepted.includes(c.multiKey) ? ' <span class="tag ok">expected</span>' : ''}<small>${esc(c.pitches.map((p) => E.pitchName(p, r.analysis.flat)).join(' '))}</small><small>${esc(c.breakdown.map((b) => `${b.rule.toLowerCase()} ${fmt(b.points)}`).join(', ') || 'nothing given up')}</small></td><td class="n">${fmt(c.score)}</td><td class="n">${l ? fmt(l.score) + (l.rank ? `<small>rank ${l.rank}</small>` : '<small>below 12</small>') : '–'}</td><td class="n">${fmt(c.difficulty)}</td></tr>`;
  }).join('');
  const ok = r.rank >= 1 && r.rank <= 3;
  return `<p class="note" style="color:var(--text)">${esc(r.analysis.name)} to ${esc(tgt.name)}${(tc.capos || []).length ? ', ' + esc(capoText(tgt, tc.capos)) : ''}. ${ok ? `Passes: the expected answer is ranked ${r.rank}.` : r.rank ? 'Fails: the expected answer is fourth, outside the top three.' : 'Fails: the expected answer is not among the voicings shown.'}</p>
    <p class="note">Expected: ${esc(want.join('  or  '))}</p>
    <div class="row"><textarea id="caseNote" data-chg="casenote" data-i="${i}" aria-label="Note" placeholder="Note">${esc(tc.note || '')}</textarea></div>
    <div class="row" style="flex-wrap:wrap"><span class="tag ${tc.status === 'confirmed' ? 'ok' : ''}">${tc.status === 'confirmed' ? 'Confirmed by you' : 'Provisional'}</span><span class="grow"></span>${tc.status === 'confirmed' ? '' : pill('Confirm', 'caseconfirm', `data-i="${i}"`, 'primary')}${pill('Open on main screen', 'caseopen', `data-i="${i}"`)}${pill('Delete', 'casedel', `data-i="${i}"`)}</div>
    <p class="note">To change the expected answer, open the case on the main screen, choose the voicing you want, and save it as a test.</p>
    ${sec('Every ranked candidate', `<div class="wrapx"><table class="bd"><tr><th>Voicing</th><th class="n">Default</th><th class="n">Learned</th><th class="n">Diff.</th></tr>${rows}</table></div><p class="note">Ranked with default weights. Difficulty reorders candidates only when their scores are within the tie window, which is why a slightly higher score can sit above a lower one.</p>`)}`;
}
function loadWork(src, tgtId, capos) {
  if (src.kind === 'piano') { S.settings.src = 'piano'; S.work.piano = (src.pitches || E.parseNotes(src.notes)).slice(); }
  else { if (!instr(src.instrument)) return toast('That instrument is no longer saved.'); S.settings.src = src.instrument; S.work.fing[src.instrument] = src.fingering.map((f) => (f < 0 ? null : f)); S.work.srcCapos = clone(src.capos || []); }
  if (tgtId && instr(tgtId)) { S.settings.tgt = tgtId; S.work.tgtCapos = clone(capos || []); }
  ses.kbInit = false; save(); recompute(); closeSheet(); render(); flashComp();
}

/* backup */
function backupData() { return JSON.stringify({ app: 'Notations', format: 1, engine: E.VERSION, exportedAt: new Date().toISOString(), state: S }, null, 1); }
function restoreFrom(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { return toast('That is not a backup file: it could not be read.'); }
  if (!o || o.app !== 'Notations' || !o.state) return toast('That file is not a Notations backup.');
  ses.pendingRestore = o;
  const s = o.state;
  $('#bkArea').innerHTML = `<p class="note warn">Replace everything here with the backup from ${esc((o.exportedAt || '').slice(0, 10) || 'an unknown date')}? It holds ${(s.picks || []).length} picks, ${(s.favourites || []).length} favourites and ${(s.tests || []).length} tests.</p><div class="row">${pill('Replace everything', 'restoreok', '', 'primary')}${pill('Cancel', 'restorecancel')}<span class="grow"></span></div>`;
}

Object.assign(ACT, {
  closesheet: closeSheet,
  backsheet() { stack.pop(); if (stack.length) drawSheet(); else closeSheet(); },
  instr(el) { ses.sheetSide = el.dataset.side; openSheet(() => (ses.sheetSide === 'src' ? 'Source instrument' : 'Target instrument'), () => instrSheet(ses.sheetSide), true); },
  library() { openSheet('Library', librarySheet, true); },
  settings() { openSheet('Settings', settingsSheet, true); },
  lab() { labRun(); openSheet('Lab', labSheet); },
  case(el) { const i = +el.dataset.i; openSheet(ses.lab[i].tc.name, () => caseSheet(i)); },
  pickinstr(el, e) {
    if (e.target.closest('[data-act="editinstr"]')) return;
    S.settings[ses.sheetSide] = el.dataset.id; S.work[ses.sheetSide + 'Capos'] = [];
    ses.kbInit = false; save(); recompute(); closeSheet(); render();
  },
  editinstr(el, e) {
    e.stopPropagation();
    const base = instr(el.dataset.id);
    ses.draft = clone(base); ses.draftCustom = S.instruments.some((i) => i.id === base.id);
    if (!ses.sheetSide) ses.sheetSide = 'tgt';
    openSheet(ses.draftCustom ? 'Edit instrument' : 'New instrument from ' + base.name, editorSheet);
  },
  capoadd() { capoList().push(E.fullCapo(side(ses.sheetSide), 2)); capoChanged(); },
  capodel(el) { capoList().splice(+el.dataset.i, 1); capoChanged(); },
  capofret(el) { const cp = capoList()[+el.dataset.i]; cp.fret = clamp(cp.fret + +el.dataset.d, 1, 12); capoChanged(); },
  capostr(el) {
    const cp = capoList()[+el.dataset.i], c = +el.dataset.c, inst = side(ses.sheetSide);
    const keys = el.dataset.s != null ? [c + ':' + el.dataset.s] : inst.courses[c].strings.map((_, s) => c + ':' + s);
    const on = keys.every((k) => cp.strings.includes(k));
    cp.strings = cp.strings.filter((k) => !keys.includes(k));
    if (!on) cp.strings.push(...keys);
    capoChanged();
  },
  caposplit() { ses.capoSplit = !ses.capoSplit; drawSheet(true); },
  caposave() {
    const name = ($('#capoName').value || '').trim();
    if (!name) return toast('Give the setup a name first.');
    S.capoSetups.push({ id: 'c' + Date.now(), name, courses: side(ses.sheetSide).courses.length, capos: clone(capoList()) });
    save(); drawSheet(true); toast('Capo setup saved.');
  },
  capoload(el, e) {
    if (e.target.closest('[data-act="capodrop"]')) return;
    const s = S.capoSetups.find((x) => x.id === el.dataset.id);
    if (s) { S.work[ses.sheetSide + 'Capos'] = clone(s.capos); capoChanged(); }
  },
  capodrop(el, e) { e.stopPropagation(); S.capoSetups = S.capoSetups.filter((x) => x.id !== el.dataset.id); save(); drawSheet(true); },
  dfrets(el) { ses.draft.fretCount = clamp((ses.draft.fretCount || 22) + +el.dataset.d, 5, 24); drawSheet(true); },
  dstart(el) { const c = ses.draft.courses[+el.dataset.c]; c.startFret = clamp((c.startFret || 0) + +el.dataset.d, 0, 12); drawSheet(true); },
  dpitch(el) { const s = ses.draft.courses[+el.dataset.c].strings[+el.dataset.s]; s.pitch = clamp(s.pitch + +el.dataset.d, 21, 96); drawSheet(true); },
  dstringadd(el) { const c = ses.draft.courses[+el.dataset.c]; c.strings.push({ pitch: c.strings[0].pitch, role: 'unison' }); drawSheet(true); },
  dstringdel(el) { ses.draft.courses[+el.dataset.c].strings.splice(+el.dataset.s, 1); drawSheet(true); },
  dcourseadd() { const cs = ses.draft.courses; if (cs.length >= 8) return toast('Eight courses is the most the app handles.'); cs.push({ startFret: 0, strings: [{ pitch: clamp((cs.length ? E.mainOf(cs[cs.length - 1]) : 55) + 5, 21, 96), role: 'main' }] }); drawSheet(true); },
  dcoursedel(el) { if (ses.draft.courses.length <= 1) return toast('An instrument needs at least one string.'); ses.draft.courses.splice(+el.dataset.c, 1); drawSheet(true); },
  dsave() {
    const d = ses.draft;
    d.name = (d.name || '').trim();
    if (!d.name) return toast('Give the instrument a name.');
    for (const c of d.courses) { const m = c.strings.findIndex((s) => s.role === 'main'); c.strings.forEach((s, i) => { if (i === (m < 0 ? 0 : m)) s.role = 'main'; else if (s.role === 'main') s.role = s.pitch === c.strings[m < 0 ? 0 : m].pitch ? 'unison' : 'octave'; }); }
    if (!ses.draftCustom) { if (instr(d.id) && instr(d.id).name === d.name) d.name += ' (mine)'; d.id = 'custom-' + Date.now(); d.group = 'Yours'; S.instruments.push(d); }
    else S.instruments[S.instruments.findIndex((i) => i.id === d.id)] = d;
    delete S.work.fing[d.id];
    S.settings[ses.sheetSide] = d.id; S.work[ses.sheetSide + 'Capos'] = [];
    ses.kbInit = false; save(); recompute(); closeSheet(); render(); toast('Saved as your instrument.');
  },
  ddelete() {
    const id = ses.draft.id;
    S.instruments = S.instruments.filter((i) => i.id !== id);
    for (const s of ['src', 'tgt']) if (S.settings[s] === id) { S.settings[s] = s === 'src' ? 'piano' : 'mandolin'; S.work[s + 'Capos'] = []; }
    save(); recompute(); closeSheet(); render(); toast('Instrument deleted.');
  },
  libgroup(el) { S.settings.libGroup = el.dataset.v; save(); drawSheet(true); },
  loadfav(el, e) {
    if (e.target.closest('[data-act="delfav"]')) return;
    const f = S.favourites.find((x) => x.id === el.dataset.id);
    if (!f) return;
    loadWork(f.voicing.pitches ? { kind: 'piano', pitches: f.voicing.pitches } : { kind: 'strings', instrument: f.instr, fingering: f.voicing.fingering, capos: f.capos });
  },
  delfav(el, e) { e.stopPropagation(); S.favourites = S.favourites.filter((x) => x.id !== el.dataset.id); save(); drawSheet(true); renderTarget(); },
  loadtr(el, e) { if (e.target.closest('[data-act="deltr"]')) return; const t = S.translations.find((x) => x.id === el.dataset.id); if (t) loadWork(t.src, t.tgt, t.capos); },
  deltr(el, e) { e.stopPropagation(); S.translations = S.translations.filter((x) => x.id !== el.dataset.id); save(); drawSheet(true); },
  reach(el) {
    const k = el.dataset.k, st = S.settings;
    st[k] = clamp(st[k] + +el.dataset.d * 5, 40, 250);
    if (st.comfortMm > st.impossibleMm) { if (k === 'comfortMm') st.impossibleMm = st.comfortMm; else st.comfortMm = st.impossibleMm; }
    settingChanged();
  },
  easier() { S.settings.preferEasier = !S.settings.preferEasier; settingChanged(); },
  a4(el) { S.settings.a4 = clamp(S.settings.a4 + +el.dataset.d, 415, 466); Snd.cache.clear(); save(); drawSheet(true); },
  wreset() { S.weights = {}; settingChanged(); toast('Weights are back to their defaults.'); },
  tastereset() { S.taste = E.newTaste(); settingChanged(); toast('Learned taste cleared. Your picks are still in the backup.'); },
  ctx(el) { const k = el.dataset.k; openSheet(k === '*' ? 'All picks together' : cap(E.contextLabel(k)), () => ctxSheet(k)); },
  ctxreset(el) {
    if (el.dataset.k === '*') S.taste.global = {}; else delete S.taste.contexts[el.dataset.k];
    save(); recompute(); render(); ACT.backsheet();
  },
  usefromwhy(el) { closeSheet(); usePick(+el.dataset.i); },
  caseconfirm(el) { ses.lab[+el.dataset.i].tc.status = 'confirmed'; save(); drawSheet(true); },
  casedel(el) { const tc = ses.lab[+el.dataset.i].tc; S.tests = S.tests.filter((t) => t !== tc); save(); labRun(); ACT.backsheet(); },
  caseopen(el) { const tc = ses.lab[+el.dataset.i].tc; loadWork(tc.source, tc.target, tc.capos); },
  labrestore() { const have = new Set(S.tests.map((t) => t.id)); for (const t of starterTests()) if (!have.has(t.id)) S.tests.push(t); save(); labRun(); drawSheet(true); },
  async backup() {
    const data = backupData(), name = `notations-backup-${new Date().toISOString().slice(0, 10)}.json`;
    try {
      const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
      if (dl) { await dl.save({ filename: name, data }); return toast('Backup saved.'); }
    } catch (err) { if (err && err.code === 'declined') return; }
    $('#bkArea').innerHTML = `<p class="note">Saving a file is not available in this view. Copy the text below and keep it somewhere safe; paste it back here to restore.</p><textarea id="bkText" readonly aria-label="Backup text">${esc(data)}</textarea><div class="row">${pill('Copy', 'bkcopy', '', 'primary')}<span class="grow"></span></div>`;
  },
  bkcopy() { const t = $('#bkText'); t.select(); try { navigator.clipboard.writeText(t.value).then(() => toast('Backup copied.'), () => toast('Select the text and copy it by hand.')); } catch (e) { toast('Select the text and copy it by hand.'); } },
  restoreok() {
    const o = ses.pendingRestore; if (!o) return;
    S = migrate(o.state); S.updatedAt = Date.now(); ses.pendingRestore = null; ses.lab = null; ses.kbInit = false;
    saveLocal(); schedulePush(); recompute(); closeSheet(); render(); toast('Backup restored.');
  },
  restorecancel() { ses.pendingRestore = null; $('#bkArea').innerHTML = ''; },
});
function settingChanged() { save(); recompute(); render(); drawSheet(true); }
const CHG = {
  weight(el) { const v = parseFloat(el.value); if (isFinite(v) && v >= 0) { if (v === E.DEFAULT_WEIGHTS[el.dataset.k]) delete S.weights[el.dataset.k]; else S.weights[el.dataset.k] = v; save(); recompute(); render(); } },
  mult(el) {
    const v = clamp(parseFloat(el.value) || 1, 0.25, 4), k = el.dataset.k, key = el.dataset.ctx;
    if (key === '*') S.taste.global[k] = v; else S.taste.contexts[key].mult[k] = v;
    save(); recompute(); render(); drawSheet(true);
  },
  dname(el) { ses.draft.name = el.value; },
  dscale(el) { const v = parseInt(el.value, 10); if (v >= 200 && v <= 1100) ses.draft.scaleLengthMm = v; },
  drole(el) { ses.draft.courses[+el.dataset.c].strings[+el.dataset.s].role = el.value; },
  casenote(el) { ses.lab[+el.dataset.i].tc.note = el.value; save(); },
  restorefile(el) { const f = el.files && el.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => restoreFrom(String(rd.result)); rd.readAsText(f); el.value = ''; },
};
document.addEventListener('paste', (e) => {
  if (!stack.length || !$('#bkArea') || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
  const t = (e.clipboardData || window.clipboardData).getData('text');
  if (t && t.includes('"Notations"')) restoreFrom(t);
});

/* ───────── boot ───────── */
loadLocal();
recompute();
render();
requestAnimationFrame(() => { render(); if (ses.out) flashComp(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => renderBridge());
initRemote();
window.Notations = { state: () => S, session: () => ses, Engine: E };
