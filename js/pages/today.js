// ─────────────────────────────────────────────
// PAGE TODAY — Action queue branchée sur API
// Affichage + actions optimistes
// ─────────────────────────────────────────────

import { ACTION_TYPES } from '../lib/action-shape.js';
import { renderActionRow } from '../components/action-row.js';
import { renderActionCard } from '../components/action-card.js';
import { renderEmptyState } from '../components/empty-state.js';
import { renderErrorBanner } from '../components/error-banner.js';
import { showModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { formatMoney } from '../lib/action-shape.js';
import {
  subscribe,
  refreshNow,
  performAction,
  startAutoRefresh,
  isPending
} from '../lib/queue-manager.js';
import { openDrawerForConvo } from './clients.js';

const LOST_REASONS = [
  { value: 'price_too_high', label: 'Prix trop cher' },
  { value: 'no_response',    label: 'Pas répondu après relance' },
  { value: 'not_interested', label: 'Pas intéressé' },
  { value: 'out_of_zone',    label: 'Hors zone livraison' },
  { value: 'other',          label: 'Autre' }
];

let initialized = false;

export function initTodayPage() {
  if (initialized) return;
  initialized = true;
  
  subscribe(renderTodayPage);
  refreshNow();
  startAutoRefresh();
}

function renderTodayPage({ queue, isLoading, error, lastFetchedAt }) {
  const target = document.querySelector('#page-today .page-body');
  if (!target) return;
  
  if (new URL(location.href).searchParams.get('demo') === '1') return;
  
  target.replaceChildren();
  
  updateUrgentBadge(queue);
  
  // ─── Loading initial ───
  if (isLoading && (!lastFetchedAt || queue.length === 0)) {
    target.appendChild(renderEmptyState({
      icon: '↻',
      title: 'Chargement...',
      description: 'Récupération des conversations en cours.',
      tone: 'neutral'
    }));
    return;
  }
  
  // ─── Erreur ───
  if (error && queue.length === 0) {
    target.appendChild(renderErrorBanner({
      message: 'Impossible de charger les conversations',
      detail: error,
      onRetry: () => refreshNow()
    }));
    return;
  }
  
  // ─── KPI Section ───
  const kpiSection = document.createElement('div');
  kpiSection.className = 'today-kpi';
  
  const totalValue = queue.reduce((sum, a) => sum + (a.value || 0), 0);
  const kpiHero = document.createElement('div');
  kpiHero.className = 'today-kpi-hero';
  
  const kpiLabel = document.createElement('div');
  kpiLabel.className = 'today-kpi-label';
  kpiLabel.textContent = 'Argent à risque aujourd\'hui';
  kpiHero.appendChild(kpiLabel);
  
  const kpiValue = document.createElement('div');
  kpiValue.className = 'today-kpi-value';
  kpiValue.textContent = formatMoney(totalValue);
  kpiHero.appendChild(kpiValue);
  
  const kpiCount = document.createElement('div');
  kpiCount.className = 'today-kpi-count';
  kpiCount.textContent = `${queue.length} action${queue.length > 1 ? 's' : ''} à traiter`;
  kpiHero.appendChild(kpiCount);
  
  kpiSection.appendChild(kpiHero);
  
  // 4 ActionCards
  const cards = document.createElement('div');
  cards.className = 'today-action-cards';
  
  const callNow = queue.filter(a => a.actionType === ACTION_TYPES.CALL_NOW);
  const frustrated = queue.filter(a => a.actionType === ACTION_TYPES.FRUSTRATED);
  const blocked = queue.filter(a => a.actionType === ACTION_TYPES.BOT_BLOCKED);
  const cod = queue.filter(a => a.actionType === ACTION_TYPES.COD_CONFIRM);
  
  cards.appendChild(renderActionCard({
    label: 'À appeler',
    count: callNow.length,
    value: callNow.reduce((s, a) => s + (a.value || 0), 0),
    tone: 'red',
    onClick: () => scrollToFirstOf(ACTION_TYPES.CALL_NOW)
  }));
  cards.appendChild(renderActionCard({
    label: 'Clients frustrés',
    count: frustrated.length,
    value: frustrated.reduce((s, a) => s + (a.value || 0), 0),
    tone: 'red',
    onClick: () => scrollToFirstOf(ACTION_TYPES.FRUSTRATED)
  }));
  cards.appendChild(renderActionCard({
    label: 'COD à confirmer',
    count: cod.length,
    value: cod.reduce((s, a) => s + (a.value || 0), 0),
    tone: 'orange',
    onClick: () => scrollToFirstOf(ACTION_TYPES.COD_CONFIRM)
  }));
  cards.appendChild(renderActionCard({
    label: 'Sabrina bloquée',
    count: blocked.length,
    value: blocked.reduce((s, a) => s + (a.value || 0), 0),
    tone: 'blue',
    onClick: () => scrollToFirstOf(ACTION_TYPES.BOT_BLOCKED)
  }));
  
  kpiSection.appendChild(cards);
  target.appendChild(kpiSection);
  
  // ─── Liste des actions ───
  const listSection = document.createElement('div');
  listSection.className = 'today-list';
  
  if (queue.length === 0) {
    listSection.appendChild(renderEmptyState({
      icon: '✓',
      title: 'Tout est traité',
      description: 'Aucune action en attente. Bon travail !',
      timestamp: lastFetchedAt || new Date(),
      tone: 'success'
    }));
  } else {
    const callbacks = makeCallbacks();
    queue.forEach(action => {
      const row = renderActionRow(action, callbacks);
      if (isPending(action.id)) {
        row.classList.add('action-row--pending');
      }
      listSection.appendChild(row);
    });
  }
  
  target.appendChild(listSection);
}

// ─── Callbacks ───

function makeCallbacks() {
  return {
    onCall: (action) => {
      if (action.phone) {
        window.location.href = `tel:${action.phone}`;
      } else {
        toast.info('Pas de téléphone client');
      }
    },
    onOpenBusinessSuite: (action) => {
      window.open(action.businessSuiteUrl, '_blank', 'noopener');
    },
    onCopyFollowup: (action) => {
      const text = buildFollowupMessage(action);
      navigator.clipboard.writeText(text)
        .then(() => toast.success('Message copié'))
        .catch(() => toast.error('Impossible de copier'));
    },
    onConvert: handleConvert,
    onNoAnswer: handleNoAnswer,
    onLost: handleLost,
    onDone: handleDone,
    // Lot 6 — open the read-only drawer with the same convo
    onViewDrawer: (action) => {
      openDrawerForConvo(action.id, { psid: action.psid, customer_name: action.clientName });
    }
  };
}

function buildFollowupMessage(action) {
  return `Bonjour ${action.clientName}, c'est Bonito Meubles. Je vous recontacte au sujet de votre demande.`;
}

async function handleConvert(action) {
  const res = await performAction(action, { action: 'converted' });
  if (res.ok) {
    toast.success(`✓ ${action.clientName} converti`);
  } else {
    toast.error(`Échec : ${res.error}`);
  }
}

async function handleDone(action) {
  const res = await performAction(action, { action: 'done' });
  if (res.ok) {
    toast.success(`✓ ${action.clientName} traité`);
  } else {
    toast.error(`Échec : ${res.error}`);
  }
}

function handleNoAnswer(action) {
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:12px;font-size:13px;';
  
  const intro = document.createElement('p');
  intro.style.cssText = 'color:var(--text-muted);margin:0;';
  intro.textContent = 'Choisis quand revenir sur ce client.';
  body.appendChild(intro);
  
  const noteLabel = document.createElement('label');
  noteLabel.textContent = 'Note (optionnel)';
  noteLabel.style.cssText = 'font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600;';
  body.appendChild(noteLabel);
  
  const noteInput = document.createElement('textarea');
  noteInput.className = 'field-input';
  noteInput.style.cssText = 'min-height:60px;resize:vertical;';
  noteInput.placeholder = 'Ex: Boîte vocale, je relance demain';
  body.appendChild(noteInput);
  
  const buildFollowup = (hours) => new Date(Date.now() + hours * 3600000).toISOString();
  const tomorrow10am = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  })();
  
  showModal({
    title: `Rappeler ${action.clientName} dans...`,
    body,
    buttons: [
      { label: 'Annuler', variant: 'secondary', onClick: () => {} },
      {
        label: 'Dans 2h',
        variant: 'secondary',
        onClick: async () => {
          await submitNoAnswer(action, buildFollowup(2), noteInput.value);
        }
      },
      {
        label: 'Dans 4h',
        variant: 'secondary',
        onClick: async () => {
          await submitNoAnswer(action, buildFollowup(4), noteInput.value);
        }
      },
      {
        label: 'Demain 10h',
        variant: 'primary',
        onClick: async () => {
          await submitNoAnswer(action, tomorrow10am, noteInput.value);
        }
      }
    ]
  });
}

async function submitNoAnswer(action, followupAt, note) {
  const res = await performAction(action, {
    action: 'no_answer',
    followupAt,
    note: note?.trim() || undefined
  });
  if (res.ok) {
    toast.success(`✓ ${action.clientName} : rappel programmé`);
  } else {
    toast.error(`Échec : ${res.error}`);
  }
}

function handleLost(action) {
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:12px;font-size:13px;';
  
  const intro = document.createElement('p');
  intro.style.cssText = 'color:var(--text-muted);margin:0;';
  intro.textContent = `Marquer ${action.clientName} comme perdu.`;
  body.appendChild(intro);
  
  const reasonLabel = document.createElement('label');
  reasonLabel.textContent = 'Raison (obligatoire)';
  reasonLabel.style.cssText = 'font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600;';
  body.appendChild(reasonLabel);
  
  const reasonSelect = document.createElement('select');
  reasonSelect.className = 'field-input';
  reasonSelect.style.cssText = 'cursor:pointer;';
  
  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = '— Choisir une raison —';
  reasonSelect.appendChild(placeholderOpt);
  
  LOST_REASONS.forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    reasonSelect.appendChild(opt);
  });
  body.appendChild(reasonSelect);
  
  const noteLabel = document.createElement('label');
  noteLabel.textContent = 'Détails (optionnel)';
  noteLabel.style.cssText = 'font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600;';
  body.appendChild(noteLabel);
  
  const noteInput = document.createElement('textarea');
  noteInput.className = 'field-input';
  noteInput.style.cssText = 'min-height:60px;resize:vertical;';
  noteInput.placeholder = 'Ex: budget de 800$ insuffisant pour matelas king';
  body.appendChild(noteInput);
  
  showModal({
    title: 'Marquer comme perdu',
    body,
    buttons: [
      { label: 'Annuler', variant: 'secondary', onClick: () => {} },
      {
        label: 'Confirmer perte',
        variant: 'danger',
        onClick: async () => {
          if (!reasonSelect.value) {
            toast.error('Choisis une raison');
            return false; // garde modal ouvert
          }
          const reasonText = LOST_REASONS.find(r => r.value === reasonSelect.value)?.label || '';
          const customNote = noteInput.value?.trim() || '';
          const finalNote = customNote
            ? `${reasonText} — ${customNote}`
            : reasonText;
          
          const res = await performAction(action, {
            action: 'lost',
            note: finalNote
          });
          if (res.ok) {
            toast.success(`${action.clientName} marqué perdu`);
          } else {
            toast.error(`Échec : ${res.error}`);
          }
        }
      }
    ]
  });
}

// ─── Helpers UI ───

function scrollToFirstOf(actionType) {
  if (!actionType) return;
  const row = document.querySelector(
    `#page-today .action-row[data-action-type="${actionType}"]`
  );
  if (!row) return;
  
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row.style.transition = 'background 0.4s';
  const original = row.style.background;
  row.style.background = 'var(--bg-hover)';
  setTimeout(() => { row.style.background = original; }, 800);
}

function updateUrgentBadge(queue) {
  const el = document.getElementById('urgent-count-badge');
  if (!el) return;
  
  const critical = queue.filter(a => a.priority === 'critical').length;
  const high = queue.filter(a => a.priority === 'high').length;
  
  if (critical > 0) {
    el.hidden = false;
    el.classList.remove('high');
    el.textContent = `⚡ ${critical} URGENT`;
  } else if (high > 0) {
    el.hidden = false;
    el.classList.add('high');
    el.textContent = `⚡ ${high} actions`;
  } else {
    el.hidden = true;
    el.textContent = '';
  }
}
