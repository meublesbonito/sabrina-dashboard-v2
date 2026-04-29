// ─────────────────────────────────────────────
// RELANCE CARD — Card d'une relance Sabrina dans Today
// Pas de logique métier — uniquement render + callbacks.
// Toutes les valeurs utilisateur passent par textContent (pas d'innerHTML).
// ─────────────────────────────────────────────

import { formatMoney } from '../lib/action-shape.js';

const PRIORITY_LABEL = { haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' };
const CANAL_LABEL    = { appel: 'Appel', messenger: 'Messenger', sms: 'SMS' };

/**
 * Format date ISO en relatif court : "à l'instant" / "il y a 5 min" / "il y a 2h" / "il y a 1 jour"
 */
export function formatRelativeTime(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '—';
  const diffMs = Date.now() - t;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1)   return "à l'instant";
  if (diffMin < 60)  return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24)    return `il y a ${diffH}h`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1)   return 'il y a 1 jour';
  if (diffD < 30)    return `il y a ${diffD} jours`;
  const diffMo = Math.round(diffD / 30);
  return diffMo === 1 ? 'il y a 1 mois' : `il y a ${diffMo} mois`;
}

/**
 * Render une carte RELANCE.
 * @param {Object} relance - relance mappée par /api/data/convos?source=relances
 * @param {Object} state - { pendingAction: string|null }  pendingAction = nom du bouton cliqué
 * @param {Object} callbacks - { onCopy, onCopyAndCalled, onMarkCalled, onMarkConverted, onMarkLost, onMarkIgnored }
 * @returns {HTMLElement}
 */
export function renderRelanceCard(relance, state = {}, callbacks = {}) {
  const card = document.createElement('div');
  const priorityKey = (relance.priorite || '').toLowerCase();
  const canalKey    = (relance.canal_relance || '').toLowerCase();

  const classes = ['today-relance-card'];
  if (priorityKey) classes.push(`today-relance-card--p-${priorityKey}`);
  if (canalKey)    classes.push(`today-relance-card--c-${canalKey}`);
  card.className = classes.join(' ');
  card.dataset.relanceId = relance.id || '';
  card.dataset.psid = relance.psid || '';

  // ─── HEADER : psid + badges priorité/canal ───
  const header = document.createElement('div');
  header.className = 'today-relance-card-head';

  const psid = document.createElement('span');
  psid.className = 'today-relance-psid';
  psid.textContent = relance.psid || '—';
  header.appendChild(psid);

  if (priorityKey) {
    const prioBadge = document.createElement('span');
    prioBadge.className = `today-relance-badge today-relance-badge--p-${priorityKey}`;
    prioBadge.textContent = PRIORITY_LABEL[priorityKey] || relance.priorite;
    header.appendChild(prioBadge);
  }

  if (canalKey) {
    const canalBadge = document.createElement('span');
    canalBadge.className = `today-relance-badge today-relance-badge--c-${canalKey}`;
    canalBadge.textContent = CANAL_LABEL[canalKey] || relance.canal_relance;
    header.appendChild(canalBadge);
  }

  if (relance.derniere_activite_client && relance.derniere_activite_client.iso) {
    const ago = document.createElement('span');
    ago.className = 'today-relance-ago';
    ago.textContent = formatRelativeTime(relance.derniere_activite_client.iso);
    header.appendChild(ago);
  }

  card.appendChild(header);

  // ─── META : type / produit / valeur / date_creation ───
  const meta = document.createElement('div');
  meta.className = 'today-relance-meta';

  if (relance.type_relance) {
    meta.appendChild(makeMeta('Type', relance.type_relance));
  }
  if (relance.produit_principal) {
    meta.appendChild(makeMeta('Produit', relance.produit_principal));
  }
  if (relance.valeur_estimee && relance.valeur_estimee > 0) {
    meta.appendChild(makeMeta('Valeur estimée', formatMoney(relance.valeur_estimee), 'today-relance-meta-v--money'));
  }
  if (relance.date_creation && relance.date_creation.iso) {
    meta.appendChild(makeMeta('Créée', formatRelativeTime(relance.date_creation.iso)));
  }

  card.appendChild(meta);

  // ─── RAISON IA ───
  if (relance.raison_ia) {
    const reason = document.createElement('div');
    reason.className = 'today-relance-reason';
    reason.textContent = relance.raison_ia;
    card.appendChild(reason);
  }

  // ─── BLOC MESSAGE ───
  if (relance.message_suggere) {
    const block = document.createElement('div');
    block.className = 'today-relance-message-block';

    const title = document.createElement('div');
    title.className = 'today-relance-message-title';
    title.textContent = canalKey === 'appel'
      ? "Script d'appel :"
      : "Envoyez ce message :";
    block.appendChild(title);

    const body = document.createElement('div');
    body.className = 'today-relance-message-body';
    body.textContent = relance.message_suggere;  // textContent → safe (pas innerHTML)
    block.appendChild(body);

    card.appendChild(block);
  }

  // ─── ACTIONS ───
  const actions = document.createElement('div');
  actions.className = 'today-relance-actions';

  const isPending = !!state.pendingAction;
  const pendingKey = state.pendingAction || '';

  actions.appendChild(makeActionBtn({
    key: 'copy',
    className: 'btn-action btn-relance-copy',
    label: '📋 Copier',
    pendingLabel: '⏳ Copie...',
    isPending,
    pendingKey,
    onClick: () => callbacks.onCopy && callbacks.onCopy(relance)
  }));

  actions.appendChild(makeActionBtn({
    key: 'copy_and_called',
    className: 'btn-action btn-relance-copy-called',
    label: '📋 Copier + Traité',
    pendingLabel: '⏳ Traitement...',
    isPending,
    pendingKey,
    onClick: () => callbacks.onCopyAndCalled && callbacks.onCopyAndCalled(relance)
  }));

  // Visual separator before write-only actions
  const sep = document.createElement('span');
  sep.className = 'action-row-sep';
  actions.appendChild(sep);

  actions.appendChild(makeActionBtn({
    key: 'mark_called',
    className: 'btn-action btn-relance-called',
    label: '✓ Traité',
    pendingLabel: '⏳ ...',
    isPending,
    pendingKey,
    onClick: () => callbacks.onMarkCalled && callbacks.onMarkCalled(relance)
  }));

  actions.appendChild(makeActionBtn({
    key: 'mark_converted',
    className: 'btn-action btn-relance-converted',
    label: '✓ Converti',
    pendingLabel: '⏳ ...',
    isPending,
    pendingKey,
    onClick: () => callbacks.onMarkConverted && callbacks.onMarkConverted(relance)
  }));

  actions.appendChild(makeActionBtn({
    key: 'mark_lost',
    className: 'btn-action btn-relance-lost',
    label: '❌ Perdu',
    pendingLabel: '⏳ ...',
    isPending,
    pendingKey,
    onClick: () => callbacks.onMarkLost && callbacks.onMarkLost(relance)
  }));

  actions.appendChild(makeActionBtn({
    key: 'mark_ignored',
    className: 'btn-action btn-relance-ignored',
    label: 'Ignorer',
    pendingLabel: '⏳ ...',
    isPending,
    pendingKey,
    onClick: () => callbacks.onMarkIgnored && callbacks.onMarkIgnored(relance)
  }));

  card.appendChild(actions);

  return card;
}

// ─── Helpers internes ───

function makeMeta(label, value, extraClass = '') {
  const wrap = document.createElement('div');
  wrap.className = 'today-relance-meta-cell';
  const k = document.createElement('div');
  k.className = 'today-relance-meta-k';
  k.textContent = label;
  const v = document.createElement('div');
  v.className = `today-relance-meta-v ${extraClass}`.trim();
  v.textContent = value;
  wrap.appendChild(k);
  wrap.appendChild(v);
  return wrap;
}

function makeActionBtn({ key, className, label, pendingLabel, isPending, pendingKey, onClick }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.dataset.actionKey = key;
  if (isPending) {
    btn.disabled = true;
    btn.textContent = pendingKey === key ? pendingLabel : label;
  } else {
    btn.textContent = label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
  }
  return btn;
}
