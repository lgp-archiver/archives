// Mode « pavé tactile » : le doigt déplace un curseur, on clique là où est le curseur.
// glisser = déplacer • taper = clic • taper 2 fois = ouvrir
// taper puis maintenir et glisser = attraper (fenêtres, barres) • 2 doigts = défiler
// Les zones marquées data-direct (administration, code) restent en tactile normal.
import { state } from './store.js';

let on = false, x = 0, y = 0, touch = null, lastTap = { t: 0 }, hover = null;
const cursor = () => document.getElementById('cursor');
const isDirect = (t) => !!(t instanceof Element && t.closest('[data-direct]'));
const under = () => document.elementFromPoint(x, y) || document.body;

function fire(el, type, extra = {}) {
  const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
  el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, composed: true, view: window,
    clientX: x, clientY: y, button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true, ...extra }));
}

function move(nx, ny) {
  x = Math.min(innerWidth - 2, Math.max(0, nx));
  y = Math.min(innerHeight - 2, Math.max(0, ny));
  cursor().style.transform = `translate(${x}px, ${y}px)`;
  const el = under().closest('button, .tree-row, .player-list li');
  if (el !== hover) { hover?.classList.remove('vhover'); el?.classList.add('vhover'); hover = el; }
}

function click(double) {
  const el = under();
  fire(el, 'pointerdown');
  fire(el, 'pointerup');
  if (el.matches('input, textarea, select')) el.focus();
  else el.closest('button')?.focus({ preventScroll: true });
  fire(el, 'click', { detail: 1 });
  if (double) fire(el, 'dblclick', { detail: 2 });
}

function scroll(dx, dy) {
  for (let el = under(); el; el = el.parentElement) {
    const s = getComputedStyle(el);
    const canY = el.scrollHeight > el.clientHeight && /auto|scroll/.test(s.overflowY);
    const canX = el.scrollWidth > el.clientWidth && /auto|scroll/.test(s.overflowX);
    if (canX || canY) { el.scrollBy(dx, dy); return; }
  }
}

const mid = (e) => ({ x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 });

function onStart(e) {
  if (!on || isDirect(e.target)) return;
  e.preventDefault();
  if (e.touches.length >= 2) {
    if (touch?.dragging) fire(under(), 'pointerup');
    touch = { two: mid(e) };
    return;
  }
  const f = e.touches[0];
  touch = { id: f.identifier, x: f.clientX, y: f.clientY, t: performance.now(), dist: 0,
    afterTap: performance.now() - lastTap.t < 300, dragging: false, target: null };
}

function onMove(e) {
  if (!on || !touch) return;
  e.preventDefault();
  if (touch.two) {
    if (e.touches.length < 2) return;
    const m = mid(e);
    scroll(touch.two.x - m.x, touch.two.y - m.y);
    touch.two = m;
    return;
  }
  const f = [...e.touches].find((t) => t.identifier === touch.id);
  if (!f) return;
  const dx = f.clientX - touch.x, dy = f.clientY - touch.y;
  touch.x = f.clientX; touch.y = f.clientY;
  touch.dist += Math.hypot(dx, dy);
  if (touch.dist < 6) return;
  if (touch.afterTap && !touch.dragging) {
    touch.dragging = true;
    lastTap.t = 0;
    touch.target = under();
    fire(touch.target, 'pointerdown');
  }
  const speed = Number(state.data.settings.trackpad.speed) || 1.4;
  move(x + dx * speed, y + dy * speed);
  if (touch.dragging) fire(touch.target.isConnected ? touch.target : document.body, 'pointermove', { buttons: 1 });
}

function onEnd(e) {
  if (!on || !touch) return;
  e.preventDefault();
  if (e.touches.length) return; // on attend que tous les doigts soient levés
  const done = touch;
  touch = null;
  if (done.two) return;
  if (done.dragging) { fire(done.target.isConnected ? done.target : document.body, 'pointerup'); return; }
  if (e.type === 'touchend' && done.dist < 10 && performance.now() - done.t < 350) {
    const double = performance.now() - lastTap.t < 450;
    lastTap = { t: double ? 0 : performance.now() };
    click(double);
  }
}

export function setTrackpad(value) {
  on = value;
  touch = null;
  document.body.classList.toggle('trackpad', on);
  cursor().hidden = !on;
  document.getElementById('mouse-toggle').setAttribute('aria-pressed', on);
  if (on) move(x || innerWidth / 2, y || innerHeight / 2);
}

export function initTrackpad() {
  const opts = { capture: true, passive: false };
  document.addEventListener('touchstart', onStart, opts);
  document.addEventListener('touchmove', onMove, opts);
  document.addEventListener('touchend', onEnd, opts);
  document.addEventListener('touchcancel', onEnd, opts);
  // Le doigt réel ne doit rien déclencher à l'endroit où il touche l'écran.
  for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
    addEventListener(type, (e) => {
      if (on && e.isTrusted && e.pointerType === 'touch' && !isDirect(e.target)) e.stopImmediatePropagation();
    }, true);
  }
  addEventListener('resize', () => { if (on) move(x, y); });
  document.getElementById('mouse-toggle').addEventListener('click', () => {
    setTrackpad(!on);
    try { localStorage.setItem('explorateur-souris', on ? '1' : '0'); } catch { /* ignoré */ }
  });
  let saved = null;
  try { saved = localStorage.getItem('explorateur-souris'); } catch { /* ignoré */ }
  const mode = state.data.settings.trackpad.default;
  const touchDevice = matchMedia('(pointer: coarse)').matches;
  setTrackpad(saved !== null ? saved === '1' : mode === 'on' || (mode === 'auto' && touchDevice));
  document.getElementById('mouse-toggle').hidden = !touchDevice && !on;
}
