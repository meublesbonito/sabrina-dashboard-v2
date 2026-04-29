// ─────────────────────────────────────────────
// API CLIENT — Frontend
// Wrapper pour fetch /api/data/* et /api/actions/*
// ─────────────────────────────────────────────

const BASE = '/api';

async function request(method, path, body = null, query = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') {
      params.append(k, String(v));
    }
  }
  const qs = params.toString();
  const url = `${BASE}${path}${qs ? `?${qs}` : ''}`;
  
  const init = {
    method,
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  };
  
  if (body !== null) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  
  let response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    return { ok: false, error: 'Erreur réseau', data: null };
  }
  
  if (response.status === 401) {
    return { ok: false, error: 'Unauthorized', data: null, status: 401 };
  }
  
  let json = null;
  try {
    json = await response.json();
  } catch {
    return { ok: false, error: 'Réponse invalide', data: null };
  }
  
  return json;
}

export const api = {
  ping() {
    return request('GET', '/data/ping');
  },
  
  // Accepts: { limit, search, sort, filter, offset }
  //   sort   : 'recent' | 'oldest' | 'cart_desc' | 'messages_desc' | 'name_asc' (Lot 8.3)
  //   filter : 'all' | 'active' | 'human_only' | 'with_cart'
  //          | 'checkout_sent' | 'checkout_completed' | 'with_phone' (Lot 8.3)
  //   offset : Airtable pagination token from a previous response.nextOffset (Lot 8.3)
  getConvos(opts = {}) {
    return request('GET', '/data/convos', null, opts);
  },

  // Lot 6 — multi-field search (name, phone, psid, city). Case-insensitive substring.
  // Accepts the same Lot 8.3 options as getConvos (sort, filter, offset).
  searchConvos(query, opts = {}) {
    return request('GET', '/data/convos', null, { search: query, ...opts });
  },

  getConvo(id) {
    return request('GET', '/data/convo', null, { id });
  },

  // Lot 6 — getSignals accepts opts.psid for drawer-scoped filtering
  getSignals(opts = {}) {
    return request('GET', '/data/signals', null, opts);
  },
  
  getErrors(opts = {}) {
    return request('GET', '/data/errors', null, opts);
  },
  
  updateAction(id, payload) {
    return request('POST', '/actions/update', { id, ...payload });
  },

  // Lot 6.2 — Suggest one operational action via OpenAI for a single conversation
  suggestAction(id) {
    return request('POST', '/ai/suggest-action', { id });
  },

  // Lot 7.2 — Toggle resolved flag on a single tblErrors record
  resolveError(id, resolved) {
    return request('POST', '/actions/error-resolve', { id, resolved });
  },

  // Lot 7.2 — Toggle traité flag on a single SIGNAUX record
  traiteSignal(id, traite) {
    return request('POST', '/actions/signal-traite', { id, traite });
  },

  // Lot 8.1 — Set the Sabrina dispatcher status on a single conversation.
  // Allowed values: 'active' | 'human_only'.
  // Co-located on /api/data/convo (PATCH method) to stay under the Vercel
  // Hobby 12-functions limit; previously a dedicated /api/actions/dispatch-control.
  setDispatch(id, status) {
    return request('PATCH', '/data/convo', { id, status });
  },

  // RELANCES — Today section "Actions à effectuer maintenant"
  // Lecture co-localisée sur /api/data/convos (?source=relances) pour rester à 12 endpoints.
  getRelances() {
    return request('GET', '/data/convos', null, { source: 'relances' });
  },

  // RELANCES — Update statut.
  // Action ∈ { 'mark_called', 'mark_converted', 'mark_lost', 'mark_ignored' }
  // Co-localisé sur /api/actions/update (target='relance') pour rester à 12 endpoints.
  // Seul le champ `statut` est modifié côté Airtable (allowlist stricte côté serveur).
  updateRelance(id, action) {
    return request('POST', '/actions/update', { target: 'relance', id, action });
  }
};

if (typeof window !== 'undefined') {
  window.api = api;
}
