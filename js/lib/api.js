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
  
  getConvos(opts = {}) {
    return request('GET', '/data/convos', null, opts);
  },

  // Lot 6 — multi-field search (name, phone, psid, city). Case-insensitive substring.
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
  }
};

if (typeof window !== 'undefined') {
  window.api = api;
}
