// ─────────────────────────────────────────────
// PAGE CLIENTS — Lot 6 (search + drawer) + Lot 8.3 (sort + filters + Load More)
// Read-only browsing. The drawer reuses /api/data/convo + signals + Lot 6.2 AI
// + Lot 8.1 Stop/Reactivate, none of which are touched by this page.
// ─────────────────────────────────────────────

import { api } from '../lib/api.js';
import { renderClientCard } from '../components/client-card.js';
import { renderEmptyState } from '../components/empty-state.js';
import { renderErrorBanner } from '../components/error-banner.js';
import { openDrawer, setDrawerBody, setDrawerFooter } from '../components/drawer.js';
import { renderClientInfoPanel, renderClientInfoFooter } from '../components/client-info-panel.js';

// ─── Filter & sort options ───
const FILTER_OPTIONS = [
  { key: 'all',                label: 'Tous'              },
  { key: 'active',             label: 'Actifs'            },
  { key: 'human_only',         label: '🔇 Stop Sabrina'   },
  { key: 'with_cart',          label: 'Avec panier'       },
  { key: 'checkout_sent',      label: 'Checkout envoyé'   },
  { key: 'checkout_completed', label: 'Checkout complété' },
  { key: 'with_phone',         label: 'Avec téléphone'    }
];

const SORT_OPTIONS = [
  { key: 'recent',        label: 'Plus récent' },
  { key: 'oldest',        label: 'Plus ancien' },
  { key: 'cart_desc',     label: 'Plus gros panier' },
  { key: 'messages_desc', label: 'Plus actif' },
  { key: 'name_asc',      label: 'Nom A-Z' }
];

const PAGE_SIZE = 100;

// ─── Module state ───
let initialized = false;
let searchInput = null;
let sortSelect = null;
let filterChipsEl = null;
let listEl = null;
let statusEl = null;
let loadMoreBtn = null;
let loadMoreWrap = null;
let countLabel = null;

let currentSearch = '';
let currentSort = 'recent';
let currentFilter = 'all';
let currentOffset = null;        // Airtable continuation token
let totalLoaded = 0;
let debounceTimer = null;
let currentRequestId = 0;
let isLoading = false;

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────

export function initClientsPage() {
  if (initialized) return;
  initialized = true;

  const target = document.querySelector('#page-clients .page-body');
  if (!target) return;

  target.replaceChildren();
  target.appendChild(renderToolbar());
  target.appendChild(renderListContainer());

  loadFresh();
}

// ─────────────────────────────────────────────
// Toolbar — search + sort + filter chips
// ─────────────────────────────────────────────

function renderToolbar() {
  const bar = document.createElement('div');
  bar.className = 'clients-toolbar';

  // Row 1: search + sort
  const row1 = document.createElement('div');
  row1.className = 'clients-row1';

  searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'clients-search-input field-input';
  searchInput.placeholder = 'Rechercher par nom, téléphone, PSID, ville…';
  searchInput.autocomplete = 'off';
  searchInput.addEventListener('input', onSearchInput);
  row1.appendChild(searchInput);

  const sortLabel = document.createElement('label');
  sortLabel.className = 'clients-sort-label';
  sortLabel.textContent = 'Tri :';
  row1.appendChild(sortLabel);

  sortSelect = document.createElement('select');
  sortSelect.className = 'clients-sort field-input';
  SORT_OPTIONS.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.key;
    opt.textContent = o.label;
    if (o.key === currentSort) opt.selected = true;
    sortSelect.appendChild(opt);
  });
  sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    loadFresh();
  });
  row1.appendChild(sortSelect);

  bar.appendChild(row1);

  // Row 2: filter chips
  filterChipsEl = document.createElement('div');
  filterChipsEl.className = 'clients-filter-chips';

  FILTER_OPTIONS.forEach(opt => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'clients-filter-chip' + (opt.key === currentFilter ? ' clients-filter-chip--active' : '');
    chip.dataset.value = opt.key;
    chip.textContent = opt.label;
    chip.addEventListener('click', () => {
      filterChipsEl.querySelectorAll('.clients-filter-chip').forEach(c => c.classList.remove('clients-filter-chip--active'));
      chip.classList.add('clients-filter-chip--active');
      currentFilter = opt.key;
      loadFresh();
    });
    filterChipsEl.appendChild(chip);
  });

  bar.appendChild(filterChipsEl);

  // Status row
  statusEl = document.createElement('div');
  statusEl.className = 'clients-status';
  statusEl.textContent = '';
  bar.appendChild(statusEl);

  return bar;
}

// ─────────────────────────────────────────────
// List container — list of cards + Load More
// ─────────────────────────────────────────────

function renderListContainer() {
  const wrap = document.createElement('div');
  wrap.className = 'clients-list-wrap';

  listEl = document.createElement('div');
  listEl.className = 'clients-list';
  wrap.appendChild(listEl);

  loadMoreWrap = document.createElement('div');
  loadMoreWrap.className = 'clients-load-more';
  loadMoreWrap.hidden = true;

  loadMoreBtn = document.createElement('button');
  loadMoreBtn.type = 'button';
  loadMoreBtn.className = 'btn-action btn-load-more';
  loadMoreBtn.textContent = 'Charger plus';
  loadMoreBtn.addEventListener('click', () => loadMore());
  loadMoreWrap.appendChild(loadMoreBtn);

  countLabel = document.createElement('div');
  countLabel.className = 'clients-count-label';
  countLabel.textContent = '';
  loadMoreWrap.appendChild(countLabel);

  wrap.appendChild(loadMoreWrap);
  return wrap;
}

// ─────────────────────────────────────────────
// Data loaders
// ─────────────────────────────────────────────

function onSearchInput() {
  if (debounceTimer) clearTimeout(debounceTimer);
  const q = searchInput.value.trim();
  debounceTimer = setTimeout(() => {
    currentSearch = q;
    loadFresh();
  }, 300);
}

/**
 * Reset the list and fetch the first page from scratch (called when sort/filter/search changes).
 */
async function loadFresh() {
  currentOffset = null;
  totalLoaded = 0;
  listEl.replaceChildren();
  loadMoreWrap.hidden = true;
  setStatus('Chargement…', 'loading');

  await fetchPage(/* append */ false);
}

/**
 * Fetch the next page using currentOffset and APPEND results to the list.
 */
async function loadMore() {
  if (isLoading || !currentOffset) return;
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = '⏳ Chargement…';
  await fetchPage(/* append */ true);
  loadMoreBtn.disabled = false;
  loadMoreBtn.textContent = 'Charger plus';
}

async function fetchPage(append) {
  const myId = ++currentRequestId;
  isLoading = true;

  const opts = {
    limit: PAGE_SIZE,
    sort: currentSort,
    filter: currentFilter
  };
  if (currentOffset) opts.offset = currentOffset;

  let res;
  try {
    if (currentSearch) {
      res = await api.searchConvos(currentSearch, opts);
    } else {
      res = await api.getConvos(opts);
    }
  } catch (err) {
    isLoading = false;
    if (myId !== currentRequestId) return;
    if (!append) renderError('Erreur réseau.');
    return;
  }

  isLoading = false;
  if (myId !== currentRequestId) return; // stale (a newer fetch superseded this one)

  if (!res || res.ok === false) {
    if (!append) renderError(res?.error || 'Erreur serveur.');
    return;
  }

  const data = Array.isArray(res.data) ? res.data : [];
  currentOffset = res.nextOffset || null;

  if (!append && data.length === 0) {
    setStatus('', 'idle');
    listEl.replaceChildren(renderEmptyState({
      icon: '🔍',
      title: currentSearch ? 'Aucun résultat' : 'Aucune conversation',
      description: currentSearch
        ? `Aucun client trouvé pour « ${currentSearch} »${currentFilter !== 'all' ? ` avec ce filtre` : ''}.`
        : currentFilter !== 'all'
          ? 'Aucun client ne correspond à ce filtre.'
          : 'La base ne contient aucune conversation pour l\'instant.',
      tone: 'neutral'
    }));
    loadMoreWrap.hidden = true;
    return;
  }

  // Append cards
  const frag = document.createDocumentFragment();
  data.forEach(convo => {
    frag.appendChild(renderClientCard(convo, (c) => openDrawerForConvo(c.id, c)));
  });
  listEl.appendChild(frag);

  totalLoaded += data.length;

  // Status line + Load More visibility
  const filterLabel = (FILTER_OPTIONS.find(f => f.key === currentFilter) || {}).label || '';
  const filterPart = currentFilter !== 'all' ? ` · filtre: ${filterLabel}` : '';
  const searchPart = currentSearch ? ` pour « ${currentSearch} »` : '';
  setStatus(
    `${totalLoaded} conversation${totalLoaded > 1 ? 's' : ''} chargée${totalLoaded > 1 ? 's' : ''}${searchPart}${filterPart}`,
    'idle'
  );

  if (currentOffset) {
    loadMoreWrap.hidden = false;
    countLabel.textContent = `${totalLoaded} conversation${totalLoaded > 1 ? 's' : ''} chargée${totalLoaded > 1 ? 's' : ''}`;
  } else {
    loadMoreWrap.hidden = true;
  }
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
    onRetry: () => loadFresh()
  }));
  loadMoreWrap.hidden = true;
}

// ─────────────────────────────────────────────
// Drawer integration (shared with Today via export)
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
