// ─────────────────────────────────────────────
// ACTION ROW — Ligne de la queue Today
// Composant central : SLA + nom + tel + valeur + raison
// Boutons contextuels selon callbacks fournis (1 à 7 boutons)
// ZÉRO logique métier — uniquement render + callbacks
// ─────────────────────────────────────────────

import {
  validateAction,
  formatPhone,
  formatMoney,
  formatWaitTime,
  ACTION_TYPE_LABELS
} from '../lib/action-shape.js';
import { renderSlaBadge } from './sla-badge.js';

export function renderActionRow(action, callbacks = {}) {
  validateAction(action);
  
const row = document.createElement('div');
  row.className = `action-row action-row--${action.priority || 'medium'}`;
  row.dataset.actionId = action.id || '';
  row.dataset.psid = action.psid || '';
  row.dataset.actionType = action.actionType || '';
  
  // ─── COLONNE 1 : SLA badge ───
  const slaCol = document.createElement('div');
  slaCol.className = 'action-row-sla';
  slaCol.appendChild(renderSlaBadge(action.priority));
  
  // ─── COLONNE 2 : Identité + raison + dernier message ───
  const mainCol = document.createElement('div');
  mainCol.className = 'action-row-main';
  
  // Ligne 1 : Nom · Téléphone · Valeur
  const line1 = document.createElement('div');
  line1.className = 'action-row-identity';
  
  const nameEl = document.createElement('span');
  nameEl.className = 'action-row-name';
  nameEl.textContent = action.clientName || 'Client';
  line1.appendChild(nameEl);
  
  if (action.phone) {
    const phoneEl = document.createElement('span');
    phoneEl.className = 'action-row-phone';
    phoneEl.textContent = formatPhone(action.phone);
    line1.appendChild(phoneEl);
  }
  
  if (action.value) {
    const valueEl = document.createElement('span');
    valueEl.className = 'action-row-value';
    valueEl.textContent = formatMoney(action.value);
    line1.appendChild(valueEl);
  }
  
  // Ligne 2 : Type + raison + temps
  const line2 = document.createElement('div');
  line2.className = 'action-row-reason';
  
  const typeLabel = ACTION_TYPE_LABELS[action.actionType] || action.actionType || '';
  const typeEl = document.createElement('span');
  typeEl.className = 'action-row-type';
  typeEl.textContent = typeLabel;
  line2.appendChild(typeEl);
  
  if (action.reason) {
    const reasonEl = document.createElement('span');
    reasonEl.className = 'action-row-reason-text';
    reasonEl.textContent = `· ${action.reason}`;
    line2.appendChild(reasonEl);
  }
  
  const waitEl = document.createElement('span');
  waitEl.className = 'action-row-wait';
  waitEl.textContent = `· attend depuis ${formatWaitTime(action.waitMinutes)}`;
  line2.appendChild(waitEl);
  
  mainCol.appendChild(line1);
  mainCol.appendChild(line2);
  
  // Ligne 3 : Dernier message (italique)
  if (action.lastMessage) {
    const line3 = document.createElement('div');
    line3.className = 'action-row-message';
    line3.textContent = `"${truncate(action.lastMessage, 120)}"`;
    mainCol.appendChild(line3);
  }
  
  // ─── COLONNE 3 : Boutons d'action ───
  const actionsCol = document.createElement('div');
  actionsCol.className = 'action-row-actions';
  
  const buttons = [];
  
  if (callbacks.onCall && action.phone) {
    buttons.push(makeBtn('btn-action btn-call', '📞 Appeler', () => callbacks.onCall(action)));
  }
  if (callbacks.onOpenBusinessSuite) {
    buttons.push(makeBtn('btn-action btn-bs', '💼 Inbox', () => callbacks.onOpenBusinessSuite(action)));
  }
  if (callbacks.onCopyFollowup) {
    buttons.push(makeBtn('btn-action btn-copy', '📋 Copier', () => callbacks.onCopyFollowup(action)));
  }
  
  // Séparateur visuel
  if (buttons.length > 0 && (callbacks.onConvert || callbacks.onNoAnswer || callbacks.onLost || callbacks.onDone)) {
    const sep = document.createElement('span');
    sep.className = 'action-row-sep';
    buttons.push(sep);
  }
  
  if (callbacks.onConvert) {
    buttons.push(makeBtn('btn-action btn-convert', '✓ Converti', () => callbacks.onConvert(action)));
  }
  if (callbacks.onNoAnswer) {
    buttons.push(makeBtn('btn-action btn-noanswer', '📞 Pas répondu', () => callbacks.onNoAnswer(action)));
  }
  if (callbacks.onLost) {
    buttons.push(makeBtn('btn-action btn-lost', '❌ Perdu', () => callbacks.onLost(action)));
  }
  if (callbacks.onDone) {
    buttons.push(makeBtn('btn-action btn-done', '✓ Traité', () => callbacks.onDone(action)));
  }
  
  buttons.forEach(b => actionsCol.appendChild(b));
  
  // Assemblage
  row.appendChild(slaCol);
  row.appendChild(mainCol);
  row.appendChild(actionsCol);
  
  return row;
}

function makeBtn(className, label, onClick) {
  const btn = document.createElement('button');
  btn.className = className;
  btn.textContent = label;
  btn.type = 'button';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}
