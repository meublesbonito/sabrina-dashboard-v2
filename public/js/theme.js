// ─────────────────────────────────────────────
// THEME — Dark/Light mode toggle
// ─────────────────────────────────────────────

const STORAGE_KEY = 'sabrina-theme';

export function initTheme() {
  // Appelé AVANT DOMContentLoaded - ne touche QUE le document root
  const saved = localStorage.getItem(STORAGE_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

export function syncThemeIcon() {
  // Appelé APRÈS DOMContentLoaded - met à jour le bouton
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEY, next);
  syncThemeIcon();
}
