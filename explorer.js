// Fenêtre explorateur : arborescence, barre d'adresse, grille de fichiers.
import { state, find, onChange, assetUrl, safeUrl } from './store.js';
import { h, activatable } from './ui.js';
import { ICONS } from './icons.js';
import { openWindow, getWindow } from './windows.js';
import { playAudio } from './player.js';
import { showImage, showText, showFile } from './viewer.js';
import { askCode } from './admin.js';

const back = [], forward = [];
let selected = null, ui = null;

export const iconKey = (n) => (n.type === 'link' ? n.look || 'link' : ICONS[n.type] ? n.type : 'file');

function go(id, remember = true) {
  if (id === state.current) return;
  if (remember) { back.push(state.current); forward.length = 0; }
  state.current = id;
  selected = null;
  render();
}

export function openNode(node) {
  if (node.type === 'folder') return go(node.id);
  if (node.type === 'admin') return askCode();
  if (node.type === 'audio') return playAudio(node);
  if (node.type === 'image') return showImage(node);
  if (node.type === 'text') return showText(node);
  if (node.type === 'file') return showFile(node);
  if (node.type === 'link') {
    const url = safeUrl(node.url);
    if (!url) return alert('Ce lien n’a pas d’adresse valide.');
    if (node.newTab === false) location.href = url;
    else window.open(url, '_blank', 'noopener');
  }
}

export function goHome() {
  openExplorer();
  go('root');
}

export function openExplorer() {
  if (getWindow('explorer')) return getWindow('explorer').focus();
  const win = openWindow({ id: 'explorer', title: state.data.settings.rootName, width: 760, height: 500 });
  const nav = (text, fn) => h('button', { type: 'button', onclick: fn }, text);
  ui = {
    win,
    back: nav('← Retour', () => { if (back.length) { forward.push(state.current); go(back.pop(), false); } }),
    next: nav('→', () => { if (forward.length) { back.push(state.current); go(forward.pop(), false); } }),
    up: nav('↑ Dossier parent', () => { const p = find(state.current)?.parent; if (p) go(p.id); }),
    address: h('div'),
    tree: h('nav', { class: 'tree side-tree' }),
    files: h('div', { class: 'files', onclick: (e) => { if (e.target === ui.files) select(null); } }),
    status: h('div', { class: 'status' }),
  };
  win.body.append(
    h('div', { class: 'toolbar' }, ui.back, ui.next, ui.up),
    h('div', { class: 'address' }, 'Chemin', ui.address),
    h('div', { class: 'split' }, ui.tree, ui.files),
    ui.status);
  render();
}

function select(id) {
  selected = id;
  ui.files.querySelectorAll('.item').forEach((el) => el.classList.toggle('selected', el.dataset.id === id));
}

function render() {
  if (!ui) return;
  let hit = find(state.current);
  if (!hit) { state.current = 'root'; hit = find('root'); }
  const { node: folder, path } = hit;
  const rootName = state.data.settings.rootName;
  const name = (n) => (n.id === 'root' ? rootName : n.name);
  ui.win.setTitle(name(folder));
  ui.back.disabled = !back.length;
  ui.next.disabled = !forward.length;
  ui.up.disabled = folder.id === 'root';
  ui.address.textContent = path.map(name).join(' › ');

  const rows = [];
  (function walk(n, depth) {
    const row = h('div', { class: 'tree-row' + (n.id === folder.id ? ' current' : ''), onclick: () => go(n.id) },
      h('span', { html: ICONS.folder, style: 'display:flex' }), name(n));
    row.style.paddingLeft = 4 + depth * 14 + 'px';
    rows.push(row);
    (n.children || []).filter((c) => c.type === 'folder').forEach((c) => walk(c, depth + 1));
  })(state.data.root, 0);
  ui.tree.replaceChildren(...rows);

  const items = (folder.children || []).map((n) => {
    const ico = h('span', { class: 'ico' });
    if (n.type === 'image' && n.src) ico.append(h('img', { src: assetUrl(n.src), alt: '', loading: 'lazy', draggable: false }));
    else ico.innerHTML = ICONS[iconKey(n)] || ICONS.file;
    if (n.type === 'link' && n.badge !== false) ico.append(h('span', { class: 'badge' }, '↗'));
    const el = h('button', { type: 'button', class: 'item' + (n.id === selected ? ' selected' : ''), 'data-id': n.id }, ico, h('span', {}, n.name));
    activatable(el, n.id, () => openNode(n), () => select(n.id));
    return el;
  });
  ui.files.replaceChildren(...(items.length ? items : [h('p', { class: 'empty' }, 'Ce dossier est vide.')]));
  ui.status.textContent = `${items.length} élément(s)` + (state.dirty ? ' • brouillon non publié' : '');
}

onChange(render);
