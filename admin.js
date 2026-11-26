// Administration : code d'accès, gestion des fichiers, réglages, publication.
import { state, find, uid, changed, addAsset, assetUrl, safeUrl, restoreDraft, discardDraft } from './store.js';
import { h } from './ui.js';
import { ICONS } from './icons.js';
import { openWindow, getWindow } from './windows.js';
import { publish, makeZip } from './publish.js';

let unlocked = false, tab = 'files', selected = 'root', panel = null, tabsEl = null, treeEl = null, publishing = false;
const TYPES = { folder: 'Dossier', audio: 'Audio', image: 'Photo', text: 'Texte', link: 'Lien', file: 'Fichier', admin: 'Accès admin' };
const BIG = 25 * 1024 * 1024, MAX = 90 * 1024 * 1024;

// ---------- Code d'accès ----------
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function hashCode(code, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations }, key, 256));
}

export function askCode() {
  if (unlocked) return openAdmin();
  if (document.querySelector('.overlay')) return;
  const input = h('input', { type: 'password', autocomplete: 'off', placeholder: 'Code', 'aria-label': 'Code' });
  const error = h('p', { class: 'error', role: 'alert' });
  const close = () => overlay.remove();
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault();
    if (!crypto.subtle) { error.textContent = 'Ouvre le site en https (ou sur localhost).'; return; }
    const a = state.data.settings.admin;
    if (await hashCode(input.value, a.salt, a.iterations) !== a.hash) { error.textContent = 'Code incorrect.'; input.value = ''; return; }
    unlocked = true;
    close();
    const restored = await restoreDraft();
    openAdmin(restored ? 'Brouillon non publié restauré.' : '');
  } }, input, error, h('div', { class: 'row' }, h('button', { type: 'button', onclick: close }, 'Annuler'), h('button', { type: 'submit' }, 'Ouvrir')));
  const overlay = h('div', { class: 'overlay', 'data-direct': '' },
    h('div', { class: 'dialog' }, h('div', { class: 'titlebar' }, h('span', { class: 'title' }, 'Accès protégé')), form));
  document.body.append(overlay);
  input.focus();
}

// ---------- Fenêtre ----------
function openAdmin(message = '') {
  if (getWindow('admin')) return getWindow('admin').focus();
  const win = openWindow({ id: 'admin', title: 'Administration', width: 720, height: 540, direct: true });
  tabsEl = h('div', { class: 'tabs' });
  panel = h('div', { class: 'panel' });
  win.body.append(h('div', { class: 'admin' }, tabsEl, panel));
  render(message);
}

function render(message = '') {
  const tabs = { files: 'Fichiers', look: 'Apparence et lecteur', publish: 'Publication', security: 'Sécurité' };
  tabsEl.replaceChildren(...Object.entries(tabs).map(([key, label]) =>
    h('button', { type: 'button', class: key === tab ? 'active' : '', onclick: () => { tab = key; render(); } }, label)));
  panel.replaceChildren(...[message && h('p', { class: 'note' }, message)].filter(Boolean));
  ({ files: filesTab, look: lookTab, publish: publishTab, security: securityTab })[tab]();
}

// ---------- Champs ----------
function field(label, obj, key, { type = 'text', options, after, ...rest } = {}) {
  let input;
  if (options) input = h('select', {}, Object.entries(options).map(([value, text]) => h('option', { value }, text)));
  else if (type === 'textarea') input = h('textarea', rest);
  else input = h('input', { type, ...rest });
  if (type === 'checkbox') input.checked = !!obj[key];
  else input.value = obj[key] ?? '';
  input.addEventListener(options || type === 'checkbox' ? 'change' : 'input', () => {
    obj[key] = type === 'checkbox' ? input.checked : type === 'range' ? Number(input.value) : input.value;
    changed();
    after?.();
  });
  return type === 'checkbox'
    ? h('label', { class: 'check' }, input, label)
    : h('label', { class: 'field' }, h('span', {}, label), input);
}
const button = (text, onclick, props = {}) => h('button', { type: 'button', onclick, ...props }, text);

function pickFiles(accept, multiple, done) {
  const input = h('input', { type: 'file', accept, multiple, hidden: true });
  input.addEventListener('change', () => {
    const files = [...input.files].filter((f) => {
      if (f.size > MAX) { alert(`« ${f.name} » dépasse 90 Mo : trop lourd pour être publié ainsi.`); return false; }
      return f.size <= BIG || confirm(`« ${f.name} » fait plus de 25 Mo. L’ajouter quand même ?`);
    });
    input.remove();
    if (files.length) done(files);
  });
  document.body.append(input);
  input.click();
}

// ---------- Onglet Fichiers ----------
function targetFolder() {
  const hit = find(selected) || find('root');
  return hit.node.type === 'folder' ? hit.node : hit.parent;
}
function add(...nodes) {
  const folder = targetFolder();
  (folder.children ||= []).push(...nodes);
  selected = nodes.at(-1).id;
  changed();
  render();
}
function addFromFiles(type, accept) {
  pickFiles(accept, true, (files) => add(...files.map((f) => {
    const node = { id: uid(), type, name: f.name, src: addAsset(f) };
    if (type === 'audio') Object.assign(node, { artist: '', cover: '' });
    if (type === 'image') Object.assign(node, { caption: '', text: '', textPosition: 'right' });
    return node;
  })));
}

function drawTree() {
  const rows = [];
  (function walk(n, depth) {
    const row = h('div', { class: 'tree-row' + (n.id === selected ? ' current' : ''), tabIndex: 0, onclick: () => { selected = n.id; render(); } },
      h('span', { html: ICONS[n.type === 'link' ? n.look || 'link' : n.type] || ICONS.file, style: 'display:flex' }),
      (n.id === 'root' ? state.data.settings.rootName : n.name) + (n.type === 'link' ? ' ↗' : ''));
    row.style.paddingLeft = 4 + depth * 14 + 'px';
    rows.push(row);
    (n.children || []).forEach((c) => walk(c, depth + 1));
  })(state.data.root, 0);
  treeEl.replaceChildren(...rows);
}

function filesTab() {
  if (!find(selected)) selected = 'root';
  treeEl = h('div', { class: 'tree' });
  const form = h('div');
  panel.append(
    h('div', { class: 'row' },
      button('+ Dossier', () => add({ id: uid(), type: 'folder', name: 'Nouveau dossier', children: [] })),
      button('+ Audio', () => addFromFiles('audio', 'audio/*,.mp3,.m4a,.ogg,.wav,.flac')),
      button('+ Photos', () => addFromFiles('image', 'image/*')),
      button('+ Texte', () => add({ id: uid(), type: 'text', name: 'Nouveau texte.txt', content: '' })),
      button('+ Lien', () => add({ id: uid(), type: 'link', name: 'Nouveau lien', url: 'https://', look: 'link', badge: true, newTab: true })),
      button('+ Autre fichier', () => addFromFiles('file', ''))),
    h('p', {}, 'Les ajouts vont dans : ', h('b', {}, targetFolder().id === 'root' ? state.data.settings.rootName : targetFolder().name)),
    h('div', { class: 'fm' }, treeEl, form));
  drawTree();
  nodeForm(form);
}

function nodeForm(form) {
  const { node, parent } = find(selected);
  if (node.id === 'root') { form.append(h('p', {}, 'Choisis un élément dans la liste pour le modifier.')); return; }
  form.append(h('h3', {}, TYPES[node.type]), field('Nom', node, 'name', { after: drawTree }));

  if (node.type === 'admin') { form.append(h('p', {}, 'Ce fichier ouvre l’administration. Il reste dans le premier dossier.')); }
  if (node.type === 'link') {
    const warn = h('p', { class: 'error' });
    const check = () => { warn.textContent = safeUrl(node.url) && node.url !== 'https://' ? '' : 'Adresse à compléter (https://…, mailto:… ou tel:…).'; };
    form.append(
      field('Adresse', node, 'url', { type: 'url', after: check }), warn,
      field('Apparence', node, 'look', { options: { link: 'Lien', folder: 'Dossier', audio: 'Audio', image: 'Photo', text: 'Texte', file: 'Fichier' }, after: drawTree }),
      field('Afficher la petite flèche de lien', node, 'badge', { type: 'checkbox' }),
      field('Ouvrir dans un nouvel onglet', node, 'newTab', { type: 'checkbox' }));
    check();
  }
  if (node.type === 'text') form.append(field('Contenu', node, 'content', { type: 'textarea' }));
  if (node.type === 'audio') {
    form.append(field('Artiste ou description', node, 'artist'),
      h('div', { class: 'row field' },
        button(node.cover ? 'Changer la pochette' : 'Ajouter une pochette', () => pickFiles('image/*', false, ([f]) => { node.cover = addAsset(f); changed(); render(); })),
        node.cover && button('Retirer la pochette', () => { node.cover = ''; changed(); render(); })));
  }
  if (node.type === 'image') {
    form.append(h('img', { src: assetUrl(node.src), alt: '', style: 'max-width:100%;max-height:120px;margin-bottom:8px' }),
      field('Titre à côté de la photo', node, 'caption'),
      field('Texte à côté de la photo', node, 'text', { type: 'textarea' }),
      field('Place du texte', node, 'textPosition', { options: { right: 'À droite', left: 'À gauche', bottom: 'En dessous' } }));
  }
  if (node.src !== undefined) {
    const accept = { audio: 'audio/*,.mp3,.m4a,.ogg,.wav,.flac', image: 'image/*' }[node.type] || '';
    form.append(h('div', { class: 'field' }, button('Remplacer le fichier', () => pickFiles(accept, false, ([f]) => { node.src = addAsset(f); changed(); render(); }))));
  }
  if (node.type === 'admin') return;

  // Déplacer, ordonner, remplacer par un lien, supprimer
  const inside = new Set();
  (function walk(n) { inside.add(n.id); (n.children || []).forEach(walk); })(node);
  const folders = [];
  (function walk(n, path) {
    if (n.type !== 'folder' || inside.has(n.id)) return;
    const label = [...path, n.id === 'root' ? state.data.settings.rootName : n.name];
    folders.push(h('option', { value: n.id, selected: n.id === parent.id }, label.join(' › ')));
    (n.children || []).forEach((c) => walk(c, label));
  })(state.data.root, []);
  const move = h('select', { onchange: () => {
    parent.children.splice(parent.children.indexOf(node), 1);
    (find(move.value).node.children ||= []).push(node);
    changed(); render();
  } }, folders);
  const shift = (dir) => {
    const list = parent.children, i = list.indexOf(node), j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    changed(); render();
  };
  const full = node.children?.length;
  form.append(
    h('label', { class: 'field' }, h('span', {}, 'Dossier'), move),
    h('div', { class: 'row field' }, button('↑ Monter', () => shift(-1)), button('↓ Descendre', () => shift(1))),
    h('div', { class: 'row' },
      node.type !== 'link' && button('Remplacer par un lien', () => {
        if (!confirm(`Remplacer « ${node.name} » par un lien ? Son contenu${full ? ' (et tout le dossier)' : ''} sera retiré du site.`)) return;
        const link = { id: node.id, type: 'link', name: node.name, url: 'https://', look: node.type, badge: true, newTab: true };
        parent.children.splice(parent.children.indexOf(node), 1, link);
        changed(); render();
      }),
      button('Supprimer', () => {
        if (!confirm(`Supprimer « ${node.name} »${full ? ' et tout son contenu' : ''} ?`)) return;
        parent.children.splice(parent.children.indexOf(node), 1);
        selected = parent.id;
        changed(); render();
      }, { class: 'danger' })));
}

// ---------- Onglet Apparence ----------
function lookTab() {
  const s = state.data.settings;
  const color = (label, obj, key) => field(label, obj, key, { type: 'color' });
  panel.append(
    h('h3', {}, 'Site'),
    field('Titre de l’onglet', s, 'title'),
    field('Nom du premier dossier', s, 'rootName', { after: () => { state.data.root.name = s.rootName; } }),
    h('div', { class: 'row' }, color('Fenêtres', s.theme, 'accent'), color('Barres', s.theme, 'chrome'), color('Fond', s.theme, 'desktop'), color('Dossiers', s.theme, 'folder')),
    h('h3', {}, 'Lecteur audio'),
    h('div', { class: 'row' }, color('Fond', s.player, 'background'), color('Texte', s.player, 'text'), color('Boutons', s.player, 'accent')),
    field('Afficher la liste de lecture', s.player, 'playlist', { type: 'checkbox' }),
    field('Enchaîner les morceaux', s.player, 'autoNext', { type: 'checkbox' }),
    field('Répéter le morceau par défaut', s.player, 'loop', { type: 'checkbox' }),
    field('Barres animées (peut couper le son écran éteint sur certains téléphones)', s.player, 'visualizer', { type: 'checkbox' }),
    h('h3', {}, 'Curseur sur mobile'),
    field('Au premier affichage', s.trackpad, 'default', { options: { auto: 'Activé sur écran tactile', on: 'Toujours activé', off: 'Désactivé' } }),
    field('Vitesse du curseur', s.trackpad, 'speed', { type: 'range', min: 0.6, max: 3, step: 0.1 }));
}

// ---------- Onglet Publication ----------
const store = {
  get(key) { try { return sessionStorage.getItem(key) || localStorage.getItem(key) || ''; } catch { return ''; } },
  set(key, value, keep) {
    try {
      localStorage.removeItem(key); sessionStorage.removeItem(key);
      (keep ? localStorage : sessionStorage).setItem(key, value);
    } catch { /* stockage indisponible */ }
  },
};
function guessRepo() {
  const m = location.hostname.match(/^(.+)\.github\.io$/);
  if (!m) return { owner: '', repo: '' };
  const first = location.pathname.split('/').filter(Boolean)[0];
  return { owner: m[1], repo: first && !first.endsWith('.html') ? first : location.hostname };
}

function publishTab() {
  const key = 'explorateur-gh:' + location.pathname;
  let saved = {};
  try { saved = JSON.parse(store.get(key)) || {}; } catch { /* rien d'enregistré */ }
  const cfg = { ...guessRepo(), branch: 'main', folder: '', token: '', keep: false, ...saved };
  const remember = () => store.set(key, JSON.stringify(cfg), cfg.keep);
  const status = h('p', { role: 'status' });
  const gh = (label, k, props = {}) => {
    const input = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, value: cfg[k], ...props });
    input.addEventListener('input', () => { cfg[k] = input.value.trim(); remember(); });
    return h('label', { class: 'field' }, h('span', {}, label), input);
  };
  const keep = h('input', { type: 'checkbox', checked: cfg.keep, onchange: () => { cfg.keep = keep.checked; remember(); } });
  const go = button('Publier sur GitHub', async () => {
    if (publishing) return;
    if (!cfg.owner || !cfg.repo || !cfg.branch || !cfg.token) { status.textContent = 'Remplis le compte, le dépôt, la branche et le jeton.'; return; }
    publishing = true;
    go.disabled = true;
    try {
      const ok = await publish(cfg, {
        log: (t) => { status.textContent = t; },
        confirmOverwrite: () => confirm('La version en ligne a changé depuis le chargement de cette page. L’écraser avec la tienne ?'),
      });
      status.textContent = ok ? 'Publié. GitHub Pages met souvent une à deux minutes à afficher la nouvelle version.' : 'Publication annulée.';
    } catch (e) {
      status.textContent = e.message;
    } finally {
      publishing = false;
      go.disabled = false;
    }
  });
  panel.append(
    h('p', { class: 'note' }, state.dirty ? 'Tu as des changements non publiés (visibles seulement sur cet appareil).' : 'Aucun changement en attente.'),
    gh('Compte GitHub', 'owner'), gh('Nom du dépôt', 'repo'), gh('Branche', 'branch'),
    gh('Sous-dossier (vide si le site est à la racine)', 'folder'),
    gh('Jeton d’accès GitHub', 'token', { type: 'password' }),
    h('label', { class: 'check' }, keep, 'Mémoriser le jeton sur cet appareil (seulement s’il est à toi)'),
    h('div', { class: 'row' }, go,
      button('Télécharger en ZIP', async () => {
        const url = URL.createObjectURL(await makeZip());
        h('a', { href: url, download: 'mise-a-jour-site.zip' }).click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }),
      button('Annuler mes changements', async () => {
        if (!confirm('Revenir à la dernière version publiée ?')) return;
        await discardDraft();
        render('Changements annulés.');
      }, { class: 'danger' })),
    status);
}

// ---------- Onglet Sécurité ----------
function securityTab() {
  const first = h('input', { type: 'password', autocomplete: 'new-password' });
  const second = h('input', { type: 'password', autocomplete: 'new-password' });
  const status = h('p', { role: 'status' });
  panel.append(
    h('p', { class: 'note' }, 'Le code cache l’administration, mais tous les fichiers d’un site GitHub Pages restent publics. Seul le jeton GitHub permet de modifier le site en ligne : ne le partage jamais. Choisis un code long.'),
    h('label', { class: 'field' }, h('span', {}, 'Nouveau code (6 caractères minimum)'), first),
    h('label', { class: 'field' }, h('span', {}, 'Répéter le code'), second),
    h('div', { class: 'row' },
      button('Changer le code', async () => {
        if (first.value.length < 6 || first.value !== second.value) { status.textContent = 'Les deux codes doivent être identiques et faire au moins 6 caractères.'; return; }
        const a = state.data.settings.admin;
        a.salt = b64(crypto.getRandomValues(new Uint8Array(16)));
        a.hash = await hashCode(first.value, a.salt, a.iterations);
        changed();
        first.value = second.value = '';
        status.textContent = 'Code changé. Publie pour l’appliquer en ligne.';
      }),
      button('Verrouiller', () => { unlocked = false; getWindow('admin')?.close(); })),
    status);
}
