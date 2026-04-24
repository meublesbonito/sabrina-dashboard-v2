// ─────────────────────────────────────────────
// MAIN — Entry point + routing
// ─────────────────────────────────────────────

import { initTheme, toggleTheme } from './theme.js';
import { initAuthUI, logout } from './auth-ui.js';

// Init theme avant tout (évite flash)
initTheme();

document.addEventListener('DOMContentLoaded', async () => {
  // Init auth (login UI ou dashboard direct si déjà connecté)
  await initAuthUI();

  // Theme toggle
  document.getElementById('theme-btn')?.addEventListener('click', toggleTheme);

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    if (!confirm('Se déconnecter ?')) return;
    await logout();
  });

  // Refresh
  document.getElementById('refresh-btn')?.addEventListener('click', () => {
    setSyncStatus('syncing');
    setTimeout(() => setSyncStatus('ok'), 800);
    // Au Lot 3 : appel API pour rafraîchir les données
  });

  // Navigation entre pages
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const page = tab.dataset.page;
      switchPage(page);
    });
  });
});

function switchPage(pageName) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.nav-tab[data-page="${pageName}"]`)?.classList.add('active');

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${pageName}`)?.classList.add('active');
}

// Sync status helper (utilisé par tous les Lots futurs)
export function setSyncStatus(state, message) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const icon = el.querySelector('.sync-icon');
  const text = el.querySelector('.sync-text');

  el.classList.remove('syncing', 'error');

  if (state === 'syncing') {
    el.classList.add('syncing');
    icon.textContent = '↻';
    text.textContent = 'Synchronisation...';
  } else if (state === 'ok') {
    icon.textContent = '✓';
    const now = new Date();
    text.textContent = `Sync OK ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
  } else if (state === 'error') {
    el.classList.add('error');
    icon.textContent = '⚠';
    text.textContent = message || 'Erreur de synchronisation';
  }
}

// Expose globalement pour les autres modules
window.setSyncStatus = setSyncStatus;
