// ─────────────────────────────────────────────
// API CLIENT — Frontend
// Wrapper simple pour fetch /api/data/*
// Pas de cache, pas de retry — KISS
// ─────────────────────────────────────────────

const BASE = '/api/data';

/**
 * Wrapper fetch avec gestion auth + erreurs.
 * @returns {Promise<{ok: boolean, data: any, count?: number, error?: string}>}
 */
async function request(path, query = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') {
      params.append(k, String(v));
    }
  }
  const qs = params.toString();
  const url = `${BASE}${path}${qs ? `?${qs}` : ''}`;
  
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });
  } catch (err) {
    return { ok: false, error: 'Erreur réseau', data: null };
  }
  
  // 401 = session expirée
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
  /**
   * Health-check : auth OK + Airtable OK
   */
  ping() {
    return request('/ping');
  },
  
  /**
   * Liste conversations (preview)
   * @param {Object} opts - { limit, traite_status }
   */
  getConvos(opts = {}) {
    return request('/convos', opts);
  },
  
  /**
   * Détail conversation complet
   * @param {string} id - rec...
   */
  getConvo(id) {
    return request('/convo', { id });
  },
  
  /**
   * Liste signaux
   * @param {Object} opts - { limit, traite }
   */
  getSignals(opts = {}) {
    return request('/signals', opts);
  },
  
  /**
   * Liste erreurs
   * @param {Object} opts - { limit, resolved }
   */
  getErrors(opts = {}) {
    return request('/errors', opts);
  }
};

// Expose globalement pour debug console
if (typeof window !== 'undefined') {
  window.api = api;
}
