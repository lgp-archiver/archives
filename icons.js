// Icônes originales du site (SVG). Modifie-les librement.
const wrap = (b) => `<svg viewBox="0 0 48 48" aria-hidden="true">${b}</svg>`;
const sheet = (b) => wrap(`<path d="M10 4h20l9 9v31H10z" fill="#fffdf8" stroke="#1d1b26" stroke-width="2"/><path d="M30 4v9h9" fill="none" stroke="#1d1b26" stroke-width="2"/>${b}`);
export const ICONS = {
  folder: wrap('<path d="M4 12a4 4 0 0 1 4-4h11l5 6h16a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" style="fill:var(--folder)" stroke="#1d1b26" stroke-width="2"/><path d="M4 21h40" stroke="#1d1b26" stroke-width="2" opacity=".35"/>'),
  audio: sheet('<circle cx="19" cy="34" r="5" fill="#7a4fa3"/><path d="M24 34V19l9 4" fill="none" stroke="#7a4fa3" stroke-width="3"/>'),
  image: sheet('<rect x="15" y="19" width="19" height="18" fill="#2f8f83"/><circle cx="21" cy="25" r="3" fill="#f2c14e"/><path d="M15 37l8-8 5 5 3-3 3 3v3z" fill="#1d1b26"/>'),
  text: sheet('<path d="M16 20h17M16 26h17M16 32h11" stroke="#6d685e" stroke-width="2.5"/>'),
  link: wrap('<circle cx="24" cy="24" r="19" fill="#2f8f83" stroke="#1d1b26" stroke-width="2"/><path d="M17 31l14-14m-10 0h10v10" fill="none" stroke="#fff" stroke-width="4"/>'),
  file: sheet(''),
  admin: wrap('<path d="M15 22v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#1d1b26" stroke-width="4"/><rect x="9" y="21" width="30" height="23" rx="4" fill="#f2c14e" stroke="#1d1b26" stroke-width="2"/><circle cx="24" cy="31" r="3.5"/><path d="M24 31v7" stroke="#1d1b26" stroke-width="3"/>'),
};
