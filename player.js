// Lecteur audio intégré. Apparence : css/player.css. Comportement : ce fichier.
import { state, find, onChange, assetUrl } from './store.js';
import { h } from './ui.js';
import { openWindow, getWindow } from './windows.js';

const audio = new Audio();
audio.preload = 'metadata';
let track = null, list = [], ui = null, ctx = null, analyser = null, frame = 0;
const cfg = () => state.data.settings.player;
const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

function slider(name, get, set) {
  const fill = h('i'), knob = h('b');
  const el = h('div', { class: 'player-slider', role: 'slider', tabIndex: 0, 'aria-label': name }, fill, knob);
  const paint = () => { const p = Math.round((get() || 0) * 1000) / 10 + '%'; fill.style.width = p; knob.style.left = p; };
  const at = (x) => { const r = el.getBoundingClientRect(); set(Math.min(1, Math.max(0, (x - r.left) / r.width))); paint(); };
  el.addEventListener('pointerdown', (e) => {
    at(e.clientX);
    const move = (m) => at(m.clientX);
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
  el.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -0.05, ArrowRight: 0.05 }[e.key];
    if (step) { set(Math.min(1, Math.max(0, get() + step))); paint(); }
  });
  return { el, paint };
}

function build() {
  const win = openWindow({ id: 'player', title: 'Lecteur audio', width: 380, height: 460, onClose: () => {
    audio.pause(); audio.removeAttribute('src'); cancelAnimationFrame(frame); ui = null; track = null;
  } });
  const b = (text, name, fn, cls = '') => h('button', { type: 'button', class: 'pl ' + cls, 'aria-label': name, onclick: fn }, text);
  ui = {
    win,
    cover: h('div', { class: 'player-cover' }),
    title: h('div', { class: 'player-title' }),
    artist: h('div', { class: 'player-artist' }),
    viz: h('canvas', { class: 'player-viz', width: 400, height: 48 }),
    time: h('span', {}, '0:00'), dur: h('span', {}, '0:00'),
    seek: slider('Position', () => audio.currentTime / audio.duration || 0, (v) => { if (audio.duration) audio.currentTime = v * audio.duration; }),
    vol: slider('Volume', () => audio.volume, (v) => { audio.volume = v; }),
    play: b('▶', 'Lecture / pause', () => (audio.paused ? start() : audio.pause()), 'main'),
    loop: b('⟳', 'Répéter', () => { audio.loop = !audio.loop; ui.loop.setAttribute('aria-pressed', audio.loop); }),
    list: h('ul', { class: 'player-list' }),
  };
  audio.loop = !!cfg().loop;
  ui.loop.setAttribute('aria-pressed', audio.loop);
  ui.root = h('div', { class: 'player' },
    h('div', { class: 'player-head' }, ui.cover, h('div', {}, ui.title, ui.artist)),
    ui.viz,
    h('div', { class: 'player-row' }, ui.time, ui.seek.el, ui.dur),
    h('div', { class: 'player-row player-controls' }, b('⏮', 'Précédent', () => step(-1)), ui.play, b('⏭', 'Suivant', () => step(1)), ui.loop),
    h('div', { class: 'player-row player-volume' }, '🔊', ui.vol.el),
    ui.list);
  win.body.append(ui.root);
  ui.vol.paint();
}

function applySettings() {
  if (!ui) return;
  const c = cfg();
  ui.root.style.setProperty('--pl-bg', c.background);
  ui.root.style.setProperty('--pl-text', c.text);
  ui.root.style.setProperty('--pl-accent', c.accent);
  ui.list.hidden = !c.playlist;
  ui.viz.hidden = !c.visualizer;
}

function show() {
  ui.title.textContent = track.name;
  ui.artist.textContent = track.artist || '';
  const cover = track.cover
    ? h('img', { class: 'player-cover', src: assetUrl(track.cover), alt: '' })
    : h('div', { class: 'player-cover' }, '♪');
  ui.cover.replaceWith(cover);
  ui.cover = cover;
  ui.list.replaceChildren(...list.map((t) => h('li', { class: t.id === track.id ? 'current' : '', onclick: () => load(t) }, t.name)));
  applySettings();
}

function load(node) {
  track = node;
  audio.src = assetUrl(node.src);
  show();
  start();
}

function start() {
  visualize();
  audio.play().catch(() => {}); // si le navigateur bloque, le bouton ▶ reste disponible
}

function step(dir) {
  const i = list.findIndex((t) => t.id === track?.id);
  if (list.length) load(list[(i + dir + list.length) % list.length]);
}

function visualize() {
  if (!cfg().visualizer) return;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      ctx.createMediaElementSource(audio).connect(analyser);
      analyser.connect(ctx.destination);
    }
    ctx.resume();
  } catch (e) { console.warn('Visualiseur indisponible', e); }
}

function draw() {
  cancelAnimationFrame(frame);
  if (!ui || !analyser || audio.paused) return;
  const g = ui.viz.getContext('2d'), data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  g.clearRect(0, 0, 400, 48);
  g.fillStyle = cfg().accent;
  data.forEach((v, i) => g.fillRect(i * (400 / data.length), 48 - (v / 255) * 48, 400 / data.length - 2, (v / 255) * 48));
  frame = requestAnimationFrame(draw);
}

export function playAudio(node) {
  const folder = find(node.id)?.parent;
  list = (folder?.children || [node]).filter((n) => n.type === 'audio');
  if (!getWindow('player')) build(); else ui.win.focus();
  load(node);
}

audio.addEventListener('timeupdate', () => { if (ui) { ui.time.textContent = fmt(audio.currentTime); ui.seek.paint(); } });
audio.addEventListener('loadedmetadata', () => { if (ui) { ui.dur.textContent = fmt(audio.duration); ui.seek.paint(); } });
audio.addEventListener('play', () => { if (ui) { ui.play.textContent = '⏸'; draw(); } });
audio.addEventListener('pause', () => { if (ui) ui.play.textContent = '▶'; });
audio.addEventListener('ended', () => { if (cfg().autoNext && track && list.at(-1)?.id !== track.id) step(1); });
audio.addEventListener('error', () => { if (ui && track) ui.artist.textContent = 'Impossible de lire ce fichier.'; });
onChange(() => {
  if (!ui || !track) return;
  const hit = find(track.id);
  if (!hit || hit.node.type !== 'audio') return ui.win.close();
  track = hit.node;
  list = (hit.parent.children || []).filter((n) => n.type === 'audio');
  show();
});
