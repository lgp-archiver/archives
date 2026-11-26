// Petits outils d'interface partagés.
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v; // réservé aux icônes internes
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

// Un clic = sélectionner, deux clics rapprochés (ou Entrée) = ouvrir.
// Fonctionne pareil à la souris, au doigt et avec le curseur tactile.
let last = { key: null, time: 0 };
export function activatable(el, key, open, select) {
  el.addEventListener('click', (e) => {
    select?.();
    if (e.detail === 0 && e.isTrusted) { open(); return; } // clavier
    const now = performance.now();
    if (last.key === key && now - last.time < 450) { last = { key: null, time: 0 }; open(); }
    else last = { key, time: now };
  });
}
