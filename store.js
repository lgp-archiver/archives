// Données du site, brouillon local et fichiers en attente de publication.
export const state = { data: null, published: null, current: 'root', dirty: false };
export const pending = new Map(); // chemin "media/…" -> { blob, url }
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
export const emit = () => listeners.forEach((fn) => fn());

export async function load() {
  const res = await fetch('data.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('data.json introuvable (' + res.status + ')');
  state.data = await res.json();
  state.published = structuredClone(state.data);
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function find(id, node = state.data.root, parent = null, path = []) {
  const here = [...path, node];
  if (node.id === id) return { node, parent, path: here };
  for (const child of node.children || []) {
    const hit = find(id, child, node, here);
    if (hit) return hit;
  }
  return null;
}

export const assetUrl = (src) => (pending.get(src)?.url) || src || '';

export function safeUrl(url) {
  try {
    const u = new URL(url, location.href);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol) ? u.href : null;
  } catch { return null; }
}

export function addAsset(file) {
  const dot = file.name.lastIndexOf('.');
  const ext = dot > 0 ? file.name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, '') : '';
  const base = (dot > 0 ? file.name.slice(0, dot) : file.name).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'fichier';
  const path = `media/${base}-${uid()}${ext}`;
  pending.set(path, { blob: file, url: URL.createObjectURL(file) });
  return path;
}

export function usedAssets(data) {
  const out = new Set();
  (function walk(n) {
    for (const key of ['src', 'cover']) if (n[key]?.startsWith('media/')) out.add(n[key]);
    (n.children || []).forEach(walk);
  })(data.root);
  return out;
}

// ---- Brouillon (IndexedDB) : les changements survivent à un rechargement ----
const DB = 'explorateur:' + location.pathname.replace(/index\.html$/, '');
function db() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('draft');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
async function tx(mode, run) {
  const d = await db();
  return new Promise((ok, ko) => {
    const t = d.transaction('draft', mode);
    const req = run(t.objectStore('draft'));
    t.oncomplete = () => { d.close(); ok(req?.result); };
    t.onerror = () => { d.close(); ko(t.error); };
  });
}

let saving = Promise.resolve();
let timer = null;
function save() {
  clearTimeout(timer);
  timer = null;
  if (!state.dirty) return saving;
  const used = usedAssets(state.data);
  const snapshot = { data: structuredClone(state.data), files: [...pending].filter(([p]) => used.has(p)).map(([p, v]) => [p, v.blob]) };
  saving = saving.then(() => tx('readwrite', (s) => s.put(snapshot, 'current')))
    .catch((e) => console.warn('Brouillon non enregistré', e));
  return saving;
}
export function changed() {
  state.dirty = true;
  emit();
  clearTimeout(timer);
  timer = setTimeout(save, 400);
}
addEventListener('pagehide', () => { if (timer) save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && timer) save(); });

export async function restoreDraft() {
  if (state.dirty) return false;
  let draft;
  try { draft = await tx('readonly', (s) => s.get('current')); } catch { return false; }
  if (!draft) return false;
  const content = (d) => JSON.stringify({ ...d, rev: 0 });
  // Le brouillon est déjà en ligne (ex. ZIP envoyé à la main) : on l'oublie.
  if (content(draft.data) === content(state.published)) { await clearDraft(); return false; }
  state.data = draft.data;
  for (const [path, blob] of draft.files) pending.set(path, { blob, url: URL.createObjectURL(blob) });
  state.dirty = true;
  emit();
  return true;
}

export async function clearDraft() {
  clearTimeout(timer);
  timer = null;
  await saving;
  try { await tx('readwrite', (s) => s.delete('current')); } catch { /* stockage indisponible */ }
}

export async function discardDraft() {
  await clearDraft();
  state.data = structuredClone(state.published);
  pending.forEach((v) => URL.revokeObjectURL(v.url));
  pending.clear();
  state.dirty = false;
  emit();
}
