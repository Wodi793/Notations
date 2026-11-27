/* UTIL — helpers shared by every page script. Loaded right after the engine. */
'use strict';
const E = Engine;
// 'web' on GitHub Pages and the Home Screen; the artifact build sets NOTATIONS_BUILD to 'artifact'.
const BUILD = window.NOTATIONS_BUILD || 'web';
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const clone = (o) => JSON.parse(JSON.stringify(o));
const fmt = (x) => (Math.round(x * 10) / 10).toString();
const ICON = {
  star: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 3.6l2.5 5.3 5.8.8-4.2 4 1 5.7-5.1-2.8-5.1 2.8 1-5.7-4.2-4 5.8-.8z"/></svg>',
  x: '<svg class="ico" viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17"/></svg>',
  left: '<svg class="ico" viewBox="0 0 24 24"><path d="M14 6l-6 6 6 6"/></svg>',
  right: '<svg class="ico" viewBox="0 0 24 24"><path d="M10 6l6 6-6 6"/></svg>',
};

