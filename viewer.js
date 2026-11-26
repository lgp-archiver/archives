// Lecteur photo (avec texte à côté) et lecteur de texte.
import { find, onChange, assetUrl } from './store.js';
import { h } from './ui.js';
import { openWindow, getWindow } from './windows.js';

let currentImage = null, ui = null;

function siblings() {
  return (find(currentImage)?.parent.children || []).filter((n) => n.type === 'image');
}
function step(dir) {
  const list = siblings(), i = list.findIndex((n) => n.id === currentImage);
  if (list.length) showImage(list[(i + dir + list.length) % list.length]);
}

function render() {
  const hit = find(currentImage);
  if (!hit || hit.node.type !== 'image') return ui.win.close();
  const n = hit.node, list = siblings();
  ui.win.setTitle(n.name);
  ui.root.className = 'viewer pos-' + (n.textPosition || 'right');
  if (ui.img.dataset.src !== n.src) { ui.img.src = assetUrl(n.src); ui.img.dataset.src = n.src; ui.stage.classList.remove('zoomed'); }
  ui.img.alt = n.caption || n.name;
  ui.side.replaceChildren(...[n.caption && h('h2', {}, n.caption), n.text].filter(Boolean));
  ui.side.hidden = !n.caption && !n.text;
  ui.count.textContent = `${list.findIndex((x) => x.id === n.id) + 1} / ${list.length}`;
}

export function showImage(node) {
  currentImage = node.id;
  if (!getWindow('viewer')) {
    const win = openWindow({ id: 'viewer', title: node.name, width: 760, height: 480, onClose: () => { ui = null; } });
    const b = (text, fn) => h('button', { type: 'button', onclick: fn }, text);
    const img = h('img', { draggable: false });
    const stage = h('div', { class: 'stage' }, img);
    const side = h('aside', { class: 'side' });
    ui = { win, img, stage, side, count: h('span'), root: h('div', {}, stage, side) };
    win.body.append(
      h('div', { class: 'toolbar' }, b('← Précédente', () => step(-1)), b('Suivante →', () => step(1)),
        b('Zoom', () => stage.classList.toggle('zoomed')), ui.count),
      ui.root);
    win.el.tabIndex = -1;
    win.el.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); });
  } else ui.win.focus();
  render();
  ui.win.el.focus({ preventScroll: true });
}

export function showText(node) {
  const id = 'text-' + node.id;
  const win = openWindow({ id, title: node.name, width: 440, height: 340 });
  win.body.replaceChildren(h('div', { class: 'doc' }, node.content || ''));
}

export function showFile(node) {
  const a = h('a', { href: assetUrl(node.src), download: node.name });
  a.click();
}

onChange(() => { if (ui) render(); });
