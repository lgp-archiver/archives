import { state, load, onChange } from './store.js';
import { applyTheme } from './theme.js';
import { openExplorer, goHome } from './explorer.js';
import { initTrackpad } from './trackpad.js';

async function start() {
  try { await load(); } catch (e) {
    document.getElementById('desktop').textContent =
      'Impossible de charger data.json. En local, lance un petit serveur (voir README). ' + e.message;
    document.getElementById('desktop').style.cssText = 'color:#fff;padding:20px';
    return;
  }
  applyTheme();
  onChange(applyTheme);
  openExplorer();
  initTrackpad();
  document.getElementById('home-btn').addEventListener('click', goHome);
  const clock = document.getElementById('clock');
  const tick = () => { clock.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  tick();
  setInterval(tick, 15000);
}
start();
