// ─────────────────────────────────────────────
// PAGE HEALTH — Lot 7.2
// Sections: Funnel (sample 200) · Erreurs Sabrina · Signaux DETECTOR.
// Read-only by default; toggle buttons call /api/actions/error-resolve and
// /api/actions/signal-traite with optimistic UI + rollback.
// No auto-refresh — manual refresh button only.
// ─────────────────────────────────────────────

import { api } from '../lib/api.js';
import { renderEmptyState } from '../components/empty-state.js';
import { renderErrorBanner } from '../components/error-banner.js';
import { renderFunnelChart } from '../components/funnel-chart.js';
import { renderErrorRow } from '../components/error-row.js';
import { renderSignalRow } from '../components/signal-row.js';
import { toast } from '../components/toast.js';
import { openDrawerForConvo } from './clients.js';

let initialized = false;
let currentErrorFilter = 'false';   // 'false' | 'true' | 'all'
let currentSignalFilter = 'false';

let funnelTarget = null;
let errorListTarget = null;
let signalListTarget = null;
let errorCounterEl = null;
let signalCounterEl = null;
let lastFetchedEl = null;

export function initHealthPage() {
  if (initialized) return;
  initialized = true;

  const target = document.querySelector('#page-health .page-body');
  if (!target) return;

  target.replaceChildren();
  target.appendChild(renderToolbar());
  target.appendChild(renderFunnelSection());
  target.appendChild(renderErrorsSection());
  target.appendChild(renderSignalsSection());

  loadAll();
}

// ─────────────────────────────────────────────
// Toolbar (top right) — refresh + last fetched indicator
// ─────────────────────────────────────────────

function renderToolbar() {
  const bar = document.createElement('div');
  bar.className = 'health-toolbar';

  lastFetchedEl = document.createElement('span');
  lastFetchedEl.className = 'health-last-fetched';
  lastFetchedEl.textContent = '';
  bar.appendChild(lastFetchedEl);

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'btn-action btn-refresh';
  refreshBtn.textContent = '↻ Rafraîchir';
  refreshBtn.addEventListener('click', () => loadAll());
  bar.appendChild(refreshBtn);

  return bar;
}

// ─────────────────────────────────────────────
// Funnel section
// ─────────────────────────────────────────────

function renderFunnelSection() {
  const sec = document.createElement('section');
  sec.className = 'health-section health-section--funnel';

  const h = document.createElement('h2');
  h.className = 'health-section-title';
  h.textContent = 'Funnel des 200 dernières conversations';
  sec.appendChild(h);

  funnelTarget = document.createElement('div');
  funnelTarget.className = 'health-section-body';
  funnelTarget.appendChild(makeLoader('Chargement du funnel…'));
  sec.appendChild(funnelTarget);

  return sec;
}

// ─────────────────────────────────────────────
// Errors section
// ─────────────────────────────────────────────

function renderErrorsSection() {
  const sec = document.createElement('section');
  sec.className = 'health-section health-section--errors';

  const head = document.createElement('div');
  head.className = 'health-section-head';

  const h = document.createElement('h2');
  h.className = 'health-section-title';
  h.textContent = 'Erreurs Sabrina';
  head.appendChild(h);

  errorCounterEl = document.createElement('span');
  errorCounterEl.className = 'health-section-counter';
  errorCounterEl.textContent = '';
  head.appendChild(errorCounterEl);

  sec.appendChild(head);

  sec.appendChild(renderFilterToggle('errors', currentErrorFilter, (val) => {
    currentErrorFilter = val;
    loadErrors();
  }));

  errorListTarget = document.createElement('div');
  errorListTarget.className = 'health-section-body';
  errorListTarget.appendChild(makeLoader('Chargement des erreurs…'));
  sec.appendChild(errorListTarget);

  return sec;
}

// ─────────────────────────────────────────────
// Signals section
// ─────────────────────────────────────────────

function renderSignalsSection() {
  const sec = document.createElement('section');
  sec.className = 'health-section health-section--signals';

  const head = document.createElement('div');
  head.className = 'health-section-head';

  const h = document.createElement('h2');
  h.className = 'health-section-title';
  h.textContent = 'Signaux DETECTOR';
  head.appendChild(h);

  signalCounterEl = document.createElement('span');
  signalCounterEl.className = 'health-section-counter';
  signalCounterEl.textContent = '';
  head.appendChild(signalCounterEl);

  sec.appendChild(head);

  sec.appendChild(renderFilterToggle('signals', currentSignalFilter, (val) => {
    currentSignalFilter = val;
    loadSignals();
  }));

  signalListTarget = document.createElement('div');
  signalListTarget.className = 'health-section-body';
  signalListTarget.appendChild(makeLoader('Chargement des signaux…'));
  sec.appendChild(signalListTarget);

  return sec;
}

// ─────────────────────────────────────────────
// Filter toggle (3 buttons)
// ─────────────────────────────────────────────

function renderFilterToggle(scope, currentValue, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'health-filter-toggle';
  wrap.dataset.scope = scope;

  const options = [
    { value: 'false', label: 'Non traités' },
    { value: 'all',   label: 'Toutes' },
    { value: 'true',  label: 'Traités' }
  ];
  if (scope === 'errors') options[0].label = 'Non traitées';
  if (scope === 'errors') options[2].label = 'Traitées';

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'health-filter-btn' + (opt.value === currentValue ? ' health-filter-btn--active' : '');
    btn.dataset.value = opt.value;
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      // Update active state on siblings
      wrap.querySelectorAll('.health-filter-btn').forEach(b => b.classList.remove('health-filter-btn--active'));
      btn.classList.add('health-filter-btn--active');
      onChange(opt.value);
    });
    wrap.appendChild(btn);
  });

  return wrap;
}

// ─────────────────────────────────────────────
// Data loaders
// ─────────────────────────────────────────────

async function loadAll() {
  setLastFetchedText('Chargement…');
  funnelTarget.replaceChildren(makeLoader('Chargement du funnel…'));
  errorListTarget.replaceChildren(makeLoader('Chargement des erreurs…'));
  signalListTarget.replaceChildren(makeLoader('Chargement des signaux…'));
  errorCounterEl.textContent = '';
  signalCounterEl.textContent = '';

  await Promise.all([loadFunnel(), loadErrors(), loadSignals()]);

  const now = new Date();
  setLastFetchedText(`Sync OK ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);
}

async function loadFunnel() {
  let res;
  try {
    res = await api.getConvos({ limit: 200 });
  } catch {
    funnelTarget.replaceChildren(renderErrorBanner({
      message: 'Impossible de charger le funnel',
      detail: 'Erreur réseau.',
      onRetry: () => loadFunnel()
    }));
    return;
  }
  if (!res || res.ok === false) {
    funnelTarget.replaceChildren(renderErrorBanner({
      message: 'Impossible de charger le funnel',
      detail: res?.error || 'Erreur serveur.',
      onRetry: () => loadFunnel()
    }));
    return;
  }
  funnelTarget.replaceChildren(renderFunnelChart(res.data || []));
}

async function loadErrors() {
  errorListTarget.replaceChildren(makeLoader('Chargement des erreurs…'));
  errorCounterEl.textContent = '';

  // Map filter value → query param. 'all' = omit param (backend default is
  // 'false'), so we pass an explicit non-true/false value to disable the
  // server-side filter.
  const queryResolved =
    currentErrorFilter === 'true'  ? true  :
    currentErrorFilter === 'false' ? false :
                                     'all';

  let res;
  try {
    res = await api.getErrors({ resolved: queryResolved, limit: 200 });
  } catch {
    errorListTarget.replaceChildren(renderErrorBanner({
      message: 'Impossible de charger les erreurs',
      detail: 'Erreur réseau.',
      onRetry: () => loadErrors()
    }));
    return;
  }
  if (!res || res.ok === false) {
    errorListTarget.replaceChildren(renderErrorBanner({
      message: 'Impossible de charger les erreurs',
      detail: res?.error || 'Erreur serveur.',
      onRetry: () => loadErrors()
    }));
    return;
  }

  const data = Array.isArray(res.data) ? res.data : [];
  errorCounterEl.textContent = formatCounter(data.length, currentErrorFilter, 'errors');

  if (data.length === 0) {
    errorListTarget.replaceChildren(renderEmptyState({
      icon: '✓',
      title: emptyStateTitle('errors', currentErrorFilter),
      description: emptyStateDesc('errors', currentErrorFilter),
      tone: currentErrorFilter === 'false' ? 'success' : 'neutral'
    }));
    return;
  }

  const frag = document.createDocumentFragment();
  data.forEach(err => {
    frag.appendChild(renderErrorRow(err, {
      onToggleResolved: handleToggleErrorResolved,
      onViewConvo: handleViewErrorConvo
    }));
  });
  errorListTarget.replaceChildren(frag);
}

async function loadSignals() {
  signalListTarget.replaceChildren(makeLoader('Chargement des signaux…'));
  signalCounterEl.textContent = '';

  const queryTraite =
    currentSignalFilter === 'true'  ? true  :
    currentSignalFilter === 'false' ? false :
                                      'all';

  let res;
  try {
    res = await api.getSignals({ traite: queryTraite, limit: 200 });
  } catch {
    signalListTarget.replaceChildren(renderErrorBanner({
      message: 'Impossible de charger les signaux',
      detail: 'Erreur réseau.',
      onRetry: () => loadSignals()
    }));
    return;
  }
  if (!res || res.ok === false) {
    signalListTarget.replaceChildren(renderErrorBanner({
      message: 'Impossible de charger les signaux',
      detail: res?.error || 'Erreur serveur.',
      onRetry: () => loadSignals()
    }));
    return;
  }

  const data = Array.isArray(res.data) ? res.data : [];
  signalCounterEl.textContent = formatCounter(data.length, currentSignalFilter, 'signals');

  if (data.length === 0) {
    signalListTarget.replaceChildren(renderEmptyState({
      icon: '✓',
      title: emptyStateTitle('signals', currentSignalFilter),
      description: emptyStateDesc('signals', currentSignalFilter),
      tone: currentSignalFilter === 'false' ? 'success' : 'neutral'
    }));
    return;
  }

  const frag = document.createDocumentFragment();
  data.forEach(sig => {
    frag.appendChild(renderSignalRow(sig, {
      onToggleTraite: handleToggleSignalTraite,
      onViewConvo: handleViewSignalConvo
    }));
  });
  signalListTarget.replaceChildren(frag);
}

// ─────────────────────────────────────────────
// Toggle handlers — optimistic UI + rollback
// ─────────────────────────────────────────────

async function handleToggleErrorResolved(err, btn) {
  const newResolved = !err.resolved;
  const rowEl = btn.closest('.health-row');
  const parent = rowEl?.parentNode || null;
  const nextSibling = rowEl?.nextSibling || null;

  // Optimistic: remove the row if the new state doesn't match the active filter
  const willHide = (
    (currentErrorFilter === 'false' && newResolved === true) ||
    (currentErrorFilter === 'true' && newResolved === false)
  );

  if (willHide && rowEl) {
    rowEl.remove();
    decrementCounter(errorCounterEl, currentErrorFilter, 'errors');
  } else {
    btn.disabled = true;
    btn.textContent = '⏳ ...';
  }

  try {
    const res = await api.resolveError(err.id, newResolved);
    if (!res || res.ok === false) throw new Error(res?.error || 'Erreur serveur');

    err.resolved = newResolved;
    toast.success(newResolved ? 'Erreur marquée traitée' : 'Erreur ré-ouverte');

    if (!willHide) {
      btn.disabled = false;
      btn.className = newResolved
        ? 'btn-action btn-toggle-untreat'
        : 'btn-action btn-toggle-treat';
      btn.textContent = newResolved ? '↻ Marquer non-traité' : '✓ Marquer traité';
      rowEl?.classList.toggle('health-row--resolved', newResolved);
    }
  } catch (e) {
    // Rollback
    if (willHide && rowEl && parent) {
      parent.insertBefore(rowEl, nextSibling);
      incrementCounter(errorCounterEl, currentErrorFilter, 'errors');
    } else {
      btn.disabled = false;
      btn.textContent = err.resolved ? '↻ Marquer non-traité' : '✓ Marquer traité';
    }
    toast.error('Échec — réessaye');
  }
}

async function handleToggleSignalTraite(sig, btn) {
  const newTraite = !sig.traite;
  const rowEl = btn.closest('.health-row');
  const parent = rowEl?.parentNode || null;
  const nextSibling = rowEl?.nextSibling || null;

  const willHide = (
    (currentSignalFilter === 'false' && newTraite === true) ||
    (currentSignalFilter === 'true' && newTraite === false)
  );

  if (willHide && rowEl) {
    rowEl.remove();
    decrementCounter(signalCounterEl, currentSignalFilter, 'signals');
  } else {
    btn.disabled = true;
    btn.textContent = '⏳ ...';
  }

  try {
    const res = await api.traiteSignal(sig.id, newTraite);
    if (!res || res.ok === false) throw new Error(res?.error || 'Erreur serveur');

    sig.traite = newTraite;
    toast.success(newTraite ? 'Signal marqué traité' : 'Signal ré-ouvert');

    if (!willHide) {
      btn.disabled = false;
      btn.className = newTraite
        ? 'btn-action btn-toggle-untreat'
        : 'btn-action btn-toggle-treat';
      btn.textContent = newTraite ? '↻ Marquer non-traité' : '✓ Marquer traité';
      rowEl?.classList.toggle('health-row--resolved', newTraite);
    }
  } catch (e) {
    if (willHide && rowEl && parent) {
      parent.insertBefore(rowEl, nextSibling);
      incrementCounter(signalCounterEl, currentSignalFilter, 'signals');
    } else {
      btn.disabled = false;
      btn.textContent = sig.traite ? '↻ Marquer non-traité' : '✓ Marquer traité';
    }
    toast.error('Échec — réessaye');
  }
}

// ─────────────────────────────────────────────
// View convo handlers — open the read-only drawer
// ─────────────────────────────────────────────

function handleViewErrorConvo(err) {
  if (!err.conversationRecordId) return;
  openDrawerForConvo(err.conversationRecordId, { psid: err.psid });
}

function handleViewSignalConvo(sig) {
  if (sig.conversationRecordId) {
    openDrawerForConvo(sig.conversationRecordId, { psid: sig.psid });
  } else if (sig.psid) {
    // Fallback: signals always have psid; without conversation_record_id we
    // cannot open the convo by record id. Surface a toast so the user knows.
    toast.info('Aucune convo liée à ce signal.');
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeLoader(text) {
  const d = document.createElement('div');
  d.className = 'health-loader';
  d.textContent = text;
  return d;
}

function setLastFetchedText(text) {
  if (lastFetchedEl) lastFetchedEl.textContent = text;
}

function formatCounter(count, filter, scope) {
  const word = scope === 'errors'
    ? (filter === 'false' ? 'non traitée' : filter === 'true' ? 'traitée' : '')
    : (filter === 'false' ? 'non traité' : filter === 'true' ? 'traité' : '');
  if (filter === 'all') {
    return `${count} ${scope === 'errors' ? 'erreur' : 'signal'}${count !== 1 ? 's' : ''}`;
  }
  return `${count} ${word}${count !== 1 ? 's' : ''}`;
}

function decrementCounter(el, filter, scope) {
  if (!el) return;
  const m = el.textContent.match(/^(\d+)/);
  if (!m) return;
  const n = Math.max(0, parseInt(m[1], 10) - 1);
  el.textContent = formatCounter(n, filter, scope);
}

function incrementCounter(el, filter, scope) {
  if (!el) return;
  const m = el.textContent.match(/^(\d+)/);
  if (!m) return;
  const n = parseInt(m[1], 10) + 1;
  el.textContent = formatCounter(n, filter, scope);
}

function emptyStateTitle(scope, filter) {
  if (scope === 'errors') {
    if (filter === 'false') return 'Aucune erreur non traitée';
    if (filter === 'true') return 'Aucune erreur traitée';
    return 'Aucune erreur dans la base';
  }
  if (filter === 'false') return 'Aucun signal non traité';
  if (filter === 'true') return 'Aucun signal traité';
  return 'Aucun signal dans la base';
}

function emptyStateDesc(scope, filter) {
  if (scope === 'errors') {
    if (filter === 'false') return 'Sabrina tourne sans erreur — bon travail.';
    if (filter === 'true') return 'Aucune erreur n\'a encore été marquée traitée.';
    return 'La table tblErrors est vide.';
  }
  if (filter === 'false') return 'Tous les signaux DETECTOR sont à jour.';
  if (filter === 'true') return 'Aucun signal n\'a encore été marqué traité.';
  return 'Aucun signal dans la base SIGNAUX.';
}
