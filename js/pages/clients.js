// ─────────────────────────────────────────────
// PAGE CLIENTS — Lot 6
// Search bar + list of clients + click → drawer with full record
// Read-only. No write endpoints touched.
// ─────────────────────────────────────────────

import { api } from '../lib/api.js';
import { renderClientCard } from '../components/client-card.js';
import { renderEmptyState } from '../components/empty-state.js';
import { renderErrorBanner } from '../components/error-banner.js';
import { openDrawer, setDrawerBody, setDrawerFooter } from '../components/drawer.js';
import { renderClientInfoPanel, renderClientInfoFooter } from '../components/client-info-panel.js';

let initialized = false;
let searchInput = null;
let listEl = null;
let statusEl = null;
let abortCtl = null;
let debounceTimer = null;
let currentRequestId = 0;

export function initClientsPage() {
  if (initialized) return;
  initialized = true;

  const target = document.querySelector('#page-clients .page-body');
  if (!target) return;

  target.replaceChildren();

  // Search bar
  const bar = document.createElement('div');
  bar.className = 'clients-searchbar';

  searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'clients-search-input field-input';
  searchInput.placeholder = 'Rechercher par nom, téléphone, PSID, ville…';
  searchInput.autocomplete = 'off';
  searchInput.addEventListener('input', onSearchInput);
  bar.appendChild(searchInput);

  statusEl = document.createElement('div');
  statusEl.className = 'clients-status';
  statusEl.textContent = '';
  bar.appendChild(statusEl);

  target.appendChild(bar);

  // List
  listEl = document.createElement('div');
  listEl.className = 'clients-list';
  target.appendChild(listEl);

  // Initial load — 100 most recent
  loadAndRender('');
}

function onSearchInput() {
  if (debounceTimer) clearTimeout(debounceTimer);
  const q = searchInput.value.trim();
  debounceTimer = setTimeout(() => loadAndRender(q), 300);
}

async function loadAndRender(query) {
  const myId = ++currentRequestId;
  if (abortCtl) {
    try { abortCtl.abort(); } catch {}
  }
  abortCtl = (typeof AbortController !== 'undefined') ? new AbortController() : null;

  setStatus('Chargement…', 'loading');
  listEl.replaceChildren();

  let res;
  try {
    if (query) {
      res = await api.searchConvos(query, { limit: 100 });
    } else {
      res = await api.getConvos({ limit: 100 });
    }
  } catch (err) {
    if (myId !== currentRequestId) return;
    renderError('Erreur réseau.');
    return;
  }

  if (myId !== currentRequestId) return; // stale

  if (!res || res.ok === false) {
    renderError(res?.error || 'Erreur serveur.');
    return;
  }

  const data = Array.isArray(res.data) ? res.data : [];

  if (data.length === 0) {
    setStatus('', 'idle');
    listEl.appendChild(renderEmptyState({
      icon: '🔍',
      title: query ? 'Aucun résultat' : 'Aucune conversation',
      description: query
        ? `Aucun client trouvé pour « ${query} ».`
        : 'La base ne contient aucune conversation pour l\'instant.',
      tone: 'neutral'
    }));
    return;
  }

  setStatus(query
    ? `${data.length} résultat${data.length > 1 ? 's' : ''} pour « ${query} »`
    : `${data.length} dernière${data.length > 1 ? 's' : ''} conversation${data.length > 1 ? 's' : ''}`,
    'idle');

  const frag = document.createDocumentFragment();
  data.forEach(convo => {
    frag.appendChild(renderClientCard(convo, (c) => openDrawerForConvo(c.id, c)));
  });
  listEl.appendChild(frag);
}

function setStatus(text, mode) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = `clients-status clients-status--${mode}`;
}

function renderError(message) {
  setStatus('', 'idle');
  listEl.replaceChildren(renderErrorBanner({
    message: 'Impossible de charger les clients',
    detail: message,
    onRetry: () => loadAndRender(searchInput.value.trim())
  }));
}

// ─────────────────────────────────────────────
// Drawer integration (shared with Today)
// ─────────────────────────────────────────────

/**
 * Opens drawer with a loader, then fetches /api/data/convo + /api/data/signals
 * and renders client info panel.
 *
 * @param {string} id - record id (recXXX)
 * @param {Object} [stub] - optional list-row stub used for initial drawer title
 */
export async function openDrawerForConvo(id, stub) {
  const title = stub
    ? (stub.customer_name
       || [stub.fb_first_name, stub.fb_last_name].filter(Boolean).join(' ')
       || `Client #${String(stub.psid || '').slice(-4) || '????'}`)
    : 'Chargement…';

  const loader = document.createElement('div');
  loader.className = 'drawer-loader';
  loader.textContent = 'Chargement de la conversation…';

  openDrawer({ title, body: loader });

  try {
    const [convoRes, signalsRes] = await Promise.all([
      api.getConvo(id),
      stub?.psid ? api.getSignals({ psid: stub.psid, limit: 50 }) : Promise.resolve({ ok: true, data: [] })
    ]);

    if (!convoRes || convoRes.ok === false) {
      const err = document.createElement('div');
      err.className = 'drawer-error';
      err.textContent = convoRes?.error || 'Conversation introuvable.';
      setDrawerBody(err);
      setDrawerFooter(null);
      return;
    }

    const convo = convoRes.data || {};

    // If stub didn't have psid (Today path always has it; Clients path might not), fetch signals now
    let signals = (signalsRes && signalsRes.ok && Array.isArray(signalsRes.data)) ? signalsRes.data : [];
    if ((!stub || !stub.psid) && convo.psid) {
      try {
        const r = await api.getSignals({ psid: convo.psid, limit: 50 });
        if (r && r.ok && Array.isArray(r.data)) signals = r.data;
      } catch {}
    }

    setDrawerBody(renderClientInfoPanel(convo, signals));
    setDrawerFooter(renderClientInfoFooter(convo));
  } catch (err) {
    const e = document.createElement('div');
    e.className = 'drawer-error';
    e.textContent = 'Erreur réseau.';
    setDrawerBody(e);
    setDrawerFooter(null);
  }
}
