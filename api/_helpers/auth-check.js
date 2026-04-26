// ─────────────────────────────────────────────
// AUTH CHECK — Middleware obligatoire pour /api/data/*
// Sans session valide → 401 Unauthorized
// ─────────────────────────────────────────────

import { getSessionFromRequest } from './session.js';

/**
 * Vérifie que la requête a une session valide.
 * Si non : envoie 401 et retourne null.
 * Si oui : retourne l'objet session { user, exp }.
 *
 * Usage dans tous les endpoints /api/data/* :
 *   const session = requireAuth(req, res);
 *   if (!session) return; // 401 déjà envoyé
 *
 * @param {Request} req
 * @param {Response} res
 * @returns {Object|null} session payload ou null
 */
export function requireAuth(req, res) {
  const session = getSessionFromRequest(req);
  
  if (!session) {
    res.status(401).json({
      ok: false,
      error: 'Unauthorized'
    });
    return null;
  }
  
  return session;
}
