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
import { api } from '../lib/api.js';
import { renderRelanceCard } from '../components/relance-card.js';
import { isDemoMode } from './demo.js';

const LOST_REASONS = [
  { value: 'price_too_high', label: 'Prix trop cher' },
  { value: 'no_response',    label: 'Pas répondu après relance' },
  { value: 'not_interested', label: 'Pas intéressé' },
  { value: 'out_of_zone',    label: 'Hors zone livraison' },
  { value: 'other',          label: 'Autre' }
];

let initialized = false;

// ─────────────────────────────────────────────
// RELANCES — section "Actions à effectuer maintenant"
// State module-scoped, indépendant de la queue Today.
// Rebuilt à chaque renderTodayPage depuis ce cache (pas de re-fetch).
// Auto-refresh toutes les 2 minutes, sauf si une action PATCH est en cours.
// ─────────────────────────────────────────────

const RELANCES_AUTO_REFRESH_MS = 120000; // 2 min
const RELANCES_DEFAULT_VISIBLE = 10;

let relancesCache = [];
let relancesLoading = false;
let relancesError = null;
let relancesShowAll = false;
let relancesLoadedOnce = false;
const relancesPending = new Map(); // recId → actionKey ('copy', 'mark_called', etc.)
let relancesAutoRefreshTimer = null;

// Last queue snapshot — used by the global "Résumé du jour" so it can rerender
// when only relances change (no queue update). Updated in renderTodayPage().
let lastQueueSnapshot = [];

// PSID → CONVERSATIONS record id cache (read-only lookup).
// Populated lazily on the first "Détails" click per RELANCE psid.
// No invalidation: a psid → recXXX mapping is stable for the session lifetime.
const psidToConvoIdCache = new Map();

const PRIORITY_RANK = { haute: 0, moyenne: 1, basse: 2 };

function sortRelances(arr) {
  return [...arr].sort((a, b) => {
    const pA = PRIORITY_RANK[(a.priorite || '').toLowerCase()] ?? 99;
    const pB = PRIORITY_RANK[(b.priorite || '').toLowerCase()] ?? 99;
    if (pA !== pB) return pA - pB;
    const cA = (a.canal_relance || '').toLowerCase() === 'appel' ? 0 : 1;
    const cB = (b.canal_relance || '').toLowerCase() === 'appel' ? 0 : 1;
    if (cA !== cB) return cA - cB;
    const vA = a.valeur_estimee || 0;
    const vB = b.valeur_estimee || 0;
    if (vA !== vB) return vB - vA;
    const dA = a.derniere_activite_client?.iso ? new Date(a.derniere_activite_client.iso).getTime() : 0;
    const dB = b.derniere_activite_client?.iso ? new Date(b.derniere_activite_client.iso).getTime() : 0;
    return dB - dA;
  });
}

async function loadRelances() {
  if (isDemoMode()) return;
  if (relancesPending.size > 0) return; // gate: ne pas refetch pendant un PATCH
  relancesLoading = true;
  relancesError = null;
  rerenderRelancesSection();
  const res = await api.getRelances();
  relancesLoading = false;
  if (res && res.ok) {
    relancesCache = sortRelances(Array.isArray(res.data) ? res.data : []);
    relancesError = null;
    relancesLoadedOnce = true;
  } else {
    relancesError = (res && res.error) || 'Erreur de chargement des relances';
  }
  rerenderRelancesSection();
}

function startRelancesAutoRefresh() {
  if (relancesAutoRefreshTimer) return;
  relancesAutoRefreshTimer = setInterval(() => {
    if (relancesPending.size > 0) return; // skip si action en cours
    if (isDemoMode()) return;
    loadRelances();
  }, RELANCES_AUTO_REFRESH_MS);
}

function rerenderRelancesSection() {
  const slot = document.getElementById('today-relances-slot');
  if (slot) slot.replaceChildren(buildRelancesSection());
  // Le résumé global dépend aussi de relancesCache → on le rerender ici.
  rerenderTodaySummary();
}

function rerenderTodaySummary() {
  const slot = document.getElementById('today-summary-slot');
  if (!slot) return;
  slot.replaceChildren(buildTodaySummary(lastQueueSnapshot));
}

// ─────────────────────────────────────────────
// Résumé du jour — bloc compact en haut de Today
// Source de vérité : relancesCache + lastQueueSnapshot (queue actuelle).
// Rerender automatique :
//  - via renderTodayPage() à chaque cycle queue
//  - via rerenderTodaySummary() après mutation locale relances
// ─────────────────────────────────────────────

function buildTodaySummary(queue) {
  const safeQueue = Array.isArray(queue) ? queue : [];

  const relancesCount = relancesCache.length;
  const suivisCount = safeQueue.length;
  const totalActions = relancesCount + suivisCount;

  const valeurRelances = relancesCache.reduce((s, r) => s + (r.valeur_estimee || 0), 0);
  const valeurSuivis   = safeQueue.reduce((s, a) => s + (a.value || 0), 0);
  const valeurTotale   = valeurRelances + valeurSuivis;

  const section = document.createElement('section');
  section.className = 'today-summary';

  // Eyebrow label
  const label = document.createElement('div');
  label.className = 'today-summary-label';
  label.textContent = 'Résumé du jour';
  section.appendChild(label);

  // Two-column grid : actions / valeur
  const grid = document.createElement('div');
  grid.className = 'today-summary-grid';

  // Stat 1 : Total actions
  const statActions = document.createElement('div');
  statActions.className = 'today-summary-stat';
  const numActions = document.createElement('div');
  numActions.className = 'today-summary-stat-num';
  numActions.textContent = String(totalActions);
  const labActions = document.createElement('div');
  labActions.className = 'today-summary-stat-lab';
  labActions.textContent = totalActions > 1 ? 'actions à traiter' : 'action à traiter';
  statActions.appendChild(numActions);
  statActions.appendChild(labActions);
  grid.appendChild(statActions);

  // Stat 2 : Valeur totale
  const statValue = document.createElement('div');
  statValue.className = 'today-summary-stat today-summary-stat--money';
  const numValue = document.createElement('div');
  numValue.className = 'today-summary-stat-num';
  numValue.textContent = formatMoney(valeurTotale);
  const labValue = document.createElement('div');
  labValue.className = 'today-summary-stat-lab';
  labValue.textContent = 'potentiel total';
  statValue.appendChild(numValue);
  statValue.appendChild(labValue);
  grid.appendChild(statValue);

  section.appendChild(grid);

  // Breakdown : "X relances Sabrina · Y suivis existants"
  const breakdown = document.createElement('div');
  breakdown.className = 'today-summary-breakdown';

  const partRelances = document.createElement('span');
  partRelances.className = 'today-summary-breakdown-part';
  const partRelancesNum = document.createElement('strong');
  partRelancesNum.textContent = String(relancesCount);
  partRelances.appendChild(partRelancesNum);
  partRelances.appendChild(document.createTextNode(' relances Sabrina'));

  const sep = document.createElement('span');
  sep.className = 'today-summary-breakdown-sep';
  sep.textContent = ' · ';

  const partSuivis = document.createElement('span');
  partSuivis.className = 'today-summary-breakdown-part';
  const partSuivisNum = document.createElement('strong');
  partSuivisNum.textContent = String(suivisCount);
  partSuivis.appendChild(partSuivisNum);
  partSuivis.appendChild(document.createTextNode(suivisCount > 1 ? ' suivis existants' : ' suivi existant'));

  breakdown.appendChild(partRelances);
  breakdown.appendChild(sep);
  breakdown.appendChild(partSuivis);

  section.appendChild(breakdown);

  return section;
}

function removeRelanceLocally(id) {
  relancesCache = relancesCache.filter(r => r.id !== id);
  relancesPending.delete(id);
  rerenderRelancesSection();
}

function setPending(id, actionKey) {
  relancesPending.set(id, actionKey);
  rerenderRelancesSection();
}
function clearPending(id) {
  relancesPending.delete(id);
  rerenderRelancesSection();
}

// ─── Callbacks RELANCE ───

async function handleRelanceCopy(relance) {
  if (relancesPending.has(relance.id)) return;
  setPending(relance.id, 'copy');
  try {
    await navigator.clipboard.writeText(relance.message_suggere || '');
    toast.success('Message copié');
  } catch {
    toast.error('Impossible de copier');
  }
  clearPending(relance.id);
}

async function handleRelanceCopyAndCalled(relance) {
  if (relancesPending.has(relance.id)) return;
  setPending(relance.id, 'copy_and_called');
  try {
    await navigator.clipboard.writeText(relance.message_suggere || '');
  } catch {
    toast.error('Impossible de copier');
    clearPending(relance.id);
    return;
  }
  const res = await api.updateRelance(relance.id, 'mark_called');
  if (res && res.ok) {
    removeRelanceLocally(relance.id);
    toast.success('Message copié · marqué traité');
  } else {
    clearPending(relance.id);
    toast.error(`Échec : ${(res && res.error) || 'erreur inconnue'}`);
  }
}

function makeRelanceWriter(action, successLabel) {
  return async (relance) => {
    if (relancesPending.has(relance.id)) return;
    setPending(relance.id, action);
    const res = await api.updateRelance(relance.id, action);
    if (res && res.ok) {
      removeRelanceLocally(relance.id);
      toast.success(successLabel);
    } else {
      clearPending(relance.id);
      toast.error(`Échec : ${(res && res.error) || 'erreur inconnue'}`);
    }
  };
}

// Read-only handler — opens the existing drawer with the convo behind a psid.
// No Airtable write. No new endpoint. No mutation of RELANCES nor CONVERSATIONS.
async function handleRelanceViewDetails(relance) {
  if (!relance || !relance.psid) {
    toast.error('Conversation introuvable');
    return;
  }
  if (relancesPending.has(relance.id)) return;
  setPending(relance.id, 'view_details');

  try {
    let convoId = psidToConvoIdCache.get(relance.psid);
    let convoMeta = null;

    if (!convoId) {
      const res = await api.searchConvos(relance.psid, { limit: 1 });
      const found = (res && res.ok && Array.isArray(res.data)) ? res.data[0] : null;
      // Defensive: searchConvos matches multiple fields. Require exact psid match.
      if (!found || String(found.psid || '') !== String(relance.psid)) {
        toast.error('Conversation introuvable');
        clearPending(relance.id);
        return;
      }
      convoId = found.id;
      convoMeta = found;
      psidToConvoIdCache.set(relance.psid, convoId);
    }

    openDrawerForConvo(convoId, {
      psid: relance.psid,
      customer_name: (convoMeta && convoMeta.customer_name) || relance.psid
    });
  } catch {
    toast.error('Conversation introuvable');
  } finally {
    clearPending(relance.id);
  }
}

const relanceCallbacks = {
  onCopy:           handleRelanceCopy,
  onViewDetails:    handleRelanceViewDetails,
  onCopyAndCalled:  handleRelanceCopyAndCalled,
  onMarkCalled:     makeRelanceWriter('mark_called',    'Marqué traité'),
  onMarkConverted:  makeRelanceWriter('mark_converted', 'Marqué converti'),
  onMarkLost:       makeRelanceWriter('mark_lost',      'Marqué perdu'),
  onMarkIgnored:    makeRelanceWriter('mark_ignored',   'Ignoré')
};

function buildRelancesSection() {
  const section = document.createElement('section');
  section.className = 'today-relances-section';

  // ─── Header ───
  const header = document.createElement('div');
  header.className = 'today-relances-header';
  const title = document.createElement('h2');
  title.className = 'today-relances-title';
  title.textContent = 'Actions à effectuer maintenant';
  const subtitle = document.createElement('div');
  subtitle.className = 'today-relances-subtitle';
  subtitle.textContent = 'Relances clients générées par Sabrina';
  header.appendChild(title);
  header.appendChild(subtitle);
  section.appendChild(header);

  // ─── Counters ───
  const totalOpen   = relancesCache.length;
  const totalHaute  = relancesCache.filter(r => (r.priorite || '').toLowerCase() === 'haute').length;
  const totalAppel  = relancesCache.filter(r => r.statut === 'à_appeler').length;
  const totalMess   = relancesCache.filter(r => r.statut === 'à_relancer_messenger').length;
  const totalValue  = relancesCache.reduce((s, r) => s + (r.valeur_estimee || 0), 0);

  const counters = document.createElement('div');
  counters.className = 'today-relances-counters';
  counters.appendChild(makeCounter('Total ouvertes', String(totalOpen)));
  counters.appendChild(makeCounter('Haute priorité', String(totalHaute), 'today-relance-counter--haute'));
  counters.appendChild(makeCounter('À appeler',      String(totalAppel)));
  counters.appendChild(makeCounter('À relancer Messenger', String(totalMess)));
  counters.appendChild(makeCounter('Valeur estimée totale', formatMoney(totalValue)));
  section.appendChild(counters);

  // ─── Loading ───
  if (relancesLoading && !relancesLoadedOnce) {
    const loader = document.createElement('div');
    loader.className = 'today-relances-loader';
    loader.textContent = 'Chargement des relances...';
    section.appendChild(loader);
    return section;
  }

  // ─── Erreur ───
  if (relancesError && relancesCache.length === 0) {
    const errBox = document.createElement('div');
    errBox.className = 'today-relances-error';
    errBox.textContent = `Impossible de charger les relances : ${relancesError}`;
    section.appendChild(errBox);
    return section;
  }

  // ─── Empty ───
  if (relancesCache.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'today-relances-empty';
    empty.textContent = 'Aucune relance à traiter';
    section.appendChild(empty);
    return section;
  }

  // ─── Liste cards (limitée à 10 par défaut) ───
  const visible = relancesShowAll
    ? relancesCache
    : relancesCache.slice(0, RELANCES_DEFAULT_VISIBLE);

  const list = document.createElement('div');
  list.className = 'today-relances-list';
  for (const r of visible) {
    const cardState = { pendingAction: relancesPending.get(r.id) || null };
    list.appendChild(renderRelanceCard(r, cardState, relanceCallbacks));
  }
  section.appendChild(list);

  // ─── Voir plus ───
  if (!relancesShowAll && relancesCache.length > RELANCES_DEFAULT_VISIBLE) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'today-relances-show-more';
    const remaining = relancesCache.length - RELANCES_DEFAULT_VISIBLE;
    more.textContent = `Voir plus (${remaining})`;
    more.addEventListener('click', () => {
      relancesShowAll = true;
      rerenderRelancesSection();
    });
    section.appendChild(more);
  }

  return section;
}

function makeCounter(label, value, extraClass = '') {
  const wrap = document.createElement('div');
  wrap.className = `today-relance-counter ${extraClass}`.trim();
  const v = document.createElement('div');
  v.className = 'today-relance-counter-v';
  v.textContent = value;
  const k = document.createElement('div');
  k.className = 'today-relance-counter-k';
  k.textContent = label;
  wrap.appendChild(v);
  wrap.appendChild(k);
  return wrap;
}

export function initTodayPage() {
  if (initialized) return;
  initialized = true;

  subscribe(renderTodayPage);
  refreshNow();
  startAutoRefresh();

  // RELANCES : initial load + auto-refresh 2 min (skipped si demo)
  if (!isDemoMode()) {
    loadRelances();
    startRelancesAutoRefresh();
  }
}

function renderTodayPage({ queue, isLoading, error, lastFetchedAt }) {
  const target = document.querySelector('#page-today .page-body');
  if (!target) return;

  if (new URL(location.href).searchParams.get('demo') === '1') return;

  target.replaceChildren();

  // Capture la queue pour le résumé global (rerender quand relances changent).
  lastQueueSnapshot = Array.isArray(queue) ? queue : [];

  updateUrgentBadge(queue);

  // ─── Résumé du jour (slot tout en haut, avant tout) ───
  const summarySlot = document.createElement('div');
  summarySlot.id = 'today-summary-slot';
  summarySlot.appendChild(buildTodaySummary(lastQueueSnapshot));
  target.appendChild(summarySlot);
  
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

  // ─── Section RELANCES (indépendante de la queue Today) ───
  const relancesSlot = document.createElement('div');
  relancesSlot.id = 'today-relances-slot';
  relancesSlot.appendChild(buildRelancesSection());
  target.appendChild(relancesSlot);

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
