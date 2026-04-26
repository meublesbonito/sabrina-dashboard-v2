// ─────────────────────────────────────────────
// API RESPONSE — Format JSON uniforme
// Toutes les réponses /api/data/* suivent ce shape
// ─────────────────────────────────────────────

/**
 * Réponse succès uniforme
 * @param {Response} res
 * @param {Array|Object} data
 * @param {Object} meta - { count, nextOffset }
 */
export function ok(res, data, meta = {}) {
  return res.status(200).json({
    ok: true,
    data: data ?? null,
    count: meta.count ?? (Array.isArray(data) ? data.length : null),
    fetched_at: new Date().toISOString(),
    nextOffset: meta.nextOffset ?? null
  });
}

/**
 * Réponse erreur uniforme
 * @param {Response} res
 * @param {number} status
 * @param {string} message - message générique pour le client
 */
export function fail(res, status, message) {
  return res.status(status).json({
    ok: false,
    error: message || 'Erreur serveur'
  });
}

/**
 * Wrapper try/catch standard pour endpoints
 * Log l'erreur côté serveur, retourne erreur générique au client
 * @param {string} endpointName
 * @param {Response} res
 * @param {Function} fn
 */
export async function safe(endpointName, res, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error(`[${endpointName}]`, err?.message || err);
    return fail(res, 500, 'Erreur serveur');
  }
}
