// ─────────────────────────────────────────────
// MAIN — Entry point + routing
// ─────────────────────────────────────────────

import { initTheme, toggleTheme, syncThemeIcon } from './theme.js';
import { initAuthUI, logout } from './auth-ui.js';
import { initDemoMode, isDemoMode } from './pages/demo.js';
import { initTodayPage } from './pages/today.js';
import { initClientsPage } from './pages/clients.js';
import { api } from './lib/api.js';
import { refreshNow } from './lib/queue-manager.js';

initTheme();

document.addEventListener('DOMContentLoaded', async () => {
  syncThemeIcon();
  await initAuthUI();

  document.getElementById('theme-btn')?.addEventListener('click', toggleTheme);

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    if (!confirm('Se déconnecter ?')) return;
    await logout();
  });

  document.getElementById('refresh-btn')?.addEventListener('click', async () => {
    setSyncStatus('syncing');
    
    if (isDemoMode()) {
      const res = await api.ping();
      setSyncStatus(res.ok ? 'ok' : 'error', res.error);
      return;
    }
    
    try {
      await refreshNow();
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('error', err.message);
    }
  });

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const page = tab.dataset.page;
      switchPage(page);
    });
  });

  if (isDemoMode()) {
    initDemoMode();
  } else {
    const isLoggedIn = !document.getElementById('dashboard')?.hidden;
    if (isLoggedIn) {
      initTodayPage();
    } else {
      const observer = new MutationObserver(() => {
        if (!document.getElementById('dashboard')?.hidden) {
          initTodayPage();
          observer.disconnect();
        }
      });
      observer.observe(document.getElementById('dashboard'), { attributes: true, attributeFilter: ['hidden'] });
    }
  }
});

function switchPage(pageName) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.nav-tab[data-page="${pageName}"]`)?.classList.add('active');

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${pageName}`)?.classList.add('active');

  // Lot 6 — lazy-init the Clients page on first visit
  if (pageName === 'clients' && !isDemoMode()) {
    initClientsPage();
  }
}

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

window.setSyncStatus = setSyncStatus;
