// ─────────────────────────────────────────────
// EMPTY STATE — Réutilisable + timestamp
// ─────────────────────────────────────────────

export function renderEmptyState({ icon = '✓', title = 'Rien à signaler', description = '', timestamp = null, tone = 'success' } = {}) {
  const el = document.createElement('div');
  el.className = `empty-state empty-state--${tone}`;
  
  const iconEl = document.createElement('div');
  iconEl.className = 'empty-icon';
  iconEl.textContent = icon;
  el.appendChild(iconEl);
  
  const titleEl = document.createElement('div');
  titleEl.className = 'empty-title';
  titleEl.textContent = title;
  el.appendChild(titleEl);
  
  if (description) {
    const descEl = document.createElement('div');
    descEl.className = 'empty-desc';
    descEl.textContent = description;
    el.appendChild(descEl);
  }
  
  if (timestamp) {
    const tsEl = document.createElement('div');
    tsEl.className = 'empty-timestamp';
    tsEl.textContent = `Dernière sync : ${formatTime(timestamp)}`;
    el.appendChild(tsEl);
  }
  
  return el;
}

function formatTime(isoOrDate) {
  try {
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch {
    return '—';
  }
}
