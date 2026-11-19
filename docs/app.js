/* wmhb enquiry page. Plain JavaScript, no build step. */
'use strict';

// The Google Apps Script web app URL (ends in /exec). See README.md, "Backend".
const ENQUIRY_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzo0kqI5dWam4mH3wij__ZmD4DDeDOioQPCmlLMHHHVSk7FdgxnQcS1rKfyBqdYhROrtg/exec';

const IG_HANDLE = 'whatmyhusbandbuilds';
const STORAGE_KEY = 'wmhb-enquiry-v1';
const TIMEOUT_MS = 15000;

const EVENTS = ['Wedding', 'Engagement', 'Birthday', 'Baby shower', 'Corporate', 'Market', 'Something else'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ORDER = ['name', 'event', 'when', 'venue', 'reply'];
const VENUE_MSG = 'Add where it is. A suburb or town is fine.';

const $ = (id) => document.getElementById(id);
const el = {};
[
  'band-place', 'band-tag', 'fail', 'fail-title', 'fail-text', 'hero', 'letter', 'summary', 'summary-text',
  'conn-name', 'conn-like', 'conn-event', 'conn-when', 'conn-venue', 'conn-reply',
  'blank-name', 'blank-event', 'blank-when', 'blank-venue', 'blank-reply',
  'field-name', 'field-venue', 'field-reply', 'in-name', 'in-venue', 'in-reply', 'label-reply', 'reply-by', 'by-phone', 'by-instagram',
  'reply-msg', 'note-wrap', 'in-note', 'note-count', 'add-note', 'add-note-hint', 'saved', 'website',
  'step-hint', 'step-hint-tag', 'step-hint-text', 'tip', 'tip-text', 'view-letter', 'view-sent', 'ok-title',
  'ok-text', 'receipt-text', 'receipt-note', 'next-1', 'actions', 'send-btn', 'send-label', 'send-extra',
  'ig-btn', 'dm-btn', 'actions-note', 'kbar', 'kbar-tag', 'kbar-text', 'kbar-btn', 'kbar-label',
  'kbar-ic-send', 'kbar-ic-done', 'kbar-ic-next', 'sheet-event', 'sheet-event-hint', 'events', 'sheet-when',
  'months', 'not-sure', 'exact-toggle', 'exact', 'in-date', 'use-date', 'date-msg', 'toast', 'band', 'page',
  'sheet', 'sheet-panel', 'sheet-scrim', 'kb-proxy'
].forEach((id) => { el[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = $(id); });

/* ---------- state ---------- */

const blankState = () => ({ name: '', event: '', when: '', venue: '', channel: 'phone', phone: '', instagram: '', note: '', noteOpen: false });
let state = blankState();

const ui = {
  editing: null,      // 'name' | 'venue' | 'reply' | 'note' while a text field is open
  chain: false,       // true while the blanks open one after another
  sheet: null,        // 'event' | 'when' while a sheet is open
  kbarShown: false,   // the bar above the keyboard, faded in once the keyboard is up
  showErrors: false,  // true after Send was pressed with problems
  fieldMsg: '',       // "add your name" or "add where it is" after Next on an empty field
  sending: false,
  failed: false,
  failMsg: '',
  sent: false
};

/* ---------- storage (every call wrapped: private mode and in-app browsers can throw) ---------- */

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* not available */ }
}
function clearSaved() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* not available */ }
}
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { d = null; }
  if (!d || typeof d !== 'object') return;
  const s = blankState();
  ['name', 'venue', 'phone', 'instagram', 'note'].forEach((k) => { if (typeof d[k] === 'string') s[k] = d[k]; });
  if (EVENTS.includes(d.event)) s.event = d.event;
  if (typeof d.when === 'string' && whenProblem(d.when) === '') s.when = d.when;
  if (d.channel === 'instagram') s.channel = 'instagram';
  s.noteOpen = !!s.note;
  state = s;
}

/* ---------- dates ---------- */

const pad = (n) => String(n).padStart(2, '0');
function todayISO() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function thisMonthISO() { return todayISO().slice(0, 7); }
function parseWhen(w) { return /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(w || ''); }
function isExact(w) { const m = parseWhen(w); return !!(m && m[3]); }

function whenText(w) {
  if (w === 'not-sure') return 'date to be decided';
  const m = parseWhen(w);
  if (!m) return '';
  return (m[3] ? Number(m[3]) + ' ' : '') + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
}

/** '' if fine, 'missing', 'past-month' or 'past-date'. */
function whenProblem(w) {
  if (!w) return 'missing';
  if (w === 'not-sure') return '';
  const m = parseWhen(w);
  if (!m) return 'missing';
  const mi = Number(m[2]);
  if (mi < 1 || mi > 12) return 'missing';
  if (m[3]) {
    const day = Number(m[3]);
    const real = new Date(Number(m[1]), mi - 1, day);
    if (real.getMonth() !== mi - 1 || real.getDate() !== day) return 'missing';
    return w < todayISO() ? 'past-date' : '';
  }
  return w < thisMonthISO() ? 'past-month' : '';
}

/* ---------- the letter's words ---------- */

function eventText(ev) {
  if (ev === 'Corporate') return 'Corporate event';
  if (ev === 'Something else') return 'something else';
  return ev;
}
function article(ev) {
  if (ev === 'Something else') return '';
  return /^[aeiou]/i.test(eventText(ev || 'event')) && ev ? 'an' : 'a';
}
/** "Aroha & Sam" or "Aroha and Sam" write as we, anyone else as I. */
const isPlural = () => /&|\sand\s/i.test(state.name);
const replyValue = () => (state.channel === 'phone' ? state.phone : state.instagram);
const igClean = (h) => String(h || '').trim().replace(/^@+/, '');
const cleanPhone = (p) => String(p || '').replace(/[\s()-]/g, '');

function isEmpty(field) {
  if (field === 'name') return !state.name.trim();
  if (field === 'event') return !state.event;
  if (field === 'when') return !state.when;
  if (field === 'venue') return !state.venue.trim();
  if (field === 'reply') return state.channel === 'phone' ? !state.phone.trim() : !igClean(state.instagram);
  return true;
}
const filledCount = () => ORDER.filter((f) => !isEmpty(f)).length;

/* ---------- validation ---------- */

function replyProblem() {
  const v = replyValue().trim();
  if (state.channel === 'phone') {
    if (!v) return { kind: 'missing' };
    return /^(\+?64|0)\d{7,10}$/.test(cleanPhone(v)) ? null : { kind: 'invalid', msg: 'Add a NZ phone number, like 021 123 4567.' };
  }
  const h = igClean(v);
  if (!h) return { kind: 'missing' };
  if (/^[A-Za-z0-9._]{1,30}$/.test(h)) return null;
  if (/\s/.test(h)) return { kind: 'invalid', msg: 'Instagram handles have no spaces.' };
  if (h.length > 30) return { kind: 'invalid', msg: 'Instagram handles are 30 characters or fewer.' };
  return { kind: 'invalid', msg: 'Instagram handles only use letters, numbers, dots and underscores.' };
}

function problems() {
  const out = [];
  if (!state.name.trim()) out.push({ field: 'name', kind: 'missing', label: 'your name' });
  if (!EVENTS.includes(state.event)) out.push({ field: 'event', kind: 'missing', label: "what you're celebrating" });
  const wp = whenProblem(state.when);
  if (wp === 'missing') out.push({ field: 'when', kind: 'missing', label: 'your month' });
  else if (wp) out.push({ field: 'when', kind: 'invalid', msg: wp === 'past-date' ? 'Pick today or a later date.' : 'Pick a month from now on.' });
  const venue = state.venue.trim();
  if (!venue) out.push({ field: 'venue', kind: 'missing', label: 'your venue' });
  else if (venue.length < 2) out.push({ field: 'venue', kind: 'invalid', msg: VENUE_MSG });
  const rp = replyProblem();
  if (rp) out.push({ field: 'reply', kind: rp.kind, msg: rp.msg, label: state.channel === 'phone' ? 'your phone number' : 'your Instagram handle' });
  return out;
}

function joinAnd(list) {
  if (list.length < 2) return list.join('');
  return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
}

/** Instagram one-tap fix: "aroha sam" or "aroha. sam" becomes "aroha.sam". */
function igFix(v) {
  const fixed = igClean(v)
    .replace(/\s*([._])\s*/g, '$1')
    .replace(/\s+/g, '.')
    .replace(/[^A-Za-z0-9._]/g, '');
  return fixed && fixed.length <= 30 && fixed !== igClean(v) ? fixed : '';
}

/* ---------- small helpers ---------- */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NS = 'http://www.w3.org/2000/svg';
function icon(name) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('class', 'ic');
  s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(NS, 'use');
  u.setAttribute('href', '#i-' + name);
  s.appendChild(u);
  return s;
}
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = () => window.matchMedia('(pointer: coarse)').matches;
const inInstagram = /Instagram/i.test(navigator.userAgent || '');
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let toastTimer = 0;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2500);
}

/* ---------- render ---------- */

const FIELD_NAME = { name: 'Your name', event: 'Event', when: 'Month or date', venue: 'Your venue', reply: 'Your number' };

function paintBlank(btn, field, o) {
  btn.className = 'blank' + (o.pick ? ' blank--pick' : '') + (o.filled ? ' is-filled' : '') +
    (o.active ? ' is-active' : '') + (o.error ? ' is-error' : '');
  btn.textContent = '';
  if (o.error) btn.appendChild(icon('alert'));
  const t = document.createElement('span');
  t.className = 'blank-text';
  t.textContent = o.text;
  btn.appendChild(t);
  if (o.pick && !o.error) btn.appendChild(icon(o.active ? 'chev-up' : 'chev-down'));
  const name = field === 'reply' && state.channel === 'instagram' ? 'Your Instagram handle' : FIELD_NAME[field];
  btn.setAttribute('aria-label', o.filled ? name + ': ' + o.text + (o.error ? ', needs fixing' : '') : name + ', ' + (o.error ? o.text + ', needs filling in' : 'empty'));
  btn.disabled = ui.sending;
}

function render() {
  const probs = ui.showErrors ? problems() : [];
  const bad = {};
  probs.forEach((p) => { bad[p.field] = p; });
  const filled = filledCount();

  // connecting words
  const we = isPlural();
  el.connName.textContent = we ? "we're" : "I'm";
  el.connLike.textContent = we ? "We'd" : "I'd";
  el.connEvent.textContent = state.event === 'Something else' ? '' : ' ' + article(state.event);
  // "around March 2027 at …", "on 13 March 2027 at …", ", date to be decided, at …"
  el.connWhen.textContent = state.when === 'not-sure' ? ', ' : isExact(state.when) ? ' on ' : ' around ';
  el.connVenue.textContent = state.when === 'not-sure' ? ', at ' : ' at ';
  el.connReply.textContent = state.channel === 'phone' ? 'Call or text' : 'Reply to';

  // blanks
  paintBlank(el.blankName, 'name', {
    text: state.name.trim() || 'your name', filled: !isEmpty('name'), error: !!bad.name
  });
  paintBlank(el.blankEvent, 'event', {
    pick: true, text: state.event ? eventText(state.event) : bad.event ? 'pick one' : 'event',
    filled: !!state.event, active: ui.sheet === 'event', error: !!bad.event && ui.sheet !== 'event'
  });
  paintBlank(el.blankWhen, 'when', {
    pick: true, text: state.when ? whenText(state.when) : bad.when ? 'pick one' : 'month',
    filled: !!state.when, active: ui.sheet === 'when', error: !!bad.when && ui.sheet !== 'when'
  });
  paintBlank(el.blankVenue, 'venue', {
    text: state.venue.trim() || 'your venue', filled: !isEmpty('venue'), error: !!bad.venue
  });
  const rv = state.channel === 'phone' ? state.phone.trim() : igClean(state.instagram);
  paintBlank(el.blankReply, 'reply', {
    text: rv ? (state.channel === 'phone' ? rv : '@' + rv) : state.channel === 'phone' ? 'your number' : 'your handle',
    filled: !!rv, error: !!bad.reply
  });

  // text fields swap in for their blanks
  el.blankName.hidden = ui.editing === 'name';
  el.fieldName.hidden = ui.editing !== 'name';
  el.blankVenue.hidden = ui.editing === 'venue';
  el.fieldVenue.hidden = ui.editing !== 'venue';
  el.blankReply.hidden = ui.editing === 'reply';
  el.fieldReply.hidden = ui.editing !== 'reply';
  el.inName.parentNode.classList.toggle('is-error', !!bad.name || (ui.editing === 'name' && !!ui.fieldMsg));
  el.inVenue.parentNode.classList.toggle('is-error', !!bad.venue || (ui.editing === 'venue' && !!ui.fieldMsg));
  el.inReply.parentNode.classList.toggle('is-error', !!bad.reply && bad.reply.kind === 'invalid');

  // reply by phone / instagram
  el.replyBy.hidden = ui.editing !== 'reply';
  el.byPhone.setAttribute('aria-pressed', String(state.channel === 'phone'));
  el.byInstagram.setAttribute('aria-pressed', String(state.channel === 'instagram'));
  renderReplyMsg(bad.reply);

  // error summary (F7)
  if (probs.length) {
    const missing = probs.filter((p) => p.kind === 'missing');
    const invalid = probs.filter((p) => p.kind === 'invalid');
    let html = '';
    if (missing.length) html += '<b>' + missing.length + ' blank' + (missing.length > 1 ? 's' : '') + ' to go:</b> ' + esc(joinAnd(missing.map((p) => p.label))) + '.';
    if (invalid.length) html += (missing.length ? ' ' : '<b>Almost there:</b> ') + esc(invalid.map((p) => p.msg).join(' '));
    el.summaryText.innerHTML = html;
  }
  el.summary.hidden = !probs.length;

  // note
  el.noteWrap.hidden = !state.noteOpen;
  const allFilled = filled === ORDER.length;
  el.addNote.hidden = state.noteOpen || ['name', 'venue', 'reply'].includes(ui.editing) || (ui.failed && allFilled);
  el.addNoteHint.textContent = allFilled ? '· venue, guests, ideas' : '· optional';
  el.addNote.disabled = ui.sending;
  el.inNote.readOnly = ui.sending;
  const left = 500 - state.note.length;
  el.noteCount.textContent = left <= 100 ? left + ' characters left' : '';
  el.saved.hidden = !ui.failed;

  // helper lines under the letter
  const venueHint = ui.editing === 'venue';
  el.stepHint.hidden = ui.editing !== 'name' && !venueHint;
  el.stepHint.classList.toggle('is-error', !!ui.fieldMsg);
  el.stepHintTag.hidden = !!ui.fieldMsg;
  el.stepHintTag.textContent = venueHint ? '4 of 5' : '1 of 5';
  el.stepHintText.textContent = ui.fieldMsg || (venueHint ? 'No venue yet? A suburb or town is fine.' : 'First names are perfect');
  const fixing = probs.length > 0;
  el.tip.hidden = !!ui.editing || ui.failed || (!fixing && allFilled);
  el.tip.style.visibility = ui.sheet ? 'hidden' : ''; // keeps its space, so the page behind the sheet doesn't shift
  el.tip.classList.toggle('is-fix', fixing);
  el.tipText.textContent = fixing ? 'Tap an outlined blank. Your other answers stay put.'
    : filled === 0 ? 'Tap the first blank. The rest open one after another.'
    : 'Tap the next blank to carry on.';

  // failure panel (F9)
  el.fail.hidden = !ui.failed;
  el.hero.hidden = ui.failed;
  document.body.classList.toggle('is-failed', ui.failed);
  if (ui.failed) el.failText.textContent = ui.failMsg;

  renderActions(probs, filled);
  renderKbar();
  document.body.classList.toggle('is-typing', !!ui.editing);
  el.letter.setAttribute('aria-busy', String(ui.sending));
}

function renderReplyMsg(problem) {
  const box = el.replyMsg;
  box.textContent = '';
  box.hidden = true;
  if (ui.editing !== 'reply') return;
  let msg = '';
  let fix = '';
  if (state.channel === 'instagram') {
    const p = replyProblem();
    if (p && p.kind === 'invalid') { msg = p.msg; fix = igFix(state.instagram); }
  } else if (problem && problem.kind === 'invalid') {
    msg = problem.msg;
  }
  if (!msg) return;
  box.appendChild(document.createTextNode(msg + ' '));
  if (fix) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fix-btn keep-focus';
    b.textContent = 'Use @' + fix;
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => {
      state.instagram = fix;
      el.inReply.value = fix;
      syncGrow(el.inReply);
      save();
      render();
      el.inReply.focus({ preventScroll: true });
    });
    box.appendChild(document.createElement('br'));
    box.appendChild(b);
  }
  box.hidden = false;
}

function renderActions(probs, filled) {
  const sent = ui.sent;
  el.sendBtn.hidden = sent;
  el.igBtn.hidden = !sent;
  el.dmBtn.hidden = sent || !ui.failed;

  el.sendBtn.classList.toggle('is-busy', ui.sending);
  el.sendBtn.disabled = ui.sending;
  el.sendBtn.setAttribute('aria-busy', String(ui.sending));
  el.sendBtn.querySelector('.btn-ic use').setAttribute('href', ui.failed ? '#i-retry' : '#i-plane');
  el.sendLabel.textContent = ui.sending ? 'Sending…' : ui.failed ? 'Try again' : 'Send enquiry';
  el.sendExtra.hidden = ui.sending || ui.failed || filled > 0;

  const note = el.actionsNote;
  note.textContent = '';
  note.hidden = false;
  if (sent) {
    if (inInstagram) { note.append('Or tap ', icon('xmark'), ' at the top'); } else { note.hidden = true; }
  } else if (ui.failed) {
    note.textContent = 'Copies your letter so you can paste it into a DM to @' + IG_HANDLE;
  } else if (probs.length) {
    const missing = probs.filter((p) => p.kind === 'missing').length;
    note.textContent = missing ? missing + ' blank' + (missing > 1 ? 's' : '') + ' left' : probs.length + ' thing' + (probs.length > 1 ? 's' : '') + ' to fix';
  } else if (filled === ORDER.length) {
    note.append(icon('check'), 'All ' + ORDER.length + ' blanks done · tap any to change it');
  } else if (filled === 0) {
    note.textContent = 'No account · no payment · we reply within a day';
  } else {
    const left = ORDER.length - filled;
    note.textContent = left + ' blank' + (left > 1 ? 's' : '') + ' left';
  }
}

const STEP_LABEL = { event: "what you're celebrating", when: 'around when', venue: 'where it is', reply: 'how to reach you' };

function renderKbar() {
  const k = el.kbar;
  k.hidden = !ui.editing;
  k.classList.toggle('is-shown', !!ui.editing && ui.kbarShown);
  if (!ui.editing) return;
  let tag = '';
  let text = '';
  let mode = 'done';
  if (ui.editing === 'name' || ui.editing === 'venue') {
    const next = ui.chain ? nextEmpty(ui.editing) : '';
    if (next) { text = 'Next: ' + STEP_LABEL[next]; mode = 'next'; }
    else if (ui.editing === 'name') { tag = '1 of 5'; text = 'Your name'; }
    else { tag = '4 of 5'; text = 'Your venue'; }
  } else if (ui.editing === 'reply') {
    tag = '5 of 5'; text = 'Last one'; mode = 'send';
  } else {
    text = 'Your note is optional';
  }
  el.kbarTag.hidden = !tag;
  el.kbarTag.textContent = tag;
  el.kbarText.textContent = text;
  el.kbarText.parentNode.classList.toggle('is-step', !!tag);
  el.kbarLabel.textContent = mode === 'next' ? 'Next' : mode === 'send' ? 'Send' : 'Done';
  // SVG elements have no .hidden property, so set the attribute
  el.kbarIcNext.toggleAttribute('hidden', mode !== 'next');
  el.kbarIcSend.toggleAttribute('hidden', mode !== 'send');
  el.kbarIcDone.toggleAttribute('hidden', mode !== 'done');
  el.kbarBtn.dataset.mode = mode;
  positionKbar();
}

/* Keep the bar above the on-screen keyboard (iOS and Android in-app browsers). */
function positionKbar() {
  const k = el.kbar;
  if (k.hidden) return;
  const vv = window.visualViewport;
  let offset = 0;
  if (vv) offset = Math.max(0, document.documentElement.clientHeight - (vv.offsetTop + vv.height));
  k.style.transform = offset > 1 ? 'translateY(' + (-offset) + 'px)' : '';
  k.style.setProperty('--kbar-safe', offset > 1 ? '0px' : 'env(safe-area-inset-bottom, 0px)');
}

/* ---------- waiting for the on-screen keyboard ---------- */
// The keyboard takes a moment to open. Scrolling the letter and showing the bar above the keyboard
// wait until it has stopped moving (visualViewport resize), so nothing jumps while it slides up.

const kb = { fn: null, wait: 0, settle: 0, movedAt: -Infinity };

function keyboardOpen() {
  const vv = window.visualViewport;
  return !!vv && document.documentElement.clientHeight - vv.height > 120;
}

function whenKeyboardReady(fn, keyboardUp) {
  clearTimeout(kb.wait);
  clearTimeout(kb.settle);
  kb.fn = fn;
  const moving = performance.now() - kb.movedAt < 150;
  if (!isTouch() || (keyboardUp && !moving)) keyboardReady();
  else if (moving) kb.settle = setTimeout(keyboardReady, 150);
  else kb.wait = setTimeout(keyboardReady, 700); // no sign of the keyboard moving: carry on anyway
}

function onViewportResize() {
  kb.movedAt = performance.now();
  positionKbar();
  if (!kb.fn) return;
  clearTimeout(kb.wait);
  clearTimeout(kb.settle);
  kb.settle = setTimeout(keyboardReady, 150);
}

function keyboardReady() {
  clearTimeout(kb.wait);
  clearTimeout(kb.settle);
  const fn = kb.fn;
  kb.fn = null;
  if (fn) fn();
}

/** The keyboard is up: fade the bar in above it and bring the letter up under the header. */
function revealTyping(field) {
  if (ui.editing !== field) return;
  ui.kbarShown = true;
  positionKbar();
  el.kbar.classList.add('is-shown');
  if (isTouch() && field !== 'note') scrollToLetter(true);
}

/* ---------- moving between blanks ---------- */

function nextEmpty(from) {
  for (let i = ORDER.indexOf(from) + 1; i < ORDER.length; i++) if (isEmpty(ORDER[i])) return ORDER[i];
  return '';
}

function blankFor(field) {
  return { name: el.blankName, event: el.blankEvent, when: el.blankWhen, venue: el.blankVenue, reply: el.blankReply }[field];
}
const TEXT_FIELDS = ['name', 'venue', 'reply'];

/** keyboardUp: a text field had focus a moment ago, so the keyboard is already open. */
function openStep(field, keyboardUp) {
  const typing = !!ui.editing;
  if (ui.editing && ui.editing !== field) endEdit();
  if (TEXT_FIELDS.includes(field)) startEdit(field, keyboardUp || typing);
  else openSheet(field);
}

function onBlankTap(field) {
  if (ui.sending) return;
  ui.chain = isEmpty(field); // an empty blank starts the chain, a filled one is edited on its own
  openStep(field);
}

/* Make sure the letter can scroll up to sit under the header (F2, F5, F7). */
function scrollToLetter(smooth) {
  const header = el.band.offsetHeight;
  const target = Math.max(0, el.letter.getBoundingClientRect().top + window.scrollY - header - 8);
  const pageTop = el.page.getBoundingClientRect().top + window.scrollY;
  const need = Math.ceil(target + window.innerHeight - pageTop);
  if (need > el.page.offsetHeight) el.page.style.minHeight = need + 'px';
  window.scrollTo({ top: target, behavior: smooth && !reduceMotion() ? 'smooth' : 'auto' });
}

/* Content under the letter changes while typing (the tip hides, hints swap). Never let the page get
   shorter at that moment: a page scrolled to the bottom would jump. */
function keepPageHeight() {
  const h = el.page.offsetHeight;
  if (h > (parseFloat(el.page.style.minHeight) || 0)) el.page.style.minHeight = h + 'px';
}

/* ---------- text fields: name, venue, reply, note ---------- */

function syncGrow(input) {
  const g = input.parentNode;
  g.dataset.value = input.value || input.placeholder;
  g.classList.toggle('is-empty', !input.value);
}

function configureReplyInput() {
  const i = el.inReply;
  if (state.channel === 'phone') {
    i.type = 'tel';
    i.inputMode = 'tel';
    i.autocomplete = 'tel';
    i.maxLength = 20;
    i.placeholder = 'your number';
    i.removeAttribute('autocapitalize');
    i.spellcheck = false;
    el.labelReply.textContent = 'Your phone number';
  } else {
    i.type = 'text';
    i.inputMode = 'text';
    i.autocomplete = 'off';
    i.maxLength = 31;
    i.placeholder = 'your handle';
    i.setAttribute('autocapitalize', 'none');
    i.setAttribute('autocorrect', 'off');
    i.spellcheck = false;
    el.labelReply.textContent = 'Your Instagram handle';
  }
}

function startEdit(field, keyboardUp) {
  if (ui.sending) return;
  const kbUp = !!keyboardUp || keyboardOpen();
  ui.editing = field;
  ui.fieldMsg = '';
  if (!kbUp) ui.kbarShown = false; // the bar waits for the keyboard
  let input;
  if (field === 'name') {
    input = el.inName;
    input.value = state.name;
  } else if (field === 'venue') {
    input = el.inVenue;
    input.value = state.venue;
  } else if (field === 'reply') {
    input = el.inReply;
    configureReplyInput();
    input.value = state.channel === 'phone' ? state.phone : igClean(state.instagram);
  } else {
    input = el.inNote;
    state.noteOpen = true;
  }
  if (input !== el.inNote) {
    // The field takes the blank's exact box (see .grow in styles.css), so the words around it stay put.
    const filled = !isEmpty(field);
    input.parentNode.classList.toggle('is-tight', filled);
    input.parentNode.dataset.floor = filled ? '' : input.placeholder;
    syncGrow(input);
  }
  keepPageHeight();
  render();
  input.focus({ preventScroll: field !== 'note' && isTouch() });
  if (input !== el.inNote) {
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) { /* some input types refuse */ }
  }
  whenKeyboardReady(() => revealTyping(field), kbUp);
}

function endEdit() {
  const f = ui.editing;
  if (!f) return;
  if (f === 'name') state.name = el.inName.value.trim();
  if (f === 'venue') state.venue = el.inVenue.value.trim();
  if (f === 'reply') {
    if (state.channel === 'phone') state.phone = el.inReply.value.trim();
    else state.instagram = igClean(el.inReply.value);
  }
  if (f === 'note') {
    state.note = el.inNote.value.replace(/\s+$/, '');
    if (!state.note.trim()) { state.note = ''; state.noteOpen = false; }
  }
  ui.editing = null;
  ui.fieldMsg = '';
  save();
  render();
}

// End editing when focus really leaves the field. If a mouse or finger is still down, wait until
// its click has landed so the layout does not jump under it.
let pointerDown = false;
document.addEventListener('pointerdown', () => { pointerDown = true; }, true);
document.addEventListener('pointerup', () => { setTimeout(() => { pointerDown = false; }, 0); }, true);
document.addEventListener('pointercancel', () => { pointerDown = false; }, true);

function editZoneHasFocus() {
  const a = document.activeElement;
  if (!a || a === document.body) return false;
  if (ui.editing === 'name') return a === el.inName || el.kbar.contains(a);
  if (ui.editing === 'venue') return a === el.inVenue || el.kbar.contains(a);
  if (ui.editing === 'reply') return a === el.inReply || el.kbar.contains(a) || el.replyBy.contains(a) || el.replyMsg.contains(a);
  if (ui.editing === 'note') return a === el.inNote || el.kbar.contains(a);
  return false;
}
function onFieldBlur() {
  const check = () => { if (ui.editing && !editZoneHasFocus()) endEdit(); };
  if (pointerDown) {
    document.addEventListener('pointerup', () => setTimeout(check, 0), { once: true, capture: true });
    setTimeout(check, 800); // in case the pointer is released outside the page
  } else {
    setTimeout(check, 0);
  }
}

/** Next (or Return) on the name or venue field: check it, then carry on to the next empty blank. */
function handleNext() {
  const field = ui.editing;
  if (field !== 'name' && field !== 'venue') return;
  const input = field === 'name' ? el.inName : el.inVenue;
  const v = input.value.trim();
  if (field === 'name' ? !v : v.length < 2) {
    ui.fieldMsg = field === 'name' ? "Add your name so we know who's writing." : VENUE_MSG;
    render();
    input.focus({ preventScroll: true });
    return;
  }
  const next = ui.chain ? nextEmpty(field) : '';
  endEdit();
  if (next) {
    openStep(next, true);
  } else {
    ui.chain = false;
    input.blur();
    blankFor(field).focus({ preventScroll: true });
  }
}

function handleDone() {
  const f = ui.editing;
  endEdit();
  if (f === 'note') {
    if (el.addNote.hidden) el.inNote.blur();
    else el.addNote.focus({ preventScroll: true });
  } else if (f) {
    blankFor(f).focus({ preventScroll: true });
  }
}

function setChannel(ch) {
  if (state.channel === ch) return;
  if (state.channel === 'phone') state.phone = el.inReply.value;
  else state.instagram = el.inReply.value;
  state.channel = ch;
  configureReplyInput();
  el.inReply.value = ch === 'phone' ? state.phone : igClean(state.instagram);
  const g = el.inReply.parentNode;
  if (g.dataset.floor) g.dataset.floor = el.inReply.placeholder;
  syncGrow(el.inReply);
  save();
  render();
  if (ui.editing === 'reply') {
    // re-focus so the phone shows the right keyboard
    el.inReply.blur();
    el.inReply.focus({ preventScroll: true });
  }
}

/* ---------- sheets ---------- */

// One dialog holds both pickers. It slides up on open and down on close, and when the event picker
// leads straight into the month picker the dimmed background stays up while the month page slides in.

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const OPEN_MS = 260;
const CLOSE_MS = 180;
const sheet = { state: 'closed', panelAnims: [], pageAnims: [] }; // state: 'closed' | 'open' | 'closing'

const sheetPage = (which) => (which === 'event' ? el.sheetEvent : which === 'when' ? el.sheetWhen : null);
const canAnimate = () => !reduceMotion() && typeof el.sheetPanel.animate === 'function';

function animate(list, node, keyframes, ms, extra) {
  const a = node.animate(keyframes, Object.assign({ duration: ms, easing: EASE }, extra));
  list.push(a);
  return a;
}
function stopAnims(list) { list.splice(0).forEach((a) => a.cancel()); }

/** Where a running slide has got to, in px, so the next one starts from there. */
function translateYOf(node) {
  const m = /matrix(3d)?\(([^)]+)\)/.exec(getComputedStyle(node).transform || '');
  if (!m) return 0;
  const v = m[2].split(',').map(Number);
  return m[1] ? v[13] : v[5];
}
const opacityOf = (node) => Number(getComputedStyle(node).opacity);

/* iPhones can still scroll the page behind an open sheet, so pin the page where it is until the sheet closes. */
let lockedAt = null;
function lockScroll() {
  if (!isIOS || lockedAt !== null) return;
  lockedAt = window.scrollY;
  document.body.style.top = -lockedAt + 'px';
  document.documentElement.classList.add('is-locked');
}
function unlockScroll() {
  if (lockedAt === null) return;
  const y = lockedAt;
  lockedAt = null;
  document.documentElement.classList.remove('is-locked');
  document.body.style.top = '';
  window.scrollTo(0, y);
}

function prepareSheet(which) {
  if (which === 'event') {
    el.sheetEventHint.textContent = ui.chain && isEmpty('when') ? 'Tap one. The month picker opens next.' : 'Tap one.';
    el.events.querySelectorAll('.pill').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.event === state.event)));
  } else {
    buildMonths();
    el.notSure.setAttribute('aria-pressed', String(state.when === 'not-sure'));
    const exact = isExact(state.when);
    showExact(exact, false);
    if (exact) el.inDate.value = state.when;
  }
  el.sheet.setAttribute('aria-labelledby', 'sheet-' + which + '-title');
}

/** Show only the current page and clear anything left over from a page change. */
function settlePages() {
  stopAnims(sheet.pageAnims);
  [el.sheetEvent, el.sheetWhen].forEach((p) => {
    p.classList.remove('is-leaving');
    p.style.top = '';
    p.inert = false;
    p.hidden = p !== sheetPage(ui.sheet);
  });
}

function focusFirst(which) {
  const page = sheetPage(which);
  const first = page.querySelector('[aria-pressed="true"]') || page.querySelector('.pill, .opt');
  if (first) first.focus({ preventScroll: true });
}

function openSheet(which) {
  if (ui.sending || sheet.state !== 'closed') return;
  lockScroll();
  prepareSheet(which);
  ui.sheet = which;
  settlePages();
  render();
  el.sheet.showModal();
  sheet.state = 'open';
  el.sheetPanel.scrollTop = 0;
  focusFirst(which);
  if (!canAnimate()) return;
  animate(sheet.panelAnims, el.sheetPanel, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], OPEN_MS);
  animate(sheet.panelAnims, el.sheetScrim, [{ opacity: 0 }, { opacity: 1 }], OPEN_MS);
}

/** The event picker leads straight into the month picker: same sheet, new page slides in. */
function turnSheet(which) {
  const panel = el.sheetPanel;
  const out = sheetPage(ui.sheet);
  const inn = sheetPage(which);
  settlePages();
  const topBefore = panel.getBoundingClientRect().top;
  const ty = translateYOf(panel);
  const scrim = opacityOf(el.sheetScrim);
  const outTop = out.offsetTop - panel.scrollTop;
  prepareSheet(which);
  ui.sheet = which;
  render();
  if (!canAnimate()) {
    settlePages();
    panel.scrollTop = 0;
    focusFirst(which);
    return;
  }
  // the old page stays where it is, out of the flow, while it fades away
  out.classList.add('is-leaving');
  out.style.top = outTop + 'px';
  out.inert = true;
  inn.hidden = false;
  panel.scrollTop = 0;
  focusFirst(which);
  // The month page is taller, so the sheet grows. Start it where it was and let it rise into place.
  const from = Math.max(0, topBefore - panel.getBoundingClientRect().top + ty);
  stopAnims(sheet.panelAnims);
  if (from > 0.5) animate(sheet.panelAnims, panel, [{ transform: 'translateY(' + from + 'px)' }, { transform: 'translateY(0)' }], OPEN_MS);
  if (scrim < 1) animate(sheet.panelAnims, el.sheetScrim, [{ opacity: scrim }, { opacity: 1 }], OPEN_MS);
  const fade = animate(sheet.pageAnims, out, [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: 'translateX(-24px)' }], 140, { easing: 'ease-out', fill: 'forwards' });
  fade.onfinish = () => {
    out.hidden = true;
    out.classList.remove('is-leaving');
    out.style.top = '';
    out.inert = false;
    fade.cancel();
  };
  animate(sheet.pageAnims, inn, [{ opacity: 0, transform: 'translateX(32px)' }, { opacity: 1, transform: 'translateX(0)' }], OPEN_MS);
}

/** Slide the sheet away, then close the dialog. after(which) runs once it has gone. */
function closeSheet(after) {
  if (sheet.state !== 'open') return;
  const which = ui.sheet;
  sheet.state = 'closing';
  ui.sheet = null;
  el.sheet.classList.add('is-closing');
  render();
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    sheet.state = 'closed';
    el.sheet.classList.remove('is-closing');
    el.sheet.close();
    stopAnims(sheet.panelAnims);
    settlePages();
    el.kbProxy.disabled = true;
    unlockScroll();
    if (after) after(which);
  };
  if (!canAnimate()) { done(); return; }
  const ty = translateYOf(el.sheetPanel);
  const scrim = opacityOf(el.sheetScrim);
  stopAnims(sheet.panelAnims);
  const slide = animate(sheet.panelAnims, el.sheetPanel, [{ transform: 'translateY(' + ty + 'px)' }, { transform: 'translateY(100%)' }], CLOSE_MS, { fill: 'forwards' });
  animate(sheet.panelAnims, el.sheetScrim, [{ opacity: scrim }, { opacity: 0 }], CLOSE_MS, { fill: 'forwards' });
  slide.onfinish = done;
  setTimeout(done, CLOSE_MS + 600); // in case the animation never reports back
}

/* iPhones only open the keyboard for a field focused during the tap itself. The page behind the sheet
   can't take focus until the sheet has closed, so a stand-in field inside the sheet takes it now and
   hands it to the venue or reply field once the sheet has slid away. */
function holdKeyboard(field) {
  if (!isTouch() || !canAnimate()) return; // without the slide the field is focused straight away
  const p = el.kbProxy;
  const phone = field === 'reply' && state.channel === 'phone';
  p.type = phone ? 'tel' : 'text';
  p.inputMode = phone ? 'tel' : 'text';
  p.disabled = false;
  p.focus({ preventScroll: true });
}

function dismissSheet() { // ×, Escape or the dimmed background: the blank keeps what it had
  if (sheet.state !== 'open') return;
  ui.chain = false;
  closeSheet((which) => blankFor(which).focus({ preventScroll: true }));
}

function choose(field, value) {
  if (sheet.state !== 'open') return;
  state[field] = value;
  save();
  const next = ui.chain ? nextEmpty(field) : '';
  if (next === 'when') { turnSheet('when'); return; }
  if (!next) ui.chain = false;
  if (next === 'venue' || next === 'reply') holdKeyboard(next);
  closeSheet((which) => {
    if (next) openStep(next);
    else blankFor(which).focus({ preventScroll: true });
  });
}

/** The browser closed the sheet itself (for example the Android back gesture): tidy up straight away. */
function onSheetClose() {
  if (sheet.state === 'closed' || el.sheet.open) return;
  const which = ui.sheet;
  sheet.state = 'closed';
  ui.sheet = null;
  ui.chain = false;
  el.sheet.classList.remove('is-closing');
  stopAnims(sheet.panelAnims);
  settlePages();
  el.kbProxy.disabled = true;
  unlockScroll();
  render();
  if (which) blankFor(which).focus({ preventScroll: true });
}

function buildMonths() {
  const box = el.months;
  box.textContent = '';
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  for (let i = 0; i < 12; i++) {
    const iso = y + '-' + pad(m + 1);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt';
    b.dataset.when = iso;
    b.setAttribute('aria-pressed', String(state.when === iso));
    b.setAttribute('aria-label', MONTHS[m] + ' ' + y);
    b.innerHTML = '<span class="opt-month">' + MON[m] + '</span><span class="opt-year">' + y + '</span>';
    box.appendChild(b);
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
}

function showExact(open, focus) {
  el.exact.hidden = !open;
  el.exactToggle.setAttribute('aria-expanded', String(open));
  el.inDate.min = todayISO();
  checkDate();
  if (open && focus) {
    el.inDate.focus();
    try { if (el.inDate.showPicker) el.inDate.showPicker(); } catch (e) { /* not allowed here, the field still works */ }
  }
}

function checkDate() {
  const v = el.inDate.value;
  const p = v ? whenProblem(v) : 'missing';
  el.useDate.disabled = !!p;
  el.dateMsg.hidden = p !== 'past-date';
  el.dateMsg.textContent = p === 'past-date' ? 'Pick today or a later date.' : '';
  return !p;
}

/* ---------- sending ---------- */

function letterSegments() {
  const s = [];
  const t = (x) => s.push({ t: x });
  const b = (x) => s.push({ b: x });
  const we = isPlural();
  t('Hi wmhb, ' + (we ? "we're " : "I'm ")); b(state.name.trim()); t('. ' + (we ? "We'd" : "I'd") + ' like the guestbook for ');
  if (state.event === 'Something else') b('something else');
  else { t(article(state.event) + ' '); b(eventText(state.event)); }
  if (state.when === 'not-sure') { t(', '); b(whenText(state.when)); t(', at '); } else { t(isExact(state.when) ? ' on ' : ' around '); b(whenText(state.when)); t(' at '); }
  b(state.venue.trim());
  t('. ');
  if (state.channel === 'phone') { t('Call or text '); b(state.phone.trim()); } else { t('Reply to '); b('@' + igClean(state.instagram)); }
  t('.');
  return s;
}
const letterPlain = () => letterSegments().map((x) => x.t || x.b).join('');
const letterHTML = () => letterSegments().map((x) => (x.b ? '<b>' + esc(x.b) + '</b>' : esc(x.t))).join('');
function dmText() {
  const note = state.note.trim();
  return letterPlain() + (note ? '\n\n' + note : '');
}

function handleSend() {
  if (ui.sending) return;
  if (ui.editing) {
    const a = document.activeElement;
    endEdit();
    if (a && a.blur) a.blur();
  }
  const probs = problems();
  if (probs.length) {
    ui.showErrors = true;
    ui.chain = false;
    render();
    scrollToLetter(true);
    showBandTag();
    el.summary.focus({ preventScroll: true });
    return;
  }
  submit();
}

let bandTimer = 0;
function showBandTag() {
  el.bandPlace.hidden = true;
  el.bandTag.hidden = false;
  clearTimeout(bandTimer);
  bandTimer = setTimeout(() => { el.bandTag.hidden = true; el.bandPlace.hidden = ui.sent || ui.failed; }, 4000);
}

async function submit() {
  ui.sending = true;
  render();
  const payload = {
    name: state.name.trim(),
    event: state.event,
    when: state.when,
    venue: state.venue.trim(),
    channel: state.channel,
    phone: state.channel === 'phone' ? state.phone.trim() : '',
    instagram: state.channel === 'instagram' ? igClean(state.instagram) : '',
    note: state.note.trim(),
    website: el.website.value
  };
  let result = null;
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);
  try {
    if (!ENQUIRY_ENDPOINT) throw new Error('ENQUIRY_ENDPOINT is not set');
    // No Content-Type header on purpose: the browser sends text/plain and skips the CORS preflight.
    const res = await fetch(ENQUIRY_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload),
      redirect: 'follow',
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined
    });
    const data = await res.json();
    if (data && typeof data.ok === 'boolean') result = data;
  } catch (e) {
    result = null;
  } finally {
    clearTimeout(timer);
  }
  ui.sending = false;
  if (result && result.ok) showSent();
  else showFailed(result && result.error ? String(result.error) : '');
}

function showFailed(serverMsg) {
  ui.failed = true;
  ui.failMsg = serverMsg
    ? serverMsg + ' Your letter is still here, nothing is lost.'
    : 'Your connection dropped. Your letter is still here, nothing is lost.';
  el.bandPlace.hidden = true;
  el.bandTag.hidden = true;
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
  el.failTitle.focus({ preventScroll: true });
}

function showSent() {
  const name = state.name.trim();
  const ok = state.channel === 'phone'
    ? "We'll text or call you on <b>" + esc(state.phone.trim()) + '</b>'
    : "We'll message you on Instagram at <b>@" + esc(igClean(state.instagram)) + '</b>';
  el.okText.innerHTML = 'Thanks, ' + esc(name) + '. ' + ok + ', usually the same evening and always within a day.';
  el.receiptText.innerHTML = '"' + letterHTML() + '"';
  const note = state.note.trim();
  el.receiptNote.hidden = !note;
  el.receiptNote.textContent = note ? 'Note: ' + note : '';
  el.next1.textContent = state.when === 'not-sure' ? 'We talk dates through with you'
    : isExact(state.when) ? 'We check your date is free' : 'We check your month is free';

  clearSaved();
  ui.sent = true;
  ui.failed = false;
  ui.showErrors = false;
  el.viewLetter.hidden = true;
  el.viewSent.hidden = false;
  el.bandPlace.hidden = true;
  el.bandTag.hidden = true;
  el.page.style.minHeight = '';
  document.body.dataset.view = 'sent';
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
  el.okTitle.focus({ preventScroll: true });
}

/* Copy the letter, then let the link open the Instagram DM. */
function copyText(text) {
  let ok = false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (e) { ok = false; }
  try {
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).catch(() => {}); ok = true; }
  } catch (e) { /* keep the execCommand result */ }
  return ok;
}

/* ---------- wiring ---------- */

function wire() {
  el.blankName.addEventListener('click', () => onBlankTap('name'));
  el.blankEvent.addEventListener('click', () => onBlankTap('event'));
  el.blankWhen.addEventListener('click', () => onBlankTap('when'));
  el.blankVenue.addEventListener('click', () => onBlankTap('venue'));
  el.blankReply.addEventListener('click', () => onBlankTap('reply'));

  // buttons that must not take focus away from the open text field (keeps the keyboard up)
  document.querySelectorAll('.keep-focus').forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));

  el.inName.addEventListener('input', () => {
    state.name = el.inName.value;
    syncGrow(el.inName);
    if (ui.fieldMsg) ui.fieldMsg = '';
    save();
    render();
  });
  el.inVenue.addEventListener('input', () => {
    state.venue = el.inVenue.value;
    syncGrow(el.inVenue);
    if (ui.fieldMsg) ui.fieldMsg = '';
    save();
    render();
  });
  el.inReply.addEventListener('input', () => {
    if (state.channel === 'phone') state.phone = el.inReply.value;
    else state.instagram = el.inReply.value;
    syncGrow(el.inReply);
    save();
    render();
  });
  el.inNote.addEventListener('input', () => { state.note = el.inNote.value; save(); render(); });

  [el.inName, el.inVenue, el.inReply, el.inNote].forEach((i) => {
    i.addEventListener('blur', onFieldBlur);
    i.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); handleDone(); }
      if (e.key === 'Enter' && i !== el.inNote && !e.isComposing) {
        e.preventDefault();
        if (i === el.inReply) handleSend(); else handleNext();
      }
    });
  });
  el.inNote.addEventListener('focus', () => {
    if (ui.editing === 'note') return;
    const kbUp = !!ui.editing || keyboardOpen();
    if (ui.editing) endEdit();
    ui.editing = 'note';
    if (!kbUp) ui.kbarShown = false;
    keepPageHeight();
    render();
    whenKeyboardReady(() => revealTyping('note'), kbUp);
  });

  el.byPhone.addEventListener('click', () => setChannel('phone'));
  el.byInstagram.addEventListener('click', () => setChannel('instagram'));

  el.kbarBtn.addEventListener('click', () => {
    const mode = el.kbarBtn.dataset.mode;
    if (mode === 'next') handleNext();
    else if (mode === 'send') handleSend();
    else handleDone();
  });

  el.addNote.addEventListener('click', () => {
    if (ui.sending) return;
    el.inNote.value = state.note;
    startEdit('note');
  });

  el.sendBtn.addEventListener('click', handleSend);

  el.dmBtn.addEventListener('click', () => {
    copyText(dmText());
    toast('Letter copied. Paste it into the DM.');
    // no preventDefault: the link opens the Instagram DM
  });

  // sheets
  el.sheet.querySelectorAll('[data-close]').forEach((c) => c.addEventListener('click', dismissSheet));
  el.sheet.addEventListener('cancel', (e) => { e.preventDefault(); dismissSheet(); });
  el.sheet.addEventListener('close', onSheetClose);
  el.events.addEventListener('click', (e) => {
    const b = e.target.closest('.pill');
    if (b) choose('event', b.dataset.event);
  });
  el.months.addEventListener('click', (e) => {
    const b = e.target.closest('.opt');
    if (b) choose('when', b.dataset.when);
  });
  el.notSure.addEventListener('click', () => choose('when', 'not-sure'));
  el.exactToggle.addEventListener('click', () => showExact(el.exact.hidden, true));
  el.inDate.addEventListener('input', checkDate);
  el.inDate.addEventListener('change', checkDate);
  el.useDate.addEventListener('click', () => { if (checkDate()) choose('when', el.inDate.value); });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportResize);
    window.visualViewport.addEventListener('scroll', positionKbar);
  }
}

load();
wire();
render();
