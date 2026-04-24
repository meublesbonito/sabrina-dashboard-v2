// ─────────────────────────────────────────────
// API: POST /api/auth/login
// ─────────────────────────────────────────────

import { setSessionCookie } from '../_helpers/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { user, password } = req.body || {};

  if (!user || !password) {
    return res.status(400).json({ error: 'user et password requis' });
  }

  // Vérifier user dans la liste
  const allowedUsers = (process.env.DASHBOARD_USERS || '')
    .split(',')
    .map(u => u.trim())
    .filter(Boolean);

  if (!allowedUsers.includes(user)) {
    return res.status(401).json({ error: 'Utilisateur inconnu' });
  }

  // Vérifier password
  const expectedPassword = process.env.DASHBOARD_PASSWORD;
  if (!expectedPassword) {
    return res.status(500).json({ error: 'DASHBOARD_PASSWORD non configuré' });
  }

  if (password !== expectedPassword) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }

  // Créer session
  setSessionCookie(res, user);
  return res.status(200).json({ success: true, user });
}
