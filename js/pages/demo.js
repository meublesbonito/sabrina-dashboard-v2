// ─────────────────────────────────────────────
// DEMO — Mode debug ?demo=1
// Debug preview : affiche tous les composants avec fake data
// + Section "Lot 4 — Action Queue" depuis fake datasets
// ─────────────────────────────────────────────

import { createFakeAction, ACTION_TYPES, PRIORITIES } from '../lib/action-shape.js';
import { renderActionCard } from '../components/action-card.js';
import { renderActionRow } from '../components/action-row.js';
import { renderSlaBadge } from '../components/sla-badge.js';
import { renderEmptyState } from '../components/empty-state.js';
import { renderErrorBanner } from '../components/error-banner.js';
import { showModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { renderCard } from '../components/card.js';

// Lot 4 imports
import { buildActionQueue } from '../lib/build-action-queue.js';
import { FAKE_CONVOS } from '../lib/fixtures/fake-convos.js';
import { FAKE_SIGNALS } from '../lib/fixtures/fake-signals.js';
import { FAKE_ERRORS } from '../lib/fixtures/fake-errors.js';

export function isDemoMode() {
  return new URL(location.href).searchParams.get('demo') === '1';
}

export function initDemoMode() {
  if (!isDemoMode()) return;
  
  const target = document.querySelector('#page-today .page-body');
  if (!target) return;
  target.replaceChildren();
  
  const wrap = document.createElement('div');
  wrap.className = 'demo-wrap';
  
  const titleEl = document.createElement('h2');
  titleEl.className = 'demo-title';
  titleEl.textContent = '🧪 Mode Demo — Composants Lot 2 + Action Queue Lot 4';
  wrap.appendChild(titleEl);
  
  // ═════════════════════════════════════════════
  // LOT 4 — ACTION QUEUE (en premier, c'est le plus important)
  // ═════════════════════════════════════════════
  const sectionQueue = section('🔥 Lot 4 — Action Queue construite depuis fake datasets');
  
  const queue = buildActionQueue({
    convos: FAKE_CONVOS,
    signals: FAKE_SIGNALS,
    errors: FAKE_ERRORS
  });
  
  // Stats résumées
  const stats = document.createElement('div');
  stats.className = 'demo-row';
  stats.style.cssText = 'background:var(--bg-subtle);padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:12px;color:var(--text-muted);font-family:JetBrains Mono,monospace;';
  stats.textContent = `Input : ${FAKE_CONVOS.length} convos + ${FAKE_SIGNALS.length} signaux  →  Output : ${queue.length} actions`;
  sectionQueue.appendChild(stats);
  
  if (queue.length === 0) {
    sectionQueue.appendChild(renderEmptyState({
      icon: '✓',
      title: 'Aucune action détectée',
      description: 'Les fake datasets n\'ont généré aucune action.',
      timestamp: new Date(),
      tone: 'neutral'
    }));
  } else {
    const cb = {
      onCall: a => toast.success(`Appel ${a.phone}`),
      onOpenBusinessSuite: a => toast.info('Ouvre Business Suite'),
      onCopyFollowup: a => toast.success('Message copié'),
      onConvert: a => toast.success(`✓ ${a.clientName} converti`),
      onNoAnswer: a => showFollowupModal(a),
      onLost: a => toast.error(`${a.clientName} marqué perdu`),
      onDone: a => toast.success(`${a.clientName} traité`)
    };
    queue.forEach(action => sectionQueue.appendChild(renderActionRow(action, cb)));
  }
  wrap.appendChild(sectionQueue);
  
  // ═════════════════════════════════════════════
  // LOT 2 — COMPOSANTS (en démo classique)
  // ═════════════════════════════════════════════
  
  // 1. Action cards
  const section1 = section('1. ActionCards (KPI Today)');
  const grid = document.createElement('div');
  grid.className = 'demo-grid-4';
  grid.appendChild(renderActionCard({ label: 'À appeler', count: 3, value: 2200, tone: 'red',    onClick: a => toast.info(`Cliqué : ${a.label}`) }));
  grid.appendChild(renderActionCard({ label: 'COD à confirmer', count: 2, value: 1650, tone: 'orange', onClick: a => toast.info(`Cliqué : ${a.label}`) }));
  grid.appendChild(renderActionCard({ label: 'Sabrina bloquée', count: 1, value: 800,  tone: 'blue',   onClick: a => toast.info(`Cliqué : ${a.label}`) }));
  grid.appendChild(renderActionCard({ label: 'Erreurs critiques', count: 0, value: 0,  tone: 'gray',   onClick: a => toast.info(`Cliqué : ${a.label}`) }));
  section1.appendChild(grid);
  wrap.appendChild(section1);
  
  // 2. Action rows (avec fake actions)
  const section2 = section('2. ActionRow (data hardcoded)');
  const cb = {
    onCall: a => toast.success(`Appel ${a.phone}`),
    onOpenBusinessSuite: a => toast.info('Ouvre Business Suite'),
    onCopyFollowup: a => toast.success('Message copié'),
    onConvert: a => toast.success(`✓ ${a.clientName} converti`),
    onNoAnswer: a => showFollowupModal(a),
    onLost: a => toast.error(`${a.clientName} marqué perdu`),
    onDone: a => toast.success(`${a.clientName} traité`)
  };
  section2.appendChild(renderActionRow(createFakeAction({ priority: PRIORITIES.CRITICAL, waitMinutes: 67 }), cb));
  section2.appendChild(renderActionRow(createFakeAction({ clientName: 'Jean Bouchard', phone: '5145559876', value: 890, priority: PRIORITIES.HIGH, actionType: ACTION_TYPES.COD_CONFIRM, reason: 'COD livraison demain', lastMessage: 'OK pour demain matin', waitMinutes: 32 }), cb));
  section2.appendChild(renderActionRow(createFakeAction({ clientName: 'Claudette Roy', value: 650, priority: PRIORITIES.MEDIUM, actionType: ACTION_TYPES.BOT_BLOCKED, reason: 'Sabrina répète 3x', lastMessage: 'Je comprends pas ce que tu me dis', waitMinutes: 15 }), cb));
  section2.appendChild(renderActionRow(createFakeAction({ clientName: 'Ahmed Benali', phone: '', value: 450, priority: PRIORITIES.LOW, actionType: ACTION_TYPES.ABANDONED_CART, reason: 'Panier ouvert 2h', lastMessage: '', waitMinutes: 125 }), cb));
  wrap.appendChild(section2);
  
  // 3. SLA badges
  const section3 = section('3. SLA Badges');
  const badges = document.createElement('div');
  badges.className = 'demo-row';
  ['critical', 'high', 'medium', 'low'].forEach(p => {
    badges.appendChild(renderSlaBadge(p, { showLabel: true }));
  });
  section3.appendChild(badges);
  wrap.appendChild(section3);
  
  // 4. Cards génériques
  const section4 = section('4. Cards génériques');
  const cardRow = document.createElement('div');
  cardRow.className = 'demo-grid-3';
  cardRow.appendChild(renderCard({ title: 'Default', body: 'Contenu de la carte par défaut.' }));
  cardRow.appendChild(renderCard({ variant: 'subtle', title: 'Subtle', body: 'Variant subtle.' }));
  cardRow.appendChild(renderCard({ variant: 'urgent', title: 'Urgent', body: 'Variant urgent (border rouge).' }));
  section4.appendChild(cardRow);
  wrap.appendChild(section4);
  
  // 5. Empty states
  const section5 = section('5. Empty States');
  const emptyRow = document.createElement('div');
  emptyRow.className = 'demo-grid-2';
  emptyRow.appendChild(renderEmptyState({ icon: '✓', title: 'Tout est traité', description: 'Aucune action en attente', timestamp: new Date(), tone: 'success' }));
  emptyRow.appendChild(renderEmptyState({ icon: '⏳', title: 'En attente', description: 'Pas encore de data', tone: 'neutral' }));
  section5.appendChild(emptyRow);
  wrap.appendChild(section5);
  
  // 6. Error banner
  const section6 = section('6. Error Banner');
  section6.appendChild(renderErrorBanner({
    message: 'Impossible de charger les conversations',
    detail: 'Dernier essai : ' + new Date().toLocaleTimeString('fr-CA'),
    onRetry: () => toast.info('Retry simulé')
  }));
  wrap.appendChild(section6);
  
  // 7. Modal + Toast
  const section7 = section('7. Modal + Toast (clique pour tester)');
  const btnRow = document.createElement('div');
  btnRow.className = 'demo-row';
  
  const buttons = [
    { act: 'modal-confirm',  label: 'Modal confirmation' },
    { act: 'modal-followup', label: 'Modal "Rappeler dans..."' },
    { act: 'toast-success',  label: 'Toast success' },
    { act: 'toast-error',    label: 'Toast error' },
    { act: 'toast-info',     label: 'Toast info' }
  ];
  buttons.forEach(({ act, label }) => {
    const btn = document.createElement('button');
    btn.className = 'btn-demo';
    btn.textContent = label;
    btn.dataset.act = act;
    btnRow.appendChild(btn);
  });
  
  btnRow.addEventListener('click', e => {
    const act = e.target.dataset.act;
    if (act === 'modal-confirm') showConfirmModal();
    if (act === 'modal-followup') showFollowupModal(createFakeAction());
    if (act === 'toast-success') toast.success('Action réussie');
    if (act === 'toast-error') toast.error('Erreur de connexion Airtable');
    if (act === 'toast-info') toast.info('Information');
  });
  section7.appendChild(btnRow);
  wrap.appendChild(section7);
  
  target.appendChild(wrap);
}

// ─── Helpers internes ───
function section(title) {
  const s = document.createElement('section');
  s.className = 'demo-section';
  const h = document.createElement('h3');
  h.className = 'demo-section-title';
  h.textContent = title;
  s.appendChild(h);
  return s;
}

function showConfirmModal() {
  const body = document.createElement('p');
  body.textContent = 'Es-tu sûr de vouloir continuer ?';
  
  showModal({
    title: 'Confirmer l\'action',
    body,
    buttons: [
      { label: 'Annuler', variant: 'secondary', onClick: () => toast.info('Annulé') },
      { label: 'Confirmer', variant: 'primary', onClick: () => toast.success('Confirmé') }
    ]
  });
}

function showFollowupModal(action) {
  const body = document.createElement('p');
  body.style.cssText = 'color:var(--text-muted);font-size:13px;margin:0;';
  body.textContent = 'Choisis quand revenir sur ce client.';
  
  showModal({
    title: `Rappeler ${action.clientName} dans...`,
    body,
    buttons: [
      { label: 'Dans 2h',     variant: 'secondary', onClick: () => toast.success('Rappel dans 2h') },
      { label: 'Dans 4h',     variant: 'secondary', onClick: () => toast.success('Rappel dans 4h') },
      { label: 'Demain 10h',  variant: 'primary',   onClick: () => toast.success('Rappel demain 10h') }
    ]
  });
}
