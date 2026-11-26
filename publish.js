// Publication : un seul commit sur GitHub (API), ou export ZIP pour envoyer à la main.
import { state, pending, usedAssets, clearDraft, changed, emit } from './store.js';

const toBase64 = (blob) => new Promise((ok, ko) => {
  const r = new FileReader();
  r.onload = () => ok(r.result.slice(r.result.indexOf(',') + 1));
  r.onerror = () => ko(r.error);
  r.readAsDataURL(blob);
});

function client({ owner, repo, token }) {
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  return async (path, { method = 'GET', body, raw = false, optional = false } = {}) => {
    const res = await fetch(base + path, {
      method, cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (optional && res.status === 404) return null;
    if (!res.ok) {
      const help = { 401: 'jeton refusé', 403: 'droits insuffisants sur le jeton', 404: 'dépôt ou branche introuvable (vérifie aussi le jeton)', 422: 'GitHub a refusé la modification' }[res.status];
      throw new Error(`Erreur GitHub ${res.status}${help ? ' : ' + help : ''}`);
    }
    return raw ? res.text() : res.json();
  };
}

export async function publish(cfg, { log, confirmOverwrite }) {
  const api = client(cfg);
  const dir = cfg.folder.replace(/^\/+|\/+$/g, '');
  const prefix = dir ? dir + '/' : '';
  const branch = cfg.branch.split('/').map(encodeURIComponent).join('/');

  log('Connexion au dépôt…');
  const ref = await api(`/git/ref/heads/${branch}`);
  const head = await api(`/git/commits/${ref.object.sha}`);
  const tree = await api(`/git/trees/${head.tree.sha}?recursive=1`);
  const existing = new Set(tree.tree.map((t) => t.path));
  const encoded = (prefix + 'data.json').split('/').map(encodeURIComponent).join('/');
  const remoteText = await api(`/contents/${encoded}?ref=${ref.object.sha}`, { raw: true, optional: true });
  const remote = remoteText ? JSON.parse(remoteText) : null;
  if (remote && remote.rev !== state.data.rev && !confirmOverwrite()) return false;

  const before = JSON.stringify(state.data);
  const data = JSON.parse(before);
  data.rev = Math.max(remote?.rev || 0, data.rev || 0) + 1;
  const used = usedAssets(data);
  const entries = [];

  const uploads = [...used].filter((p) => !existing.has(prefix + p));
  for (const [i, path] of uploads.entries()) {
    const file = pending.get(path);
    if (!file) throw new Error(`Fichier manquant : ${path}. Remplace-le depuis l’onglet Fichiers.`);
    log(`Envoi du fichier ${i + 1} / ${uploads.length}…`);
    const blob = await api('/git/blobs', { method: 'POST', body: { content: await toBase64(file.blob), encoding: 'base64' } });
    entries.push({ path: prefix + path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  // Supprime uniquement les fichiers que le site utilisait et n'utilise plus.
  if (remote) {
    for (const path of usedAssets(remote)) {
      if (!used.has(path) && existing.has(prefix + path)) entries.push({ path: prefix + path, mode: '100644', type: 'blob', sha: null });
    }
  }
  entries.push({ path: prefix + 'data.json', mode: '100644', type: 'blob', content: JSON.stringify(data, null, 2) });

  log('Création du commit…');
  const newTree = await api('/git/trees', { method: 'POST', body: { base_tree: head.tree.sha, tree: entries } });
  const commit = await api('/git/commits', { method: 'POST', body: { message: 'Mise à jour du site depuis l’administration', tree: newTree.sha, parents: [ref.object.sha] } });
  await api(`/git/refs/heads/${branch}`, { method: 'PATCH', body: { sha: commit.sha } });

  const untouched = JSON.stringify(state.data) === before;
  state.data.rev = data.rev;
  state.published = data;
  if (untouched) { await clearDraft(); state.dirty = false; emit(); }
  else changed();
  return true;
}

// ---- ZIP sans compression (suffisant pour déposer les fichiers sur GitHub) ----
const CRC = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export async function makeZip() {
  const data = structuredClone(state.data);
  data.rev = (data.rev || 0) + 1;
  const files = [['data.json', new Blob([JSON.stringify(data, null, 2)])]];
  for (const path of usedAssets(data)) if (pending.has(path)) files.push([path, pending.get(path).blob]);
  const parts = [], central = [];
  let offset = 0, centralSize = 0;
  const header = (size, fields) => {
    const view = new DataView(new ArrayBuffer(size));
    for (const [at, bytes, value] of fields) bytes === 4 ? view.setUint32(at, value, true) : view.setUint16(at, value, true);
    return view.buffer;
  };
  for (const [name, blob] of files) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const n = new TextEncoder().encode(name), crc = crc32(bytes);
    const common = (at) => [[at, 2, 20], [at + 2, 2, 0x800], [at + 4, 2, 0], [at + 8, 2, 33], [at + 10, 4, crc], [at + 14, 4, bytes.length], [at + 18, 4, bytes.length], [at + 22, 2, n.length]];
    parts.push(header(30, [[0, 4, 0x04034b50], ...common(4)]), n, bytes);
    central.push(header(46, [[0, 4, 0x02014b50], [4, 2, 20], ...common(6), [42, 4, offset]]), n);
    offset += 30 + n.length + bytes.length;
    centralSize += 46 + n.length;
  }
  const end = header(22, [[0, 4, 0x06054b50], [8, 2, files.length], [10, 2, files.length], [12, 4, centralSize], [16, 4, offset]]);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
