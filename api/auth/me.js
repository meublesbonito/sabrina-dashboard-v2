// ─────────────────────────────────────────────
// API: GET /api/auth/me
// Retourne user si session valide
// Retourne availableUsers (toujours public)
// ─────────────────────────────────────────────

import { getSessionFromRequest } from '../_helpers/session.js';

export default async function handler(req, res) {
  const allowedUsers = (process.env.DASHBOARD_USERS || '')
    .split(',')
    .map(u => u.trim())
    .filter(Boolean);

  const session = getSessionFromRequest(req);

  if (!session) {
    // Pas connecté : on retourne juste la liste des users disponibles
    return res.status(401).json({
      authenticated: false,
      availableUsers: allowedUsers
    });
  }

  return res.status(200).json({
    authenticated: true,
    user: session.user,
    availableUsers: allowedUsers,
    expiresAt: session.exp
  });
}
