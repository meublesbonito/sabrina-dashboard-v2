// ─────────────────────────────────────────────
// ACTION CARD — Top KPI cards (4 columns Today)
// ─────────────────────────────────────────────

import { formatMoney } from '../lib/action-shape.js';

export function renderActionCard({ label, count = 0, value = 0, tone = 'gray', onClick } = {}) {
  const card = document.createElement('div');
  card.className = `action-card action-card--${tone}`;
  if (count > 0) card.classList.add('action-card--has-items');
  
  const labelEl = document.createElement('div');
  labelEl.className = 'action-card-label';
  labelEl.textContent = label || '';
  card.appendChild(labelEl);
  
  const countEl = document.createElement('div');
  countEl.className = 'action-card-count';
  countEl.textContent = String(count);
  card.appendChild(countEl);
  
  const valueEl = document.createElement('div');
  valueEl.className = 'action-card-value';
  valueEl.textContent = value > 0 ? formatMoney(value) : '—';
  card.appendChild(valueEl);
  
  const ctaEl = document.createElement('div');
  ctaEl.className = 'action-card-cta';
  ctaEl.textContent = 'Voir →';
  card.appendChild(ctaEl);
  
  if (onClick) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => onClick({ label, count, value }));
  }
  
  return card;
}
