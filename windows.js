// Gestionnaire de fenêtres : ouvrir, déplacer, agrandir, réduire, fermer.
import { h } from './ui.js';
const wins = new Map();
let z = 10, offset = 0;
const small = () => matchMedia('(max-width: 700px)').matches;

export function openWindow({ id, title, width = 560, height = 400, direct = false, onClose }) {
  if (wins.has(id)) { const w = wins.get(id); w.setTitle(title); w.focus(); return w; }
  const desktop = document.getElementById('desktop');
  const label = h('span', { class: 'title' }, title);
  const body = h('div', { class: 'body' });
  const btn = (text, name, fn) => h('button', { type: 'button', 'aria-label': name, onclick: (e) => { e.stopPropagation(); fn(); } }, text);
  const bar = h('div', { class: 'titlebar' }, label,
    btn('_', 'Réduire', () => api.minimize()),
    btn('□', 'Agrandir', () => el.classList.toggle('max')),
    btn('×', 'Fermer', () => api.close()));
  const el = h('section', { class: 'window' + (small() ? ' max' : '') }, bar, body);
  if (direct) el.setAttribute('data-direct', '');
  const w = Math.min(width, innerWidth - 20), ht = Math.min(height, innerHeight - 60);
  offset = (offset + 26) % 130;
  Object.assign(el.style, { width: w + 'px', height: ht + 'px',
    left: Math.max(0, (innerWidth - w) / 2 - 60 + offset) + 'px', top: Math.max(0, (innerHeight - ht) / 2 - 80 + offset) + 'px' });
  const task = h('button', { type: 'button', onclick: () => (el.classList.contains('active') ? api.minimize() : api.focus()) }, title);

  const api = {
    el, body,
    setTitle(t) { label.textContent = t; task.textContent = t; },
    focus() { el.hidden = false; el.style.zIndex = ++z; activate(api); },
    minimize() { el.hidden = true; activateTop(); },
    close() { onClose?.(); el.remove(); task.remove(); wins.delete(id); activateTop(); },
  };
  el.addEventListener('pointerdown', () => { if (!el.classList.contains('active')) api.focus(); }, true);
  bar.addEventListener('dblclick', (e) => { if (e.target.closest('button') === null) el.classList.toggle('max'); });
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || el.classList.contains('max') || e.button > 0) return;
    const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop;
    const move = (m) => {
      el.style.left = Math.min(innerWidth - 60, Math.max(60 - el.offsetWidth, m.clientX - sx)) + 'px';
      el.style.top = Math.min(desktop.clientHeight - 30, Math.max(0, m.clientY - sy)) + 'px';
    };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });

  desktop.append(el);
  document.getElementById('tasks').append(task);
  api.task = task;
  wins.set(id, api);
  api.focus();
  return api;
}

function activate(active) {
  wins.forEach((w) => { w.el.classList.toggle('active', w === active); w.task.classList.toggle('active', w === active); });
}
function activateTop() {
  const top = [...wins.values()].filter((w) => !w.el.hidden).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
  activate(top);
}
export const getWindow = (id) => wins.get(id);
