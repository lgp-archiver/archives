import { state } from './store.js';
export function applyTheme() {
  const { theme, title } = state.data.settings;
  for (const [key, value] of Object.entries(theme)) document.documentElement.style.setProperty('--' + key, value);
  document.title = title;
}
